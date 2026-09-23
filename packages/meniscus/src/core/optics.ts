import { resolveProfile, type Profile } from './profiles';

export interface OpticsInput {
  /** Width of the curved band along the outline, in px. */
  bezel: number;
  /** Height the bezel rises to at the plateau, in px: the glass thickness. */
  thickness: number;
  /** Index of refraction: 1 is air, 1.5 is window glass, 2.4 is diamond. */
  ior: number;
  profile?: Profile;
  /**
   * Allow caustic folds. A steep rim can shift neighboring points past each
   * other, so a single line in the page shows up twice near the outline. Off
   * by default: the shift is limited so the image compresses into the rim
   * instead of folding.
   */
  caustics?: boolean;
  /** Samples taken across the bezel. */
  samples?: number;
}

/** With caustics off, the shift may change by at most this much per px moved inward, which keeps the mapping one-to-one. */
export const FOLD_LIMIT = 0.85;

/**
 * How light bends at every point across the bezel, sampled from the outline
 * (index 0) to the plateau (last index).
 */
export interface RefractionProfile {
  /** Horizontal shift of the refracted ray where it lands on the page, px. Positive points inward. */
  displacement: Float32Array;
  /** Surface slope dz/dd: height gained per px moved inward. */
  slope: Float32Array;
  /** Surface height above the page, px. */
  height: Float32Array;
  /** Largest absolute displacement, px. */
  maxDisplacement: number;
  samples: number;
  bezel: number;
}

export const DEFAULT_SAMPLES = 256;

/**
 * Traces one vertical view ray per sample through the bezel.
 *
 * The eye looks straight down. Where the surface tilts by angle α, the ray
 * enters the glass at incidence α and leaves the surface at θt, with
 * sin α = n · sin θt (Snell's law, air outside). The refracted ray leans
 * α − θt off vertical, toward the plateau, and travels the local glass height
 * before reaching the page, so it lands height · tan(α − θt) away from where
 * it entered. That shift is the displacement the filters and shaders apply.
 */
export function computeRefractionProfile(input: OpticsInput): RefractionProfile {
  const samples = Math.max(2, Math.floor(input.samples ?? DEFAULT_SAMPLES));
  const bezel = Math.max(1e-6, input.bezel);
  const thickness = Math.max(0, input.thickness);
  const ior = Math.max(1, input.ior);
  const f = resolveProfile(input.profile);

  const displacement = new Float32Array(samples);
  const slope = new Float32Array(samples);
  const height = new Float32Array(samples);
  const step = 1 / (samples - 1);
  const half = step / 2;
  let maxDisplacement = 0;

  for (let i = 0; i < samples; i++) {
    const t = i * step;
    const t0 = Math.max(0, t - half);
    const t1 = Math.min(1, t + half);
    const z = thickness * f(t);
    const dzdd = (thickness * (f(t1) - f(t0))) / (t1 - t0) / bezel;
    const alpha = Math.atan(dzdd);
    const thetaT = Math.asin(Math.sin(alpha) / ior);
    const shift = z * Math.tan(alpha - thetaT);

    height[i] = z;
    slope[i] = dzdd;
    displacement[i] = shift;
  }

  // A screen point u px in from the outline samples the page at u + shift(u).
  // That stays one-to-one while d(shift)/du > -1, so walking outward from the
  // plateau, the shift may grow by less than one px per px.
  if (!input.caustics) {
    const limit = FOLD_LIMIT * step * bezel;
    for (let i = samples - 2; i >= 0; i--) {
      const cap = displacement[i + 1]! + limit;
      if (displacement[i]! > cap) displacement[i] = cap;
    }
    // The glass thins to nothing exactly on the outline, so the raw shift
    // drops to zero in the last fraction of a px. Drawn, that is a hairline
    // of unrefracted page around the glass; hold the rim's shift instead.
    if (displacement[1]! > displacement[0]!) displacement[0] = displacement[1]!;
  }

  for (let i = 0; i < samples; i++) {
    if (Math.abs(displacement[i]!) > maxDisplacement) maxDisplacement = Math.abs(displacement[i]!);
  }

  return { displacement, slope, height, maxDisplacement, samples, bezel };
}

/** Linear interpolation into a profile table at t in [0, 1]. */
export function sampleTable(table: Float32Array, t: number): number {
  const n = table.length;
  if (n === 0) return 0;
  if (t <= 0) return table[0]!;
  if (t >= 1) return table[n - 1]!;
  const x = t * (n - 1);
  const i = Math.floor(x);
  const frac = x - i;
  const a = table[i]!;
  const b = table[Math.min(n - 1, i + 1)]!;
  return a + (b - a) * frac;
}

export interface RayTrace {
  /** Surface tilt at this point, radians. */
  incidence: number;
  /** Angle of the refracted ray from the surface normal, radians. */
  refraction: number;
  /** Angle of the refracted ray from vertical, radians. */
  deviation: number;
  /** Surface height, px. */
  height: number;
  /** Where the ray lands, measured inward from where it entered, px. */
  shift: number;
}

/**
 * The full optics at one point `d` px in from the outline. Diagrams use this
 * to draw the exact ray the renderers apply.
 */
export function traceRay(input: OpticsInput, d: number): RayTrace {
  const bezel = Math.max(1e-6, input.bezel);
  const thickness = Math.max(0, input.thickness);
  const ior = Math.max(1, input.ior);
  const f = resolveProfile(input.profile);
  const t = Math.min(1, Math.max(0, d / bezel));
  const h = 1e-4;
  const t0 = Math.max(0, t - h);
  const t1 = Math.min(1, t + h);
  const z = thickness * f(t);
  const dzdd = (thickness * (f(t1) - f(t0))) / (t1 - t0) / bezel;
  const incidence = Math.atan(dzdd);
  const refraction = Math.asin(Math.sin(incidence) / ior);
  const deviation = incidence - refraction;
  return { incidence, refraction, deviation, height: z, shift: z * Math.tan(deviation) };
}
