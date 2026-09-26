import { toDataURL } from './encode';
import { createDisplacementTiles, createHighlightImage } from './maps';
import { computeRefractionProfile, type RefractionProfile } from './optics';
import { profileKey, type Profile } from './profiles';
import { resolveRadius, type Radius } from './shape';

export type GlassVariant = 'regular' | 'clear';
export type GlassAppearance = 'auto' | 'light' | 'dark';
/** Semantic strength: a named step, or a number from 0 (subtle) through 0.5 (regular) to 1 (strong). */
export type GlassIntensity = 'subtle' | 'regular' | 'strong' | number;

export interface GlassOptions {
  /** `regular` frosts and tints for legibility; `clear` stays transparent over media. */
  variant?: GlassVariant;
  /**
   * How strongly the glass bends and lights: `'subtle'`, `'regular'` (the
   * default) or `'strong'`, or a number from 0 (subtle) through 0.5 (regular)
   * to 1 (strong). Explicit `refraction`, `specular` and `aberration` win.
   */
  intensity?: GlassIntensity;
  /**
   * Light glass (a pale wash) or dark glass (a smoky one). `auto` follows the
   * page's color scheme, including a site's own theme switch, through CSS
   * `light-dark()`. Only sets the default tint; an explicit `tint` wins.
   */
  appearance?: GlassAppearance;
  /** Corner radius in px, or `'capsule'` for fully rounded ends. */
  radius?: Radius;
  /** Width of the curved edge band in px. Capped at the corner radius. */
  bezel?: number;
  /** Glass thickness relative to the bezel width. 0 turns refraction off. */
  refraction?: number;
  /** Index of refraction. 1.5 is window glass. */
  ior?: number;
  /** Shape of the edge's cross-section. */
  profile?: Profile;
  /** Let a steep rim fold the image into doubled lines, as thick real glass does. Off by default. */
  caustics?: boolean;
  /** Backdrop blur, px. */
  blur?: number;
  /** Backdrop saturation multiplier. */
  saturation?: number;
  /** Color laid over the refracted backdrop. */
  tint?: string;
  /** Chromatic aberration: 0 is off, 1 splits red and blue by a quarter of the shift. */
  aberration?: number;
  /** Strength of reflected highlights, 0 to 1. */
  specular?: number;
  /** Strength of the bright line along the outline, 0 to 1. */
  rim?: number;
  /** Darkening where the rim turns edge-on, 0 to 1. Keeps glass legible on light pages. */
  shade?: number;
  /** Where the light comes from, degrees clockwise from the top. */
  lightAngle?: number;
  /** Light height above the surface, degrees. */
  lightElevation?: number;
}

interface VariantDefaults {
  blur: number;
  saturation: number;
  /** Tint of light glass. */
  tint: string;
  /** Tint of dark glass. */
  darkTint: string;
  specular: number;
  rim: number;
  shade: number;
}

export const VARIANTS: Readonly<Record<GlassVariant, VariantDefaults>> = {
  regular: { blur: 5, saturation: 1.6, tint: 'rgba(255, 255, 255, 0.12)', darkTint: 'rgba(22, 26, 32, 0.34)', specular: 0.8, rim: 0.7, shade: 0.35 },
  clear: { blur: 0.5, saturation: 1.15, tint: 'rgba(255, 255, 255, 0.03)', darkTint: 'rgba(8, 10, 14, 0.1)', specular: 0.9, rim: 0.8, shade: 0.3 },
};

/** The default tint of a variant in an appearance. */
export function defaultTint(variant: GlassVariant | undefined, appearance: GlassAppearance = 'auto'): string {
  const v = VARIANTS[variant ?? 'regular'] ?? VARIANTS.regular;
  if (appearance === 'light') return v.tint;
  if (appearance === 'dark') return v.darkTint;
  return `light-dark(${v.tint}, ${v.darkTint})`;
}

export const DEFAULTS = {
  radius: 28 as Radius,
  maxAutoBezel: 32,
  refraction: 1,
  ior: 1.5,
  profile: 'squircle' as Profile,
  caustics: false,
  aberration: 0,
  lightAngle: -45,
  lightElevation: 18,
} as const;

export interface ResolvedGlass {
  width: number;
  height: number;
  radius: number;
  bezel: number;
  thickness: number;
  ior: number;
  profile: Profile;
  caustics: boolean;
  blur: number;
  saturation: number;
  tint: string;
  aberration: number;
  specular: number;
  rim: number;
  shade: number;
  lightAngle: number;
  lightElevation: number;
}

const q = (v: number, step: number) => Math.round(v / step) * step;

const INTENSITY_STEP: Readonly<Record<'subtle' | 'regular' | 'strong', number>> = { subtle: 0, regular: 0.5, strong: 1 };
const SUBTLE = { refraction: 0.6, specular: 0.6, aberration: 0 };
const STRONG = { refraction: 1.5, specular: 1, aberration: 0.15 };

/** Refraction, specular and aberration for an intensity. Regular is the variant's own defaults, unchanged. */
export function intensityOptics(intensity: GlassIntensity | undefined, variant: GlassVariant | undefined): { refraction: number; specular: number; aberration: number } {
  const v = VARIANTS[variant ?? 'regular'] ?? VARIANTS.regular;
  const regular = { refraction: DEFAULTS.refraction, specular: v.specular, aberration: DEFAULTS.aberration };
  const t = typeof intensity === 'number' ? (Number.isFinite(intensity) ? Math.max(0, Math.min(1, intensity)) : 0.5) : (INTENSITY_STEP[intensity ?? 'regular'] ?? 0.5);
  if (t === 0.5) return regular;
  const [from, to, k] = t < 0.5 ? [SUBTLE, regular, t / 0.5] : [regular, STRONG, (t - 0.5) / 0.5];
  const mix = (a: number, b: number) => a + (b - a) * k;
  return { refraction: mix(from.refraction, to.refraction), specular: mix(from.specular, to.specular), aberration: mix(from.aberration, to.aberration) };
}

/** Fills defaults, caps the geometry to the element, and quantizes values that key the map caches. */
export function resolveGlass(options: GlassOptions, width: number, height: number): ResolvedGlass {
  const variant = VARIANTS[options.variant ?? 'regular'] ?? VARIANTS.regular;
  const radius = q(resolveRadius(options.radius ?? DEFAULTS.radius, width, height), 0.5);
  const bezel = q(Math.min(radius, Math.max(0, options.bezel ?? Math.min(radius, DEFAULTS.maxAutoBezel))), 0.5);
  const tone = intensityOptics(options.intensity, options.variant);
  const refraction = Math.max(0, options.refraction ?? tone.refraction);
  return {
    width,
    height,
    radius,
    bezel,
    thickness: q(bezel * refraction, 0.5),
    ior: q(Math.max(1, options.ior ?? DEFAULTS.ior), 0.01),
    profile: options.profile ?? DEFAULTS.profile,
    caustics: options.caustics ?? DEFAULTS.caustics,
    blur: Math.max(0, options.blur ?? variant.blur),
    saturation: Math.max(0, options.saturation ?? variant.saturation),
    tint: options.tint ?? defaultTint(options.variant, options.appearance),
    aberration: Math.max(0, Math.min(1, options.aberration ?? tone.aberration)),
    specular: q(Math.max(0, Math.min(1, options.specular ?? tone.specular)), 0.01),
    rim: q(Math.max(0, Math.min(1, options.rim ?? variant.rim)), 0.01),
    shade: q(Math.max(0, Math.min(1, options.shade ?? variant.shade)), 0.01),
    lightAngle: q(options.lightAngle ?? DEFAULTS.lightAngle, 1),
    lightElevation: q(Math.max(1, Math.min(89, options.lightElevation ?? DEFAULTS.lightElevation)), 1),
  };
}

class LRU<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, v: V): V {
    this.map.set(key, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
    return v;
  }
}

const profileCache = new LRU<RefractionProfile>(64);
const lightingCache = new LRU<RefractionProfile>(64);
const tileCache = new LRU<TileURLs>(96);
const highlightCache = new LRU<HighlightURL>(96);

function opticsKey(g: ResolvedGlass): string {
  return `${profileKey(g.profile)}|${g.bezel}|${g.thickness}|${g.ior}|${g.caustics ? 1 : 0}`;
}

/** The refraction profile for a glass, cached by its optics. */
export function glassProfile(g: ResolvedGlass): RefractionProfile {
  const key = opticsKey(g);
  return profileCache.get(key) ?? profileCache.set(key, computeRefractionProfile({ bezel: g.bezel, thickness: g.thickness, ior: g.ior, profile: g.profile, caustics: g.caustics }));
}

/**
 * The surface the lights see: the bezel's own curvature, with the glass as
 * thick as the bezel is wide. It ignores `refraction` and `ior`, so optical
 * strength can change (or be 0) without the rim and highlights changing shape.
 */
export function lightingProfile(g: Pick<ResolvedGlass, 'bezel' | 'profile'>): RefractionProfile {
  const key = `${profileKey(g.profile)}|${g.bezel}`;
  return lightingCache.get(key) ?? lightingCache.set(key, computeRefractionProfile({ bezel: g.bezel, thickness: g.bezel, ior: 1.5, profile: g.profile }));
}

export interface TileURLs {
  radius: number;
  scale: number;
  tl: string;
  tr: string;
  bl: string;
  br: string;
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export interface HighlightURL {
  url: string;
  /** Corner slice in image px, for `border-image-slice`. */
  slice: number;
}

/** Whether this glass bends light at all, so it has displacement tiles. Cheap: no maps are built. */
export function glassRefracts(g: ResolvedGlass): boolean {
  return g.radius >= 1 && g.bezel >= 0.5 && g.thickness > 0 && glassProfile(g).maxDisplacement > 0;
}

/** Encoded displacement tiles, or null when this glass doesn't refract. */
export function glassTiles(g: ResolvedGlass): TileURLs | null {
  if (!glassRefracts(g)) return null;
  const key = `${opticsKey(g)}|${g.radius}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const t = createDisplacementTiles(glassProfile(g), g.radius, g.bezel);
  return tileCache.set(key, {
    radius: g.radius,
    scale: t.scale,
    tl: toDataURL(t.tl),
    tr: toDataURL(t.tr),
    bl: toDataURL(t.bl),
    br: toDataURL(t.br),
    top: toDataURL(t.top),
    bottom: toDataURL(t.bottom),
    left: toDataURL(t.left),
    right: toDataURL(t.right),
  });
}

/** Encoded highlight map, or null when both highlight strengths are zero. */
export function glassHighlight(g: ResolvedGlass, pixelRatio = 1): HighlightURL | null {
  if (g.radius < 1 || (g.specular <= 0 && g.rim <= 0 && g.shade <= 0)) return null;
  const pr = q(Math.max(1, Math.min(3, pixelRatio)), 0.5);
  const key = `${profileKey(g.profile)}|${g.bezel}|${g.radius}|${g.lightAngle}|${g.lightElevation}|${g.specular}|${g.rim}|${g.shade}|${pr}`;
  const hit = highlightCache.get(key);
  if (hit) return hit;
  const img = createHighlightImage(lightingProfile(g), g.radius, g.bezel, {
    angle: g.lightAngle,
    elevation: g.lightElevation,
    specular: g.specular,
    rim: g.rim,
    shade: g.shade,
  }, pr);
  return highlightCache.set(key, { url: toDataURL(img), slice: img.slice });
}
