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
