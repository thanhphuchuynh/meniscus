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
