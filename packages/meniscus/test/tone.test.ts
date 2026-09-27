import { composite, DARK_BELOW, LIGHT_ABOVE, luminance, parseComputedColor, pickTone } from '../src/core/tone';

it('computes WCAG relative luminance', () => {
  expect(luminance([1, 1, 1])).toBeCloseTo(1, 6);
  expect(luminance([0, 0, 0])).toBe(0);
  expect(luminance([0.5, 0.5, 0.5])).toBeCloseTo(0.214, 3);
  expect(luminance([0, 1, 0])).toBeCloseTo(0.7152, 4);
});

it('composites a translucent color over a backdrop', () => {
  expect(composite([0, 0, 0, 0.5], 1)).toBeCloseTo(0.5, 6);
  expect(composite([1, 1, 1, 0], 0.3)).toBeCloseTo(0.3, 6);
  expect(composite([1, 1, 1], 0)).toBeCloseTo(1, 6);
});

it('picks a tone, keeping the previous one inside the margin', () => {
  expect(pickTone(DARK_BELOW - 0.01, null)).toBe('dark');
  expect(pickTone(LIGHT_ABOVE + 0.01, 'dark')).toBe('light');
  expect(pickTone(0.18, 'dark')).toBe('dark');
  expect(pickTone(0.18, 'light')).toBe('light');
  expect(pickTone(0.18, null)).toBe('light');
});

it('parses computed colors without a canvas', () => {
  expect(parseComputedColor('rgb(18, 52, 86)')).toEqual([18 / 255, 52 / 255, 86 / 255, 1]);
  expect(parseComputedColor('rgba(0, 0, 0, 0)')).toEqual([0, 0, 0, 0]);
  expect(parseComputedColor('rgb(255 128 0 / 50%)')).toEqual([1, 128 / 255, 0, 0.5]);
  expect(parseComputedColor('color(srgb 0.1 0.2 0.3 / 0.4)')).toEqual([0.1, 0.2, 0.3, 0.4]);
  expect(parseComputedColor('canvas')).toBeNull();
  expect(parseComputedColor('rgb(nope)')).toBeNull();
});
