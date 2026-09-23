/**
 * Bezel height profiles.
 *
 * A profile maps `t` (distance in from the glass outline, divided by the bezel
 * width, so 0 is the outline and 1 is where the bezel meets the flat top) to a
 * surface height in units of the glass thickness: 0 at the outline, 1 on the
 * plateau. The slope of this curve is what bends light.
 */
export type ProfileName = 'squircle' | 'circle' | 'parabolic' | 'lip';
export type ProfileFn = (t: number) => number;
export type Profile = ProfileName | ProfileFn;

const squircle: ProfileFn = (t) => Math.pow(1 - Math.pow(1 - t, 4), 0.25);

export const PROFILES: Readonly<Record<ProfileName, ProfileFn>> = {
  /** Flat for most of the bezel, then rolls off steeply at the outline. The default. */
  squircle,
  /** A quarter circle: the classic rounded edge. */
  circle: (t) => Math.sqrt(1 - (1 - t) * (1 - t)),
  /** A gentle bevel with a finite slope at the outline; the softest lensing. */
  parabolic: (t) => 1 - (1 - t) * (1 - t),
  /** A raised rim that dips back to the plateau, so the inner band magnifies. */
  lip: (t) => squircle(t) + 0.14 * Math.pow(Math.sin(Math.PI * t), 2),
};

export function resolveProfile(profile: Profile = 'squircle'): ProfileFn {
  if (typeof profile === 'function') return profile;
  return PROFILES[profile] ?? squircle;
}

/** A stable cache key for a profile. Custom functions get a per-function id. */
const customIds = new WeakMap<ProfileFn, number>();
let nextCustomId = 0;
export function profileKey(profile: Profile = 'squircle'): string {
  if (typeof profile !== 'function') return profile;
  let id = customIds.get(profile);
  if (id === undefined) {
    id = nextCustomId++;
    customIds.set(profile, id);
  }
  return `fn${id}`;
}
