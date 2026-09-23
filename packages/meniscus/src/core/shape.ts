export type Radius = number | 'capsule';

/** The corner radius actually drawn: capped at half the short side. */
export function resolveRadius(radius: Radius, width: number, height: number): number {
  const max = Math.max(0, Math.min(width, height) / 2);
  if (radius === 'capsule') return max;
  return Math.min(Math.max(0, radius), max);
}

export interface SdfSample {
  /** Signed distance to the outline, px. Negative inside. */
  distance: number;
  /** Outward unit normal of the nearest outline point. */
  nx: number;
  ny: number;
}

/**
 * Signed distance from (x, y) to a rounded rectangle whose top-left corner is
 * at the origin, plus the outward normal. Inside corner zones the normal is
 * radial, so it stays continuous around the curve.
 */
export function roundedRectSdf(x: number, y: number, width: number, height: number, radius: number): SdfSample {
  const cx = x - width / 2;
  const cy = y - height / 2;
  const qx = Math.abs(cx) - (width / 2 - radius);
  const qy = Math.abs(cy) - (height / 2 - radius);
  const sx = cx < 0 ? -1 : 1;
  const sy = cy < 0 ? -1 : 1;
  if (qx > 0 && qy > 0) {
    const len = Math.hypot(qx, qy);
    return { distance: len - radius, nx: (sx * qx) / len, ny: (sy * qy) / len };
  }
  if (qx > qy) return { distance: qx - radius, nx: sx, ny: 0 };
  return { distance: qy - radius, nx: 0, ny: sy };
}
