# Glass Stack and Layer Physics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Glass.Stack` and `Glass.Layer`: depth-ordered glass layers whose optics (presence, refraction, highlight, tint, shadow) move on independent springs, staggered by depth, and compound through the stack on the CSS and WebGL paths.

**Architecture:**
- **Portable core:**
  - `core/spring.ts`: one solver.
  - `core/physics.ts`: `GlassPhysics`, one spring per optical channel, a shared frame loop and `staggerDelay`.
- **React:**
  - `useGlassPhysics` owns an instance.
  - `Glass` gains `optics`: CSS variables plus the SVG filter scale, with no per-frame renders.
  - `GlassStack`/`GlassLayer` (`react/GlassStack.tsx`, with contexts in `react/stack.ts`) register layers, batch `present` changes per commit and stagger them.
- **WebGL compounding:** a control layer's `MediaLayer` renders every lower control layer plus itself in layered passes, clipped to its own shape (`RenderOptions.clip`, `PaneFrame.optics`).

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 18/19, WebGL2, Vitest + jsdom, Playwright (Chromium, WebKit).

**Spec:** `docs/superpowers/specs/2026-09-25-glass-stack-design.md`

## Global Constraints

- No new runtime dependencies.
- SSR-safe: no DOM or `requestAnimationFrame` access during render.
- `GlassPhysics` built without `requestAnimationFrame` is manual.
- Springs never re-render React. They write CSS custom properties, SVG attributes or GL uniforms.
- Reduced motion: targets apply instantly, delays and momentum are skipped, and squash and ripple stay off as before.
- At rest (`OPTICAL_REST`), a glass with `optics` renders like one without:
  - WebGL output is pixel-identical.
  - CSS shadow and tint expressions evaluate to the same values.
- Every public prop and type has JSDoc.
- Semantic props lead (`intensity`, `physics` presets), and raw options override them.
- Presets are `gentle` (1/120/20), `snappy` (1/300/30, the default), `bouncy` (1/260/14) and `stiff` (1/520/44).
- Channel stiffness multipliers are presence 1, refraction 1, highlight 2.5, tint 0.8 and shadow 0.55. The shadow's damping is also ×1.1.
- Stagger defaults to 0.12. The delay is rank × |stagger| × period, and deeper layers lag unless stagger is negative.
- Commits carry no `Co-Authored-By` trailer.

## Review Focus

1. **A layer whose `present` flips while its previous transition is still running (rapid Open/Close)** should reverse smoothly from where it is, without jumping. Test: Task 2, "lets a newer target replace a pending one"; Task 5, "reverses mid-transition without a jump".
2. **Unmounting a layer mid-transition, or unmounting the whole stack,** should stop the loop, drop pending targets and leave no stale `--meniscus-*` properties. Test: Task 4, "cleans up on unmount"; Task 5, "unregisters layers that leave mid-transition".
3. **`present={false}` layers must be unreachable** (keyboard focus, clicks and screen readers) while still in the DOM. Test: Task 5, "hides absent layers from the page".
4. **Glass nested inside a control layer** (a `GlassButton` in the modal) must not act as a stack layer. Test: Task 5, "keeps glass inside a layer out of the stack".
5. **An app's own opacity or shadow on a layer** must be kept: opacity composes with presence, and a custom shadow stays static. Test: Task 4, "composes the app's opacity" and "keeps a custom shadow".

---

### Task 1: One spring solver

**Files:**
- Create: `packages/meniscus/src/core/spring.ts`
- Create: `packages/meniscus/test/spring.test.ts`
- Modify: `packages/meniscus/src/react/interaction.ts` (its `Spring` extends the core one)
- Modify: `packages/meniscus/src/core/index.ts` (exports)

**Interfaces:**
- Produces:
  - `SpringConfig {mass?, stiffness?, damping?}`
  - `SPRINGS` and `SpringPreset`
  - `SpringInput = SpringConfig | SpringPreset`
  - `resolveSpring(input?) → Required<SpringConfig>`
  - `springPeriod(input?) → seconds`
  - `dampingRatio(input?)`
  - `class Spring(value = 0, config: SpringInput = 'snappy')` with `value`, `velocity`, `target`, `config`, `step(dt)`, `settled` and `snap()`
- `interaction.ts` keeps exporting `Spring(rest, stiffness = 420, damping = 24)` with `rest`, `atRest` and `reset()`, now as a subclass. `liquid.ts` is unchanged.

- [x] **Step 1: Write the failing tests** — `packages/meniscus/test/spring.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { SPRINGS, Spring, dampingRatio, resolveSpring, springPeriod, type SpringInput } from '../src/core/spring';

/** Seconds between two upward crossings of the target, released from 1 below it. */
function measuredPeriod(config: SpringInput): number {
  const s = new Spring(0, config);
  s.target = 1;
  const dt = 1 / 2000;
  const crossings: number[] = [];
  let prev = s.value - s.target;
  for (let t = 0; t < 5 && crossings.length < 3; t += dt) {
    s.step(dt);
    const now = s.value - s.target;
    if (prev < 0 && now >= 0) crossings.push(t);
    prev = now;
  }
  return crossings[2]! - crossings[1]!;
}

function peak(config: SpringInput): number {
  const s = new Spring(0, config);
  s.target = 1;
  let m = 0;
  for (let i = 0; i < 240; i++) {
    s.step(1 / 60);
    m = Math.max(m, s.value);
  }
  return m;
}

describe('Spring', () => {
  it('oscillates with the period it promises', () => {
    const config = { mass: 1, stiffness: 100, damping: 0 };
    expect(Math.abs(measuredPeriod(config) / springPeriod(config) - 1)).toBeLessThan(0.03);
  });

  it('is slower by √2 when twice as heavy', () => {
    const light = measuredPeriod({ mass: 1, stiffness: 100, damping: 0 });
    const heavy = measuredPeriod({ mass: 2, stiffness: 100, damping: 0 });
    expect(Math.abs(heavy / light / Math.SQRT2 - 1)).toBeLessThan(0.03);
  });

  it('overshoots when underdamped and not when near critical', () => {
    expect(peak('bouncy')).toBeGreaterThan(1.1);
    expect(peak('stiff')).toBeLessThan(1.005);
  });

  it('stays finite and settles through huge frames and extreme physics', () => {
    const s = new Spring(0, { mass: 0.01, stiffness: 1e6, damping: 1e4 });
    s.target = 5;
    for (let i = 0; i < 60; i++) {
      s.step(1);
      expect(Number.isFinite(s.value)).toBe(true);
    }
    expect(s.settled).toBe(true);
  });

  it('fills presets and partial physics, ignoring nonsense', () => {
    expect(resolveSpring()).toEqual(SPRINGS.snappy);
    expect(resolveSpring('gentle')).toEqual(SPRINGS.gentle);
    expect(resolveSpring({ stiffness: 500 })).toEqual({ mass: 1, stiffness: 500, damping: 30 });
    expect(resolveSpring({ mass: -1, stiffness: Number.NaN, damping: -3 })).toEqual(SPRINGS.snappy);
    expect(resolveSpring({ damping: 0 }).damping).toBe(0);
  });

  it('reports its period and damping ratio', () => {
    expect(springPeriod('snappy')).toBeCloseTo((2 * Math.PI) / Math.sqrt(300), 9);
    expect(dampingRatio('snappy')).toBeCloseTo(30 / (2 * Math.sqrt(300)), 9);
  });

  it('knows when it has settled, and snaps to its target', () => {
    const s = new Spring(0);
    expect(s.settled).toBe(true);
    s.target = 1;
    expect(s.settled).toBe(false);
    s.snap();
    expect([s.value, s.velocity, s.settled]).toEqual([1, 0, true]);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `pnpm --filter meniscus exec vitest run test/spring.test.ts`
Expected: FAIL, "Cannot find module '../src/core/spring'".

- [x] **Step 3: Implement** — `packages/meniscus/src/core/spring.ts`

```ts
/** Mass, stiffness and damping of a spring. Omitted values come from the `snappy` preset. */
export interface SpringConfig {
  /** Mass of what moves. A heavier spring responds more slowly and rings longer. Default 1. */
  mass?: number;
  /** Pull toward the target per unit of distance. A stiffer spring is faster. Default 300. */
  stiffness?: number;
  /** Resistance to motion. Below critical damping, 2·√(stiffness·mass), the spring overshoots. Default 30. */
  damping?: number;
}

/** Named springs, for `physics` props. */
export const SPRINGS = {
  /** Soft and slow, with barely any overshoot. */
  gentle: { mass: 1, stiffness: 120, damping: 20 },
  /** Quick, with a trace of overshoot. The default. */
  snappy: { mass: 1, stiffness: 300, damping: 30 },
  /** Lively: overshoots and rings once or twice. */
  bouncy: { mass: 1, stiffness: 260, damping: 14 },
  /** Fast and firm, with no visible overshoot. */
  stiff: { mass: 1, stiffness: 520, damping: 44 },
} as const satisfies Record<string, Required<SpringConfig>>;

/** The name of a preset in `SPRINGS`. */
export type SpringPreset = keyof typeof SPRINGS;
/** A spring's physics: a preset name, or mass, stiffness and damping. */
export type SpringInput = SpringConfig | SpringPreset;

const MAX_STEP = 1 / 240;
const MAX_FRAME = 1 / 15;

/** Fills a spring's physics from its preset or the defaults. Non-finite and non-positive values fall back. */
export function resolveSpring(input: SpringInput = 'snappy'): Required<SpringConfig> {
  const base = SPRINGS.snappy;
  if (typeof input === 'string') return { ...(SPRINGS[input] ?? base) };
  const positive = (v: number | undefined, fallback: number) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : fallback);
  const damping = input.damping !== undefined && Number.isFinite(input.damping) && input.damping >= 0 ? input.damping : base.damping;
  return { mass: positive(input.mass, base.mass), stiffness: positive(input.stiffness, base.stiffness), damping };
}

/** Undamped period of a spring, seconds: 2π·√(mass / stiffness). */
export function springPeriod(input?: SpringInput): number {
  const { mass, stiffness } = resolveSpring(input);
  return 2 * Math.PI * Math.sqrt(mass / stiffness);
}

/** Damping ratio: 1 is critical; below it the spring overshoots. */
export function dampingRatio(input?: SpringInput): number {
  const { mass, stiffness, damping } = resolveSpring(input);
  return damping / (2 * Math.sqrt(stiffness * mass));
}

/**
 * A damped spring pulling `value` toward `target`. It steps with semi-implicit
 * Euler in substeps short enough for any stiffness and damping, so a long
 * frame slows it rather than blowing it up.
 */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  config: Required<SpringConfig>;

  constructor(value = 0, config: SpringInput = 'snappy') {
    this.value = value;
    this.target = value;
    this.config = resolveSpring(config);
  }

  /** Advances `dt` seconds, capped at 1/15 s. */
  step(dt: number): void {
    const total = Math.min(MAX_FRAME, Math.max(0, dt));
    if (total === 0) return;
    const { mass, stiffness, damping } = this.config;
    // Short enough for stiffness (ω·h ≤ 1) and for damping (h·d/m ≤ 1).
    const limit = Math.min(MAX_STEP, Math.sqrt(mass / stiffness), damping > 0 ? mass / damping : MAX_STEP);
    const n = Math.ceil(total / limit);
    const h = total / n;
    for (let i = 0; i < n; i++) {
      const force = -stiffness * (this.value - this.target) - damping * this.velocity;
      this.velocity += (force / mass) * h;
      this.value += this.velocity * h;
    }
  }

  /** At the target and still. */
  get settled(): boolean {
    return Math.abs(this.value - this.target) < 1e-4 && Math.abs(this.velocity) < 1e-3;
  }

  /** Jumps to the target and stops. */
  snap(): void {
    this.value = this.target;
    this.velocity = 0;
  }
}
```

Then run this patch (`python3` from the repo root):

```python
p = 'packages/meniscus/src/react/interaction.ts'
s = open(p).read()
start = s.index('/** A damped spring, integrated per frame.')
end = s.index('export interface InteractionHandlers')
s = s[:start] + '''/** A spring with a resting value it returns to on `reset()`. The motion is the core solver's. */
export class Spring extends CoreSpring {
  constructor(
    readonly rest: number,
    stiffness = 420,
    damping = 24,
  ) {
    super(rest, { stiffness, damping });
  }
  get atRest(): boolean {
    return this.settled && Math.abs(this.target - this.rest) < 1e-9;
  }
  reset(): void {
    this.target = this.rest;
    this.snap();
  }
}

''' + s[end:]
s = s.replace("import { useIsomorphicLayoutEffect } from './hooks';\n", "import { Spring as CoreSpring } from '../core/spring';\nimport { useIsomorphicLayoutEffect } from './hooks';\n", 1)
open(p, 'w').write(s)

p = 'packages/meniscus/src/core/index.ts'
s = open(p).read().rstrip('\n')
s += "\nexport { Spring, SPRINGS, resolveSpring, springPeriod, dampingRatio, type SpringConfig, type SpringInput, type SpringPreset } from './spring';\n"
open(p, 'w').write(s)
```

- [x] **Step 4: Run the tests to verify they pass, then the whole suite and typecheck**

Run: `pnpm --filter meniscus exec vitest run test/spring.test.ts && pnpm --filter meniscus test && pnpm --filter meniscus typecheck`
Expected: all pass. The interaction and indicator suites guard the subclass switch.

- [x] **Step 5: Commit**

```bash
git add packages/meniscus/src/core/spring.ts packages/meniscus/src/core/index.ts packages/meniscus/src/react/interaction.ts packages/meniscus/test/spring.test.ts
git commit -m "feat(core): add a portable spring solver"
```

---

### Task 2: Optical physics

**Files:**
- Create: `packages/meniscus/src/core/physics.ts`
- Create: `packages/meniscus/test/physics.test.ts`
- Modify: `packages/meniscus/src/core/index.ts`

**Interfaces:**
- Consumes: `Spring`, `resolveSpring`, `springPeriod`, `SpringConfig` and `SpringInput` (Task 1).
- Produces:
  - `OpticalChannel` and `OpticalState {presence, refraction, highlightX, highlightY, tint, shadow}`
  - `OPTICAL_REST` and `RESPONSE`
  - `GlassPhysicsOptions {physics?, response?, initial?, scheduler?, reducedMotion?}`
  - `TransitionOptions {delay?}`
  - `class GlassPhysics` with `state`, `settled`, `configure()`, `to(target, {delay})`, `impulse(vx, vy)`, `step(dt)`, `subscribe(fn) → unsubscribe` (it calls the listener at once) and `dispose()` (not permanent: a later `to` wakes it)
  - `staggerDelay(rank, physics?, stagger = 0.12) → ms`

- [x] **Step 1: Write the failing tests** — `packages/meniscus/test/physics.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlassPhysics, staggerDelay, type GlassPhysicsOptions } from '../src/core/physics';
import { springPeriod } from '../src/core/spring';

const created: GlassPhysics[] = [];
function make(options: GlassPhysicsOptions = {}): GlassPhysics {
  const p = new GlassPhysics({ scheduler: 'manual', ...options });
  created.push(p);
  return p;
}
afterEach(() => {
  for (const p of created.splice(0)) p.dispose();
  vi.unstubAllGlobals();
});

describe('GlassPhysics', () => {
  it('settles the highlight first, the refraction next and the shadow last', () => {
    const p = make({ initial: { highlightX: 1, refraction: 2, shadow: 2 } });
    p.to({ highlightX: 0, refraction: 1, shadow: 1 });
    const last = { highlight: 0, refraction: 0, shadow: 0 };
    for (let t = 0; t < 3; t += 1 / 120) {
      p.step(1 / 120);
      if (Math.abs(p.state.highlightX) > 0.01) last.highlight = t;
      if (Math.abs(p.state.refraction - 1) > 0.01) last.refraction = t;
      if (Math.abs(p.state.shadow - 1) > 0.01) last.shadow = t;
    }
    expect(last.highlight).toBeLessThan(last.refraction);
    expect(last.refraction).toBeLessThan(last.shadow);
  });

  it('rings harder after a faster release, and a slow one barely moves', () => {
    const ring = (speed: number) => {
      const p = make();
      p.impulse(speed, 0);
      let m = 1;
      for (let i = 0; i < 120; i++) {
        p.step(1 / 60);
        m = Math.max(m, p.state.refraction);
      }
      return m;
    };
    const slow = ring(300);
    const fast = ring(3000);
    expect(fast).toBeGreaterThan(slow + 0.05);
    expect(slow).toBeLessThan(1.05);
  });

  it('holds a delayed target until its own clock passes the delay', () => {
    const p = make();
    p.to({ presence: 0 }, { delay: 100 });
    p.step(0.05);
    expect(p.state.presence).toBe(1);
    p.step(0.06);
    expect(p.state.presence).toBeLessThan(1);
  });

  it('lets a newer target replace a pending one', () => {
    const p = make();
    p.to({ tint: 0 }, { delay: 100 });
    p.to({ tint: 0.5 });
    for (let i = 0; i < 180; i++) p.step(1 / 60);
    expect(p.state.tint).toBeCloseTo(0.5, 3);
  });

  it('reverses mid-flight from where it is', () => {
    const p = make();
    p.to({ presence: 0 });
    for (let i = 0; i < 6; i++) p.step(1 / 60);
    const mid = p.state.presence;
    p.to({ presence: 1 });
    p.step(1 / 240);
    expect(Math.abs(p.state.presence - mid)).toBeLessThan(0.05);
  });

  it('jumps straight to targets under reduced motion, skipping delays and momentum', () => {
    const p = make({ reducedMotion: true });
    p.to({ presence: 0, tint: 0.3 }, { delay: 500 });
    expect(p.state.presence).toBe(0);
    expect(p.state.tint).toBe(0.3);
    p.impulse(3000, 0);
    p.step(1 / 60);
    expect(p.state.refraction).toBe(1);
  });

  it('tells subscribers at once and on every step, until they leave', () => {
    const p = make();
    const seen: number[] = [];
    const off = p.subscribe((s) => seen.push(s.presence));
    expect(seen).toEqual([1]);
    p.to({ presence: 0 });
    p.step(1 / 60);
    expect(seen.length).toBe(2);
    off();
    p.step(1 / 60);
    expect(seen.length).toBe(2);
  });

  it('runs on the shared frame loop and stops once settled', () => {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => queue.push(f));
    const p = new GlassPhysics();
    created.push(p);
    p.to({ presence: 0 });
    expect(queue.length).toBe(1);
    let now = 0;
    for (let i = 0; i < 400 && queue.length; i++) queue.shift()!((now += 16));
    expect(queue.length).toBe(0);
    expect(p.state.presence).toBe(0);
    expect(p.settled).toBe(true);
  });

  it('never asks for frames with the manual scheduler', () => {
    const spy = vi.fn();
    vi.stubGlobal('requestAnimationFrame', spy);
    const p = make();
    p.to({ presence: 0 });
    p.impulse(1000, 0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('stops everything on dispose', () => {
    const p = make();
    const seen: number[] = [];
    p.subscribe((s) => seen.push(s.presence));
    p.to({ presence: 0 }, { delay: 50 });
    p.dispose();
    p.step(0.1);
    expect(seen).toEqual([1]);
    expect(p.state.presence).toBe(1);
  });

  it('changes its spring without a jump', () => {
    const p = make();
    p.to({ presence: 0 });
    p.step(0.05);
    const mid = p.state.presence;
    p.configure({ physics: 'gentle' });
    expect(p.state.presence).toBe(mid);
    p.step(1 / 60);
    expect(p.state.presence).toBeLessThan(mid);
  });
});

describe('staggerDelay', () => {
  it('grows with rank and with the spring period, whichever way it runs', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(2, 'snappy', 0.12)).toBeCloseTo(2 * 0.12 * springPeriod('snappy') * 1000, 6);
    expect(staggerDelay(1, 'gentle')).toBeGreaterThan(staggerDelay(1, 'stiff'));
    expect(staggerDelay(1, 'snappy', -0.12)).toBe(staggerDelay(1, 'snappy', 0.12));
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `pnpm --filter meniscus exec vitest run test/physics.test.ts`
Expected: FAIL, "Cannot find module '../src/core/physics'".

- [x] **Step 3: Implement** — `packages/meniscus/src/core/physics.ts`

```ts
import { Spring, resolveSpring, springPeriod, type SpringConfig, type SpringInput } from './spring';

/** An optical property a glass animates on its own spring. */
export type OpticalChannel = 'presence' | 'refraction' | 'highlight' | 'tint' | 'shadow';

/**
 * A glass's optics, each normalized so its resting value is the glass as its
 * options describe it: 1 for the multipliers, 0 for the highlight offset.
 */
export interface OpticalState {
  /** 1 when shown, 0 when hidden. */
  presence: number;
  /** Multiplier on the glass's bend. */
  refraction: number;
  /** Light offset toward the right (positive) or left, −1 to 1. */
  highlightX: number;
  /** Light offset toward the bottom (positive) or top, −1 to 1. */
  highlightY: number;
  /** Multiplier on the tint's opacity. */
  tint: number;
  /** Lift: 0 is flat on the page, 1 resting, above 1 raised. */
  shadow: number;
}

/** A glass at rest, exactly as its options describe it. */
export const OPTICAL_REST: Readonly<OpticalState> = { presence: 1, refraction: 1, highlightX: 0, highlightY: 0, tint: 1, shadow: 1 };

/**
 * How much stiffer each channel's spring is than the base spring. Light
 * reflects at once, so the highlight settles first; a shadow follows the
 * glass's height, so it lags.
 */
export const RESPONSE: Readonly<Record<OpticalChannel, number>> = { presence: 1, refraction: 1, highlight: 2.5, tint: 0.8, shadow: 0.55 };

/** Options for a `GlassPhysics`. */
export interface GlassPhysicsOptions {
  /** The base spring: a preset name, or mass, stiffness and damping. Default `'snappy'`. */
  physics?: SpringInput;
  /** Stiffness multipliers per channel, replacing those in `RESPONSE`. */
  response?: Partial<Record<OpticalChannel, number>>;
  /** Where the optics start. Omitted values start at rest. */
  initial?: Partial<OpticalState>;
  /** `'frame'` runs on the shared animation frame loop; `'manual'` waits for `step()`. Default `'frame'` where `requestAnimationFrame` exists. */
  scheduler?: 'frame' | 'manual';
  /** Jump to targets, skipping delays and momentum. */
  reducedMotion?: boolean;
}

/** Options for `GlassPhysics.to`. */
export interface TransitionOptions {
  /** Milliseconds, on the physics clock, before the targets apply. */
  delay?: number;
}

/** The shadow is a little more damped than the rest, so it lags without ringing. */
const SHADOW_DAMPING = 1.1;
/** Channel velocity per 1000 px/s of glass speed, and the speed momentum stops growing at. */
const IMPULSE = { refraction: 1.2, highlight: 1.5, shadow: 0.8, maxSpeed: 4000 };
const MAX_DT = 1 / 15;

const CHANNEL: Readonly<Record<keyof OpticalState, OpticalChannel>> = {
  presence: 'presence',
  refraction: 'refraction',
  highlightX: 'highlight',
  highlightY: 'highlight',
  tint: 'tint',
  shadow: 'shadow',
};
const KEYS = Object.keys(CHANNEL) as Array<keyof OpticalState>;

// One animation frame loop steps every instance in motion.
const moving = new Set<GlassPhysics>();
let loopFrame = 0;
let loopLast = 0;

function loop(now: number): void {
  const dt = loopLast ? (now - loopLast) / 1000 : 1 / 60;
  loopLast = now;
  for (const p of Array.from(moving)) p.step(dt);
  if (moving.size && typeof requestAnimationFrame === 'function') {
    loopFrame = requestAnimationFrame(loop);
  } else {
    loopFrame = 0;
    loopLast = 0;
  }
}

function channelSpring(base: Required<SpringConfig>, channel: OpticalChannel, multiplier: number): Required<SpringConfig> {
  const k = Math.max(1e-6, multiplier);
  // Damping grows with √stiffness, which keeps the base's damping ratio.
  return { mass: base.mass, stiffness: base.stiffness * k, damping: base.damping * Math.sqrt(k) * (channel === 'shadow' ? SHADOW_DAMPING : 1) };
}

function finite(target: Partial<OpticalState>): Partial<OpticalState> {
  const out: Partial<OpticalState> = {};
  for (const key of KEYS) {
    const v = target[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/**
 * A glass's optics on springs. Presence, refraction, highlight, tint and
 * shadow each move on their own spring, at their own speed, toward targets
 * set with `to()`, and take momentum from `impulse()`. Framework-free: with
 * `scheduler: 'manual'`, call `step()` to drive it from any loop.
 */
export class GlassPhysics {
  /** The current optics. Read it, or `subscribe` to hear every change. */
  readonly state: OpticalState = { ...OPTICAL_REST };
  private springs = {} as Record<keyof OpticalState, Spring>;
  private pending: Array<{ at: number; target: Partial<OpticalState> }> = [];
  private clock = 0;
  private listeners = new Set<(state: OpticalState) => void>();
  private manual: boolean;
  private reduced: boolean;
  private base: Required<SpringConfig>;
  private response: Record<OpticalChannel, number>;

  constructor(options: GlassPhysicsOptions = {}) {
    this.manual = options.scheduler === 'manual' || typeof requestAnimationFrame !== 'function';
    this.reduced = !!options.reducedMotion;
    this.base = resolveSpring(options.physics);
    this.response = { ...RESPONSE, ...options.response };
    const initial = { ...OPTICAL_REST, ...finite(options.initial ?? {}) };
    for (const key of KEYS) this.springs[key] = new Spring(initial[key], this.springFor(key));
    this.sync(false);
  }

  /** At rest: nothing moving and nothing waiting. */
  get settled(): boolean {
    return this.pending.length === 0 && KEYS.every((key) => this.springs[key].settled);
  }

  /** Changes the base spring, the channel response or reduced motion, without disturbing motion in flight. */
  configure({ physics, response, reducedMotion }: Pick<GlassPhysicsOptions, 'physics' | 'response' | 'reducedMotion'>): void {
    if (physics !== undefined) this.base = resolveSpring(physics);
    if (response !== undefined) this.response = { ...RESPONSE, ...response };
    for (const key of KEYS) this.springs[key].config = this.springFor(key);
    if (reducedMotion !== undefined) this.reduced = reducedMotion;
    if (this.reduced) this.finish();
  }

  /** Moves toward new targets, after `delay` ms. A later target for a channel replaces a pending one. */
  to(target: Partial<OpticalState>, { delay = 0 }: TransitionOptions = {}): void {
    const clean = finite(target);
    const keys = Object.keys(clean) as Array<keyof OpticalState>;
    if (!keys.length) return;
    for (const p of this.pending) for (const key of keys) delete p.target[key];
    this.pending = this.pending.filter((p) => Object.keys(p.target).length > 0);
    if (this.reduced) {
      this.apply(clean);
      this.finish();
      return;
    }
    if (delay > 0) this.pending.push({ at: this.clock + delay / 1000, target: clean });
    else this.apply(clean);
    this.wake();
  }

  /** Momentum from a drag or a release, in px/s of the glass: it swells, its light lags and it lifts, then springs back. */
  impulse(vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy);
    if (this.reduced || !(speed > 0) || !Number.isFinite(speed)) return;
    const s = Math.min(speed, IMPULSE.maxSpeed) / 1000;
    this.springs.refraction.velocity += IMPULSE.refraction * s;
    this.springs.highlightX.velocity -= IMPULSE.highlight * (vx / speed) * s;
    this.springs.highlightY.velocity -= IMPULSE.highlight * (vy / speed) * s;
    this.springs.shadow.velocity += IMPULSE.shadow * s;
    this.wake();
  }

  /** Advances `dt` seconds, capped at 1/15 s. The frame loop calls it; with `scheduler: 'manual'`, you do. */
  step(dt: number): void {
    const d = Math.min(MAX_DT, Math.max(0, dt));
    this.clock += d;
    if (this.pending.length) {
      const due = this.pending.filter((p) => p.at <= this.clock + 1e-9);
      if (due.length) {
        this.pending = this.pending.filter((p) => p.at > this.clock + 1e-9);
        for (const p of due) this.apply(p.target);
      }
    }
    for (const key of KEYS) this.springs[key].step(d);
    if (this.settled) {
      for (const key of KEYS) this.springs[key].snap();
      moving.delete(this);
    }
    this.sync(true);
  }

  /** Calls `listener` with the optics now and after every change. Returns the unsubscribe. */
  subscribe(listener: (state: OpticalState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stops motion and drops pending targets and listeners. A later `to()` starts it again. */
  dispose(): void {
    moving.delete(this);
    this.pending = [];
    this.listeners.clear();
  }

  private springFor(key: keyof OpticalState): Required<SpringConfig> {
    const channel = CHANNEL[key];
    return channelSpring(this.base, channel, this.response[channel] ?? 1);
  }

  private apply(target: Partial<OpticalState>): void {
    for (const key of Object.keys(target) as Array<keyof OpticalState>) this.springs[key].target = target[key]!;
  }

  private finish(): void {
    for (const p of this.pending) this.apply(p.target);
    this.pending = [];
    for (const key of KEYS) this.springs[key].snap();
    moving.delete(this);
    this.sync(true);
  }

  private wake(): void {
    if (this.manual) return;
    moving.add(this);
    if (!loopFrame && typeof requestAnimationFrame === 'function') loopFrame = requestAnimationFrame(loop);
  }

  private sync(notify: boolean): void {
    for (const key of KEYS) this.state[key] = this.springs[key].value;
    if (notify) for (const listener of Array.from(this.listeners)) listener(this.state);
  }
}

/** Milliseconds a layer waits in a shared transition: its rank from the leading layer × |stagger| × its spring's period. */
export function staggerDelay(rank: number, physics?: SpringInput, stagger = 0.12): number {
  return Math.max(0, rank) * Math.abs(stagger) * springPeriod(physics) * 1000;
}
```

Append to `packages/meniscus/src/core/index.ts`:

```ts
export { GlassPhysics, OPTICAL_REST, RESPONSE, staggerDelay, type OpticalChannel, type OpticalState, type GlassPhysicsOptions, type TransitionOptions } from './physics';
```

- [x] **Step 4: Run the tests**

Run: `pnpm --filter meniscus exec vitest run test/physics.test.ts && pnpm --filter meniscus typecheck`
Expected: all pass.

- [x] **Step 5: Commit**

```bash
git add packages/meniscus/src/core/physics.ts packages/meniscus/src/core/index.ts packages/meniscus/test/physics.test.ts
git commit -m "feat(core): drive glass optics on independent springs"
```

---

### Task 3: Semantic intensity

**Files:**
- Modify: `packages/meniscus/src/core/glass.ts` (type, option, `intensityOptics`, `resolveGlass`)
- Modify: `packages/meniscus/src/core/constants.ts` (`'intensity'` in `GLASS_OPTION_KEYS`)
- Modify: `packages/meniscus/src/core/index.ts` and `packages/meniscus/src/index.ts` (exports)
- Create: `packages/meniscus/test/intensity.test.ts`

**Interfaces:**
- Produces:
  - `GlassIntensity = 'subtle' | 'regular' | 'strong' | number`
  - `GlassOptions.intensity?`
  - `intensityOptics(intensity, variant) → { refraction, specular, aberration }`

- [x] **Step 1: Write the failing tests** — `packages/meniscus/test/intensity.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { intensityOptics, resolveGlass } from '../src/core/glass';

describe('intensity', () => {
  it('leaves the glass exactly as before by default', () => {
    expect(resolveGlass({ intensity: 'regular' }, 200, 80)).toEqual(resolveGlass({}, 200, 80));
    expect(resolveGlass({ intensity: 0.5, variant: 'clear' }, 200, 80)).toEqual(resolveGlass({ variant: 'clear' }, 200, 80));
  });

  it('bends and lights less when subtle and more when strong', () => {
    const subtle = resolveGlass({ intensity: 'subtle' }, 200, 80);
    const regular = resolveGlass({}, 200, 80);
    const strong = resolveGlass({ intensity: 'strong' }, 200, 80);
    expect(subtle.thickness).toBeLessThan(regular.thickness);
    expect(strong.thickness).toBeGreaterThan(regular.thickness);
    expect(subtle.specular).toBe(0.6);
    expect(strong.specular).toBe(1);
    expect(strong.aberration).toBeCloseTo(0.15, 9);
  });

  it('interpolates numbers between the named steps', () => {
    expect(intensityOptics(0.25, 'regular').refraction).toBeCloseTo(0.8, 9);
    expect(intensityOptics(0.75, 'regular').refraction).toBeCloseTo(1.25, 9);
    expect(intensityOptics(7, 'regular')).toEqual(intensityOptics('strong', 'regular'));
    expect(intensityOptics(Number.NaN, 'regular')).toEqual(intensityOptics('regular', 'regular'));
  });

  it('gives way to explicit options', () => {
    const g = resolveGlass({ intensity: 'strong', refraction: 0.2, specular: 0.3, aberration: 0 }, 200, 80);
    expect(g.thickness).toBeCloseTo(g.bezel * 0.2, 0);
    expect(g.specular).toBe(0.3);
    expect(g.aberration).toBe(0);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `pnpm --filter meniscus exec vitest run test/intensity.test.ts`
Expected: FAIL, "intensityOptics is not a function" (or a missing export).

- [x] **Step 3: Implement**

```python
p = 'packages/meniscus/src/core/glass.ts'
s = open(p).read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)
rep("export type GlassAppearance = 'auto' | 'light' | 'dark';\n",
    "export type GlassAppearance = 'auto' | 'light' | 'dark';\n/** Semantic strength: a named step, or a number from 0 (subtle) through 0.5 (regular) to 1 (strong). */\nexport type GlassIntensity = 'subtle' | 'regular' | 'strong' | number;\n")
rep("""  variant?: GlassVariant;
  /**
   * Light glass""", """  variant?: GlassVariant;
  /**
   * How strongly the glass bends and lights: `'subtle'`, `'regular'` (the
   * default) or `'strong'`, or a number from 0 (subtle) through 0.5 (regular)
   * to 1 (strong). Explicit `refraction`, `specular` and `aberration` win.
   */
  intensity?: GlassIntensity;
  /**
   * Light glass""")
rep("""const q = (v: number, step: number) => Math.round(v / step) * step;
""", """const q = (v: number, step: number) => Math.round(v / step) * step;

const INTENSITY_STEP: Readonly<Record<'subtle' | 'regular' | 'strong', number>> = { subtle: 0, regular: 0.5, strong: 1 };
const SUBTLE = { refraction: 0.6, specular: 0.6, aberration: 0 };
const STRONG = { refraction: 1.5, specular: 1, aberration: 0.15 };

/** Refraction, specular and aberration for an intensity. Regular is the variant's own defaults, unchanged. */
export function intensityOptics(intensity: GlassIntensity | undefined, variant: GlassVariant | undefined): { refraction: number; specular: number; aberration: number } {
  const v = VARIANTS[variant ?? 'regular'] ?? VARIANTS.regular;
  const regular = { refraction: DEFAULTS.refraction, specular: v.specular, aberration: DEFAULTS.aberration };
  const t = typeof intensity === 'number' ? (Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0.5) : (INTENSITY_STEP[intensity ?? 'regular'] ?? 0.5);
  if (t === 0.5) return regular;
  const [from, to, k] = t < 0.5 ? [SUBTLE, regular, t / 0.5] : [regular, STRONG, (t - 0.5) / 0.5];
  const mix = (a: number, b: number) => a + (b - a) * k;
  return { refraction: mix(from.refraction, to.refraction), specular: mix(from.specular, to.specular), aberration: mix(from.aberration, to.aberration) };
}
""")
rep("""  const refraction = Math.max(0, options.refraction ?? DEFAULTS.refraction);
""", """  const tone = intensityOptics(options.intensity, options.variant);
  const refraction = Math.max(0, options.refraction ?? tone.refraction);
""")
rep("    aberration: Math.max(0, Math.min(1, options.aberration ?? DEFAULTS.aberration)),\n",
    "    aberration: Math.max(0, Math.min(1, options.aberration ?? tone.aberration)),\n")
rep("    specular: q(Math.max(0, Math.min(1, options.specular ?? variant.specular)), 0.01),\n",
    "    specular: q(Math.max(0, Math.min(1, options.specular ?? tone.specular)), 0.01),\n")
open(p, 'w').write(s)

p = 'packages/meniscus/src/core/constants.ts'
s = open(p).read()
s = s.replace("  'appearance',\n", "  'appearance',\n  'intensity',\n", 1)
open(p, 'w').write(s)

p = 'packages/meniscus/src/core/index.ts'
s = open(p).read().rstrip('\n') + "\nexport { intensityOptics, type GlassIntensity } from './glass';\n"
open(p, 'w').write(s)

p = 'packages/meniscus/src/index.ts'
s = open(p).read()
s = s.replace("export type { GlassOptions, GlassVariant, GlassAppearance, ResolvedGlass } from './core/glass';",
              "export type { GlassOptions, GlassVariant, GlassAppearance, GlassIntensity, ResolvedGlass } from './core/glass';", 1)
open(p, 'w').write(s)
```

- [x] **Step 4: Run the tests**

Run: `pnpm --filter meniscus test && pnpm --filter meniscus typecheck`
Expected: all pass. The existing optics suite is unchanged, because the default intensity is exactly the regular defaults.

- [x] **Step 5: Commit**

```bash
git add packages/meniscus/src/core/glass.ts packages/meniscus/src/core/constants.ts packages/meniscus/src/core/index.ts packages/meniscus/src/index.ts packages/meniscus/test/intensity.test.ts
git commit -m "feat: add semantic intensity to glass options"
```

---

### Task 4: `useGlassPhysics` and `optics` on Glass

**Files:**
- Create: `packages/meniscus/src/react/useGlassPhysics.ts`
- Create: `packages/meniscus/src/react/optics.ts` (`useOptics`, `OPTIC_SHADOW`, `opticTint`, `SPOT`)
- Modify: `packages/meniscus/src/react/Glass.tsx` (`optics` prop, styles, spot layer, gesture)
- Modify: `packages/meniscus/src/react/liquid.ts` (`optics` option: press lift, release impulse)
- Modify: `packages/meniscus/src/index.ts` (exports)
- Create: `packages/meniscus/test/glass-physics.test.tsx`

**Interfaces:**
- Consumes: `GlassPhysics`, `OpticalState` and `GlassPhysicsOptions` (Task 2).
- Produces:
  - `useGlassPhysics(options?) → GlassPhysics`
  - `GlassOwnProps.optics?: GlassPhysics`
  - `LiquidMotionOptions.optics?: GlassPhysics | null`
  - `useOptics(node, optics, filterKey)`

- [x] **Step 1: Write the failing tests** — `packages/meniscus/test/glass-physics.test.tsx`

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Glass, useGlassPhysics } from '../src';
import { GlassPhysics, overrideRefractionSupport } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

function movable(el: HTMLElement, box = { left: 100, top: 100, width: 200, height: 80 }) {
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
  frame(400);
  frames = [];
  reduced = false;
  overrideRefractionSupport(undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const still = (initial: ConstructorParameters<typeof GlassPhysics>[0] extends infer O ? O extends { initial?: infer I } ? I : never : never) =>
  new GlassPhysics({ scheduler: 'manual', initial });

describe('useGlassPhysics', () => {
  it('keeps one instance, reconfigures it, and stops it on unmount', () => {
    const seen: GlassPhysics[] = [];
    const dispose = vi.spyOn(GlassPhysics.prototype, 'dispose');
    function Probe({ physics }: { physics: 'snappy' | 'gentle' }) {
      seen.push(useGlassPhysics({ physics }));
      return null;
    }
    const { rerender, unmount } = render(<Probe physics="snappy" />);
    const configure = vi.spyOn(seen[0]!, 'configure');
    rerender(<Probe physics="gentle" />);
    expect(seen[1]).toBe(seen[0]);
    expect(configure).toHaveBeenCalledWith(expect.objectContaining({ physics: 'gentle' }));
    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('follows reduced motion', () => {
    reduced = true;
    let physics: GlassPhysics | null = null;
    function Probe() {
      physics = useGlassPhysics();
      return null;
    }
    render(<Probe />);
    physics!.to({ presence: 0 });
    expect(physics!.state.presence).toBe(0);
  });
});

describe('<Glass optics>', () => {
  it('writes the optics to the element and scales the refraction filter', () => {
    overrideRefractionSupport(true);
    mockSize(200, 80);
    const optics = still({ presence: 0.5, refraction: 0.5, tint: 0.4, shadow: 0.2, highlightX: 0.3, highlightY: -0.1 });
    const { container } = render(<Glass optics={optics}>x</Glass>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--meniscus-presence')).toBe('0.5');
    expect(el.style.getPropertyValue('--meniscus-tint')).toBe('0.4');
    expect(el.style.getPropertyValue('--meniscus-shadow')).toBe('0.2');
    expect(el.style.getPropertyValue('--meniscus-hx')).toBe('0.3');
    expect(el.style.getPropertyValue('--meniscus-hy')).toBe('-0.1');
    const map = el.querySelector('feDisplacementMap')!;
    expect(Number(map.getAttribute('scale'))).toBeCloseTo(Number(map.getAttribute('data-scale')) * 0.25, 3);
    expect(el.querySelector('[data-meniscus-layer="spot"]')).not.toBeNull();
  });

  it('reads presence, tint and lift in its styles, and leaves glass without optics untouched', () => {
    const optics = still({});
    const html = renderToString(<Glass optics={optics}>x</Glass>);
    expect(html).toContain('opacity:var(--meniscus-presence, 1)');
    expect(html).toContain('var(--meniscus-tint, 1)');
    expect(html).toContain('var(--meniscus-shadow, 1)');
    expect(renderToString(<Glass>x</Glass>)).not.toContain('--meniscus');
  });

  it('keeps a custom shadow', () => {
    const html = renderToString(
      <Glass optics={still({})} shadow="0 0 4px red">
        x
      </Glass>,
    );
    expect(html).toContain('box-shadow:0 0 4px red');
  });

  it('composes the app’s opacity with presence', () => {
    const html = renderToString(
      <Glass optics={still({})} style={{ opacity: 0.5 }}>
        x
      </Glass>,
    );
    expect(html).toContain('opacity:calc(var(--meniscus-presence, 1) * 0.5)');
  });

  it('lifts on press and rings with the release', () => {
    overrideRefractionSupport(true);
    mockSize(200, 80);
    const optics = still({});
    const { getByTestId } = render(
      <Glass data-testid="g" optics={optics} interactive>
        x
      </Glass>,
    );
    const el = getByTestId('g');
    const box = movable(el);
    act(() => {
      fireEvent.pointerDown(el, { pointerId: 1, clientX: 150, clientY: 140 });
      frame();
    });
    for (let i = 0; i < 40; i++) optics.step(1 / 60);
    expect(optics.state.shadow).toBeGreaterThan(1.2);
    act(() => {
      for (let k = 0; k < 4; k++) {
        box.left += 40;
        frame();
      }
      fireEvent.pointerUp(el, { pointerId: 1 });
    });
    let peak = 1;
    for (let i = 0; i < 60; i++) {
      optics.step(1 / 60);
      peak = Math.max(peak, optics.state.refraction);
    }
    expect(peak).toBeGreaterThan(1.01);
  });

  it('cleans up on unmount', () => {
    overrideRefractionSupport(true);
    mockSize(200, 80);
    const optics = still({ presence: 0.5 });
    const { container, unmount } = render(<Glass optics={optics}>x</Glass>);
    const el = container.firstElementChild as HTMLElement;
    const seen: number[] = [];
    optics.subscribe((s) => seen.push(s.presence));
    unmount();
    expect(el.style.getPropertyValue('--meniscus-presence')).toBe('');
    optics.to({ presence: 1 });
    optics.step(1 / 60);
    expect(seen.length).toBeGreaterThan(1);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `pnpm --filter meniscus exec vitest run test/glass-physics.test.tsx`
Expected: FAIL, "useGlassPhysics is not exported" (or undefined).

- [x] **Step 3: Implement the hook and the optics writer**

`packages/meniscus/src/react/useGlassPhysics.ts`:

```ts
import { useEffect, useState } from 'react';
import { GlassPhysics, type GlassPhysicsOptions } from '../core/physics';
import { REDUCED_MOTION } from '../core/support';
import { useIsomorphicLayoutEffect, useMediaQuery } from './hooks';

/**
 * A `GlassPhysics` owned by this component: one instance for its whole life,
 * reconfigured as options change and stopped on unmount. Give it to a glass
 * as `optics`, then move it with `to()` and `impulse()`. It follows the
 * reduced-motion setting unless `reducedMotion` is passed.
 */
export function useGlassPhysics(options: GlassPhysicsOptions = {}): GlassPhysics {
  const systemReduced = useMediaQuery(REDUCED_MOTION);
  const reducedMotion = options.reducedMotion ?? systemReduced;
  const [physics] = useState(() => new GlassPhysics({ ...options, reducedMotion }));
  // Keyed by value: inline objects are new on every render.
  const physicsKey = JSON.stringify(options.physics ?? null);
  const responseKey = JSON.stringify(options.response ?? null);
  useIsomorphicLayoutEffect(() => {
    physics.configure({ physics: options.physics, response: options.response, reducedMotion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physics, physicsKey, responseKey, reducedMotion]);
  useEffect(() => () => physics.dispose(), [physics]);
  return physics;
}
```

`packages/meniscus/src/react/optics.ts`:

```ts
import type { CSSProperties } from 'react';
import type { GlassPhysics, OpticalState } from '../core/physics';
import { useIsomorphicLayoutEffect } from './hooks';

const lift = 'var(--meniscus-shadow, 1)';

/** The default shadow scaled by the lift channel. At rest it is exactly `DEFAULT_SHADOW`. */
export const OPTIC_SHADOW = `0 calc(${lift} * 1px) calc(${lift} * 2px) rgba(0, 0, 0, calc(${lift} * 0.08)), 0 calc(${lift} * 10px) calc(${lift} * 28px) -6px rgba(0, 0, 0, calc(${lift} * 0.18))`;

/** A tint whose opacity follows the tint channel. At rest it is the tint itself. */
export function opticTint(tint: string): string {
  return `color-mix(in srgb, ${tint} calc(var(--meniscus-tint, 1) * 100%), transparent)`;
}

/** Opacity that follows presence, composed with the app's own. */
export function opticOpacity(own: CSSProperties['opacity']): string {
  return own === undefined ? 'var(--meniscus-presence, 1)' : `calc(var(--meniscus-presence, 1) * ${own})`;
}

/** A soft specular spot that follows the highlight channel. Invisible at rest. */
export const SPOT: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  borderRadius: 'inherit',
  pointerEvents: 'none',
  background:
    'radial-gradient(circle at calc(50% + var(--meniscus-hx, 0) * 50%) calc(50% + var(--meniscus-hy, 0) * 50%), rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0) 55%)',
  opacity: 'min(1, calc((var(--meniscus-hx, 0) * var(--meniscus-hx, 0) + var(--meniscus-hy, 0) * var(--meniscus-hy, 0)) * 6))' as unknown as number,
  mixBlendMode: 'screen',
};

const PROPS = ['presence', 'tint', 'shadow', 'hx', 'hy'] as const;
const n = (x: number) => String(Math.round(x * 1e4) / 1e4);
const maps = (node: HTMLElement) => node.querySelectorAll<SVGElement>(':scope > svg feDisplacementMap[data-scale]');

/**
 * Writes a glass's optics to its element on every change: custom properties
 * its styles read, and the refraction filter's strength. Nothing re-renders.
 * `filterKey` changes when the filter is rebuilt, so its strength is written
 * again.
 */
export function useOptics(node: HTMLElement | null, optics: GlassPhysics | undefined, filterKey: unknown): void {
  useIsomorphicLayoutEffect(() => {
    if (!node || !optics) return;
    const apply = (s: OpticalState) => {
      const presence = Math.max(0, Math.min(1, s.presence));
      node.style.setProperty('--meniscus-presence', n(presence));
      node.style.setProperty('--meniscus-tint', n(Math.max(0, s.tint)));
      node.style.setProperty('--meniscus-shadow', n(Math.max(0, s.shadow)));
      node.style.setProperty('--meniscus-hx', n(s.highlightX));
      node.style.setProperty('--meniscus-hy', n(s.highlightY));
      const k = Math.max(0, s.refraction) * presence;
      maps(node).forEach((map) => map.setAttribute('scale', n(Number(map.getAttribute('data-scale')) * k)));
    };
    const off = optics.subscribe(apply);
    return () => {
      off();
      for (const name of PROPS) node.style.removeProperty(`--meniscus-${name}`);
      maps(node).forEach((map) => map.setAttribute('scale', map.getAttribute('data-scale') ?? '0'));
    };
  }, [node, optics, filterKey]);
}
```

- [x] **Step 4: Wire `Glass` and the gesture**

```python
def edit(p, pairs):
    s = open(p).read()
    for old, new in pairs:
        assert s.count(old) == 1, (p, old[:70])
        s = s.replace(old, new)
    open(p, 'w').write(s)

edit('packages/meniscus/src/react/liquid.ts', [
("import type { RippleField } from '../core/ripple';\n", "import type { GlassPhysics } from '../core/physics';\nimport type { RippleField } from '../core/ripple';\n"),
("""  ripple: RippleField | null;
  reducedMotion: boolean;
}""", """  ripple: RippleField | null;
  reducedMotion: boolean;
  /** Optics to lift on press and to set ringing with the release momentum. */
  optics?: GlassPhysics | null;
}"""),
("export function useLiquidMotion(node: HTMLElement | null, { squash, ripple, reducedMotion }: LiquidMotionOptions): void {",
 "export function useLiquidMotion(node: HTMLElement | null, { squash, ripple, reducedMotion, optics = null }: LiquidMotionOptions): void {"),
("    if (!node || reducedMotion || (!squash && !ripple)) return;", "    if (!node || reducedMotion || (!squash && !ripple && !optics)) return;"),
("""      pointerId = e.pointerId;
      if (!frame) {""", """      pointerId = e.pointerId;
      optics?.to({ shadow: 1.25 });
      if (!frame) {"""),
("""      pointerId = null;
      trail = null;
      releasedAt = performance.now();""", """      pointerId = null;
      trail = null;
      releasedAt = performance.now();
      optics?.to({ shadow: 1 });
      optics?.impulse(vx, vy);"""),
("  }, [node, squash, ripple, reducedMotion]);", "  }, [node, squash, ripple, reducedMotion, optics]);"),
])

edit('packages/meniscus/src/react/Glass.tsx', [
("import { RippleField } from '../core/ripple';\n", "import type { GlassPhysics } from '../core/physics';\nimport { RippleField } from '../core/ripple';\n"),
("import { useAppear } from './appear';\n", "import { useAppear } from './appear';\nimport { OPTIC_SHADOW, SPOT, opticOpacity, opticTint, useOptics } from './optics';\n"),
("""  /** Drop shadow under the glass, or `false` for none. */
  shadow?: string | false;""", """  /** Drop shadow under the glass, or `false` for none. A custom shadow stays as it is under `optics`. */
  shadow?: string | false;
  /**
   * Springs for this glass's optics, from `useGlassPhysics`: presence,
   * refraction, highlight, tint and lift follow it frame by frame without
   * re-rendering. With `interactive`, a press lifts the glass and the release
   * momentum sets it ringing.
   */
  optics?: GlassPhysics;"""),
("interactive = false, appear = false, ripple = false, backdrop, shadow, style, children, ...rest } = props",
 "interactive = false, appear = false, ripple = false, backdrop, shadow, optics, style, children, ...rest } = props"),
("  useLiquidMotion(node, { squash: interactive && !disabled, ripple: disabled ? null : field, reducedMotion });",
 "  useLiquidMotion(node, { squash: interactive && !disabled, ripple: disabled ? null : field, reducedMotion, optics: interactive && !disabled ? (optics ?? null) : null });"),
("  const highlight = g && !bare && !childless && !webgl ? glassHighlight(g, pixelRatio) : null;\n",
 "  const highlight = g && !bare && !childless && !webgl ? glassHighlight(g, pixelRatio) : null;\n  useOptics(node, optics, tiles);\n"),
("""            backgroundColor: copyActive ? 'transparent' : reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : tint,""",
 """            backgroundColor: copyActive ? 'transparent' : reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : optics ? opticTint(tint) : tint,"""),
("    boxShadow: shadow === false || (group && shadow === undefined) ? undefined : (shadow ?? DEFAULT_SHADOW),",
 "    boxShadow: shadow === false || (group && shadow === undefined) ? undefined : (shadow ?? (optics ? OPTIC_SHADOW : DEFAULT_SHADOW)),"),
("""    ...style,
    ...(hidden ? { opacity: 0 } : null),""", """    ...style,
    ...(optics ? { opacity: opticOpacity(style?.opacity) as unknown as number } : null),
    ...(hidden ? { opacity: 0 } : null),"""),
("""        <span style={{ position: 'absolute', inset: 0, backgroundColor: reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : tint }} />""",
 """        <span style={{ position: 'absolute', inset: 0, backgroundColor: reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : optics ? opticTint(tint) : tint }} />"""),
("    highlight && g ? <span aria-hidden=\"true\" data-meniscus-layer=\"highlight\" style={highlightStyle(highlight, g.radius)} /> : null,\n",
 "    highlight && g ? <span aria-hidden=\"true\" data-meniscus-layer=\"highlight\" style={highlightStyle(highlight, g.radius)} /> : null,\n    optics && !bare && !webgl && !childless ? <span aria-hidden=\"true\" data-meniscus-layer=\"spot\" style={SPOT} /> : null,\n"),
])

edit('packages/meniscus/src/index.ts', [
("export { useGlassMode, useElementSize } from './react/hooks';\n",
 "export { useGlassMode, useElementSize } from './react/hooks';\nexport { useGlassPhysics } from './react/useGlassPhysics';\nexport { GlassPhysics, OPTICAL_REST, staggerDelay, type OpticalChannel, type OpticalState, type GlassPhysicsOptions, type TransitionOptions } from './core/physics';\nexport { SPRINGS, type SpringConfig, type SpringInput, type SpringPreset } from './core/spring';\n"),
])
```

- [x] **Step 5: Run the tests**

Run: `pnpm --filter meniscus exec vitest run test/glass-physics.test.tsx && pnpm --filter meniscus test && pnpm --filter meniscus typecheck`
Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add packages/meniscus/src/react/useGlassPhysics.ts packages/meniscus/src/react/optics.ts packages/meniscus/src/react/Glass.tsx packages/meniscus/src/react/liquid.ts packages/meniscus/src/index.ts packages/meniscus/test/glass-physics.test.tsx
git commit -m "feat: drive glass optics from useGlassPhysics"
```

---

### Task 5: `Glass.Stack` and `Glass.Layer`

**Files:**
- Create: `packages/meniscus/src/react/stack.ts` (contexts shared by `Glass` and the stack)
- Create: `packages/meniscus/src/react/GlassStack.tsx`
- Modify: `packages/meniscus/src/react/Glass.tsx`:
  - reads `LayerContext`, whose WebGL preference feeds `useFallback`
  - binds its resolved glass
  - clears the context for its children
- Modify: `packages/meniscus/src/index.ts` (`Glass` with `Stack`/`Layer`, plus named exports)
- Create: `packages/meniscus/test/stack.test.tsx`

**Interfaces:**
- Consumes: `useGlassPhysics` and the `optics` prop (Task 4), `staggerDelay` and `GlassPhysics` (Task 2), `SpringInput` (Task 1).
- Produces:
  - `GlassStack`, `GlassLayer`, `GlassStackProps`, `GlassLayerProps`, `StackRenderer`
  - `Glass.Stack` and `Glass.Layer`
  - `LayerHandle { preferWebGL; bind(glass: () => ResolvedGlass | null): () => void; below(): StackPane[] }`
  - `StackPane { el; glass: ResolvedGlass; optics: GlassPhysics }`
  - `LayerContext` and `InsideLayerContext`

- [x] **Step 1: Write the failing tests** — `packages/meniscus/test/stack.test.tsx`

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { Glass, GlassButton } from '../src';
import { overrideRefractionSupport, overrideWebGL2, springPeriod, staggerDelay } from '../src/core';

function mockSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height });
}

let frames: FrameRequestCallback[] = [];
let now = 1000;
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
  mockSize(200, 100);
});

afterEach(() => {
  cleanup();
  frame(400);
  frames = [];
  overrideRefractionSupport(undefined);
  overrideWebGL2(undefined);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const presence = (el: HTMLElement) => Number(el.style.getPropertyValue('--meniscus-presence') || '1');

/** Frames until each element's presence first moves past 0.02 from `from`. */
function starts(els: HTMLElement[], from: number, limit = 200): number[] {
  const first = els.map(() => -1);
  for (let i = 0; i < limit; i++) {
    frame();
    els.forEach((el, k) => {
      if (first[k] === -1 && Math.abs(presence(el) - from) > 0.02) first[k] = i;
    });
  }
  return first;
}

function Pair({ stagger = 0.5, initial = false }: { stagger?: number; initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <>
      <button onClick={() => setOpen((o) => !o)}>toggle</button>
      <Glass.Stack physics="snappy" stagger={stagger}>
        <Glass.Layer depth={1} present={open} data-testid="side">
          S
        </Glass.Layer>
        <Glass.Layer depth={2} present={open} data-testid="card">
          C<GlassButton data-testid="inner">in</GlassButton>
        </Glass.Layer>
      </Glass.Stack>
    </>
  );
}

describe('<Glass.Stack>', () => {
  it('orders layers by depth and draws context layers as plain content', () => {
    const { getByTestId } = render(
      <Glass.Stack>
        <Glass.Layer kind="context" data-testid="scene">
          <p>Scene</p>
        </Glass.Layer>
        <Glass.Layer depth={2} data-testid="card">
          C
        </Glass.Layer>
        <Glass.Layer depth={1} data-testid="side">
          S
        </Glass.Layer>
      </Glass.Stack>,
    );
    expect(getByTestId('card').style.zIndex).toBe('2');
    expect(getByTestId('side').style.zIndex).toBe('1');
    expect(getByTestId('scene').dataset.meniscus).toBeUndefined();
    expect(getByTestId('card').dataset.meniscus).toBeDefined();
  });

  it('gives control layers the context media as their backdrop, as the renderer asks', () => {
    overrideWebGL2(true);
    const scene = (renderer?: 'auto' | 'css' | 'webgl') => (
      <Glass.Stack renderer={renderer}>
        <Glass.Layer kind="context">
          <img alt="" src={GIF} />
        </Glass.Layer>
        <Glass.Layer data-testid="c">C</Glass.Layer>
      </Glass.Stack>
    );
    overrideRefractionSupport(false);
    const safari = render(scene());
    expect(safari.getByTestId('c').dataset.meniscus).toBe('webgl');
    safari.unmount();
    const css = render(scene('css'));
    expect(css.getByTestId('c').dataset.meniscus).toBe('frost');
    css.unmount();
    overrideRefractionSupport(true);
    const chromium = render(scene());
    expect(chromium.getByTestId('c').dataset.meniscus).toBe('refract');
    chromium.unmount();
    const forced = render(scene('webgl'));
    expect(forced.getByTestId('c').dataset.meniscus).toBe('webgl');
  });

  it('staggers a shared transition by depth, nearest first', async () => {
    const { getByText, getByTestId } = render(<Pair />);
    await act(async () => {
      fireEvent.click(getByText('toggle'));
    });
    const [side, card] = act(() => starts([getByTestId('side'), getByTestId('card')], 0));
    const expected = staggerDelay(1, 'snappy', 0.5) / 16;
    expect(card).toBeGreaterThanOrEqual(0);
    expect(Math.abs(side! - card! - expected)).toBeLessThanOrEqual(1.5);
  });

  it('reverses the order with a negative stagger', async () => {
    const { getByText, getByTestId } = render(<Pair stagger={-0.5} />);
    await act(async () => {
      fireEvent.click(getByText('toggle'));
    });
    const [side, card] = act(() => starts([getByTestId('side'), getByTestId('card')], 0));
    expect(side!).toBeLessThan(card!);
  });

  it('reverses mid-transition without a jump', async () => {
    const { getByText, getByTestId } = render(<Pair stagger={0} />);
    await act(async () => {
      fireEvent.click(getByText('toggle'));
    });
    act(() => frame(5));
    const mid = presence(getByTestId('card'));
    await act(async () => {
      fireEvent.click(getByText('toggle'));
    });
    act(() => frame(1));
    expect(Math.abs(presence(getByTestId('card')) - mid)).toBeLessThan(0.15);
  });

  it('enters on mount with appear', async () => {
    const { getByTestId } = render(
      <Glass.Stack appear>
        <Glass.Layer data-testid="c">C</Glass.Layer>
      </Glass.Stack>,
    );
    expect(presence(getByTestId('c'))).toBe(0);
    await act(async () => {});
    act(() => frame(120));
    expect(presence(getByTestId('c'))).toBe(1);
  });

  it('hides absent layers from the page', () => {
    const { getByTestId } = render(<Pair />);
    expect(getByTestId('card').hasAttribute('inert')).toBe(true);
    expect(presence(getByTestId('card'))).toBe(0);
  });

  it('keeps glass inside a layer out of the stack', () => {
    const { getByTestId } = render(<Pair initial />);
    expect(getByTestId('inner').style.zIndex).toBe('');
    expect(getByTestId('inner').style.getPropertyValue('--meniscus-presence')).toBe('');
  });

  it('unregisters layers that leave mid-transition', async () => {
    function Leaving() {
      const [open, setOpen] = useState(false);
      const [shown, setShown] = useState(true);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <button onClick={() => setShown(false)}>drop</button>
          <Glass.Stack stagger={0.5}>{shown ? <Glass.Layer present={open}>C</Glass.Layer> : null}</Glass.Stack>
        </>
      );
    }
    const { getByText } = render(<Leaving />);
    await act(async () => {
      fireEvent.click(getByText('open'));
    });
    act(() => frame(2));
    await act(async () => {
      fireEvent.click(getByText('drop'));
    });
    expect(() => act(() => frame(200))).not.toThrow();
    expect(frames.length).toBe(0);
  });

  it('warns once for a layer outside a stack, and once for a stack inside a layer', () => {
    render(
      <>
        <Glass.Layer>a</Glass.Layer>
        <Glass.Layer>b</Glass.Layer>
        <Glass.Stack>
          <Glass.Layer>
            <Glass.Stack>
              <Glass.Layer>c</Glass.Layer>
            </Glass.Stack>
          </Glass.Layer>
        </Glass.Stack>
      </>,
    );
    const calls = vi.mocked(console.warn).mock.calls.map(([m]) => String(m));
    expect(calls.filter((m) => m.includes('inside a <Glass.Stack>')).length).toBe(1);
    expect(calls.filter((m) => m.includes('inside a control layer')).length).toBe(1);
  });

  it('keeps the period arithmetic honest', () => {
    expect(staggerDelay(1, 'snappy', 0.5)).toBeCloseTo(0.5 * springPeriod('snappy') * 1000, 6);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `pnpm --filter meniscus exec vitest run test/stack.test.tsx`
Expected: FAIL, "Cannot read properties of undefined (reading 'Stack')" or similar.

- [x] **Step 3: Implement the contexts** — `packages/meniscus/src/react/stack.ts`

```ts
import { createContext } from 'react';
import type { ResolvedGlass } from '../core/glass';
import type { GlassPhysics } from '../core/physics';

/** A control layer beneath another, as the WebGL path needs it. */
export interface StackPane {
  el: HTMLElement;
  glass: ResolvedGlass;
  optics: GlassPhysics;
}

/** What a control layer tells its own glass. */
export interface LayerHandle {
  /** Take WebGL even where live refraction works (`renderer="webgl"`). */
  preferWebGL: boolean;
  /** The glass shares its resolved shape, for the layers above that draw it. Returns the unbind. */
  bind(glass: () => ResolvedGlass | null): () => void;
  /** Control layers beneath this one, deepest first. */
  below(): StackPane[];
}

/** Set by a control layer for its own glass. That glass clears it for its children. */
export const LayerContext = createContext<LayerHandle | null>(null);

/** True anywhere inside a control layer, for the nested-stack warning. */
export const InsideLayerContext = createContext(false);
```

- [x] **Step 4: Implement the stack** — `packages/meniscus/src/react/GlassStack.tsx`

```tsx
import {
  createContext,
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import type { GlassOptions, ResolvedGlass } from '../core/glass';
import { staggerDelay, type GlassPhysics } from '../core/physics';
import type { SpringInput } from '../core/spring';
import { isMediaElement } from '../webgl/media';
import { DEV } from './dev';
import { Glass, type GlassOwnProps } from './Glass';
import { useIsomorphicLayoutEffect } from './hooks';
import { useMergedRef } from './refs';
import { InsideLayerContext, LayerContext, type LayerHandle, type StackPane } from './stack';
import { useGlassPhysics } from './useGlassPhysics';

/** How a stack's control layers draw. */
export type StackRenderer = 'auto' | 'css' | 'webgl';

type ContextMedia = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export interface GlassStackProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** The spring for every layer that sets none: a preset name, or mass, stiffness and damping. Default `'snappy'`. */
  physics?: SpringInput;
  /**
   * The wait between depth ranks in a shared transition, as a fraction of each
   * layer's spring period. Nearer layers lead and deeper ones follow; a
   * negative value reverses the order, and 0 moves every layer together.
   * Default 0.12.
   */
  stagger?: number;
  /**
   * How control layers draw. `'auto'` refracts the live page where the browser
   * can and uses WebGL over a media context elsewhere; `'css'` never uses
   * WebGL; `'webgl'` uses WebGL over a media context everywhere. Default
   * `'auto'`.
   */
  renderer?: StackRenderer;
  /** Layers shown on mount enter from hidden, staggered by depth. Default false. */
  appear?: boolean;
  /** The element to render. Default `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

export interface GlassLayerProps extends Omit<GlassOwnProps, 'optics' | 'backdrop'>, Omit<HTMLAttributes<HTMLElement>, 'children' | 'color'> {
  /** Stacking order: higher is nearer the viewer. Sets `z-index`; without it, layers stack in page order. */
  depth?: number;
  /**
   * `'control'` (the default) is glass that refracts everything beneath it,
   * lower layers included. `'context'` is the scene behind: images, video,
   * gradients or any content, drawn as it is.
   */
  kind?: 'context' | 'control';
  /** For a context layer: the media the WebGL path draws. Defaults to the first `img`, `video` or `canvas` inside. */
  source?: ContextMedia | RefObject<ContextMedia | null>;
  /** Whether the layer is shown. Changes animate on its springs, staggered with the other layers changing in the same render. Default true. */
  present?: boolean;
  /** This layer's spring, over the stack's: a preset name, or mass, stiffness and damping. It also sets the layer's place in a stagger. */
  physics?: SpringInput;
  /** The element to render. Default `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

interface LayerRecord {
  el: HTMLElement;
  kind: 'context' | 'control';
  depth: number | undefined;
  physics: SpringInput | undefined;
  optics: GlassPhysics | null;
  glass: (() => ResolvedGlass | null) | null;
}

interface StackValue {
  physics: SpringInput | undefined;
  renderer: StackRenderer;
  appear: boolean;
  source: ContextMedia | null;
  setSource(media: ContextMedia | null): void;
  register(record: LayerRecord): () => void;
  update(el: HTMLElement, patch: Partial<LayerRecord>): void;
  present(el: HTMLElement, present: boolean): void;
  below(el: HTMLElement): StackPane[];
}

const StackContext = createContext<StackValue | null>(null);

let warnedOutside = false;
let warnedNested = false;

/**
 * Layers of glass over a scene. Control layers refract everything painted
 * beneath them, lower glass included: live in Chromium, in WebGL over media
 * in Safari and Firefox. Each layer's optics move on springs, and layers that
 * change together are staggered by depth.
 */
function GlassStackImpl({ physics, stagger = 0.12, renderer = 'auto', appear = false, as, style, children, ...rest }: GlassStackProps, ref: ForwardedRef<HTMLElement>) {
  const inside = useContext(InsideLayerContext);
  useEffect(() => {
    if (!inside || !DEV || warnedNested) return;
    warnedNested = true;
    console.warn('meniscus: a <Glass.Stack> inside a control layer can’t see past that layer’s glass. Place stacks side by side, not inside glass.');
  }, [inside]);

  const records = useRef(new Map<HTMLElement, LayerRecord>());
  const [source, setSourceState] = useState<ContextMedia | null>(null);
  const settings = useRef({ physics, stagger });
  settings.current = { physics, stagger };
  const queue = useRef<Array<{ el: HTMLElement; present: boolean }>>([]);
  const scheduled = useRef(false);

  const depthOf = useCallback((el: HTMLElement): number => {
    const record = records.current.get(el);
    if (record?.depth !== undefined) return record.depth;
    // Without a depth, later in the page is nearer.
    let index = 0;
    for (const other of records.current.keys()) if (other.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) index++;
    return index;
  }, []);

  const flush = useCallback(() => {
    scheduled.current = false;
    const { physics: base, stagger: gap } = settings.current;
    const batch = queue.current.splice(0).filter((b) => records.current.get(b.el)?.optics);
    batch.sort((a, b) => depthOf(b.el) - depthOf(a.el));
    if (gap < 0) batch.reverse();
    batch.forEach(({ el, present }, rank) => {
      const record = records.current.get(el)!;
      const to = present ? 1 : 0;
      record.optics!.to({ presence: to, shadow: to }, { delay: staggerDelay(rank, record.physics ?? base, gap) });
    });
  }, [depthOf]);

  const value = useMemo<StackValue>(
    () => ({
      physics,
      renderer,
      appear,
      source,
      setSource: (media) => setSourceState((prev) => (prev === media ? prev : media)),
      register(record) {
        records.current.set(record.el, record);
        return () => {
          records.current.delete(record.el);
          queue.current = queue.current.filter((q) => q.el !== record.el);
        };
      },
      update(el, patch) {
        const record = records.current.get(el);
        if (record) Object.assign(record, patch);
      },
      present(el, present) {
        queue.current = queue.current.filter((q) => q.el !== el);
        queue.current.push({ el, present });
        if (scheduled.current) return;
        scheduled.current = true;
        // Every layer's layout effect in one commit runs before this microtask: one batch per commit.
        queueMicrotask(flush);
      },
      below(el) {
        const mine = depthOf(el);
        const out: Array<StackPane & { depth: number }> = [];
        for (const record of records.current.values()) {
          if (record.el === el || record.kind !== 'control' || !record.optics || !record.glass) continue;
          const glass = record.glass();
          const depth = depthOf(record.el);
          if (glass && depth < mine) out.push({ el: record.el, glass, optics: record.optics, depth });
        }
        return out.sort((a, b) => a.depth - b.depth).map(({ el: e, glass, optics }) => ({ el: e, glass, optics }));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(physics ?? null), renderer, appear, source, flush, depthOf],
  );

  return createElement(
    as ?? 'div',
    { ...rest, ref, 'data-meniscus-stack': '', style: { position: 'relative', isolation: 'isolate', ...style } },
    <StackContext.Provider value={value}>{children}</StackContext.Provider>,
  );
}

function ContextLayer({ depth, source, as, style, children, ...rest }: GlassLayerProps, ref: ForwardedRef<HTMLElement>) {
  const stack = useContext(StackContext);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const setRef = useMergedRef(ref, setEl);
  useIsomorphicLayoutEffect(() => {
    if (!stack || !el) return;
    return stack.register({ el, kind: 'context', depth, physics: undefined, optics: null, glass: null });
  }, [stack?.register, el]);
  useIsomorphicLayoutEffect(() => {
    if (!stack || !el) return;
    stack.update(el, { depth });
    const explicit = source && 'current' in source ? source.current : source;
    const found = explicit ?? el.querySelector('img, video, canvas');
    stack.setSource(found && isMediaElement(found) ? (found as ContextMedia) : null);
  });
  const glassKeys = rest as Record<string, unknown>;
  for (const key of ['kind', 'present', 'physics', 'interactive', 'ripple', 'appear', 'mode', 'shadow', 'intensity', 'variant', 'radius', 'tint', 'refraction', 'blur']) delete glassKeys[key];
  return createElement(as ?? 'div', { ...glassKeys, ref: setRef, 'data-meniscus-layer-kind': 'context', style: { ...(depth !== undefined ? { zIndex: depth } : null), ...style } }, children);
}

function ControlLayer({ depth, physics, present = true, kind: _kind, source: _source, style, children, ...glassProps }: GlassLayerProps, ref: ForwardedRef<HTMLElement>) {
  const stack = useContext(StackContext);
  useEffect(() => {
    if (stack || !DEV || warnedOutside) return;
    warnedOutside = true;
    console.warn('meniscus: <Glass.Layer> belongs inside a <Glass.Stack>; outside one it is a plain glass.');
  }, [stack]);

  const start = stack?.appear ? 0 : present ? 1 : 0;
  const optics = useGlassPhysics({ physics: physics ?? stack?.physics, initial: { presence: start, shadow: start } });
  const [el, setEl] = useState<HTMLElement | null>(null);
  const setRef = useMergedRef(ref, setEl);
  const physicsKey = JSON.stringify(physics ?? null);

  useIsomorphicLayoutEffect(() => {
    if (!stack || !el) return;
    return stack.register({ el, kind: 'control', depth, physics, optics, glass: null });
  }, [stack?.register, el, optics]);
  useIsomorphicLayoutEffect(() => {
    if (stack && el) stack.update(el, { depth, physics });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, el, depth, physicsKey]);

  // A change of `present` joins this commit's shared transition.
  const last = useRef<boolean | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!el) return;
    if (last.current === null) {
      last.current = present;
      if (stack?.appear && present) stack.present(el, true);
      return;
    }
    if (last.current === present) return;
    last.current = present;
    if (stack) stack.present(el, present);
    else optics.to({ presence: present ? 1 : 0, shadow: present ? 1 : 0 });
  }, [stack, el, present, optics]);

  // An absent layer stays in the page but can't be reached.
  useIsomorphicLayoutEffect(() => {
    if (!el) return;
    el.toggleAttribute('inert', !present);
    if (present) el.removeAttribute('aria-hidden');
    else el.setAttribute('aria-hidden', 'true');
  }, [el, present]);

  const handle = useMemo<LayerHandle>(
    () => ({
      preferWebGL: stack?.renderer === 'webgl',
      bind: (glass) => {
        if (!stack || !el) return () => {};
        stack.update(el, { glass });
        return () => stack.update(el, { glass: null });
      },
      below: () => (stack && el ? stack.below(el) : []),
    }),
    [stack, el],
  );

  const backdrop = stack && stack.renderer !== 'css' ? stack.source : undefined;
  const Pane = Glass as (p: Record<string, unknown>) => ReturnType<typeof Glass>;
  return (
    <InsideLayerContext.Provider value={true}>
      <LayerContext.Provider value={handle}>
        <Pane
          {...glassProps}
          ref={setRef}
          optics={optics}
          backdrop={backdrop}
          data-meniscus-layer-kind="control"
          style={{ ...(depth !== undefined ? { zIndex: depth } : null), ...style }}
        >
          {children}
        </Pane>
      </LayerContext.Provider>
    </InsideLayerContext.Provider>
  );
}

const ContextLayerRef = forwardRef(ContextLayer);
const ControlLayerRef = forwardRef(ControlLayer);

function GlassLayerImpl(props: GlassLayerProps, ref: ForwardedRef<HTMLElement>) {
  return props.kind === 'context' ? <ContextLayerRef {...props} ref={ref} /> : <ControlLayerRef {...props} ref={ref} />;
}

/** A stack of glass layers over a scene. See `GlassStackProps`. */
export const GlassStack = forwardRef(GlassStackImpl);
GlassStack.displayName = 'Glass.Stack';

/** One layer of a `Glass.Stack`: a control layer of glass, or the context scene beneath. See `GlassLayerProps`. */
export const GlassLayer = forwardRef(GlassLayerImpl);
GlassLayer.displayName = 'Glass.Layer';

export type { GlassOptions };
```

- [x] **Step 5: Teach `Glass` the layer handle, and attach the statics**

```python
def edit(p, pairs):
    s = open(p).read()
    for old, new in pairs:
        assert s.count(old) == 1, (p, old[:70])
        s = s.replace(old, new)
    open(p, 'w').write(s)

edit('packages/meniscus/src/react/Glass.tsx', [
("  useCallback,\n  useEffect,\n  useId,\n", "  useCallback,\n  useContext,\n  useEffect,\n  useId,\n"),
("import { OPTIC_SHADOW, SPOT, opticOpacity, opticTint, useOptics } from './optics';\n",
 "import { OPTIC_SHADOW, SPOT, opticOpacity, opticTint, useOptics } from './optics';\nimport { LayerContext } from './stack';\n"),
("  const fallback = useFallback(childless ? undefined : backdrop, node, modePreference, mode, ripple && !reducedMotion);",
 "  // A control layer of a stack: its WebGL preference, and the glass beneath it.\n  const layer = useContext(LayerContext);\n  const fallback = useFallback(childless ? undefined : backdrop, node, modePreference, mode, (ripple && !reducedMotion) || !!layer?.preferWebGL);"),
("  const gRef = useRef(g);\n  gRef.current = g;\n",
 "  const gRef = useRef(g);\n  gRef.current = g;\n  useIsomorphicLayoutEffect(() => (layer ? layer.bind(() => gRef.current) : undefined), [layer]);\n"),
("    children,\n  );\n}", "    // Glass inside this one is not part of the stack.\n    layer ? <LayerContext.Provider value={null}>{children}</LayerContext.Provider> : children,\n  );\n}"),
])

edit('packages/meniscus/src/index.ts', [
("export { Glass, DEFAULT_SHADOW, GLASS_OPTION_KEYS, type GlassProps, type GlassOwnProps } from './react/Glass';\n",
 "import { Glass as GlassBase } from './react/Glass';\nimport { GlassLayer, GlassStack } from './react/GlassStack';\n\n/** A surface of liquid glass, with `Glass.Stack` and `Glass.Layer` for layered glass. */\nexport const Glass = Object.assign(GlassBase, { Stack: GlassStack, Layer: GlassLayer });\nexport { DEFAULT_SHADOW, GLASS_OPTION_KEYS, type GlassProps, type GlassOwnProps } from './react/Glass';\nexport { GlassStack, GlassLayer, type GlassStackProps, type GlassLayerProps, type StackRenderer } from './react/GlassStack';\n"),
])
```

- [x] **Step 6: Run the tests**

Run: `pnpm --filter meniscus exec vitest run test/stack.test.tsx && pnpm --filter meniscus test && pnpm --filter meniscus typecheck`
Expected: all pass.

- [x] **Step 7: Commit**

```bash
git add packages/meniscus/src/react/stack.ts packages/meniscus/src/react/GlassStack.tsx packages/meniscus/src/react/Glass.tsx packages/meniscus/src/index.ts packages/meniscus/test/stack.test.tsx
git commit -m "feat: add Glass.Stack and Glass.Layer with depth-staggered physics"
```

---

### Task 6: WebGL compounding and optics in the renderer

**Files:**
- Modify: `packages/meniscus/src/webgl/renderer.ts` (`PaneFrame.optics`, `RenderOptions.clip`, `u_optic`)
- Modify: `packages/meniscus/src/webgl/shaders.ts` (`u_optic`: presence coverage and bend)
- Modify: `packages/meniscus/src/react/MediaLayer.tsx` (`MediaFrame.layered`/`clip`, `MediaPane.optics`, shared `hostOrigin`)
- Modify: `packages/meniscus/src/react/Glass.tsx` (`mediaFrame` draws the layers below)
- Modify: `apps/site/scripts/check-living-optics.mjs` (GPU checks)

**Interfaces:**
- Consumes: `OpticalState` (Task 2); `LayerHandle.below()` (Task 5).
- Produces:
  - `PaneFrame.optics?: OpticalState | null`
  - `RenderOptions.clip?: number`
  - `MediaFrame.layered?: boolean` and `MediaFrame.clip?: number`
  - `MediaPane.optics?`
  - `hostOrigin(el) → { left, top, sx, sy }`

- [x] **Step 1: Write the failing GPU checks**

In `check-living-optics.mjs`'s GPU block, after the waves checks and before `canvas.width = 240`, add:

```js
    // Optics at rest change nothing; presence 0 removes a pane; a clipped
    // layered render keeps only its last pane.
    const REST = { presence: 1, refraction: 1, highlightX: 0, highlightY: 0, tint: 1, shadow: 1 };
    renderer.render(panes.map((p) => ({ ...p, optics: REST })), 'fill', 1); const restful = pixels();
    renderer.render([panes[0]], 'fill', 1); const onlyFirst = pixels();
    renderer.render([panes[0], { ...panes[1], optics: { ...REST, presence: 0 } }], 'fill', 1); const absent = pixels();
    renderer.render(panes, 'fill', 1, { layered: true, clip: 1, panesOnly: true }); const clipped = pixels();
    const alphaAt = (p, x, y) => p[((119 - y) * 160 + x) * 4 + 3];
    const opticsCheck = { rest: diff(plain, restful), absent: diff(onlyFirst, absent), outside: alphaAt(clipped, 4, 4), inside: alphaAt(clipped, 95, 66), clipError: gl.getError() };
```

Add `opticsCheck` to the returned object, and after the waves asserts add:

```js
  assert.equal(gpu.opticsCheck.rest, 0, 'optics at rest must not change the glass');
  assert.equal(gpu.opticsCheck.absent, 0, 'presence 0 removes a pane');
  assert.equal(gpu.opticsCheck.outside, 0, 'a clipped render is transparent outside its pane');
  assert.ok(gpu.opticsCheck.inside > 200, `a clipped render draws its pane: ${JSON.stringify(gpu.opticsCheck)}`);
  assert.equal(gpu.opticsCheck.clipError, 0);
```

- [x] **Step 2: Run to verify it fails**

Run: `MENISCUS_TEST_URL=http://localhost:5199/ node apps/site/scripts/check-living-optics.mjs`
Expected: FAIL on `presence 0 removes a pane`, since optics are ignored.

- [x] **Step 3: Implement the renderer and the shader**

```python
def edit(p, pairs):
    s = open(p).read()
    for old, new in pairs:
        assert s.count(old) == 1, (p, old[:70])
        s = s.replace(old, new)
    open(p, 'w').write(s)

edit('packages/meniscus/src/webgl/renderer.ts', [
("import { RIPPLE_MAX, type RippleField } from '../core/ripple';\n",
 "import type { OpticalState } from '../core/physics';\nimport { RIPPLE_MAX, type RippleField } from '../core/ripple';\n"),
("""  /** Draw only the glass (and its shadow), leaving the rest of the canvas clear. */
  panesOnly?: boolean;""", """  /** Draw only the glass (and its shadow), leaving the rest of the canvas clear. */
  panesOnly?: boolean;
  /** With `layered`: composite panes 0…clip only, and keep just pane `clip` in the output, transparent elsewhere. */
  clip?: number;"""),
("""  /** A liquid surface over this pane, drawn while it moves. */
  ripple?: RippleField | null;""", """  /** A liquid surface over this pane, drawn while it moves. */
  ripple?: RippleField | null;
  /** Its optics on springs: presence fades it, refraction scales the bend, the highlight turns the light, tint and lift scale theirs. */
  optics?: OpticalState | null;"""),
("    wave: new Float32Array(MAX_PANES * 4),\n", "    wave: new Float32Array(MAX_PANES * 4),\n    optic: new Float32Array(MAX_PANES * 4),\n"),
("'u_misc', 'u_waves', 'u_wave']", "'u_misc', 'u_waves', 'u_wave', 'u_optic']"),
("    const { merge = 0, panesOnly = false, shadow = null, layered = false } = typeof options === 'number' ? { merge: options } : options;",
 "    const { merge = 0, panesOnly = false, shadow = null, layered = false, clip } = typeof options === 'number' ? { merge: options } : options;"),
("""      a.tint.set(p.tint, o);
      const [lx, ly, lz] = lightVector(g.lightAngle, g.lightElevation);
      a.light.set([lx, ly, lz, g.specular], o);""", """      const optics = p.optics;
      const presence = optics ? Math.max(0, Math.min(1, optics.presence)) : 1;
      const bend = optics ? Math.max(0, optics.refraction) * presence : 1;
      a.tint.set([p.tint[0], p.tint[1], p.tint[2], optics ? p.tint[3] * Math.max(0, Math.min(1, optics.tint)) : p.tint[3]], o);
      let [lx, ly, lz] = lightVector(g.lightAngle, g.lightElevation);
      if (optics && (optics.highlightX || optics.highlightY)) {
        // Turn the light toward the highlight offset.
        const tx = lx + 0.6 * optics.highlightX;
        const ty = ly + 0.6 * optics.highlightY;
        const len = Math.hypot(tx, ty, lz);
        [lx, ly, lz] = [tx / len, ty / len, lz / len];
      }
      a.light.set([lx, ly, lz, g.specular], o);
      a.optic.set([presence, bend, optics ? Math.max(0, optics.shadow) * presence : 1, 0], o);"""),
("        a.wave.set([g.thickness * (1 - 1 / g.ior) * pixelRatio, field.cols, field.rows, 1], o);",
 "        a.wave.set([g.thickness * (1 - 1 / g.ior) * pixelRatio * bend, field.cols, field.rows, 1], o);"),
("    gl.uniform4fv(u.u_wave!, a.wave);\n", "    gl.uniform4fv(u.u_wave!, a.wave);\n    gl.uniform4fv(u.u_optic!, a.optic);\n"),
("""    if (layered && merge <= 0 && !panesOnly && count > 0) {""", """    const stack = clip === undefined ? count : Math.max(0, Math.min(count, clip + 1));
    if (layered && merge <= 0 && stack > 0 && (!panesOnly || clip !== undefined)) {
      gl.uniform1i(u.u_panesOnly!, 0);"""),
("""      for (let i = 0; i < count; i++) {
        const input = this.targets[i % 2]!;
        const output = i === count - 1 ? null : this.targets[(i + 1) % 2]!.framebuffer;""", """      for (let i = 0; i < stack; i++) {
        const input = this.targets[i % 2]!;
        const output = i === stack - 1 ? null : this.targets[(i + 1) % 2]!.framebuffer;
        // A clipped render keeps only its last pane.
        if (clip !== undefined && i === stack - 1) gl.uniform1i(u.u_panesOnly!, 1);"""),
("        gl.uniform3f(u.u_shadow!, shadow && panes[i]!.shadow !== false ? shadow.strength : 0, shadow ? shadow.drop * pixelRatio : 0, shadow ? shadow.blur * pixelRatio : 1);",
 "        gl.uniform3f(u.u_shadow!, shadow && panes[i]!.shadow !== false ? shadow.strength * a.optic[i * 4 + 2]! : 0, shadow ? shadow.drop * pixelRatio : 0, shadow ? shadow.blur * pixelRatio : 1);"),
])

edit('packages/meniscus/src/webgl/shaders.ts', [
("uniform vec4 u_wave[MAX_PANES];         // shift per unit slope (canvas px), cols, rows, on\n",
 "uniform vec4 u_wave[MAX_PANES];         // shift per unit slope (canvas px), cols, rows, on\nuniform vec4 u_optic[MAX_PANES];        // presence, bend multiplier, lift, unused\n"),
("  return Material(table.r * u_misc[i].w, table.g,", "  return Material(table.r * u_misc[i].w * u_optic[i].y, table.g,"),
("""      Material m = Material(0.0, 0.0, 0.0, 0.0, 0.0, vec4(0.0), vec4(0.0), 0.0, 0.0, vec2(0.0), 0.0);""",
 """      Material m = Material(0.0, 0.0, 0.0, 0.0, 0.0, vec4(0.0), vec4(0.0), 0.0, 0.0, vec2(0.0), 0.0);
      float presence = 0.0;"""),
("""        m.waveDepth += w[i] * p.waveDepth;
""", """        m.waveDepth += w[i] * p.waveDepth;
        presence += w[i] * u_optic[i].x;
"""),
("      color = mix(color, glassColor(m, n), clamp(0.5 - d, 0.0, 1.0));",
 "      color = mix(color, glassColor(m, n), clamp(0.5 - d, 0.0, 1.0) * presence);"),
("      color = mix(color, glassColor(paneMaterial(i, d), n), clamp(0.5 - d, 0.0, 1.0));",
 "      color = mix(color, glassColor(paneMaterial(i, d), n), clamp(0.5 - d, 0.0, 1.0) * u_optic[i].x);"),
])
```

- [x] **Step 4: Media layer and `Glass` frame**

```python
def edit(p, pairs):
    s = open(p).read()
    for old, new in pairs:
        assert s.count(old) == 1, (p, old[:70])
        s = s.replace(old, new)
    open(p, 'w').write(s)

edit('packages/meniscus/src/react/MediaLayer.tsx', [
("import type { ResolvedGlass } from '../core/glass';\n", "import type { ResolvedGlass } from '../core/glass';\nimport type { OpticalState } from '../core/physics';\n"),
("""  /** Where CSS custom properties in the tint resolve. */
  el: HTMLElement;
}""", """  /** Where CSS custom properties in the tint resolve. */
  el: HTMLElement;
  /** Its optics on springs, if any. */
  optics?: OpticalState | null;
}"""),
("""  merge: number;
  shadow: boolean;""", """  merge: number;
  shadow: boolean;
  /** Composite the panes back to front, each refracting those before it. */
  layered?: boolean;
  /** With `layered`: keep only this pane in the output. */
  clip?: number;"""),
("""      const hostRect = host.getBoundingClientRect();
      // Divide out the glass's own squash (a centered matrix, area kept) so only
      // ancestor scale remains, and anchor at the center, which it never moves.
      const [ma, mb, mc, md] = ownMatrix(host);
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      const sx = w ? hostRect.width / (Math.abs(ma) * w + Math.abs(mc) * h) : 1;
      const sy = h ? hostRect.height / (Math.abs(mb) * w + Math.abs(md) * h) : 1;
      const left = hostRect.left + (hostRect.width - w * sx) / 2;
      const top = hostRect.top + (hostRect.height - h * sy) / 2;
""", """      const { left, top, sx, sy } = hostOrigin(host);
"""),
("      for (const p of f.panes) panes.push({ x: p.x - box.x, y: p.y - box.y, glass: p.glass, tint: resolveTint(p.el, p.glass.tint), ripple: rippleOf(p.el) ?? null });",
 "      for (const p of f.panes) panes.push({ x: p.x - box.x, y: p.y - box.y, glass: p.glass, tint: resolveTint(p.el, p.glass.tint), ripple: rippleOf(p.el) ?? null, optics: p.optics ?? null });"),
("      renderer.render(panes, placement, pr, { merge: f.merge, panesOnly: true, shadow: f.shadow ? MERGED_SHADOW : null });",
 "      renderer.render(panes, placement, pr, { merge: f.merge, panesOnly: true, shadow: f.shadow ? MERGED_SHADOW : null, layered: f.layered, clip: f.clip });"),
("""/** The host's own inline matrix (the squash) as [a, b, c, d]; identity for anything else. */""",
 """/**
 * Where a host's untransformed box sits on screen: its top left, and the
 * scale its ancestors apply. Its own squash (a centered matrix, area kept) is
 * divided out, anchored at the center, which the squash never moves.
 */
export function hostOrigin(host: HTMLElement): { left: number; top: number; sx: number; sy: number } {
  const r = host.getBoundingClientRect();
  const [ma, mb, mc, md] = ownMatrix(host);
  const w = host.offsetWidth;
  const h = host.offsetHeight;
  const sx = w ? r.width / (Math.abs(ma) * w + Math.abs(mc) * h) : 1;
  const sy = h ? r.height / (Math.abs(mb) * w + Math.abs(md) * h) : 1;
  return { left: r.left + (r.width - w * sx) / 2, top: r.top + (r.height - h * sy) / 2, sx, sy };
}

/** The host's own inline matrix (the squash) as [a, b, c, d]; identity for anything else. */"""),
])

edit('packages/meniscus/src/react/Glass.tsx', [
("import { MediaLayer, type MediaFrame } from './MediaLayer';\n", "import { MediaLayer, hostOrigin, type MediaFrame } from './MediaLayer';\n"),
("""    const box = { x: -node.clientLeft, y: -node.clientTop, width: node.offsetWidth, height: node.offsetHeight };
    return { panes: [{ x: box.x, y: box.y, glass, el: node }], box, merge: 0, shadow: false, key: `${box.width}x${box.height}|${optionsKey(optionsRef.current)}` };
  }, [node]);""", """    const box = { x: -node.clientLeft, y: -node.clientTop, width: node.offsetWidth, height: node.offsetHeight };
    const own = opticsRef.current?.state ?? null;
    const key = `${box.width}x${box.height}|${optionsKey(optionsRef.current)}|${opticsKey(own)}`;
    const self = { x: box.x, y: box.y, glass, el: node, optics: own };
    const below = layerRef.current?.below() ?? [];
    if (!below.length) return { panes: [self], box, merge: 0, shadow: false, key };
    // Stacked: draw the glass beneath, back to front, and keep only this one.
    const origin = hostOrigin(node);
    const panes = below.map((b) => {
      const r = b.el.getBoundingClientRect();
      return { x: (r.left - origin.left) / origin.sx - node.clientLeft, y: (r.top - origin.top) / origin.sy - node.clientTop, glass: b.glass, el: b.el, optics: b.optics.state };
    });
    panes.push(self);
    const m = STACK_MARGIN;
    const wide = { x: box.x - m, y: box.y - m, width: box.width + 2 * m, height: box.height + 2 * m };
    const stackKey = panes.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${opticsKey(p.optics)}`).join(';');
    return { panes, box: wide, merge: 0, shadow: false, layered: true, clip: panes.length - 1, key: `${key}|${stackKey}` };
  }, [node]);"""),
("  const gRef = useRef(g);\n  gRef.current = g;\n",
 "  const gRef = useRef(g);\n  gRef.current = g;\n  const opticsRef = useRef(optics);\n  opticsRef.current = optics;\n  const layerRef = useRef(layer);\n  layerRef.current = layer;\n"),
("/** Page around a copied backdrop, so its blur has something to draw from at the rim, px. */",
 "/** Room around a stacked glass's canvas, so the layers beneath refract from real pixels at its rim, px. */\nconst STACK_MARGIN = 48;\n\nconst opticsKey = (s: { presence: number; refraction: number; highlightX: number; highlightY: number; tint: number; shadow: number } | null) =>\n  s ? [s.presence, s.refraction, s.highlightX, s.highlightY, s.tint, s.shadow].map((v) => v.toFixed(3)).join(',') : '';\n\n/** Page around a copied backdrop, so its blur has something to draw from at the rim, px. */"),
])
```

`layer` must be declared before `layerRef`. Task 5 declares `const layer = useContext(LayerContext);` just before the fallback line, and `gRef` comes later in the component, so the order holds. Keep it that way.

- [x] **Step 5: Run the checks**

Run: `pnpm --filter meniscus test && pnpm typecheck && MENISCUS_TEST_URL=http://localhost:5199/ node apps/site/scripts/check-living-optics.mjs`
Expected: unit tests and typecheck pass. The browser script prints `PASS` with `opticsCheck.rest === 0`, `absent === 0`, `outside === 0` and `inside > 200`.

- [x] **Step 6: Commit**

```bash
git add packages/meniscus/src/webgl packages/meniscus/src/react/MediaLayer.tsx packages/meniscus/src/react/Glass.tsx apps/site/scripts/check-living-optics.mjs
git commit -m "feat(webgl): compound stacked glass and animate optics in the renderer"
```

---

### Task 7: The "Glass on glass" plate and browser proof

**Files:**
- Create: `apps/site/src/home/PlateStack.tsx`
- Modify: `apps/site/src/home/Home.tsx` (render it after `PlateDepth`)
- Modify: `apps/site/src/home/experiments.css` (stack styles)
- Create: `apps/site/scripts/check-stack.mjs`
- Modify: `apps/site/package.json` (`test:stack` script)

**Interfaces:**
- Consumes: `Glass.Stack`, `Glass.Layer`, `SPRINGS` and `SpringPreset` (Tasks 1, 5); the site's `Plate`, `Scale`, `plateSrc` and `useTheme`.

- [x] **Step 1: Write the failing browser check** — `apps/site/scripts/check-stack.mjs`

```js
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const url = process.env.MENISCUS_TEST_URL ?? 'http://127.0.0.1:5173/';
const engines = (process.env.MENISCUS_BROWSERS ?? 'chromium,webkit').split(',');
const period = (k, m = 1) => 2 * Math.PI * Math.sqrt(m / k);

for (const name of engines) {
  const browser = await { chromium, webkit }[name].launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(url);
    await page.locator('.splash').waitFor({ state: 'detached' });
    const stage = page.locator('.stack__stage');
    await stage.scrollIntoViewIfNeeded();
    const card = page.locator('.stack__card');
    const side = page.locator('.stack__sidebar');
    assert.equal(await card.getAttribute('data-meniscus'), name === 'chromium' ? 'refract' : 'webgl', `${name}: card path`);

    // A wide stagger, so frame timing can't hide it.
    const stagger = page.getByLabel('Stagger', { exact: true });
    await stagger.fill('0.6');
    const toggle = page.getByRole('button', { name: /panes/ });
    await toggle.click();
    await page.waitForTimeout(1500);
    assert.equal(await card.evaluate((el) => el.hasAttribute('inert')), true, `${name}: closed layers are inert`);
    await page.evaluate(() => {
      const els = [document.querySelector('.stack__card'), document.querySelector('.stack__sidebar')];
      window.__starts = [null, null];
      const t0 = performance.now();
      const tick = () => {
        els.forEach((el, i) => {
          if (window.__starts[i] === null && Number(el.style.getPropertyValue('--meniscus-presence') || 0) > 0.02) window.__starts[i] = performance.now() - t0;
        });
        if (window.__starts.includes(null) && performance.now() - t0 < 3000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await toggle.click();
    await page.waitForTimeout(1600);
    const [cardStart, sideStart] = await page.evaluate(() => window.__starts);
    const expected = 0.6 * period(300) * 1000;
    assert.ok(Math.abs(sideStart - cardStart - expected) < 70, `${name}: stagger ${sideStart - cardStart} ms, expected ${expected.toFixed(0)}`);

    // Compounding: the card's pixels change when the sidebar moves beneath it.
    const overlap = async () => {
      const c = await card.boundingBox();
      const s = await side.boundingBox();
      const x = Math.max(c.x, s.x) + 4;
      const w = Math.min(c.x + c.width, s.x + s.width) - x - 4;
      const shot = await page.screenshot({ clip: { x, y: c.y + 12, width: Math.max(8, w), height: 40 } });
      return shot;
    };
    await card.evaluate((el) => { el.style.left = '150px'; el.style.top = '60px'; });
    await page.waitForTimeout(400);
    const before = await overlap();
    await side.evaluate((el) => { el.style.top = '90px'; });
    await page.waitForTimeout(400);
    const after = await overlap();
    assert.ok(!before.equals(after), `${name}: the card refracts the sidebar beneath it`);
    assert.deepEqual(errors, [], `${name}: page errors`);
    console.log(JSON.stringify({ engine: name, result: 'PASS', stagger: Math.round(sideStart - cardStart), expected: Math.round(expected) }));
  } finally {
    await browser.close();
  }
}
```

Add `"test:stack": "node scripts/check-stack.mjs"` to `apps/site/package.json` scripts.

- [x] **Step 2: Run to verify it fails**

Run: `MENISCUS_TEST_URL=http://localhost:5199/ node apps/site/scripts/check-stack.mjs`
Expected: FAIL: `.stack__stage` not found (a timeout on `scrollIntoViewIfNeeded`).

- [x] **Step 3: Implement the plate** — `apps/site/src/home/PlateStack.tsx`

```tsx
import { Glass, SPRINGS, type SpringPreset } from 'meniscus';
import { useRef, useState, type PointerEvent } from 'react';
import { Plate } from '../shared/chrome';
import { Scale } from '../shared/Scale';
import { plateSrc, useTheme } from '../shared/theme';

const PRESETS = Object.keys(SPRINGS) as SpringPreset[];

export function PlateStack() {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const [preset, setPreset] = useState<SpringPreset>('snappy');
  const [stagger, setStagger] = useState(0.12);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const clamp = (v: number, r: number) => Math.max(-r, Math.min(r, v));

  const onDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset({ x: clamp(e.clientX - d.x, 220), y: clamp(e.clientY - d.y, 120) });
  };
  const onUp = (e: PointerEvent<HTMLElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  return (
    <Plate folio="Experiment" id="stack" className="stack" label="Glass on glass">
      <div className="interfaces__text">
        <h2>Glass on glass.</h2>
        <p>
          A sidebar and a card, one pane above the other. The card bends the sidebar beneath it as well as the plate. Open them together and the nearer pane
          leads while the deeper one follows, each settling on its own spring. Fling the card and let its light and shadow catch up.
        </p>
      </div>
      <Glass.Stack className="stack__stage" physics={preset} stagger={stagger} appear>
        <Glass.Layer kind="context" className="stack__scene">
          <img src={plateSrc('opticks-plate-2', theme)} alt="Newton’s Opticks, Book I, Plate II, behind two panes of glass." />
        </Glass.Layer>
        <Glass.Layer as="nav" depth={1} present={open} className="stack__sidebar" radius={22} aria-label="Plates">
          <a href="#main">Specimen</a>
          <a href="#depth">Three surfaces</a>
          <a href="#stack">Glass on glass</a>
          <a href="#try-online">Start</a>
        </Glass.Layer>
        <Glass.Layer
          depth={2}
          present={open}
          className="stack__card"
          radius={26}
          interactive
          role="region"
          aria-label="Stacked card"
          style={{ left: `calc(38% + ${offset.x}px)`, top: `calc(18% + ${offset.y}px)` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <h3>Plate II</h3>
          <p>Drag this card across the sidebar: every edge you pass bends twice.</p>
        </Glass.Layer>
      </Glass.Stack>
      <div className="stack__controls">
        <button type="button" className="action action--primary" aria-pressed={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Close the panes' : 'Open the panes'}
        </button>
        <label className="stack__preset">
          Spring
          <select value={preset} onChange={(e) => setPreset(e.target.value as SpringPreset)}>
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <Scale label="Stagger" value={stagger} min={-0.6} max={0.6} step={0.02} onChange={setStagger} format={(v) => v.toFixed(2)} hint="Fraction of a spring period between depths. Negative leads with the deeper pane." />
      </div>
    </Plate>
  );
}
```

`Home.tsx`: `import { PlateStack } from './PlateStack';` and render `<PlateStack />` right after `<PlateDepth />`.

Append to `experiments.css`:

```css
.stack__stage { position: relative; height: 440px; overflow: hidden; border: var(--hair) solid var(--rule-faint); }
.stack__scene { position: absolute; inset: 0; }
.stack__scene img { width: 100%; height: 100%; object-fit: cover; object-position: center 70%; display: block; }
.stack__sidebar { position: absolute; left: 22px; top: 22px; bottom: 22px; width: 200px; padding: 18px 16px; display: grid; align-content: start; gap: 4px; translate: calc((1 - var(--meniscus-presence, 1)) * -36px) 0; }
.stack__sidebar a { color: var(--ink); text-decoration: none; padding: 8px 10px; border-radius: 12px; font: 600 var(--fs-ui) var(--font-display); }
.stack__sidebar a:hover, .stack__sidebar a:focus-visible { background: color-mix(in srgb, var(--ink) 8%, transparent); }
.stack__card { position: absolute; width: 300px; padding: 20px 22px; cursor: grab; touch-action: none; translate: 0 calc((1 - var(--meniscus-presence, 1)) * 22px); }
.stack__card:active { cursor: grabbing; }
.stack__card h3 { margin: 0 0 6px; font: 700 var(--fs-h3, 1.2rem) var(--font-display); }
.stack__card p { margin: 0; }
.stack__controls { display: flex; flex-wrap: wrap; gap: 18px 28px; align-items: end; margin-top: 18px; }
.stack__preset { display: grid; gap: 6px; font: 600 var(--fs-ui) var(--font-display); }
.stack__preset select { font: inherit; padding: 6px 10px; border-radius: 10px; border: var(--hair) solid var(--rule-faint); background: transparent; color: var(--ink); }
@media (max-width: 640px) {
  .stack__stage { height: 380px; }
  .stack__sidebar { width: 136px; }
  .stack__card { width: 220px; }
}
```

- [x] **Step 4: Run the browser checks, then look**

Run: `MENISCUS_TEST_URL=http://localhost:5199/ node apps/site/scripts/check-stack.mjs && MENISCUS_TEST_URL=http://localhost:5199/ node apps/site/scripts/check-living-optics.mjs`
Expected: `PASS` for Chromium and WebKit, with the measured stagger within 70 ms of the expected ~218 ms. The living-optics check still passes, including the 320 px no-overflow check.

Then run a scratchpad Playwright script (not committed) and view the frames:
- the plate after Open at +60 / +160 / +400 ms, in Chromium and WebKit
- the card dragged over the sidebar

- [x] **Step 5: Commit**

```bash
git add apps/site/src/home/PlateStack.tsx apps/site/src/home/Home.tsx apps/site/src/home/experiments.css apps/site/scripts/check-stack.mjs apps/site/package.json
git commit -m "feat(site): add the glass-on-glass plate"
```

---

### Task 8: Documentation, verification, review

**Files:**
- Modify: `packages/meniscus/README.md` (Stacked glass, Physics, props rows for `intensity` and `optics`)
- Modify: `apps/site/src/docs/content.ts` (`STACK_PROPS`, `LAYER_PROPS`, `CODE.stack`, and the `intensity`/`optics` rows in `GLASS_PROPS`)
- Modify: `apps/site/src/docs/Docs.tsx` (a "Stacked glass" section after the WebGL stage section, renumbering the sections after it)
- Modify: `apps/site/src/components/Components.tsx` (`intensity` and `optics` rows in the glass props)
- Modify: `CHANGELOG.md`

- [x] **Step 1: README**
  - Props table: `intensity` (`'subtle' | 'regular' | 'strong' | number`, default `'regular'`) and `optics` (`GlassPhysics`).
  - New `## Stacked glass` section: a sidebar and card example, the capability matrix from spec §1, the `stagger` rule, `present` and `appear`, and entrance motion through `--meniscus-presence`.
  - New `## Physics` section: `useGlassPhysics`, the portable `GlassPhysics` loop with `scheduler: 'manual'`, the `SPRINGS` presets, the channel speeds, and emergent momentum.
  - Limits: in Safari and Firefox over media, a WebGL layer covers lower layers' text instead of refracting it.
- [x] **Step 2: Manual and catalog**
  - `content.ts`: add `STACK_PROPS` and `LAYER_PROPS` rows matching the JSDoc in `GlassStack.tsx`, plus `CODE.stack` (the plate's markup, trimmed), and the `intensity` and `optics` rows in `GLASS_PROPS`.
  - `Docs.tsx`: a `Section id="stack"` titled "Stacked glass", with two paragraphs, the code block and both props tables. Renumber the `n=` of the sections after it.
  - Catalog: add the two glass rows.
- [x] **Step 3: CHANGELOG**, under `## [Unreleased]`:
  - Added: `Glass.Stack`/`Glass.Layer`, `useGlassPhysics`/`GlassPhysics`/`SPRINGS`, `optics`, `intensity`.
  - Changed: one spring solver drives press and squash.
- [x] **Step 4: Verify.** Run `pnpm test && pnpm typecheck && pnpm build && node apps/site/scripts/check-living-optics.mjs && node apps/site/scripts/check-stack.mjs` (both browser scripts with `MENISCUS_TEST_URL` set). All must pass.
- [x] **Step 5: Commit.** `git commit -m "docs: document stacked glass and layer physics"`
- [x] **Step 6: Final review.** Dispatch one fresh reviewer on the most capable model over the whole branch, with this plan, the spec and the Review Focus list. Fix Critical and Important findings with a RED→GREEN test each, then commit.

## Decisions and progress

- Executed inline on `feat/glass-stack` (cut from the merged liquid-physics work).
- **Plan-code corrections** (ledger rulings):
  - React 19 `act()` returns a thenable, so the stagger tests capture their value in a closure.
  - The nested-glass test reads `LayerContext` directly.
  - Two type annotations in the stacking code.
- **The v0.2.0 flick check was flaky:** a position read sat between the last move and the release. It moved after the release; 5/5 runs pass.
- **The demo surfaced two library bugs, both fixed test-first:**
  - The hook disposed on StrictMode's fake unmount; it now pauses and resumes.
  - The stack's methods changed identity when the scene appeared, which dropped queued entrances; they're stable now.
- **The user's report surfaced two more, both fixed:**
  - A bouncy exit rebounded into view; presence now has an inelastic floor at 0.
  - Text outlived its glass on close; opacity follows `presenceOpacity`, and the demo fades content ahead of its glass.
- **UX:**
  - A new spring replays the entrance.
  - The toggle loses `aria-pressed`.
  - Sidebar links fit on one line at 390 px.
- **Final review (fresh reviewer):**
  - Five Important findings plus one re-graded Minor, all fixed with RED→GREEN tests: late-mounted layers now compound, lower resizes redraw, SSR hides absent layers, a class position wins, throwing listeners can't stop the loop, and a cancelled lift drops back.
  - Eight minors are deferred (see the ledger).
- **Verification:**
  - Suite: 163 tests. Typecheck and build are clean.
  - Browser checks pass in Chromium (live refraction) and WebKit (WebGL), with stagger measured within a frame of the expected 218 ms.

