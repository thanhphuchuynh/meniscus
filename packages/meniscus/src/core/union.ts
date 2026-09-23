import { BOUNCE_STRENGTH, DEFAULT_SHININESS, SHADE_COLOR, lightVector, shadeSurface, type Lighting, type RGBAImage } from './maps';
import { sampleTable, type RefractionProfile } from './optics';
import { roundedRectSdf } from './shape';

/** One rounded rectangle in a union, in CSS px relative to the union box. */
export interface UnionShape {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface UnionInput {
  shapes: UnionShape[];
  /** Size of the box the maps cover, CSS px. */
  width: number;
  height: number;
  /**
   * How far apart two outlines can be and still bridge, px. Outlines within
   * twice this distance already lean toward each other.
   */
  smoothing: number;
  /** Width of the curved band inside the merged outline, px. */
  bezel: number;
  /** Refraction profile for the bezel (displacement). */
  profile: RefractionProfile;
  /** Lighting profile for the bezel (slope). */
  lighting: RefractionProfile;
  light: Lighting;
  /** Map pixels per CSS px. */
  pixelScale: number;
}

export interface UnionMaps {
  /** R, G: displacement as for feDisplacementMap. A: coverage of the merged outline, usable as a CSS mask. */
  displacement: RGBAImage;
  /** White light and blue-black shade in straight alpha, like the nine-slice highlight map. */
  highlight: RGBAImage;
  /** The feDisplacementMap `scale` for `displacement`. */
  scale: number;
}

/** Blended normals shorter than this are not stretched to full length. */
export const NORMAL_FLOOR = 0.25;

function encode(v: number, max: number): number {
  if (max <= 0) return 128;
  return Math.round(127.5 + 127.5 * Math.max(-1, Math.min(1, v / max)));
}

/**
 * Maps for several rounded rectangles fused into one liquid surface. The
 * outlines combine with a polynomial smooth minimum, so outlines closer than
 * `smoothing` grow a neck between them the way two drops bridge. The bezel
 * follows the merged outline, and so do refraction and light.
 */
export function createUnionMaps(input: UnionInput): UnionMaps {
  const { shapes, bezel, profile, lighting, light, pixelScale: s } = input;
  // A polynomial smooth minimum of radius k bridges gaps narrower than k / 2.
  const k = 2 * Math.max(0, input.smoothing);
  const w = Math.max(1, Math.ceil(input.width * s));
  const h = Math.max(1, Math.ceil(input.height * s));
  const disp = new Uint8ClampedArray(w * h * 4);
  const glow = new Uint8ClampedArray(w * h * 4);
  const max = profile.maxDisplacement;
  const L = lightVector(light.angle, light.elevation);
  const shininess = light.shininess ?? DEFAULT_SHININESS;
  const shade = light.shade ?? 0;
  const b = Math.max(1e-6, bezel);
  const n = shapes.length;

  for (let j = 0; j < h; j++) {
    const py = (j + 0.5) / s;
    for (let i = 0; i < w; i++) {
      const px = (i + 0.5) / s;
      let d = Infinity;
      let gx = 0;
      let gy = 0;
      for (let q = 0; q < n; q++) {
        const sh = shapes[q]!;
        const sd = roundedRectSdf(px - sh.x, py - sh.y, sh.width, sh.height, sh.radius);
        if (d === Infinity) {
          d = sd.distance;
          gx = sd.nx;
          gy = sd.ny;
          continue;
        }
        if (k <= 0) {
          if (sd.distance < d) {
            d = sd.distance;
            gx = sd.nx;
            gy = sd.ny;
          }
          continue;
        }
        // Polynomial smooth minimum; its weight also blends the two normals.
        const t = Math.max(0, Math.min(1, 0.5 + (0.5 * (sd.distance - d)) / k));
        d = sd.distance + (d - sd.distance) * t - k * t * (1 - t);
        gx = sd.nx + (gx - sd.nx) * t;
        gy = sd.ny + (gy - sd.ny) * t;
      }
      const o = (j * w + i) * 4;
      const coverage = Math.max(0, Math.min(1, 0.5 - d * s));
      if (coverage <= 0 && d * s > 1.5) {
        disp[o] = 128;
        disp[o + 1] = 128;
        disp[o + 2] = 128;
        continue;
      }
      // Where two outlines pull the normal opposite ways (the waist of a neck)
      // the blend is short; soften there so the saddle has no crease.
      const gl = Math.max(Math.hypot(gx, gy), NORMAL_FLOOR);
      const nx = gx / gl;
      const ny = gy / gl;
      const depth = Math.max(0, -d) / b;
      const m = depth < 1 ? sampleTable(profile.displacement, depth) : 0;
      disp[o] = encode(-nx * m, max);
      disp[o + 1] = encode(-ny * m, max);
      disp[o + 2] = 128;
      disp[o + 3] = Math.round(coverage * 255);

      if (coverage <= 0 || depth >= 1) continue;
      const slope = sampleTable(lighting.slope, depth);
      const terms = shadeSurface(nx, ny, slope, L, shininess);
      const lit = Math.max(0, Math.min(1, light.specular * (terms.highlight + BOUNCE_STRENGTH * terms.bounce) + light.rim * terms.rim));
      const dark = Math.max(0, Math.min(1, shade * terms.shade)) * (1 - lit);
      const a = lit + dark;
      if (a <= 0) continue;
      glow[o] = (255 * lit + SHADE_COLOR[0] * dark) / a;
      glow[o + 1] = (255 * lit + SHADE_COLOR[1] * dark) / a;
      glow[o + 2] = (255 * lit + SHADE_COLOR[2] * dark) / a;
      glow[o + 3] = Math.round(a * coverage * 255);
    }
  }

  return {
    displacement: { data: disp, width: w, height: h },
    highlight: { data: glow, width: w, height: h },
    scale: 2 * max,
  };
}

/** Pixel density for union maps: full CSS resolution up to a budget, coarser beyond it. */
/** How far a union's outline can bulge past its shapes, px: a quarter of the smoothing radius. */
export function unionReach(smoothing: number): number {
  return Math.max(0, smoothing) / 2;
}

export function unionPixelScale(width: number, height: number, budget = 90_000): number {
  const area = Math.max(1, width * height);
  return Math.min(1, Math.sqrt(budget / area));
}
