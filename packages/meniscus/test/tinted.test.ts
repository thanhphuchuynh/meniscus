import { ACCENT, defaultTint, glassTint, resolveGlass, VARIANTS } from '../src/core/glass';

it('mixes a tinted glass’s color at 70%, defaulting to the accent', () => {
  expect(glassTint({ variant: 'tinted', tint: '#e34720' })).toBe('color-mix(in srgb, #e34720 70%, transparent)');
  expect(glassTint({ variant: 'tinted' })).toBe(`color-mix(in srgb, ${ACCENT} 70%, transparent)`);
});

it('lays other tints over as given; adaptive starts out as auto', () => {
  expect(glassTint({ tint: 'rgba(0, 0, 0, 0.2)' })).toBe('rgba(0, 0, 0, 0.2)');
  expect(glassTint({ appearance: 'adaptive' })).toBe(defaultTint('regular', 'auto'));
  expect(glassTint({ appearance: 'dark' })).toBe(VARIANTS.regular.darkTint);
  expect(glassTint({ variant: 'clear', appearance: 'light' })).toBe(VARIANTS.clear.tint);
});

it('resolves tinted glass with its own frost and light', () => {
  const g = resolveGlass({ variant: 'tinted' }, 120, 44);
  expect(g).toMatchObject({ blur: 4, saturation: 1.8, specular: 0.9, rim: 0.8, shade: 0.25 });
  expect(g.tint).toBe(glassTint({ variant: 'tinted' }));
});
