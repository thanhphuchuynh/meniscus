export interface Point { x: number; y: number }
export interface Bounds { minX: number; maxX: number; minY: number; maxY: number }
export interface LensFlight { position: Point; velocity: Point; target: Point }

export function boundLens(p: Point, b: Bounds): Point {
  return { x: Math.max(b.minX, Math.min(b.maxX, p.x)), y: Math.max(b.minY, Math.min(b.maxY, p.y)) };
}

export function releaseLens(position: Point, velocity: Point, bounds: Bounds): LensFlight {
  const v = { x: Math.max(-1800, Math.min(1800, velocity.x)), y: Math.max(-1800, Math.min(1800, velocity.y)) };
  return { position: { ...position }, velocity: v, target: boundLens({ x: position.x + v.x * 0.16, y: position.y + v.y * 0.16 }, bounds) };
}

/** Bounded underdamped spring. Substeps keep irregular pointer/frame timing stable. */
export function advanceLens(f: LensFlight, elapsed: number, bounds: Bounds): boolean {
  const duration = Math.max(0, Math.min(elapsed, 1 / 30));
  const steps = Math.max(1, Math.ceil(duration * 120));
  const dt = duration / steps;
  f.target = boundLens(f.target, bounds);
  for (let i = 0; i < steps; i++) {
    for (const axis of ['x', 'y'] as const) {
      f.velocity[axis] += (-100 * (f.position[axis] - f.target[axis]) - 17 * f.velocity[axis]) * dt;
      f.position[axis] += f.velocity[axis] * dt;
    }
    const p = boundLens(f.position, bounds);
    if (p.x !== f.position.x) f.velocity.x *= -0.18;
    if (p.y !== f.position.y) f.velocity.y *= -0.18;
    f.position = p;
  }
  if (Math.hypot(f.position.x - f.target.x, f.position.y - f.target.y) < 0.05 && Math.hypot(f.velocity.x, f.velocity.y) < 0.5) {
    f.position = { ...f.target };
    f.velocity = { x: 0, y: 0 };
    return false;
  }
  return true;
}
