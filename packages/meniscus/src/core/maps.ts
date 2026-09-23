import { sampleTable, type RefractionProfile } from './optics';
import { roundedRectSdf } from './shape';

export interface RGBAImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Displacement maps in nine-slice form. Refraction only varies inside the
 * bezel, so one map per corner plus a one-pixel strip per edge describes a
 * rounded rectangle of any size. The SVG filter places and stretches them,
 * which means resizing the glass never regenerates a map.
 *
 * Channel encoding follows feDisplacementMap: R carries x, G carries y,
 * 128 means no shift, and `scale` converts channel values back to px.
 */
export interface DisplacementTiles {
  /** Corner radius the tiles describe, CSS px. */
  radius: number;
  /** Pixel size of each corner tile (tiles are square). */
  resolution: number;
  /** The feDisplacementMap `scale` that reproduces the traced shift in px. */
  scale: number;
  tl: RGBAImage;
  tr: RGBAImage;
  bl: RGBAImage;
  br: RGBAImage;
  /** 1 px wide, `resolution` tall. */
  top: RGBAImage;
  bottom: RGBAImage;
  /** `resolution` wide, 1 px tall. */
  left: RGBAImage;
  right: RGBAImage;
}

const MAX_TILE_RESOLUTION = 256;

function encode(v: number, max: number): number {
  if (max <= 0) return 128;
  const u = Math.max(-1, Math.min(1, v / max));
  return Math.round(127.5 + 127.5 * u);
}

function image(width: number, height: number): RGBAImage {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

function put(img: RGBAImage, i: number, r: number, g: number, b: number, a: number): void {
  const o = i * 4;
  img.data[o] = r;
  img.data[o + 1] = g;
  img.data[o + 2] = b;
  img.data[o + 3] = a;
}

/**
 * One corner tile. `cx` and `cy` (0 or 1, in units of the radius) locate the
 * arc center inside the tile: the top-left corner's arc is centered at (1, 1).
 */
function cornerTile(profile: RefractionProfile, radius: number, bezel: number, n: number, cx: number, cy: number, max: number): RGBAImage {
  const img = image(n, n);
  const px = radius / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const vx = (i + 0.5) * px - cx * radius;
      const vy = (j + 0.5) * px - cy * radius;
      const r = Math.hypot(vx, vy);
      const t = Math.max(0, radius - r) / bezel;
      let dx = 0;
      let dy = 0;
      if (t < 1 && r > 1e-9) {
        const m = sampleTable(profile.displacement, t);
        dx = (-vx / r) * m;
        dy = (-vy / r) * m;
      }
      put(img, j * n + i, encode(dx, max), encode(dy, max), 128, 255);
    }
  }
  return img;
}

/** An edge strip. `inward` is the direction toward the plateau. */
function edgeStrip(profile: RefractionProfile, radius: number, bezel: number, n: number, side: 'top' | 'bottom' | 'left' | 'right', max: number): RGBAImage {
  const vertical = side === 'top' || side === 'bottom';
  const img = vertical ? image(1, n) : image(n, 1);
  const px = radius / n;
  for (let k = 0; k < n; k++) {
    const along = (k + 0.5) * px;
    const d = side === 'top' || side === 'left' ? along : radius - along;
    const t = Math.max(0, d) / bezel;
    const m = t < 1 ? sampleTable(profile.displacement, t) : 0;
    const sign = side === 'top' || side === 'left' ? 1 : -1;
    const dx = vertical ? 0 : sign * m;
    const dy = vertical ? sign * m : 0;
    put(img, k, encode(dx, max), encode(dy, max), 128, 255);
  }
  return img;
}

export function createDisplacementTiles(profile: RefractionProfile, radius: number, bezel: number): DisplacementTiles {
  const n = Math.max(1, Math.min(MAX_TILE_RESOLUTION, Math.ceil(radius)));
  const max = profile.maxDisplacement;
  const b = Math.max(1e-6, Math.min(bezel, radius));
  return {
    radius,
    resolution: n,
    scale: 2 * max,
    tl: cornerTile(profile, radius, b, n, 1, 1, max),
    tr: cornerTile(profile, radius, b, n, 0, 1, max),
    bl: cornerTile(profile, radius, b, n, 1, 0, max),
    br: cornerTile(profile, radius, b, n, 0, 0, max),
    top: edgeStrip(profile, radius, b, n, 'top', max),
    bottom: edgeStrip(profile, radius, b, n, 'bottom', max),
    left: edgeStrip(profile, radius, b, n, 'left', max),
    right: edgeStrip(profile, radius, b, n, 'right', max),
  };
}

export interface Lighting {
  /** Where the light comes from, degrees clockwise from the top (CSS angle convention). */
  angle: number;
  /** Height of the light above the surface, degrees. Low lights push highlights toward the outline. */
  elevation: number;
  /** Strength of the reflected highlights, 0 to 1. */
  specular: number;
  /** Strength of the thin bright line along the outline, 0 to 1. */
  rim: number;
  /** Strength of the darkening where the rim turns edge-on, 0 to 1. */
  shade?: number;
  /** Tightness of the highlights. */
  shininess?: number;
}

/** Unit vector toward the light in screen space (x right, y down, z toward the viewer). */
export function lightVector(angleDeg: number, elevationDeg: number): [number, number, number] {
  const a = (angleDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e)];
}

export interface ShadeTerms {
  /** Reflection of the light source. */
  highlight: number;
  /** Reflection of the light off the far wall, seen through the glass. */
  bounce: number;
  /** Grazing-angle edge line (Fresnel-like). */
  rim: number;
  /** Grazing-angle darkening: the edge reflects the darker room instead of the page behind it. */
  shade: number;
}

/**
 * Lighting of one surface point from its outward 2D normal and slope. Shared
 * by the CSS highlight maps and the WebGL shader so both paths match.
 * Values are relative to the flat plateau, which stays unlit.
 *
 * - highlight: Blinn-Phong reflection of the light, a tight lobe on the
 *   stretch of bezel tilted toward it.
 * - bounce: the same light reflected off the far wall inside the glass.
 * - rim: a grazing-angle (Fresnel-like) line where the surface turns edge-on,
 *   brightest on the side facing the light, fainter on the far side.
 * - shade: where the rim turns edge-on it mostly reflects the room, which is
 *   darker than a lit page, so real glass edges read dark on light ground.
 *   Heaviest on the side away from the light.
 */
export function shadeSurface(nx: number, ny: number, slope: number, light: [number, number, number], shininess: number): ShadeTerms {
  const len = Math.sqrt(slope * slope + 1);
  const Nx = (nx * slope) / len;
  const Ny = (ny * slope) / len;
  const Nz = 1 / len;
  const [lx, ly, lz] = light;
  const hLen = Math.hypot(lx, ly, lz + 1);
  const flat = Math.pow((lz + 1) / hLen, shininess);
  const lobe = (dot: number) => Math.max(0, Math.pow(Math.max(0, dot), shininess) - flat) / (1 - flat);
  const highlight = lobe((Nx * lx + Ny * ly + Nz * (lz + 1)) / hLen);
  const bounce = lobe((-Nx * lx - Ny * ly + Nz * (lz + 1)) / hLen);
  const planar = Math.hypot(lx, ly) || 1;
  const facing = (nx * lx + ny * ly) / planar;
  const fresnel = Math.pow(1 - Nz, RIM_POWER);
  const rim = fresnel * (RIM_FLOOR + (1 - RIM_FLOOR) * Math.max(0, facing) + RIM_BACK * Math.max(0, -facing));
  const shade = Math.pow(1 - Nz, SHADE_POWER) * (SHADE_FLOOR + (1 - SHADE_FLOOR) * Math.max(0, -facing));
  return { highlight, bounce, rim, shade };
}

export const RIM_POWER = 4;
export const RIM_FLOOR = 0.25;
export const RIM_BACK = 0.45;
export const SHADE_POWER = 2.5;
export const SHADE_FLOOR = 0.45;
/** The shade's ink: a blue-black, so it darkens without graying a tinted glass. */
export const SHADE_COLOR: readonly [number, number, number] = [10, 18, 28];
export const BOUNCE_STRENGTH = 0.45;
export const DEFAULT_SHININESS = 36;

export interface HighlightImage extends RGBAImage {
  /** Size of each corner slice in image px, for `border-image-slice`. */
  slice: number;
}

const MAX_HIGHLIGHT_CORNER = 256;

/**
 * Highlight map for a rounded square whose middle rows and columns are
 * straight edges: white light and blue-black shade in straight alpha, drawn
 * with normal blending (white at alpha a over the glass is exactly a screen
 * blend, and the shade darkens where a screen could not). CSS `border-image` nine-slices
 * it onto any size, which gives the frosted path the same rim light as the
 * refracting path.
 */
export function createHighlightImage(profile: RefractionProfile, radius: number, bezel: number, lighting: Lighting, pixelRatio = 1): HighlightImage {
  const n = Math.max(1, Math.min(MAX_HIGHLIGHT_CORNER, Math.ceil(radius * pixelRatio)));
  const middle = 2;
  const size = 2 * n + middle;
  const k = n / Math.max(1e-6, radius);
  const bezelPx = Math.max(1e-6, Math.min(bezel, radius) * k);
  const light = lightVector(lighting.angle, lighting.elevation);
  const shininess = lighting.shininess ?? DEFAULT_SHININESS;
  const img = image(size, size);

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const s = roundedRectSdf(i + 0.5, j + 0.5, size, size, n);
      const coverage = Math.max(0, Math.min(1, 0.5 - s.distance));
      if (coverage <= 0) continue;
      const t = Math.max(0, -s.distance) / bezelPx;
      const slope = t < 1 ? sampleTable(profile.slope, t) : 0;
      const terms = shadeSurface(s.nx, s.ny, slope, light, shininess);
      const lit = Math.max(0, Math.min(1, lighting.specular * (terms.highlight + BOUNCE_STRENGTH * terms.bounce) + lighting.rim * terms.rim));
      const dark = Math.max(0, Math.min(1, (lighting.shade ?? 0) * terms.shade)) * (1 - lit);
      // White light over the dark shade, as one straight-alpha pixel.
      const a = lit + dark;
      if (a <= 0) continue;
      const r = (255 * lit + SHADE_COLOR[0] * dark) / a;
      const g = (255 * lit + SHADE_COLOR[1] * dark) / a;
      const b = (255 * lit + SHADE_COLOR[2] * dark) / a;
      put(img, j * size + i, Math.round(r), Math.round(g), Math.round(b), Math.round(a * coverage * 255));
    }
  }
  return { ...img, slice: n };
}
