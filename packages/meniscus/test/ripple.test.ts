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
    // Beside the path the surface is still, bar the scheme's one-cell-per-step precursor.
    expect(Math.abs(at(fast, fast.cols / 2, 3))).toBeLessThan(Math.abs(at(fast, fast.cols / 2, fast.rows / 2)) * 1e-3);
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
