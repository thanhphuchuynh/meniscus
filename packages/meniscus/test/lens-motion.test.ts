import { describe, expect, it } from 'vitest';
import { advanceLens, releaseLens } from '../../../apps/site/src/home/lensMotion';

describe('lens release motion', () => {
  const bounds = { minX: 0, maxX: 300, minY: 0, maxY: 200 };
  it('carries a flick forward and settles at its projected destination', () => {
    const flight = releaseLens({ x: 100, y: 100 }, { x: 500, y: -100 }, bounds);
    advanceLens(flight, 1 / 60, bounds);
    expect(flight.position.x).toBeGreaterThan(100);
    for (let i = 0; i < 600; i++) advanceLens(flight, 1 / 60, bounds);
    expect(flight.position).toEqual(flight.target);
    expect(flight.velocity).toEqual({ x: 0, y: 0 });
  });
  it('keeps fast flicks inside the available bounds, even after a long frame', () => {
    const flight = releaseLens({ x: 290, y: 5 }, { x: 5000, y: -5000 }, bounds);
    for (let i = 0; i < 300; i++) {
      advanceLens(flight, i === 0 ? 2 : 1 / 60, bounds);
      expect(flight.position.x).toBeGreaterThanOrEqual(0);
      expect(flight.position.x).toBeLessThanOrEqual(300);
      expect(flight.position.y).toBeGreaterThanOrEqual(0);
      expect(flight.position.y).toBeLessThanOrEqual(200);
    }
    expect(flight.position).toEqual(flight.target);
  });
  it('does not move a stationary release', () => {
    const flight = releaseLens({ x: 100, y: 100 }, { x: 0, y: 0 }, bounds);
    expect(advanceLens(flight, 1 / 60, bounds)).toBe(false);
    expect(flight.position).toEqual({ x: 100, y: 100 });
  });
});
