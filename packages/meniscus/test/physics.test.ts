import { afterEach, describe, expect, it, vi } from 'vitest';
import { GlassPhysics, presenceOpacity, staggerDelay, type GlassPhysicsOptions } from '../src/core/physics';
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

  it('pauses without losing its place, and resumes', () => {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => queue.push(f));
    const p = new GlassPhysics();
    created.push(p);
    p.to({ presence: 0 }, { delay: 50 });
    p.pause();
    let now = 0;
    for (let i = 0; i < 10 && queue.length; i++) queue.shift()!((now += 16));
    expect(queue.length).toBe(0);
    expect(p.state.presence).toBe(1);
    p.resume();
    expect(queue.length).toBe(1);
    for (let i = 0; i < 400 && queue.length; i++) queue.shift()!((now += 16));
    expect(p.state.presence).toBe(0);
  });

  it('never bounces back into view once it has left, even on a bouncy spring', () => {
    const p = make({ physics: 'bouncy' });
    p.to({ presence: 0 });
    let gone = false;
    for (let i = 0; i < 180; i++) {
      p.step(1 / 60);
      if (p.state.presence <= 0) gone = true;
      else if (gone) throw new Error(`came back to ${p.state.presence} after leaving`);
      expect(p.state.presence).toBeGreaterThanOrEqual(0);
    }
    expect(gone).toBe(true);
  });

  it('still overshoots on the way in with a bouncy spring', () => {
    const p = make({ physics: 'bouncy', initial: { presence: 0 } });
    p.to({ presence: 1 });
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      p.step(1 / 60);
      peak = Math.max(peak, p.state.presence);
    }
    expect(peak).toBeGreaterThan(1.05);
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

describe('presenceOpacity', () => {
  it('stays opaque down to presence 0.5 and is gone by 0.15, before the spring’s slow tail', () => {
    expect(presenceOpacity(1)).toBe(1);
    expect(presenceOpacity(1.2)).toBe(1);
    expect(presenceOpacity(0.5)).toBe(1);
    expect(presenceOpacity(0.325)).toBeCloseTo(0.5, 9);
    expect(presenceOpacity(0.15)).toBe(0);
    expect(presenceOpacity(0)).toBe(0);
    expect(presenceOpacity(-0.1)).toBe(0);
  });

  it('spends under 50 ms half-faded when a snappy glass leaves', () => {
    const p = make();
    p.to({ presence: 0 });
    let ghost = 0;
    for (let i = 0; i < 120; i++) {
      p.step(1 / 240);
      const o = presenceOpacity(p.state.presence);
      if (o > 0.05 && o < 0.5) ghost += 1000 / 240;
    }
    expect(ghost).toBeLessThan(50);
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
