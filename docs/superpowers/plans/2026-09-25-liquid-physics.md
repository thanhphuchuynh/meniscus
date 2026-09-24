# Liquid Physics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moving `interactive` glass squashes and wobbles, and a new `ripple` prop gives glass a damped-wave liquid surface whose slopes bend the refraction and the light in WebGL.

**Architecture:**
- A pure `RippleField` (CPU, damped wave equation on a masked grid) belongs to each rippling glass and is registered by element.
- The existing `GlassStage` and `MediaLayer` frame loops advance it and pass it to `GlassRenderer`. The renderer uploads heights into an `R16F` texture array, and the fragment shader adds `slope × thickness × (1 − 1/n)` to the refraction offset and tilts the lighting normal.
- A `useLiquidMotion` hook tracks the element from press to rest. It drives an area-preserving squash `transform` and feeds drops, trails and acceleration into the field.

**Tech Stack:** TypeScript, React 18/19, WebGL2 (GLSL ES 3.00), Vitest + jsdom, Playwright (Chromium, WebKit).

**Spec:** `docs/superpowers/specs/2026-09-25-liquid-physics-design.md`

## Global Constraints

- No new runtime dependencies.
- Every browser keeps a working path. WebGL failure, unreadable media or reduced transparency fall back exactly as in 0.2.0, with ripples silently off.
- `prefers-reduced-motion`: no squash, no ripple field.
- No cost at rest: a calm field is never stepped or uploaded, and the shader skips it (`u_wave.w = 0`), so calm glass renders pixel-identical to 0.2.0.
- Wave speed 300 px/s, damping 4 s⁻¹, cell 2.5 px, max 128 cells a side, step `min(1/240 s, 0.5·cell/c)`, elapsed capped at 50 ms per advance.
- Sleep below 0.02 px height and 1 px/s velocity.
- Squash: `s = 0.15·tanh(max(0, |v| − 100) / 1800)`, springs stiffness 260 and damping 14, matrix determinant 1. Applied only when the element's computed `transform` is `none` at gesture start. Restored exactly at rest.
- Commits carry no `Co-Authored-By` trailer.
- Keep the Opticks copy voice in site text.

## Review Focus

1. **A tap inside a scaled ancestor** should land under the finger. Local coordinates divide out the element's on-screen scale. Test: Task 3, "lands a tap under the finger inside a scaled container".
2. **Resizing a glass mid-wave** (responsive layout, rotation) should reset the field without out-of-range writes or uploads. Test: Task 1, "flattens on resize…". Browser check: Task 4, upload after resize.
3. **Turning `ripple` off mid-wave** should unregister the field and return Chromium to live SVG refraction. Test: Task 3, "draws over media in WebGL even where live refraction works" (the rerender half).
4. **A touch drag cancelled by the browser (`pointercancel`)** should end the gesture and restore the element's transform. Test: Task 2, "stops tracking when the pointer is cancelled".
5. **Rapid repeated taps, fast strokes and long frames** (background tab) should keep the surface finite and bounded. Test: Task 1, "stays finite through irregular frames and rapid input".

---

### Task 1: Ripple simulation core

**Files:**
- Create: `packages/meniscus/src/core/ripple.ts`
- Create: `packages/meniscus/test/ripple.test.ts`
- Modify: `packages/meniscus/src/core/index.ts` (export the type)

**Interfaces:**
- Produces:
  - Constants: `RIPPLE_SPEED = 300`, `RIPPLE_DAMPING = 4`, `RIPPLE_CELL = 2.5`, `RIPPLE_MAX = 128`.
  - `class RippleField` with these members:
    - `cols: number`, `rows: number`, `heights: Float32Array` (row-major from the top left, layout px), `active: boolean`, `version: number`
    - `resize(width, height, radius): void`
    - `drop(x, y, strength = 1): void`
    - `stroke(x0, y0, x1, y1, speed): void`
    - `accelerate(ax, ay): void`
    - `advance(now: number /* ms */): boolean`

- [ ] **Step 1: Write the failing tests**

`packages/meniscus/test/ripple.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RIPPLE_SPEED, RippleField } from '../src/core/ripple';

/** Runs the field at 60 fps from `from` ms for `seconds`; returns the last timestamp. */
function run(field: RippleField, seconds: number, from = 0): number {
  let t = from;
  field.advance(t);
  const end = from + seconds * 1000;
  while (t < end) {
    t = Math.min(end, t + 1000 / 60);
    field.advance(t);
  }
  return t;
}

const at = (f: RippleField, i: number, j: number) => f.heights[j * f.cols + i]!;

function maxSlope(f: RippleField, width: number, height: number): number {
  const dx = width / f.cols;
  const dy = height / f.rows;
  let m = 0;
  for (let j = 1; j < f.rows - 1; j++) {
    for (let i = 1; i < f.cols - 1; i++) {
      const sx = (at(f, i + 1, j) - at(f, i - 1, j)) / (2 * dx);
      const sy = (at(f, i, j + 1) - at(f, i, j - 1)) / (2 * dy);
      m = Math.max(m, Math.hypot(sx, sy));
    }
  }
  return m;
}

describe('RippleField', () => {
  it('lays a grid of 2.5 px cells, at most 128 a side', () => {
    const f = new RippleField();
    f.resize(220, 100, 50);
    expect([f.cols, f.rows]).toEqual([88, 40]);
    f.resize(1000, 10, 5);
    expect([f.cols, f.rows]).toEqual([128, 8]);
  });

  it('sends a tap out as a ring at the wave speed', () => {
    const f = new RippleField();
    f.resize(320, 320, 0);
    f.drop(160, 160);
    run(f, 0.25);
    const row = f.rows / 2;
    let peak = 0;
    let where = 0;
    for (let i = f.cols / 2 + 8; i < f.cols - 1; i++) {
      const v = Math.abs(at(f, i, row));
      if (v > peak) {
        peak = v;
        where = i;
      }
    }
    const radius = (where + 0.5) * (320 / f.cols) - 160;
    expect(radius).toBeGreaterThan(RIPPLE_SPEED * 0.25 * 0.75);
    expect(radius).toBeLessThan(RIPPLE_SPEED * 0.25 * 1.05);
  });

  it('keeps the surface outside the rim still', () => {
    const f = new RippleField();
    f.resize(200, 200, 100);
    f.drop(30, 100);
    let t = 0;
    f.advance(t);
    for (let k = 0; k < 90; k++) {
      f.advance((t += 16));
      expect(at(f, 2, 2)).toBe(0);
      expect(at(f, f.cols - 3, f.rows - 3)).toBe(0);
    }
  });

  it('falls asleep, flat, within 3 s of a tap', () => {
    const f = new RippleField();
    f.resize(220, 220, 110);
    f.drop(110, 110);
    run(f, 3);
    expect(f.active).toBe(false);
    expect(f.heights.every((h) => h === 0)).toBe(true);
    const version = f.version;
    run(f, 0.5, 3000);
    expect(f.version).toBe(version);
  });

  it('peaks near slope 0.35 after a tap', () => {
    const f = new RippleField();
    f.resize(220, 220, 110);
    f.drop(110, 110);
    let peak = 0;
    let t = 0;
    f.advance(t);
    for (let k = 0; k < 40; k++) {
      f.advance((t += 1000 / 60));
      peak = Math.max(peak, maxSlope(f, 220, 220));
    }
    expect(peak).toBeGreaterThan(0.28);
    expect(peak).toBeLessThan(0.42);
  });

  it('sloshes against the rim when the glass stops, leading side up', () => {
    const f = new RippleField();
    f.resize(220, 220, 110);
    let t = 0;
    f.advance(t);
    // Moving right at 1000 px/s, stopped over three frames.
    for (let k = 0; k < 3; k++) {
      f.accelerate(-20000, 0);
      f.advance((t += 1000 / 60));
    }
    let peak = 0;
    for (let k = 0; k < 30; k++) {
      f.advance((t += 1000 / 60));
      peak = Math.max(peak, maxSlope(f, 220, 220));
    }
    expect(peak).toBeGreaterThan(0.12);
    expect(peak).toBeLessThan(0.3);
    const j = f.rows / 2;
    let row = 0;
    for (let i = 1; i < f.cols / 2; i++) {
      expect(at(f, i, j) + at(f, f.cols - 1 - i, j)).toBeCloseTo(0, 6);
      row = Math.max(row, Math.abs(at(f, i, j)));
    }
    expect(row).toBeGreaterThan(0.01);
  });

  it('wakes for a real jolt, not for jitter', () => {
    const f = new RippleField();
    f.resize(100, 100, 50);
    f.accelerate(100, 0);
    expect(f.active).toBe(false);
    f.accelerate(5000, 0);
    expect(f.active).toBe(true);
  });

  it('stays finite through irregular frames and rapid input', () => {
    const f = new RippleField();
    f.resize(180, 120, 40);
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let t = 0;
    for (let k = 0; k < 10000; k++) {
      t += rand() < 0.02 ? 200 : rand() * 34;
      const r = rand();
      if (r < 0.05) f.drop(rand() * 180, rand() * 120, rand() * 2);
      else if (r < 0.1) f.stroke(rand() * 180, rand() * 120, rand() * 180, rand() * 120, rand() * 4000);
      else if (r < 0.2) f.accelerate((rand() - 0.5) * 80000, (rand() - 0.5) * 80000);
      f.advance(t);
    }
    let peak = 0;
    for (const h of f.heights) {
      expect(Number.isFinite(h)).toBe(true);
      peak = Math.max(peak, Math.abs(h));
    }
    expect(peak).toBeLessThan(40);
  });

  it('draws a trail as strong as the finger is fast, and nothing for a still finger', () => {
    const make = () => {
      const f = new RippleField();
      f.resize(200, 100, 20);
      return f;
    };
    const slow = make();
    const fast = make();
    const still = make();
    slow.stroke(40, 50, 160, 50, 300);
    fast.stroke(40, 50, 160, 50, 1500);
    still.stroke(40, 50, 160, 50, 0);
    for (const f of [slow, fast, still]) run(f, 0.05);
    const energy = (f: RippleField) => f.heights.reduce((s, h) => s + h * h, 0);
    expect(still.active).toBe(false);
    expect(energy(fast)).toBeGreaterThan(energy(slow) * 4);
    expect(Math.abs(at(fast, fast.cols / 2, fast.rows / 2))).toBeGreaterThan(0);
    expect(at(fast, fast.cols / 2, 3)).toBe(0);
  });

  it('advances once per timestamp', () => {
    const make = () => {
      const f = new RippleField();
      f.resize(100, 100, 50);
      f.drop(50, 50);
      f.advance(0);
      return f;
    };
    const a = make();
    const b = make();
    a.advance(16);
    b.advance(16);
    b.advance(16);
    expect(Array.from(b.heights)).toEqual(Array.from(a.heights));
  });

  it('flattens on resize, and keeps its waves when the size is unchanged', () => {
    const f = new RippleField();
    f.resize(100, 100, 50);
    f.drop(50, 50);
    run(f, 0.1);
    f.resize(100, 100, 50);
    expect(f.active).toBe(true);
    f.resize(120, 100, 50);
    expect(f.active).toBe(false);
    expect([f.cols, f.rows]).toEqual([48, 40]);
    expect(f.heights.length).toBe(48 * 40);
    expect(f.heights.every((h) => h === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter meniscus exec vitest run test/ripple.test.ts`
Expected: FAIL, "Failed to resolve import ../src/core/ripple".

- [ ] **Step 3: Implement `RippleField`**

`packages/meniscus/src/core/ripple.ts`:

```ts
import { roundedRectSdf } from './shape';

/** How fast waves cross the glass, px/s. */
export const RIPPLE_SPEED = 300;
/** Velocity damping, 1/s: wave height halves about every 0.35 s. */
export const RIPPLE_DAMPING = 4;
/** Target cell size, px. Glass narrower than 20 px gets smaller cells and shorter steps. */
export const RIPPLE_CELL = 2.5;
/** Most cells along a side. The WebGL renderer's wave layers are this size. */
export const RIPPLE_MAX = 128;

const MIN_CELLS = 8;
const MAX_STEP = 1 / 240;
const MAX_ELAPSED = 0.05;
const SLEEP_HEIGHT = 0.02;
const SLEEP_SPEED = 1;
const DROP_SIGMA = 5;
/** Peak push of a strength-1 drop, px/s; calibrated so the first ring peaks near slope 0.35. */
const DROP_SPEED = 130;
const STROKE_SPEED = 1500;
/** Body-force gain, 1/px; calibrated so a 1000 px/s stop sloshes to about slope 0.2. */
const SLOSH = 0.002;
const MAX_ACCELERATION = 30000;
const WAKE_ACCELERATION = 200;

const clampAcceleration = (v: number) => (Number.isFinite(v) ? Math.max(-MAX_ACCELERATION, Math.min(MAX_ACCELERATION, v)) : 0);

/**
 * A liquid surface over a glass: heights on a grid, moved by the damped wave
 * equation. Cells outside the glass's rounded outline stay at zero, so waves
 * reflect off its real shape and fade out at the edge. It sleeps, flat, when
 * calm and wakes on input.
 */
export class RippleField {
  cols = 0;
  rows = 0;
  /** Surface height per cell, px, row by row from the top left. */
  heights = new Float32Array(0);
  /** Whether the surface is moving. A sleeping field is flat. */
  active = false;
  /** Bumped whenever `heights` changes. */
  version = 0;
  private width = -1;
  private height = -1;
  private radius = -1;
  private dx = 1;
  private dy = 1;
  private step = MAX_STEP;
  private velocities = new Float32Array(0);
  private interior = new Int32Array(0);
  private last: number | null = null;
  private carry = 0;
  private ax = 0;
  private ay = 0;

  /** Lays the grid over a glass of this size, px, and flattens it. An unchanged size keeps the waves. */
  resize(width: number, height: number, radius: number): void {
    if (width === this.width && height === this.height && radius === this.radius) return;
    this.width = width;
    this.height = height;
    this.radius = radius;
    const cells = (length: number) => Math.min(RIPPLE_MAX, Math.max(MIN_CELLS, Math.floor(length / RIPPLE_CELL)));
    const cols = width > 0 && height > 0 ? cells(width) : 0;
    const rows = cols ? cells(height) : 0;
    this.cols = cols;
    this.rows = rows;
    this.dx = cols ? width / cols : 1;
    this.dy = rows ? height / rows : 1;
    // Courant number at most 0.5 for any cell size.
    this.step = Math.min(MAX_STEP, (0.5 * Math.min(this.dx, this.dy)) / RIPPLE_SPEED);
    this.heights = new Float32Array(cols * rows);
    this.velocities = new Float32Array(cols * rows);
    // The outermost ring stays at zero too, so every moving cell has four neighbours in the grid.
    const inside: number[] = [];
    for (let j = 1; j < rows - 1; j++) {
      for (let i = 1; i < cols - 1; i++) {
        if (roundedRectSdf((i + 0.5) * this.dx, (j + 0.5) * this.dy, width, height, radius).distance < 0) inside.push(j * cols + i);
      }
    }
    this.interior = Int32Array.from(inside);
    this.active = false;
    this.carry = 0;
    this.ax = 0;
    this.ay = 0;
    this.version++;
  }

  /** A bead of liquid dropped at (x, y), px from the glass's top left: pressing pushes the surface down. */
  drop(x: number, y: number, strength = 1): void {
    if (!this.cols || !(strength > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const reach = 3 * DROP_SIGMA;
    const i0 = Math.max(1, Math.floor((x - reach) / this.dx));
    const i1 = Math.min(this.cols - 2, Math.ceil((x + reach) / this.dx));
    const j0 = Math.max(1, Math.floor((y - reach) / this.dy));
    const j1 = Math.min(this.rows - 2, Math.ceil((y + reach) / this.dy));
    const push = -DROP_SPEED * strength;
    const falloff = 1 / (2 * DROP_SIGMA * DROP_SIGMA);
    for (let j = j0; j <= j1; j++) {
      const py = (j + 0.5) * this.dy - y;
      for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) * this.dx - x;
        this.velocities[j * this.cols + i]! += push * Math.exp(-(px * px + py * py) * falloff);
      }
    }
    this.active = true;
  }

  /** A finger drawn from (x0, y0) to (x1, y1) at `speed` px/s, relative to the glass: a ridge along the way. */
  stroke(x0: number, y0: number, x1: number, y1: number, speed: number): void {
    const strength = Math.min(1, speed / STROKE_SPEED) * 0.5;
    if (!this.cols || !(strength > 0)) return;
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (!Number.isFinite(length)) return;
    const n = Math.max(1, Math.ceil(length / Math.min(this.dx, this.dy)));
    // Beads a cell apart overlap into a ridge about as tall as one bead of this strength.
    const each = strength * Math.min(1, length / n / (DROP_SIGMA * Math.sqrt(2 * Math.PI)));
    for (let k = 1; k <= n; k++) this.drop(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, each);
  }

  /** The glass's acceleration, px/s², for the next `advance`: the liquid tilts against it. */
  accelerate(ax: number, ay: number): void {
    this.ax = clampAcceleration(ax);
    this.ay = clampAcceleration(ay);
    if (this.cols && Math.hypot(this.ax, this.ay) > WAKE_ACCELERATION) this.active = true;
  }

  /** Moves the surface on to `now`, ms. Returns whether the heights changed. Repeating a timestamp does nothing. */
  advance(now: number): boolean {
    const from = this.last ?? now;
    this.last = now;
    if (!this.active) return false;
    this.carry += Math.min(MAX_ELAPSED, Math.max(0, (now - from) / 1000));
    if (this.carry < this.step) return false;
    while (this.carry >= this.step) {
      this.integrate();
      this.carry -= this.step;
    }
    this.ax = 0;
    this.ay = 0;
    this.version++;
    if (this.calm()) {
      this.heights.fill(0);
      this.velocities.fill(0);
      this.active = false;
      this.carry = 0;
    }
    return true;
  }

  /** One step of symplectic Euler on h_tt = c²∇²h − γh_t + force. */
  private integrate(): void {
    const { heights: h, velocities: v, interior, cols } = this;
    const dt = this.step;
    const cx = (RIPPLE_SPEED * RIPPLE_SPEED) / (this.dx * this.dx);
    const cy = (RIPPLE_SPEED * RIPPLE_SPEED) / (this.dy * this.dy);
    const decay = Math.exp(-RIPPLE_DAMPING * dt);
    const forced = this.ax !== 0 || this.ay !== 0;
    const kx = -SLOSH * this.ax;
    const ky = -SLOSH * this.ay;
    const mx = this.width / 2;
    const my = this.height / 2;
    for (let n = 0; n < interior.length; n++) {
      const k = interior[n]!;
      const c = h[k]!;
      let a = cx * (h[k - 1]! + h[k + 1]! - 2 * c) + cy * (h[k - cols]! + h[k + cols]! - 2 * c);
      if (forced) {
        const i = k % cols;
        const j = (k - i) / cols;
        a += kx * ((i + 0.5) * this.dx - mx) + ky * ((j + 0.5) * this.dy - my);
      }
      v[k] = (v[k]! + dt * a) * decay;
    }
    for (let n = 0; n < interior.length; n++) {
      const k = interior[n]!;
      h[k] = h[k]! + dt * v[k]!;
    }
  }

  private calm(): boolean {
    const { heights: h, velocities: v, interior } = this;
    for (let n = 0; n < interior.length; n++) {
      const k = interior[n]!;
      if (Math.abs(h[k]!) >= SLEEP_HEIGHT || Math.abs(v[k]!) >= SLEEP_SPEED) return false;
    }
    return true;
  }
}
```

In `packages/meniscus/src/core/index.ts`, add:

```ts
export type { RippleField } from './ripple';
```

- [ ] **Step 4: Run the tests. Calibrate `DROP_SPEED` and `SLOSH` if the two calibration tests miss**

Run: `pnpm --filter meniscus exec vitest run test/ripple.test.ts`
Expected: all pass. If "peaks near slope 0.35" fails, scale `DROP_SPEED` by `0.35 / measured` (the response is linear). If the slosh peak misses `[0.12, 0.3]`, scale `SLOSH` by `0.2 / measured`. Print `measured` with a temporary `console.log` in the test and remove it afterwards. Re-run until green. Never widen a range to pass.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/core/ripple.ts packages/meniscus/src/core/index.ts packages/meniscus/test/ripple.test.ts
git commit -m "feat(core): add damped-wave ripple field"
```

---

### Task 2: Squash and the motion tracker

**Files:**
- Create: `packages/meniscus/src/react/liquid.ts`
- Create: `packages/meniscus/test/liquid.test.tsx`
- Modify: `packages/meniscus/src/react/interaction.ts:5` (`class Spring` becomes `export class Spring`)

**Interfaces:**
- Consumes: `RippleField` (Task 1). `Spring(rest, stiffness, damping)` from `interaction.ts`, with `value`, `target`, `step(dt)`, `settled` and `reset()`.
- Produces:
  - `MAX_SQUASH = 0.15`
  - `squashTarget(vx, vy): [number, number]`
  - `squashMatrix(a, b): [m11, m12, m21, m22]`
  - `rippleOf(el): RippleField | undefined`
  - `registerRipple(el, field): () => void`
  - `warnUndrawnRipple(): void`
  - `useLiquidMotion(node, { squash, ripple, reducedMotion }): void`

- [ ] **Step 1: Write the failing tests**

`packages/meniscus/test/liquid.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Glass } from '../src';
import { MAX_SQUASH, squashMatrix, squashTarget } from '../src/react/liquid';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

/** A screen box the test moves; the element reports it as its rect. */
function movable(el: HTMLElement, box = { left: 100, top: 100, width: 200, height: 200 }) {
  el.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => box }) as DOMRect;
  return box;
}

let frames: FrameRequestCallback[] = [];
let now = 1000;
let reduced = false;
function frame(count = 1) {
  for (let i = 0; i < count && frames.length; i++) {
    const run = frames;
    frames = [];
    now += 16;
    for (const f of run) f(now);
  }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    frames.push(f);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduced-motion'), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
});

afterEach(() => {
  cleanup();
  frames = [];
  reduced = false;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('squash', () => {
  it('stretches along the velocity, shrinks across it, and keeps the area', () => {
    for (const [vx, vy] of [[1200, 0], [0, -800], [900, 900], [-300, 1700]] as const) {
      const [m11, m12, m21, m22] = squashMatrix(...squashTarget(vx, vy));
      expect(m11 * m22 - m12 * m21).toBeCloseTo(1, 9);
      const len = Math.hypot(vx, vy);
      const ux = vx / len;
      const uy = vy / len;
      const px = m11 * ux + m12 * uy;
      const py = m21 * ux + m22 * uy;
      expect(Math.hypot(px, py)).toBeGreaterThan(1);
      expect(px * uy - py * ux).toBeCloseTo(0, 9);
      const qx = m11 * -uy + m12 * ux;
      const qy = m21 * -uy + m22 * ux;
      expect(Math.hypot(qx, qy)).toBeLessThan(1);
    }
  });

  it('rests at the identity, ignores creeping motion, and stays within about 16%', () => {
    expect(squashMatrix(...squashTarget(0, 0))).toEqual([1, 0, 0, 1]);
    expect(squashTarget(60, 0)).toEqual([0, 0]);
    const [m11] = squashMatrix(...squashTarget(1e6, 0));
    expect(m11).toBeGreaterThan(1.15);
    expect(m11).toBeLessThanOrEqual(Math.sqrt((1 + MAX_SQUASH) / (1 - MAX_SQUASH)) + 1e-9);
  });
});

describe('a moving interactive glass', () => {
  function drag(el: HTMLElement, box: { left: number }, steps: number) {
    act(() => {
      fireEvent.pointerDown(el, { pointerId: 1, clientX: 200, clientY: 200 });
      frame();
      for (let k = 0; k < steps; k++) {
        box.left += 20;
        frame();
      }
    });
  }

  it('squashes while it moves and gives the transform back at rest', () => {
    mockSize(200, 200);
    const { getByTestId } = render(<Glass data-testid="g" interactive>x</Glass>);
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 6);
    expect(el.style.transform).toMatch(/^matrix\(/);
    const m11 = Number(el.style.transform.slice(7).split(',')[0]);
    expect(m11).toBeGreaterThan(1.01);
    act(() => {
      fireEvent.pointerUp(el, { pointerId: 1 });
      frame(200);
    });
    expect(el.style.transform).toBe('');
  });

  it('never squashes a glass that does not move', () => {
    mockSize(200, 200);
    const { getByTestId } = render(<Glass data-testid="g" interactive>x</Glass>);
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 0);
    act(() => frame(10));
    expect(el.style.transform).toBe('');
  });

  it('leaves a glass the app transforms alone', () => {
    mockSize(200, 200);
    const { getByTestId } = render(
      <Glass data-testid="g" interactive style={{ transform: 'rotate(4deg)' }}>
        x
      </Glass>,
    );
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 6);
    expect(el.style.transform).toBe('rotate(4deg)');
  });

  it('stops tracking when the pointer is cancelled mid-drag', () => {
    mockSize(200, 200);
    const { getByTestId } = render(<Glass data-testid="g" interactive>x</Glass>);
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 4);
    act(() => {
      fireEvent.pointerCancel(el, { pointerId: 1 });
      frame(200);
    });
    expect(el.style.transform).toBe('');
  });

  it('does nothing under reduced motion', () => {
    reduced = true;
    mockSize(200, 200);
    const { getByTestId } = render(<Glass data-testid="g" interactive>x</Glass>);
    const el = getByTestId('g');
    const box = movable(el);
    drag(el, box, 6);
    expect(el.style.transform).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter meniscus exec vitest run test/liquid.test.tsx`
Expected: FAIL, "Failed to resolve import ../src/react/liquid".

- [ ] **Step 3: Export `Spring` and implement `liquid.ts`**

In `packages/meniscus/src/react/interaction.ts`, change `class Spring {` to `export class Spring {`.

`packages/meniscus/src/react/liquid.ts`:

```ts
import { useEffect } from 'react';
import type { RippleField } from '../core/ripple';
import { DEV } from './dev';
import { Spring } from './interaction';

/** Most a moving glass stretches: 0.15 is about 16% along its path, area kept. */
export const MAX_SQUASH = 0.15;
/** Speeds below this don't squash, so a press's own small pull never does. */
const SQUASH_FLOOR = 100;
const SQUASH_SPEED = 1800;
const MAX_ACCELERATION = 30000;
const REST_FRAMES = 6;
const RELEASE_MS = 2000;
const TRAIL_SPEED = 30;

const fields = new WeakMap<HTMLElement, RippleField>();

/** The liquid surface a rippling glass registered for its element, for the renderer that draws it. */
export function rippleOf(el: HTMLElement): RippleField | undefined {
  return fields.get(el);
}

export function registerRipple(el: HTMLElement, field: RippleField): () => void {
  fields.set(el, field);
  return () => {
    if (fields.get(el) === field) fields.delete(el);
  };
}

let warned = false;
/** Development hint, once a page: `ripple` was asked for where nothing can draw it. */
export function warnUndrawnRipple(): void {
  if (!DEV || warned) return;
  warned = true;
  console.warn('meniscus: `ripple` needs WebGL to draw its waves. Give the glass an image, video or canvas `backdrop`, or place it in a GlassStage as a GlassPane.');
}

/**
 * The stretch a velocity asks for, as (s·cos 2θ, s·sin 2θ): doubling the
 * angle makes opposite directions the same stretch, with no wrap-around.
 */
export function squashTarget(vx: number, vy: number): [number, number] {
  const speed = Math.hypot(vx, vy);
  const over = speed - SQUASH_FLOOR;
  if (!(over > 0)) return [0, 0];
  const s = MAX_SQUASH * Math.tanh(over / SQUASH_SPEED);
  const c = vx / speed;
  const n = vy / speed;
  return [s * (c * c - n * n), s * 2 * c * n];
}

/** The area-preserving 2D matrix [m11, m12, m21, m22] for the stretch (a, b). */
export function squashMatrix(a: number, b: number): [number, number, number, number] {
  const k = 1 / Math.sqrt(Math.max(1e-3, 1 - a * a - b * b));
  return [(1 + a) * k, b * k, b * k, (1 - a) * k];
}

const clamp = (v: number) => Math.max(-MAX_ACCELERATION, Math.min(MAX_ACCELERATION, v));

function transformed(el: HTMLElement): boolean {
  const t = getComputedStyle(el).transform;
  return !!t && t !== 'none';
}

export interface LiquidMotionOptions {
  /** Squash along the path and wobble at a stop. */
  squash: boolean;
  /** A surface to drop beads, draw trails and slosh on. */
  ripple: RippleField | null;
  reducedMotion: boolean;
}

/**
 * Liquid response to motion. From a press until the glass comes to rest, it
 * follows the element on screen: the glass squashes along its path and
 * wobbles as it stops, and a rippling glass takes beads, trails and the
 * slosh of its own acceleration. Glass that never moves is left alone, and
 * a glass the app transforms keeps its transform.
 */
export function useLiquidMotion(node: HTMLElement | null, { squash, ripple, reducedMotion }: LiquidMotionOptions): void {
  useEffect(() => {
    if (!node || reducedMotion || (!squash && !ripple)) return;
    const a = new Spring(0, 260, 14);
    const b = new Spring(0, 260, 14);
    let frame = 0;
    let pointerId: number | null = null;
    let releasedAt = 0;
    let last: { x: number; y: number; t: number } | null = null;
    let vx = 0;
    let vy = 0;
    let ax = 0;
    let ay = 0;
    let still = 0;
    let owned = false;
    let inline = '';
    let trail: { x: number; y: number; t: number } | null = null;

    const local = (clientX: number, clientY: number) => {
      const r = node.getBoundingClientRect();
      const sx = node.offsetWidth ? r.width / node.offsetWidth : 1;
      const sy = node.offsetHeight ? r.height / node.offsetHeight : 1;
      return { x: (clientX - r.left) / sx, y: (clientY - r.top) / sy };
    };

    const finish = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = null;
      vx = vy = ax = ay = 0;
      still = 0;
      a.reset();
      b.reset();
      if (owned) node.style.transform = inline;
      owned = false;
    };

    const tick = (now: number) => {
      frame = 0;
      const r = node.getBoundingClientRect();
      const x = r.left + r.width / 2 + window.scrollX;
      const y = r.top + r.height / 2 + window.scrollY;
      let dt = 1 / 60;
      let moved = 0;
      if (last) {
        dt = Math.min(1 / 30, Math.max(1 / 240, (now - last.t) / 1000));
        const nvx = vx + 0.5 * ((x - last.x) / dt - vx);
        const nvy = vy + 0.5 * ((y - last.y) / dt - vy);
        ax = clamp(ax + 0.5 * ((nvx - vx) / dt - ax));
        ay = clamp(ay + 0.5 * ((nvy - vy) / dt - ay));
        vx = nvx;
        vy = nvy;
        moved = Math.hypot(x - last.x, y - last.y);
      }
      last = { x, y, t: now };
      ripple?.accelerate(ax, ay);
      if (owned) {
        [a.target, b.target] = squashTarget(vx, vy);
        a.step(dt);
        b.step(dt);
        const resting = a.settled && b.settled && Math.abs(a.value) < 1e-4 && Math.abs(b.value) < 1e-4;
        if (resting) {
          node.style.transform = inline;
        } else {
          const [m11, m12, m21, m22] = squashMatrix(a.value, b.value);
          node.style.transform = `matrix(${m11.toFixed(4)}, ${m21.toFixed(4)}, ${m12.toFixed(4)}, ${m22.toFixed(4)}, 0, 0)`;
        }
      }
      still = moved < 0.1 ? still + 1 : 0;
      if (pointerId === null && ((still >= REST_FRAMES && a.settled && b.settled) || now - releasedAt > RELEASE_MS)) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || pointerId !== null) return;
      pointerId = e.pointerId;
      if (!frame) {
        // Decided once a gesture, before any squash of ours is on the element.
        owned = squash && !transformed(node);
        inline = node.style.transform;
        frame = requestAnimationFrame(tick);
      }
      if (ripple) {
        const p = local(e.clientX, e.clientY);
        ripple.drop(p.x, p.y);
        trail = { ...p, t: e.timeStamp };
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!ripple || e.pointerId !== pointerId || !trail) return;
      const p = local(e.clientX, e.clientY);
      const dt = Math.max(0.004, (e.timeStamp - trail.t) / 1000);
      const speed = Math.hypot(p.x - trail.x, p.y - trail.y) / dt;
      // A glass dragged along with the finger has nothing moving across it.
      if (speed > TRAIL_SPEED && Math.hypot(vx, vy) < speed * 0.25) ripple.stroke(trail.x, trail.y, p.x, p.y, speed);
      trail = { ...p, t: e.timeStamp };
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      trail = null;
      releasedAt = performance.now();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!ripple || e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
      ripple.drop(node.offsetWidth / 2, node.offsetHeight / 2);
    };

    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('keydown', onKey);
    // Releases can land anywhere once the pointer leaves the glass.
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      finish();
    };
  }, [node, squash, ripple, reducedMotion]);
}
```

Wire the squash into `Glass` now; ripple wiring comes in Task 3. In `packages/meniscus/src/react/Glass.tsx`, import `useLiquidMotion` from `./liquid`. After `const handlers = useLiquidInteraction(ref, interactive && !disabled, reducedMotion);` add:

```ts
  useLiquidMotion(node, { squash: interactive && !disabled, ripple: null, reducedMotion });
```

- [ ] **Step 4: Run the tests to verify they pass, then the whole suite**

Run: `pnpm --filter meniscus exec vitest run test/liquid.test.tsx && pnpm --filter meniscus test`
Expected: all pass, including the 80 existing tests. The existing interaction regressions for `scale` and `translate` must be unaffected.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/liquid.ts packages/meniscus/src/react/interaction.ts packages/meniscus/src/react/Glass.tsx packages/meniscus/test/liquid.test.tsx
git commit -m "feat: squash moving interactive glass along its path"
```

---

### Task 3: `ripple` on Glass and GlassPane

**Files:**
- Modify: `packages/meniscus/src/react/Glass.tsx` (prop, field lifecycle, fallback preference, warning)
- Modify: `packages/meniscus/src/react/backdrop.ts:52-70` (`useFallback` gains `preferWebGL`)
- Modify: `packages/meniscus/src/webgl/GlassStage.tsx` (`GlassPane` forwards `ripple` only when drawn)
- Test: `packages/meniscus/test/liquid.test.tsx` (append)

**Interfaces:**
- Consumes: `RippleField` (Task 1). `registerRipple`, `rippleOf`, `useLiquidMotion` and `warnUndrawnRipple` (Task 2).
- Produces: `GlassOwnProps.ripple?: boolean`. A rippling glass registers its `RippleField` under its element, resized to the resolved glass.

- [ ] **Step 1: Write the failing tests** (append to `liquid.test.tsx`; add the imports at the top of the file)

```tsx
import { useRef } from 'react';
import { overrideRefractionSupport, overrideWebGL2 } from '../src/core';
import { rippleOf } from '../src/react/liquid';

describe('ripple', () => {
  afterEach(() => {
    overrideRefractionSupport(undefined);
    overrideWebGL2(undefined);
  });

  function Photo({ ripple = true }: { ripple?: boolean }) {
    const img = useRef<HTMLImageElement>(null);
    return (
      <div>
        <img ref={img} alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
        <Glass data-testid="g" ripple={ripple} backdrop={img}>
          x
        </Glass>
      </div>
    );
  }

  it('warns once when nothing can draw the waves', () => {
    mockSize(100, 100);
    render(
      <>
        <Glass ripple>a</Glass>
        <Glass ripple>b</Glass>
      </>,
    );
    const calls = vi.mocked(console.warn).mock.calls.filter(([m]) => String(m).includes('`ripple` needs WebGL'));
    expect(calls.length).toBe(1);
  });

  it('draws over media in WebGL even where live refraction works, and goes back when turned off', () => {
    overrideRefractionSupport(true);
    overrideWebGL2(true);
    mockSize(160, 160);
    const { getByTestId, rerender } = render(<Photo />);
    const el = getByTestId('g');
    expect(el.dataset.meniscus).toBe('webgl');
    expect(rippleOf(el)?.cols).toBe(64);
    rerender(<Photo ripple={false} />);
    expect(el.dataset.meniscus).toBe('refract');
    expect(rippleOf(el)).toBeUndefined();
  });

  it('drops a bead at the center on Space', () => {
    overrideRefractionSupport(true);
    overrideWebGL2(true);
    mockSize(160, 160);
    const { getByTestId } = render(<Photo />);
    const el = getByTestId('g');
    const field = rippleOf(el)!;
    expect(field.active).toBe(false);
    fireEvent.keyDown(el, { key: ' ' });
    expect(field.active).toBe(true);
  });

  it('lands a tap under the finger inside a scaled container', () => {
    overrideRefractionSupport(true);
    overrideWebGL2(true);
    mockSize(160, 160);
    const { getByTestId } = render(<Photo />);
    const el = getByTestId('g');
    // Laid out 160 px wide, drawn twice that size by a scaled ancestor.
    movable(el, { left: 100, top: 100, width: 320, height: 320 });
    const field = rippleOf(el)!;
    act(() => {
      fireEvent.pointerDown(el, { pointerId: 1, clientX: 100 + 2 * 40, clientY: 100 + 2 * 120 });
    });
    field.advance(now);
    field.advance(now + 16);
    const cell = (x: number, y: number) => field.heights[Math.floor(y / (160 / field.rows)) * field.cols + Math.floor(x / (160 / field.cols))]!;
    expect(cell(40, 120)).not.toBe(0);
    expect(cell(120, 40)).toBe(0);
  });

  it('keeps still under reduced motion', () => {
    reduced = true;
    overrideRefractionSupport(true);
    overrideWebGL2(true);
    mockSize(160, 160);
    const { getByTestId } = render(<Photo />);
    const el = getByTestId('g');
    expect(el.dataset.meniscus).toBe('refract');
    expect(rippleOf(el)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter meniscus exec vitest run test/liquid.test.tsx`
Expected: the new tests FAIL (no `ripple` prop: `data-meniscus` is `refract`, `rippleOf` is undefined, no warning).

- [ ] **Step 3: Implement**

`backdrop.ts`, in `useFallback`:

```ts
export function useFallback(
  backdrop: Backdrop | undefined,
  host: HTMLElement | null,
  preference: RenderModePreference | undefined,
  mode: RenderMode,
  /** Waves need WebGL: take the media path even where live refraction works. */
  preferWebGL = false,
): { path: FallbackPath | null; element: HTMLElement | null; fail: () => void } {
  const reducedTransparency = useMediaQuery(REDUCED_TRANSPARENCY);
  const [state, setState] = useState<{ path: FallbackPath | null; element: HTMLElement | null }>({ path: null, element: null });
  // A path that failed (unreadable media, a lost context) is not tried again.
  const [failed, setFailed] = useState<FallbackPath | null>(null);
  const eligible = !!backdrop && (preference ?? 'auto') === 'auto' && (mode === 'frost' || (preferWebGL && mode === 'refract')) && !reducedTransparency;
  useIsomorphicLayoutEffect(() => {
    const element = eligible ? backdropElement(backdrop) : null;
    let path = pickFallback(element, host);
    // Live refraction already draws everything a copy would; only WebGL adds waves.
    if (path === 'element' && mode !== 'frost') path = null;
    if (path && path === failed) path = null;
    if (path !== state.path || (path ? element : null) !== state.element) setState({ path, element: path ? element : null });
  });
  const fail = useCallback(() => setFailed(state.path), [state.path]);
  return { ...state, fail };
}
```

`Glass.tsx`:

1. Imports: add `useEffect` to the React import. Add `import { RippleField } from '../core/ripple';` and `import { supportsWebGL2 } from '../core/support';`, merged into the existing support import. Add `import { isMediaElement } from '../webgl/media';`. Change the backdrop import to `import { backdropElement, useElementCopy, useFallback, type Backdrop } from './backdrop';`. Extend the liquid import to `import { registerRipple, useLiquidMotion, warnUndrawnRipple } from './liquid';`.
2. In `GlassOwnProps`, after `appear`:

```ts
  /**
   * A liquid surface: a tap rings it, a finger drawn across leaves a trail,
   * and moving the glass sloshes it. Waves bend what's behind and catch the
   * light. Needs WebGL: glass over an image, video or canvas `backdrop`
   * (which then draws in WebGL in every browser), or a `GlassPane` in a
   * `GlassStage`. Off under reduced motion.
   */
  ripple?: boolean;
```

3. Destructuring: `const { as, mode: modePreference, interactive = false, appear = false, ripple = false, backdrop, shadow, style, children, ...rest } = ...`.
4. Remove the Task 2 line `useLiquidMotion(node, { squash: interactive && !disabled, ripple: null, reducedMotion });`.
5. Replace `const fallback = useFallback(childless ? undefined : backdrop, node, modePreference, mode);` and the two `copying`/`webgl` lines after it with:

```ts
  const fallback = useFallback(childless ? undefined : backdrop, node, modePreference, mode, ripple && !reducedMotion);
  const copying = fallback.path === 'element';
  const webgl = fallback.path === 'webgl';
  // Only WebGL draws waves: this glass's own media layer, or a stage drawing it (mode none).
  const rippling = ripple && !reducedMotion && !group && !childless && (webgl || ownMode === 'none');
  const fieldRef = useRef<RippleField | null>(null);
  const field = rippling ? (fieldRef.current ??= new RippleField()) : null;
  useIsomorphicLayoutEffect(() => {
    if (field && g) field.resize(g.width, g.height, g.radius);
  }, [field, g?.width, g?.height, g?.radius]);
  useIsomorphicLayoutEffect(() => (field && node ? registerRipple(node, field) : undefined), [field, node]);
  useLiquidMotion(node, { squash: interactive && !disabled, ripple: disabled ? null : field, reducedMotion });
  useEffect(() => {
    if (!ripple || reducedMotion || group || ownMode === 'none') return;
    // Judged from the inputs, not the fallback state, which settles a render later.
    const media = backdropElement(backdrop);
    const drawable = !!media && isMediaElement(media) && supportsWebGL2() && (modePreference ?? 'auto') === 'auto' && !reducedTransparency;
    if (!drawable) warnUndrawnRipple();
  });
```

`GlassStage.tsx`, in `GlassPaneImpl`'s return:

```tsx
  return <Pane {...props} ref={setRef} shadow={shadow} mode={webgl ? 'none' : 'frost'} ripple={webgl ? props.ripple : false} data-meniscus-pane="" />;
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter meniscus test && pnpm --filter meniscus typecheck`
Expected: all pass. The existing `backdrop fallbacks` tests still pass, because `preferWebGL` defaults to false.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/Glass.tsx packages/meniscus/src/react/backdrop.ts packages/meniscus/src/webgl/GlassStage.tsx packages/meniscus/test/liquid.test.tsx
git commit -m "feat: add ripple prop to Glass and GlassPane"
```

---

### Task 4: Draw the waves in WebGL

**Files:**
- Modify: `packages/meniscus/src/webgl/renderer.ts` (texture array, `u_wave`, uploads, `PaneFrame.ripple`)
- Modify: `packages/meniscus/src/webgl/shaders.ts` (`waveSlope`, `Material`, `glassColor`)
- Modify: `packages/meniscus/src/webgl/GlassStage.tsx` (advance fields in the loop, add them to the signature and frames)
- Modify: `packages/meniscus/src/react/MediaLayer.tsx` (same, plus squash-aware placement)
- Modify: `apps/site/scripts/check-living-optics.mjs` (GPU ripple checks and perf log)

**Interfaces:**
- Consumes: `RippleField` and `RIPPLE_MAX` (Task 1), `rippleOf` (Task 2).
- Produces: `PaneFrame.ripple?: RippleField | null`. Renderer uniforms `u_waves` (texture unit 2) and `u_wave[MAX_PANES]`.

- [ ] **Step 1: Write the failing GPU check**

In `apps/site/scripts/check-living-optics.mjs`, inside the `page.evaluate` GPU block, add the import next to the others:

```js
    const { RippleField } = await import(`/@fs${root}packages/meniscus/src/core/ripple.ts`);
```

Then insert this immediately before `canvas.width = 240; canvas.height = 180;`:

```js
    // Waves: a calm field draws nothing extra, an excited one bends the image,
    // and once it sleeps the glass is exactly as before.
    const diff = (p, q) => { let d = 0; for (let i = 0; i < p.length; i++) d += Math.abs(p[i] - q[i]); return d; };
    const field = new RippleField(); field.resize(75, 72, 25);
    const rippled = panes.map((p, i) => ({ ...p, ripple: i === 0 ? field : null }));
    renderer.render(panes, 'fill', 1); const plain = pixels();
    renderer.render(rippled, 'fill', 1); const calm = pixels();
    field.drop(37, 36); for (let t = 0; t <= 96; t += 16) field.advance(t);
    renderer.render(rippled, 'fill', 1); const wavy = pixels();
    const waveError = gl.getError();
    for (let t = 112; t <= 5000; t += 16) field.advance(t);
    renderer.render(rippled, 'fill', 1); const slept = pixels();
    const waves = { calm: diff(plain, calm), wavy: diff(plain, wavy), slept: diff(plain, slept), asleep: !field.active, waveError };
    // Simulation cost: a full 128 × 128 grid, 60 frames of an active surface.
    const big = new RippleField(); big.resize(320, 320, 0); big.drop(160, 160);
    const costs = []; let clock = 0; big.advance(clock);
    for (let k = 0; k < 60; k++) { const s = performance.now(); big.advance((clock += 1000 / 60)); costs.push(performance.now() - s); }
    costs.sort((x, y) => x - y);
    const simMs = costs[30];
```

Add `waves, simMs` to the returned object, and after the existing GPU asserts:

```js
  assert.equal(gpu.waves.calm, 0, 'a calm field must not change the glass');
  assert.ok(gpu.waves.wavy > 2000, `waves must bend the image: ${JSON.stringify(gpu.waves)}`);
  assert.equal(gpu.waves.slept, 0, 'a sleeping field must leave the glass exactly as before');
  assert.ok(gpu.waves.asleep); assert.equal(gpu.waves.waveError, 0);
  assert.ok(gpu.simMs < 0.5, `ripple simulation budget: ${gpu.simMs} ms`);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter site dev --port 5173` in the background, then `MENISCUS_TEST_URL=http://127.0.0.1:5173/ node apps/site/scripts/check-living-optics.mjs`
Expected: FAIL on `waves must bend the image` (the renderer ignores `ripple`).

- [ ] **Step 3: Implement the renderer**

`renderer.ts`:

```ts
import { RIPPLE_MAX, type RippleField } from '../core/ripple';
```

In `PaneFrame`, add:

```ts
  /** A liquid surface over this pane, drawn while it moves. */
  ripple?: RippleField | null;
```

Fields: add `private waveTex: WebGLTexture;`, `private waveReady = false;` and `private waveBroken = false;`. Add `private waveUploads = Array.from({ length: MAX_PANES }, () => ({ field: null as RippleField | null, version: -1 }));` and add `wave: new Float32Array(MAX_PANES * 4),` to `arrays`.

Constructor: add `'u_waves', 'u_wave'` to the uniform name list. After the LUT texture setup, add:

```ts
    // Wave heights, one layer per pane. A 1 × 1 placeholder keeps the sampler
    // valid; the full array is allocated the first time something ripples.
    const waveTex = gl.createTexture();
    if (!waveTex) throw new Error('meniscus: could not create textures');
    this.waveTex = waveTex;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, waveTex);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R16F, 1, 1, 1, 0, gl.RED, gl.FLOAT, null);
    gl.activeTexture(gl.TEXTURE0);
```

Methods:

```ts
  /** Allocates the wave layers once. False if the GPU refused; glass then draws without waves. */
  private waves(): boolean {
    if (this.waveReady || this.waveBroken) return this.waveReady;
    const gl = this.gl;
    gl.getError();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.waveTex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R16F, RIPPLE_MAX, RIPPLE_MAX, MAX_PANES, 0, gl.RED, gl.FLOAT, null);
    gl.activeTexture(gl.TEXTURE0);
    this.waveReady = gl.getError() === gl.NO_ERROR;
    this.waveBroken = !this.waveReady;
    return this.waveReady;
  }

  private uploadWave(layer: number, field: RippleField): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.waveTex);
    // Typed-array uploads to 3D textures require both flags off.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, field.cols, field.rows, 1, gl.RED, gl.FLOAT, field.heights);
    gl.activeTexture(gl.TEXTURE0);
  }
```

In `render()`, inside the per-pane loop after `this.uploadProfile(...)`:

```ts
      const field = p.ripple;
      if (field && field.active && field.cols > 0 && this.waves()) {
        const slot = this.waveUploads[i]!;
        if (slot.field !== field || slot.version !== field.version) {
          this.uploadWave(i, field);
          slot.field = field;
          slot.version = field.version;
        }
        // Small-angle refraction: a surface tilted by slope s shifts the view s·T·(1 − 1/n).
        a.wave.set([g.thickness * (1 - 1 / g.ior) * pixelRatio, field.cols, field.rows, 1], o);
      } else {
        a.wave.set([0, 0, 0, 0], o);
      }
```

In the uniform setup after `gl.uniform4fv(u.u_misc!, a.misc);`:

```ts
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.waveTex);
    gl.uniform1i(u.u_waves!, 2);
    gl.uniform4fv(u.u_wave!, a.wave);
    gl.activeTexture(gl.TEXTURE0);
```

In `dispose()`, add `gl.deleteTexture(this.waveTex);`.

- [ ] **Step 4: Implement the shader**

`shaders.ts`: add `import { RIPPLE_MAX } from '../core/ripple';`. After the `uniform vec4 u_misc[MAX_PANES];` line, add:

```glsl
uniform mediump sampler2DArray u_waves; // liquid surface heights (layout px), one layer per pane
uniform vec4 u_wave[MAX_PANES];         // shift per unit slope (canvas px), cols, rows, on
```

Before `struct Material`, add:

```glsl
// Slope of pane i's liquid surface here, from central differences of its layer.
vec2 waveSlope(int i) {
  vec4 w = u_wave[i];
  if (w.w < 0.5) return vec2(0.0);
  vec4 rect = u_rect[i];
  vec2 cells = w.yz;
  vec2 at = (v_px - rect.xy) / rect.zw * cells;
  vec2 lo = vec2(0.5);
  vec2 hi = cells - 0.5;
  float layer = float(i);
  const float SIZE = ${glsl(RIPPLE_MAX)};
  float l = textureLod(u_waves, vec3(clamp(at - vec2(1.0, 0.0), lo, hi) / SIZE, layer), 0.0).r;
  float r = textureLod(u_waves, vec3(clamp(at + vec2(1.0, 0.0), lo, hi) / SIZE, layer), 0.0).r;
  float t = textureLod(u_waves, vec3(clamp(at - vec2(0.0, 1.0), lo, hi) / SIZE, layer), 0.0).r;
  float b = textureLod(u_waves, vec3(clamp(at + vec2(0.0, 1.0), lo, hi) / SIZE, layer), 0.0).r;
  // One cell in layout px: the rect is in canvas px and misc.w is the pixel ratio.
  vec2 cell = rect.zw / (cells * u_misc[i].w);
  return vec2(r - l, b - t) / (2.0 * cell);
}
```

In `struct Material`, after `float shade;`, add:

```glsl
  vec2 wave;        // liquid surface slope
  float waveDepth;  // shift per unit slope, canvas px
```

`paneMaterial` return becomes:

```glsl
  return Material(table.r * u_misc[i].w, table.g, u_shape[i].z, u_shape[i].w, u_misc[i].y, u_tint[i], u_light[i], u_misc[i].x, u_misc[i].z, waveSlope(i), u_wave[i].x);
```

In `glassColor`: `vec2 offset = -n * m.shift;` becomes `vec2 offset = -n * m.shift + m.wave * m.waveDepth;`, and `vec3 N = normalize(vec3(n * m.slope, 1.0));` becomes `vec3 N = normalize(vec3(n * m.slope - m.wave, 1.0));`.

In the merged branch: `Material m = Material(0.0, 0.0, 0.0, 0.0, 0.0, vec4(0.0), vec4(0.0), 0.0, 0.0, vec2(0.0), 0.0);`, and in the blend loop after `m.shade += w[i] * p.shade;`, add `m.wave += w[i] * p.wave;` and `m.waveDepth += w[i] * p.waveDepth;`.

- [ ] **Step 5: Advance fields in the stage and media loops**

`GlassStage.tsx`: import `rippleOf` from `'../react/liquid'`. Change `const loop = () => {` to `const loop = (now: number) => {`. In the pane loop, replace the `frames.push(...)` and `signature += ...` lines with:

```ts
        const ripple = rippleOf(el) ?? null;
        ripple?.advance(now);
        frames.push({ x, y, glass, tint: resolveTint(el, glass.tint), shadow: options.shadow === undefined, ripple });
        signature += `|${x.toFixed(2)},${y.toFixed(2)},${width.toFixed(2)},${height.toFixed(2)},${optionsKey(options)}${ripple ? `~${ripple.version}` : ''}`;
```

`MediaLayer.tsx`: import `rippleOf` from `'./liquid'`. Change `const loop = () => {` to `const loop = (now: number) => {`. Replace the block from `const hostRect = host.getBoundingClientRect();` through the `panes.push` loop with:

```ts
      const hostRect = host.getBoundingClientRect();
      // Divide out the glass's own squash (a centered matrix, area kept) so only
      // ancestor scale remains, and anchor at the center, which it never moves.
      const [ma, mb, mc, md] = ownMatrix(host);
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      const sx = w ? hostRect.width / (Math.abs(ma) * w + Math.abs(mc) * h) : 1;
      const sy = h ? hostRect.height / (Math.abs(mb) * w + Math.abs(md) * h) : 1;
      const left = hostRect.left + (hostRect.width - w * sx) / 2;
      const top = hostRect.top + (hostRect.height - h * sy) / 2;
      const pr = Math.min(maxPixelRatio, window.devicePixelRatio || 1);
      const { box } = f;
      const cw = Math.max(1, Math.round(box.width * pr));
      const ch = Math.max(1, Math.round(box.height * pr));
      // The media's drawn rect, from viewport px into the canvas's layout px.
      const m = mediaRect(media);
      const placement = {
        x: (m.x - left) / sx - host.clientLeft - box.x,
        y: (m.y - top) / sy - host.clientTop - box.y,
        width: m.width / sx,
        height: m.height / sy,
      };
      let waves = '';
      for (const p of f.panes) {
        const ripple = rippleOf(p.el);
        if (!ripple) continue;
        ripple.advance(now);
        waves += `~${ripple.version}`;
      }
      const key = `${f.key}|${tintVersion()}|${waves}|${box.x.toFixed(2)},${box.y.toFixed(2)},${cw}x${ch}|${placement.x.toFixed(2)},${placement.y.toFixed(2)},${placement.width.toFixed(2)},${placement.height.toFixed(2)}`;
      if (!live && key === last) return;
      last = key;

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      Object.assign(canvas.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`, visibility: 'visible' });
      panes.length = 0;
      for (const p of f.panes) panes.push({ x: p.x - box.x, y: p.y - box.y, glass: p.glass, tint: resolveTint(p.el, p.glass.tint), ripple: rippleOf(p.el) ?? null });
```

Then add this module-level helper at the bottom of `MediaLayer.tsx`:

```ts
/** The host's own inline matrix (the squash) as [a, b, c, d]; identity for anything else. */
function ownMatrix(el: HTMLElement): [number, number, number, number] {
  const m = /^matrix\(([^)]*)\)$/.exec(el.style.transform);
  const v = m ? m[1]!.split(',').map(Number) : [];
  return v.length === 6 && v.every(Number.isFinite) ? [v[0]!, v[1]!, v[2]!, v[3]!] : [1, 0, 0, 1];
}
```

- [ ] **Step 6: Run the checks**

Run: `pnpm --filter meniscus test && pnpm typecheck && MENISCUS_TEST_URL=http://127.0.0.1:5173/ node apps/site/scripts/check-living-optics.mjs`
Expected: unit tests and typecheck pass. The browser script prints `PASS` with `waves.calm === 0`, `waves.slept === 0`, `waves.wavy > 2000`, and `simMs < 0.5`.

- [ ] **Step 7: Commit**

```bash
git add packages/meniscus/src/webgl packages/meniscus/src/react/MediaLayer.tsx apps/site/scripts/check-living-optics.mjs
git commit -m "feat(webgl): refract and light liquid surfaces"
```

---

### Task 5: Demo, browser proof, Chromium transform check

**Files:**
- Modify: `apps/site/src/home/PlateSpecimen.tsx` (lens `ripple`, caption)
- Modify: `apps/site/src/home/PlateDepth.tsx` (panes `ripple`, copy)
- Modify: `apps/site/src/home/experiments.css:4` (panes receive pointer events)
- Modify: `apps/site/scripts/check-living-optics.mjs` (hero path, flick squash, tap waves, reduced motion)

**Interfaces:**
- Consumes: `ripple` on `Glass`/`GlassPane` (Task 3), the WebGL waves (Task 4) and the squash (Task 2).

- [ ] **Step 1: Write the failing browser checks**

In `check-living-optics.mjs`:

1. Right after the lens is located, assert the path: `assert.equal(await lens.getAttribute('data-meniscus'), 'webgl', 'a rippling lens over the engraving draws in WebGL');`.
2. After `const carried = ...` (the flick), assert the squash is on in flight: `assert.match(await lens.evaluate(el => el.style.transform), /^matrix\(/, 'a flung lens squashes');`.
3. Change the settle wait from `waitForTimeout(1800)` to `waitForTimeout(2400)`, which is longer than the 2 s squash cap. After the stable-style assert, add `assert.equal(await lens.evaluate(el => el.style.transform), '', 'squash gives the transform back');`.
4. After the index check (`/2\.42/`), add:

```js
  // A tap rings the lens: frames change, then the surface settles.
  const tapBox = await lens.boundingBox();
  await page.mouse.click(tapBox.x + tapBox.width * 0.62, tapBox.y + tapBox.height * 0.4);
  const ring1 = await lens.screenshot(); await page.waitForTimeout(90); const ring2 = await lens.screenshot();
  assert.ok(!ring1.equals(ring2), 'waves move across the lens');
  await page.waitForTimeout(3300);
  const rest1 = await lens.screenshot(); await page.waitForTimeout(300); const rest2 = await lens.screenshot();
  assert.ok(rest1.equals(rest2), 'the surface settles');
```

5. In the reduced-motion block, after the drag, add: `assert.equal(await lens.evaluate(el => el.style.transform), '', 'no squash under reduced motion');`.

- [ ] **Step 2: Run to verify it fails**

Run: `MENISCUS_TEST_URL=http://127.0.0.1:5173/ node apps/site/scripts/check-living-optics.mjs`
Expected: FAIL on `a rippling lens over the engraving draws in WebGL` (the lens has no `ripple` yet).

- [ ] **Step 3: Implement the demo**

`PlateSpecimen.tsx`: add `ripple` after `interactive` on the lens `Glass`. Replace the caption sentence `Flick the lens and let it settle. Change the index to bend the engraving’s lines; the section follows your pointer.` with `Flick the lens and it wobbles as it lands; tap it and ripples run across the glass, bending the engraving’s lines. Change the index to bend them further; the section follows your pointer.`

`PlateDepth.tsx`: add `ripple` to each `GlassPane`. Change the lead paragraph to `Move across the plate to separate three curved panes. Each bends the image, glass and soft shadows beneath it. Different indices, one beam of light. Tap a pane to ring it.`

`experiments.css` line 4: remove `pointer-events: none;` from `.depth__pane`. Pane events bubble to the stage, whose parallax handler keeps working.

- [ ] **Step 4: Run the browser checks, then look at the result**

Run: `MENISCUS_CAPTURE=1 MENISCUS_TEST_URL=http://127.0.0.1:5173/ node apps/site/scripts/check-living-optics.mjs`
Expected: `PASS`, no page errors.

Then run a scratchpad Playwright script (not committed):
- **Tap proof (Chromium):** tap the hero lens, take a full-page screenshot 120 ms later, crop the lens with PIL and view it. The engraving lines must visibly ripple inside the lens.
- **Refract + squash check (Chromium):** on the masthead glass (`[data-meniscus="refract"]`), set `el.style.transform = 'matrix(1.12, 0.06, 0.06, 0.9, 0, 0)'`, take a full unclipped screenshot, crop and view it. The refraction must follow the skewed outline. If it doesn't, restrict `squashTarget` on refract-path glass to axis-aligned stretches, as the spec's fallback says: pass the path into `useLiquidMotion` and zero `b` there. Add a unit test for that restriction.
- **WebKit tap:** the same tap flow in WebKit. The hero is WebGL there by default; view the screenshot.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/home/PlateSpecimen.tsx apps/site/src/home/PlateDepth.tsx apps/site/src/home/experiments.css apps/site/scripts/check-living-optics.mjs
git commit -m "feat(site): ring the hero lens and depth panes"
```

---

### Task 6: Documentation

**Files:**
- Modify: `packages/meniscus/README.md` (props table, Motion, Accessibility, Limits)
- Modify: `apps/site/src/docs/content.ts` (Glass props)
- Modify: `apps/site/src/components/Components.tsx` (Glass props table row)
- Modify: `CHANGELOG.md` (Unreleased)

- [ ] **Step 1: README**

Props table, after the `interactive` row:

```md
| `ripple` | `boolean` | `false` | A liquid surface: taps ring it, a finger drawn across leaves a trail, moving the glass sloshes it. Needs WebGL (see Motion) |
```

Change the `interactive` row's description to: `Lift on hover; swell on press with light blooming from the touch point; stretch toward the pointer; squash along its path while it moves`.

In Motion, after the "Press and hover." paragraph, add:

```md
**Wobble.** An `interactive` glass that moves, dragged or flung by your code, squashes along its path and jiggles as it stops. It is tracked from a press until it comes to rest, so glass that doesn't move is untouched. The squash is an area-preserving `transform`, applied only when the element has no `transform` of its own, and removed at rest.

**Ripples.** With `ripple`, the surface is liquid: a tap drops a bead and a ring spreads out, a finger drawn across the glass leaves a trail, and when the glass starts or stops the liquid sloshes against the rim. Space and Enter drop a bead at the center. Waves bend what is behind the glass by slope × thickness × (1 − 1/n), catch the light on their crests, bounce off the rim and die out in about two seconds. The simulation sleeps when the surface is calm, so resting glass costs nothing. Waves are drawn in WebGL: give the glass an image, video or canvas `backdrop` (it then draws in WebGL in every browser, Chromium included), or use a `GlassPane` in a `GlassStage`.
```

In Accessibility, change the reduced-motion bullet to: `Under prefers-reduced-motion, interactive glass keeps its glow but stops swelling, stretching, squashing and blooming; ripple is off; indicators jump with a short fade; appear fades.`

In Limits, add: `- Ripples need WebGL: over plain page content in Chromium, where live SVG refraction draws the glass, ripple does nothing (a development warning says so). Inside a GlassStage or GlassGroup, the drawn glass follows the element's bounding box, so a diagonal squash is approximated.`

- [ ] **Step 2: Manual and catalog**

`content.ts`, `GLASS_PROPS` (the array holding `interactive`):
- Change the `interactive` body to: `'Lift on hover, swell on press with light blooming from the touch point, stretch toward the pointer, glow where it touches. When the glass itself moves, it squashes along its path and wobbles as it stops. Keyboard presses animate too.'`
- After `appear`, add `{ name: 'ripple', type: 'boolean', default: 'false', body: 'A liquid surface: a tap rings it, a finger drawn across leaves a trail, and moving the glass sloshes it. Waves bend what is behind and catch the light, then die out. Drawn in WebGL: glass over an image, video or canvas backdrop (every browser, Chromium included), or a GlassPane in a GlassStage. Off under reduced motion.' },`.

`Components.tsx`, `glass` props list, after `appear`: `{ name: 'ripple', type: 'boolean', default: 'false', body: 'Liquid surface over a media backdrop or in a stage.' },`.

- [ ] **Step 3: CHANGELOG**

Under `## [Unreleased]`:

```md
### Added

- `ripple` on `Glass` and `GlassPane`: a damped-wave liquid surface. Taps ring it, fingers leave trails, and the glass sloshes when it starts or stops. Waves refract the backdrop and catch the light, in WebGL, and cost nothing at rest.

### Changed

- `interactive` glass that moves squashes along its path and wobbles as it stops.
- Glass with a media `backdrop` and `ripple` draws in WebGL in every browser, including Chromium.
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm --filter site build`
Expected: both succeed; the tokens check passes.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/README.md apps/site/src/docs/content.ts apps/site/src/components/Components.tsx CHANGELOG.md
git commit -m "docs: document ripple and moving-glass squash"
```

---

### Task 7: Whole-branch verification and review

- [ ] **Step 1:** Run `pnpm test && pnpm typecheck && pnpm build` from the repo root. All must pass; report the test count.
- [ ] **Step 2:** Run `MENISCUS_TEST_URL=http://127.0.0.1:5173/ node apps/site/scripts/check-living-optics.mjs` → `PASS`.
- [ ] **Step 3:** Dispatch one fresh reviewer on the most capable model over `git diff main...feat/liquid-physics`, with the spec and this plan. Fix the material findings, re-run steps 1–2, and commit the fixes.
- [ ] **Step 4:** Update this plan's checkboxes and add a short "Decisions and progress" note at the end: calibrated constants, the Chromium transform finding, and measured `simMs`. Commit.
