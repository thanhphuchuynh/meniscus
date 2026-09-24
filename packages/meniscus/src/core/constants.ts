import type { GlassOptions } from './glass';

/** Every prop of `Glass` that configures the glass rather than the element. */
export const GLASS_OPTION_KEYS = [
  'variant',
  'appearance',
  'radius',
  'bezel',
  'refraction',
  'ior',
  'profile',
  'caustics',
  'blur',
  'saturation',
  'tint',
  'aberration',
  'specular',
  'rim',
  'shade',
  'lightAngle',
  'lightElevation',
] as const satisfies ReadonlyArray<keyof GlassOptions>;

/** The shadow `Glass` draws unless given another, or `false`. */
export const DEFAULT_SHADOW = '0 1px 2px rgba(0, 0, 0, 0.08), 0 10px 28px -6px rgba(0, 0, 0, 0.18)';
