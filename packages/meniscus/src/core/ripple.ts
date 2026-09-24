import { roundedRectSdf } from './shape';

/** How fast waves cross the glass, px/s. */
export const RIPPLE_SPEED = 300;
/** Velocity damping, 1/s: wave height halves about every 0.35 s. */
export const RIPPLE_DAMPING = 4;
/** Target cell size, px. Glass narrower than 20 px gets smaller cells and shorter steps. */
export const RIPPLE_CELL = 2.5;
/** Most cells along a side. The WebGL renderer's wave layers are this size. */
export const RIPPLE_MAX = 128;

const MIN_CELLS = 8;
const MAX_STEP = 1 / 240;
const MAX_ELAPSED = 0.05;
const SLEEP_HEIGHT = 0.02;
const SLEEP_SPEED = 1;
const DROP_SIGMA = 5;
/** Peak push of a strength-1 drop, px/s; calibrated so the first ring peaks near slope 0.35. */
const DROP_SPEED = 300;
const STROKE_SPEED = 1500;
/** Body-force gain, 1/px; calibrated so a 1000 px/s stop sloshes to about slope 0.2. */
const SLOSH = 0.0005;
const MAX_ACCELERATION = 30000;
const WAKE_ACCELERATION = 200;

const clampAcceleration = (v: number) => (Number.isFinite(v) ? Math.max(-MAX_ACCELERATION, Math.min(MAX_ACCELERATION, v)) : 0);

/**
 * A liquid surface over a glass: heights on a grid, moved by the damped wave
 * equation. Cells outside the glass's rounded outline stay at zero, so waves
 * reflect off its real shape and fade out at the edge. It sleeps, flat, when
 * calm and wakes on input.
 */
export class RippleField {
  cols = 0;
  rows = 0;
  /** Surface height per cell, px, row by row from the top left. */
  heights = new Float32Array(0);
  /** Whether the surface is moving. A sleeping field is flat. */
  active = false;
  /** Bumped whenever `heights` changes. */
  version = 0;
  private width = -1;
  private height = -1;
  private radius = -1;
  private dx = 1;
  private dy = 1;
  private step = MAX_STEP;
  private velocities = new Float32Array(0);
  private interior = new Int32Array(0);
  private last: number | null = null;
  private carry = 0;
  private ax = 0;
  private ay = 0;

  /** Lays the grid over a glass of this size, px, and flattens it. An unchanged size keeps the waves. */
  resize(width: number, height: number, radius: number): void {
    if (width === this.width && height === this.height && radius === this.radius) return;
    this.width = width;
    this.height = height;
    this.radius = radius;
    const cells = (length: number) => Math.min(RIPPLE_MAX, Math.max(MIN_CELLS, Math.floor(length / RIPPLE_CELL)));
    const cols = width > 0 && height > 0 ? cells(width) : 0;
    const rows = cols ? cells(height) : 0;
    this.cols = cols;
    this.rows = rows;
    this.dx = cols ? width / cols : 1;
    this.dy = rows ? height / rows : 1;
    // Courant number at most 0.5 for any cell size.
    this.step = Math.min(MAX_STEP, (0.5 * Math.min(this.dx, this.dy)) / RIPPLE_SPEED);
    this.heights = new Float32Array(cols * rows);
    this.velocities = new Float32Array(cols * rows);
    // The outermost ring stays at zero too, so every moving cell has four neighbours in the grid.
    const inside: number[] = [];
    for (let j = 1; j < rows - 1; j++) {
      for (let i = 1; i < cols - 1; i++) {
        if (roundedRectSdf((i + 0.5) * this.dx, (j + 0.5) * this.dy, width, height, radius).distance < 0) inside.push(j * cols + i);
      }
    }
    this.interior = Int32Array.from(inside);
    this.active = false;
    this.carry = 0;
    this.ax = 0;
    this.ay = 0;
    this.version++;
  }

  /** A bead of liquid dropped at (x, y), px from the glass's top left: pressing pushes the surface down. */
  drop(x: number, y: number, strength = 1): void {
    if (!this.cols || !(strength > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const reach = 3 * DROP_SIGMA;
    const i0 = Math.max(1, Math.floor((x - reach) / this.dx));
    const i1 = Math.min(this.cols - 2, Math.ceil((x + reach) / this.dx));
    const j0 = Math.max(1, Math.floor((y - reach) / this.dy));
    const j1 = Math.min(this.rows - 2, Math.ceil((y + reach) / this.dy));
    const push = -DROP_SPEED * strength;
    const falloff = 1 / (2 * DROP_SIGMA * DROP_SIGMA);
    for (let j = j0; j <= j1; j++) {
      const py = (j + 0.5) * this.dy - y;
      for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) * this.dx - x;
        this.velocities[j * this.cols + i]! += push * Math.exp(-(px * px + py * py) * falloff);
      }
    }
    this.active = true;
  }

  /** A finger drawn from (x0, y0) to (x1, y1) at `speed` px/s, relative to the glass: a ridge along the way. */
  stroke(x0: number, y0: number, x1: number, y1: number, speed: number): void {
    const strength = Math.min(1, speed / STROKE_SPEED) * 0.5;
    if (!this.cols || !(strength > 0)) return;
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (!Number.isFinite(length)) return;
    const n = Math.max(1, Math.ceil(length / Math.min(this.dx, this.dy)));
    // Beads a cell apart overlap into a ridge about as tall as one bead of this strength.
    const each = strength * Math.min(1, length / n / (DROP_SIGMA * Math.sqrt(2 * Math.PI)));
    for (let k = 1; k <= n; k++) this.drop(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, each);
  }

  /** The glass's acceleration, px/s², for the next `advance`: the liquid tilts against it. */
  accelerate(ax: number, ay: number): void {
    this.ax = clampAcceleration(ax);
    this.ay = clampAcceleration(ay);
    if (this.cols && Math.hypot(this.ax, this.ay) > WAKE_ACCELERATION) this.active = true;
  }

  /** Moves the surface on to `now`, ms. Returns whether the heights changed. Repeating a timestamp does nothing. */
  advance(now: number): boolean {
    const from = this.last ?? now;
    this.last = now;
    if (!this.active) return false;
    this.carry += Math.min(MAX_ELAPSED, Math.max(0, (now - from) / 1000));
    if (this.carry < this.step) return false;
    while (this.carry >= this.step) {
      this.integrate();
      this.carry -= this.step;
    }
    this.ax = 0;
    this.ay = 0;
    this.version++;
    if (this.calm()) {
      this.heights.fill(0);
      this.velocities.fill(0);
      this.active = false;
      this.carry = 0;
    }
    return true;
  }

  /** One step of symplectic Euler on h_tt = c²∇²h − γh_t + force. */
  private integrate(): void {
    const { heights: h, velocities: v, interior, cols } = this;
    const dt = this.step;
    const cx = (RIPPLE_SPEED * RIPPLE_SPEED) / (this.dx * this.dx);
    const cy = (RIPPLE_SPEED * RIPPLE_SPEED) / (this.dy * this.dy);
    const decay = Math.exp(-RIPPLE_DAMPING * dt);
    const forced = this.ax !== 0 || this.ay !== 0;
    const kx = -SLOSH * this.ax;
    const ky = -SLOSH * this.ay;
    const mx = this.width / 2;
    const my = this.height / 2;
    for (let n = 0; n < interior.length; n++) {
      const k = interior[n]!;
      const c = h[k]!;
      let a = cx * (h[k - 1]! + h[k + 1]! - 2 * c) + cy * (h[k - cols]! + h[k + cols]! - 2 * c);
      if (forced) {
        const i = k % cols;
        const j = (k - i) / cols;
        a += kx * ((i + 0.5) * this.dx - mx) + ky * ((j + 0.5) * this.dy - my);
      }
      v[k] = (v[k]! + dt * a) * decay;
    }
    for (let n = 0; n < interior.length; n++) {
      const k = interior[n]!;
      h[k] = h[k]! + dt * v[k]!;
    }
  }

  private calm(): boolean {
    const { heights: h, velocities: v, interior } = this;
    for (let n = 0; n < interior.length; n++) {
      const k = interior[n]!;
      if (Math.abs(h[k]!) >= SLEEP_HEIGHT || Math.abs(v[k]!) >= SLEEP_SPEED) return false;
    }
    return true;
  }
}
