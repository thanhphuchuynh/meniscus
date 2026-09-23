import { inflateSync } from 'node:zlib';
import {
  computeRefractionProfile,
  createDisplacementTiles,
  createHighlightImage,
  describeFilter,
  encodePNG,
  resolveGlass,
  traceRay,
  type RGBAImage,
} from '../src/core';

const glass = { bezel: 24, thickness: 24, ior: 1.5 };

describe('traceRay', () => {
  it('does not bend light on the flat plateau', () => {
    const r = traceRay(glass, 24);
    expect(r.incidence).toBeCloseTo(0, 6);
    expect(r.shift).toBeCloseTo(0, 6);
  });

  it('obeys Snell’s law at the surface', () => {
    const r = traceRay(glass, 3);
    expect(Math.sin(r.incidence)).toBeCloseTo(1.5 * Math.sin(r.refraction), 9);
    expect(r.deviation).toBeCloseTo(r.incidence - r.refraction, 12);
  });

  it('bends nothing when the glass has the index of air', () => {
    expect(traceRay({ ...glass, ior: 1 }, 3).shift).toBeCloseTo(0, 9);
  });
});

describe('computeRefractionProfile', () => {
  const p = computeRefractionProfile(glass);

  it('shifts inward on a convex bezel and settles to zero on the plateau', () => {
    expect(p.displacement[p.samples - 1]).toBeCloseTo(0, 5);
    for (let i = 1; i < p.samples - 1; i++) expect(p.displacement[i]!).toBeGreaterThanOrEqual(0);
  });

  it('concentrates the shift near the outline', () => {
    const near = p.displacement[Math.round(0.05 * (p.samples - 1))]!;
    const mid = p.displacement[Math.round(0.5 * (p.samples - 1))]!;
    expect(near).toBeGreaterThan(mid * 4);
    expect(p.maxDisplacement).toBeGreaterThan(0.3 * glass.thickness);
  });

  it('bends harder in denser glass', () => {
    const dense = computeRefractionProfile({ ...glass, ior: 2.4 });
    expect(dense.maxDisplacement).toBeGreaterThan(p.maxDisplacement);
  });

  it('magnifies the inner band of a lip profile', () => {
    const lip = computeRefractionProfile({ ...glass, profile: 'lip' });
    const inner = lip.displacement[Math.round(0.8 * (lip.samples - 1))]!;
    expect(inner).toBeLessThan(0);
  });
});

/** feDisplacementMap's decoding: P' = P + scale * (C / 255 - 0.5). */
const decode = (c: number, scale: number) => scale * (c / 255 - 0.5);
const px = (img: RGBAImage, x: number, y: number) => {
  const o = (y * img.width + x) * 4;
  return [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!, img.data[o + 3]!] as const;
};

describe('createDisplacementTiles', () => {
  const profile = computeRefractionProfile(glass);
  const tiles = createDisplacementTiles(profile, 24, 24);

  it('points corner shifts at the arc center', () => {
    // Pixels 3.5 px inside the arc, on the diagonal.
    const [r, g] = px(tiles.tl, 9, 9);
    expect(decode(r, tiles.scale)).toBeGreaterThan(1);
    expect(decode(g, tiles.scale)).toBeGreaterThan(1);
    const [r2, g2] = px(tiles.br, 14, 14);
    expect(decode(r2, tiles.scale)).toBeLessThan(-1);
    expect(decode(g2, tiles.scale)).toBeLessThan(-1);
  });

  it('carries the rim shift past the outline, so antialiased edge pixels stay refracted', () => {
    const [r, g] = px(tiles.tl, 1, 1);
    const shift = Math.hypot(decode(r, tiles.scale), decode(g, tiles.scale));
    expect(shift).toBeGreaterThan(0.95 * (tiles.scale / 2));
    expect(r).toBe(g); // on the diagonal, pointing at the arc center
  });

  it('encodes the traced shift within one channel step', () => {
    const [, g] = px(tiles.top, 0, 5);
    const expected = traceRay(glass, 5.5).shift;
    expect(Math.abs(decode(g, tiles.scale) - expected)).toBeLessThan(tiles.scale / 255 + 0.05);
  });

  it('shifts each edge strip inward along one axis only', () => {
    const top = px(tiles.top, 0, 3);
    const bottom = px(tiles.bottom, 0, tiles.bottom.height - 4);
    const left = px(tiles.left, 3, 0);
    const right = px(tiles.right, tiles.right.width - 4, 0);
    expect(top[0]).toBe(128);
    expect(decode(top[1], tiles.scale)).toBeGreaterThan(0);
    expect(decode(bottom[1], tiles.scale)).toBeLessThan(0);
    expect(left[1]).toBe(128);
    expect(decode(left[0], tiles.scale)).toBeGreaterThan(0);
    expect(decode(right[0], tiles.scale)).toBeLessThan(0);
  });

  it('leaves the plateau neutral when the bezel is narrower than the radius', () => {
    const narrow = createDisplacementTiles(computeRefractionProfile({ ...glass, bezel: 8, thickness: 8 }), 24, 8);
    expect(px(narrow.tl, 23, 23).slice(0, 2)).toEqual([128, 128]);
  });
});

describe('createHighlightImage', () => {
  const profile = computeRefractionProfile(glass);
  const img = createHighlightImage(profile, 24, 24, { angle: -45, elevation: 25, specular: 1, rim: 1 }, 1);
  const alpha = (x: number, y: number) => px(img, x, y)[3];

  it('keeps the plateau and the outside of the shape clear', () => {
    expect(alpha(img.slice, img.slice)).toBe(0);
    expect(alpha(0, 0)).toBe(0);
  });

  it('lights the side facing the light more than the far side', () => {
    // Total light along each diagonal, from the outline in to the plateau.
    const c = img.width / 2;
    let near = 0;
    let far = 0;
    for (let d = 1; d <= 24; d++) {
      const r = 24 - d + 0.5;
      near += alpha(Math.round(c - r * Math.SQRT1_2), Math.round(c - r * Math.SQRT1_2));
      far += alpha(Math.round(c + r * Math.SQRT1_2), Math.round(c + r * Math.SQRT1_2));
    }
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});

describe('describeFilter', () => {
  const tiles = { radius: 20, scale: 18, tl: 'a', tr: 'b', bl: 'c', br: 'd', top: 'e', bottom: 'f', left: 'g', right: 'h' };

  it('skips side strips on a capsule', () => {
    const nodes = describeFilter({ width: 200, height: 40, tiles });
    const hrefs = nodes.filter((n) => n.tag === 'feImage').map((n) => n.attrs.result);
    expect(hrefs).toEqual(['top', 'bottom', 'tl', 'tr', 'bl', 'br']);
  });

  it('splits channels when aberration is on', () => {
    const nodes = describeFilter({ width: 200, height: 120, tiles, aberration: 1 });
    const scales = nodes.filter((n) => n.tag === 'feDisplacementMap').map((n) => n.attrs.scale);
    expect(scales).toEqual([18 * 1.25, 18, 18 * 0.75]);
  });
});

describe('resolveGlass', () => {
  it('caps the radius at half the short side and the bezel at the radius', () => {
    const g = resolveGlass({ radius: 80, bezel: 100 }, 300, 60);
    expect(g.radius).toBe(30);
    expect(g.bezel).toBe(30);
  });

  it('rounds capsules fully', () => {
    expect(resolveGlass({ radius: 'capsule' }, 240, 57).radius).toBe(28.5);
  });

  it('turns refraction off at zero', () => {
    expect(resolveGlass({ refraction: 0 }, 100, 100).thickness).toBe(0);
  });
});

describe('encodePNG', () => {
  it('round-trips pixels', () => {
    const img = createDisplacementTiles(computeRefractionProfile(glass), 12, 12).tl;
    const png = encodePNG(img);
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IDAT starts after the 8-byte signature and the 25-byte IHDR chunk.
    const len = (png[33]! << 24) | (png[34]! << 16) | (png[35]! << 8) | png[36]!;
    const raw = inflateSync(png.subarray(41, 41 + len));
    const row = img.width * 4 + 1;
    for (let y = 0; y < img.height; y++) {
      expect(raw[y * row]).toBe(0);
      expect(Array.from(raw.subarray(y * row + 1, (y + 1) * row))).toEqual(Array.from(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4)));
    }
  });
});

describe('fold limiting', () => {
  const steep = { bezel: 30, thickness: 45, ior: 1.5 };
  const mapping = (d: Float32Array, bezel: number) => Array.from(d, (shift, i) => (i / (d.length - 1)) * bezel + shift);

  it('keeps the page-to-screen mapping one-to-one by default', () => {
    const p = computeRefractionProfile(steep);
    const m = mapping(p.displacement, steep.bezel);
    for (let i = 2; i < m.length; i++) expect(m[i]!).toBeGreaterThanOrEqual(m[i - 1]! - 1e-9);
  });

  it('lets caustics fold the image when asked', () => {
    const p = computeRefractionProfile({ ...steep, caustics: true });
    const m = mapping(p.displacement, steep.bezel);
    const folds = m.slice(2).some((v, i) => v < m[i + 1]! - 1e-6);
    expect(folds).toBe(true);
  });
});
