import { BOUNCE_STRENGTH, DEFAULT_SHININESS, RIM_BACK, RIM_FLOOR, RIM_POWER, SHADE_COLOR, SHADE_FLOOR, SHADE_POWER, lightVector, type Lighting, type RGBAImage } from './maps';
import type { RefractionProfile } from './optics';

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

/**
 * Everything `unionKernel` needs, as plain data: it crosses into a worker by
 * structured clone, so constants travel with the job instead of being
 * imported.
 */
export interface UnionJob {
  /** x, y, width, height, radius for each shape, CSS px relative to the union box. */
  shapes: number[];
  width: number;
  height: number;
  /** Map pixels per CSS px. */
  scale: number;
  /** Radius of the polynomial smooth minimum, px: twice the bridging distance. */
  k: number;
  bezel: number;
  displacement: Float32Array;
  maxDisplacement: number;
  slope: Float32Array;
  light: [number, number, number];
  shininess: number;
  specular: number;
  rim: number;
  shade: number;
  c: {
    rimPower: number;
    rimFloor: number;
    rimBack: number;
    shadePower: number;
    shadeFloor: number;
    shadeColor: [number, number, number];
    bounce: number;
    normalFloor: number;
  };
}

export interface UnionPixels {
  disp: Uint8ClampedArray;
  glow: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * The per-pixel work behind `createUnionMaps`. It must stay self-contained
 * (no imports, no outer variables): its source text is what runs inside the
 * map worker.
 */
export function unionKernel(job: UnionJob): UnionPixels {
  const s = job.scale;
  const w = Math.max(1, Math.ceil(job.width * s));
  const h = Math.max(1, Math.ceil(job.height * s));
  const disp = new Uint8ClampedArray(w * h * 4);
  const glow = new Uint8ClampedArray(w * h * 4);
  const shapes = job.shapes;
  const n = Math.floor(shapes.length / 5);
  const k = job.k;
  const b = Math.max(1e-6, job.bezel);
  const max = job.maxDisplacement;
  const lx = job.light[0];
  const ly = job.light[1];
  const lz = job.light[2];
  const c = job.c;
  const hLen = Math.hypot(lx, ly, lz + 1);
  const flat = Math.pow((lz + 1) / hLen, job.shininess);
  const planar = Math.hypot(lx, ly) || 1;

  const sample = (table: Float32Array, t: number): number => {
    const len = table.length;
    if (len === 0) return 0;
    if (t <= 0) return table[0]!;
    if (t >= 1) return table[len - 1]!;
    const x = t * (len - 1);
    const i = Math.floor(x);
    const a = table[i]!;
    return a + (table[Math.min(len - 1, i + 1)]! - a) * (x - i);
  };
  const lobe = (dot: number): number => Math.max(0, Math.pow(Math.max(0, dot), job.shininess) - flat) / (1 - flat);
  const encode = (v: number): number => (max <= 0 ? 128 : Math.round(127.5 + 127.5 * Math.max(-1, Math.min(1, v / max))));

  for (let j = 0; j < h; j++) {
    const py = (j + 0.5) / s;
    for (let i = 0; i < w; i++) {
      const px = (i + 0.5) / s;
      let d = Infinity;
      let gx = 0;
      let gy = 0;
      for (let q = 0; q < n; q++) {
        // Signed distance to a rounded rectangle and its outward normal.
        const o5 = q * 5;
        const sw = shapes[o5 + 2]!;
        const sh = shapes[o5 + 3]!;
        const r = shapes[o5 + 4]!;
        const cx = px - shapes[o5]! - sw / 2;
        const cy = py - shapes[o5 + 1]! - sh / 2;
        const qx = Math.abs(cx) - (sw / 2 - r);
        const qy = Math.abs(cy) - (sh / 2 - r);
        const sx = cx < 0 ? -1 : 1;
        const sy = cy < 0 ? -1 : 1;
        let dist: number;
        let nx: number;
        let ny: number;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(qx, qy);
          dist = len - r;
          nx = (sx * qx) / len;
          ny = (sy * qy) / len;
        } else if (qx > qy) {
          dist = qx - r;
          nx = sx;
          ny = 0;
        } else {
          dist = qy - r;
          nx = 0;
          ny = sy;
        }
        if (d === Infinity) {
          d = dist;
          gx = nx;
          gy = ny;
        } else if (k <= 0) {
          if (dist < d) {
            d = dist;
            gx = nx;
            gy = ny;
          }
        } else {
          // Polynomial smooth minimum; its weight also blends the two normals.
          const t = Math.max(0, Math.min(1, 0.5 + (0.5 * (dist - d)) / k));
          d = dist + (d - dist) * t - k * t * (1 - t);
          gx = nx + (gx - nx) * t;
          gy = ny + (gy - ny) * t;
        }
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
      const gl = Math.max(Math.hypot(gx, gy), c.normalFloor);
      const nx = gx / gl;
      const ny = gy / gl;
      const depth = Math.max(0, -d) / b;
      const m = depth < 1 ? sample(job.displacement, depth) : 0;
      disp[o] = encode(-nx * m);
      disp[o + 1] = encode(-ny * m);
      disp[o + 2] = 128;
      disp[o + 3] = Math.round(coverage * 255);

      if (coverage <= 0 || depth >= 1) continue;
      // Lighting, as shadeSurface() in maps.ts.
      const slope = sample(job.slope, depth);
      const len = Math.sqrt(slope * slope + 1);
      const Nx = (nx * slope) / len;
      const Ny = (ny * slope) / len;
      const Nz = 1 / len;
      const highlight = lobe((Nx * lx + Ny * ly + Nz * (lz + 1)) / hLen);
      const bounce = lobe((-Nx * lx - Ny * ly + Nz * (lz + 1)) / hLen);
      const facing = (nx * lx + ny * ly) / planar;
      const rim = Math.pow(1 - Nz, c.rimPower) * (c.rimFloor + (1 - c.rimFloor) * Math.max(0, facing) + c.rimBack * Math.max(0, -facing));
      const shade = Math.pow(1 - Nz, c.shadePower) * (c.shadeFloor + (1 - c.shadeFloor) * Math.max(0, -facing));
      const lit = Math.max(0, Math.min(1, job.specular * (highlight + c.bounce * bounce) + job.rim * rim));
      const dark = Math.max(0, Math.min(1, job.shade * shade)) * (1 - lit);
      const a = lit + dark;
      if (a <= 0) continue;
      glow[o] = (255 * lit + c.shadeColor[0] * dark) / a;
      glow[o + 1] = (255 * lit + c.shadeColor[1] * dark) / a;
      glow[o + 2] = (255 * lit + c.shadeColor[2] * dark) / a;
      glow[o + 3] = Math.round(a * coverage * 255);
    }
  }
  return { disp, glow, width: w, height: h };
}

/** The kernel's input for a union. */
export function unionJob(input: UnionInput): UnionJob {
  const shapes: number[] = [];
  for (const q of input.shapes) shapes.push(q.x, q.y, q.width, q.height, q.radius);
  return {
    shapes,
    width: input.width,
    height: input.height,
    scale: input.pixelScale,
    // A polynomial smooth minimum of radius k bridges gaps narrower than k / 2.
    k: 2 * Math.max(0, input.smoothing),
    bezel: input.bezel,
    displacement: input.profile.displacement,
    maxDisplacement: input.profile.maxDisplacement,
    slope: input.lighting.slope,
    light: lightVector(input.light.angle, input.light.elevation),
    shininess: input.light.shininess ?? DEFAULT_SHININESS,
    specular: input.light.specular,
    rim: input.light.rim,
    shade: input.light.shade ?? 0,
    c: {
      rimPower: RIM_POWER,
      rimFloor: RIM_FLOOR,
      rimBack: RIM_BACK,
      shadePower: SHADE_POWER,
      shadeFloor: SHADE_FLOOR,
      shadeColor: [SHADE_COLOR[0], SHADE_COLOR[1], SHADE_COLOR[2]],
      bounce: BOUNCE_STRENGTH,
      normalFloor: NORMAL_FLOOR,
    },
  };
}

/**
 * Maps for several rounded rectangles fused into one liquid surface. The
 * outlines combine with a polynomial smooth minimum, so outlines closer than
 * `smoothing` grow a neck between them the way two drops bridge. The bezel
 * follows the merged outline, and so do refraction and light.
 */
export function createUnionMaps(input: UnionInput): UnionMaps {
  const px = unionKernel(unionJob(input));
  return {
    displacement: { data: px.disp, width: px.width, height: px.height },
    highlight: { data: px.glow, width: px.width, height: px.height },
    scale: 2 * input.profile.maxDisplacement,
  };
}

/** How far a union's outline can bulge past its shapes, px: a quarter of the smoothing radius. */
export function unionReach(smoothing: number): number {
  return Math.max(0, smoothing) / 2;
}

/** Pixel density for union maps: full CSS resolution up to a budget, coarser beyond it. */
export function unionPixelScale(width: number, height: number, budget = 90_000): number {
  const area = Math.max(1, width * height);
  return Math.min(1, Math.sqrt(budget / area));
}
