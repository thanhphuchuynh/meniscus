import { Spring, resolveSpring, springPeriod, type SpringConfig, type SpringInput } from './spring';

/** An optical property a glass animates on its own spring. */
export type OpticalChannel = 'presence' | 'refraction' | 'highlight' | 'tint' | 'shadow';

/**
 * A glass's optics, each normalized so its resting value is the glass as its
 * options describe it: 1 for the multipliers, 0 for the highlight offset.
 */
export interface OpticalState {
  /** 1 when shown, 0 when hidden. */
  presence: number;
  /** Multiplier on the glass's bend. */
  refraction: number;
  /** Light offset toward the right (positive) or left, −1 to 1. */
  highlightX: number;
  /** Light offset toward the bottom (positive) or top, −1 to 1. */
  highlightY: number;
  /** Multiplier on the tint's opacity. */
  tint: number;
  /** Lift: 0 is flat on the page, 1 resting, above 1 raised. */
  shadow: number;
}

/** A glass at rest, exactly as its options describe it. */
export const OPTICAL_REST: Readonly<OpticalState> = { presence: 1, refraction: 1, highlightX: 0, highlightY: 0, tint: 1, shadow: 1 };

/**
 * How much stiffer each channel's spring is than the base spring. Light
 * reflects at once, so the highlight settles first; a shadow follows the
 * glass's height, so it lags.
 */
export const RESPONSE: Readonly<Record<OpticalChannel, number>> = { presence: 1, refraction: 1, highlight: 2.5, tint: 0.8, shadow: 0.55 };

/** Options for a `GlassPhysics`. */
export interface GlassPhysicsOptions {
  /** The base spring: a preset name, or mass, stiffness and damping. Default `'snappy'`. */
  physics?: SpringInput;
  /** Stiffness multipliers per channel, replacing those in `RESPONSE`. */
  response?: Partial<Record<OpticalChannel, number>>;
  /** Where the optics start. Omitted values start at rest. */
  initial?: Partial<OpticalState>;
  /** `'frame'` runs on the shared animation frame loop; `'manual'` waits for `step()`. Default `'frame'` where `requestAnimationFrame` exists. */
  scheduler?: 'frame' | 'manual';
  /** Jump to targets, skipping delays and momentum. */
  reducedMotion?: boolean;
}

/** Options for `GlassPhysics.to`. */
export interface TransitionOptions {
  /** Milliseconds, on the physics clock, before the targets apply. */
  delay?: number;
}

/** The shadow is a little more damped than the rest, so it lags without ringing. */
const SHADOW_DAMPING = 1.1;
/** Channel velocity per 1000 px/s of glass speed, and the speed momentum stops growing at. */
const IMPULSE = { refraction: 1.2, highlight: 1.5, shadow: 0.8, maxSpeed: 4000 };
const MAX_DT = 1 / 15;

const CHANNEL: Readonly<Record<keyof OpticalState, OpticalChannel>> = {
  presence: 'presence',
  refraction: 'refraction',
  highlightX: 'highlight',
  highlightY: 'highlight',
  tint: 'tint',
  shadow: 'shadow',
};
const KEYS = Object.keys(CHANNEL) as Array<keyof OpticalState>;

// One animation frame loop steps every instance in motion.
const moving = new Set<GlassPhysics>();
let loopFrame = 0;
let loopLast = 0;

function loop(now: number): void {
  const dt = loopLast ? (now - loopLast) / 1000 : 1 / 60;
  loopLast = now;
  for (const p of Array.from(moving)) p.step(dt);
  if (moving.size && typeof requestAnimationFrame === 'function') {
    loopFrame = requestAnimationFrame(loop);
  } else {
    loopFrame = 0;
    loopLast = 0;
  }
}

function channelSpring(base: Required<SpringConfig>, channel: OpticalChannel, multiplier: number): Required<SpringConfig> {
  const k = Math.max(1e-6, multiplier);
  // Damping grows with √stiffness, which keeps the base's damping ratio.
  return { mass: base.mass, stiffness: base.stiffness * k, damping: base.damping * Math.sqrt(k) * (channel === 'shadow' ? SHADOW_DAMPING : 1) };
}

function finite(target: Partial<OpticalState>): Partial<OpticalState> {
  const out: Partial<OpticalState> = {};
  for (const key of KEYS) {
    const v = target[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/**
 * A glass's optics on springs. Presence, refraction, highlight, tint and
 * shadow each move on their own spring, at their own speed, toward targets
 * set with `to()`, and take momentum from `impulse()`. Framework-free: with
 * `scheduler: 'manual'`, call `step()` to drive it from any loop.
 */
export class GlassPhysics {
  /** The current optics. Read it, or `subscribe` to hear every change. */
  readonly state: OpticalState = { ...OPTICAL_REST };
  private springs = {} as Record<keyof OpticalState, Spring>;
  private pending: Array<{ at: number; target: Partial<OpticalState> }> = [];
  private clock = 0;
  private listeners = new Set<(state: OpticalState) => void>();
  private manual: boolean;
  private reduced: boolean;
  private base: Required<SpringConfig>;
  private response: Record<OpticalChannel, number>;

  constructor(options: GlassPhysicsOptions = {}) {
    this.manual = options.scheduler === 'manual' || typeof requestAnimationFrame !== 'function';
    this.reduced = !!options.reducedMotion;
    this.base = resolveSpring(options.physics);
    this.response = { ...RESPONSE, ...options.response };
    const initial = { ...OPTICAL_REST, ...finite(options.initial ?? {}) };
    for (const key of KEYS) this.springs[key] = new Spring(initial[key], this.springFor(key));
    this.sync(false);
  }

  /** At rest: nothing moving and nothing waiting. */
  get settled(): boolean {
    return this.pending.length === 0 && KEYS.every((key) => this.springs[key].settled);
  }

  /** Changes the base spring, the channel response or reduced motion, without disturbing motion in flight. */
  configure({ physics, response, reducedMotion }: Pick<GlassPhysicsOptions, 'physics' | 'response' | 'reducedMotion'>): void {
    if (physics !== undefined) this.base = resolveSpring(physics);
    if (response !== undefined) this.response = { ...RESPONSE, ...response };
    for (const key of KEYS) this.springs[key].config = this.springFor(key);
    if (reducedMotion !== undefined) this.reduced = reducedMotion;
    if (this.reduced) this.finish();
  }

  /** Moves toward new targets, after `delay` ms. A later target for a channel replaces a pending one. */
  to(target: Partial<OpticalState>, { delay = 0 }: TransitionOptions = {}): void {
    const clean = finite(target);
    const keys = Object.keys(clean) as Array<keyof OpticalState>;
    if (!keys.length) return;
    for (const p of this.pending) for (const key of keys) delete p.target[key];
    this.pending = this.pending.filter((p) => Object.keys(p.target).length > 0);
    if (this.reduced) {
      this.apply(clean);
      this.finish();
      return;
    }
    if (delay > 0) this.pending.push({ at: this.clock + delay / 1000, target: clean });
    else this.apply(clean);
    this.wake();
  }

  /** Momentum from a drag or a release, in px/s of the glass: it swells, its light lags and it lifts, then springs back. */
  impulse(vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy);
    if (this.reduced || !(speed > 0) || !Number.isFinite(speed)) return;
    const s = Math.min(speed, IMPULSE.maxSpeed) / 1000;
    this.springs.refraction.velocity += IMPULSE.refraction * s;
    this.springs.highlightX.velocity -= IMPULSE.highlight * (vx / speed) * s;
    this.springs.highlightY.velocity -= IMPULSE.highlight * (vy / speed) * s;
    this.springs.shadow.velocity += IMPULSE.shadow * s;
    this.wake();
  }

  /** Advances `dt` seconds, capped at 1/15 s. The frame loop calls it; with `scheduler: 'manual'`, you do. */
  step(dt: number): void {
    const d = Math.min(MAX_DT, Math.max(0, dt));
    this.clock += d;
    if (this.pending.length) {
      const due = this.pending.filter((p) => p.at <= this.clock + 1e-9);
      if (due.length) {
        this.pending = this.pending.filter((p) => p.at > this.clock + 1e-9);
        for (const p of due) this.apply(p.target);
      }
    }
    for (const key of KEYS) this.springs[key].step(d);
    if (this.settled) {
      for (const key of KEYS) this.springs[key].snap();
      moving.delete(this);
    }
    this.sync(true);
  }

  /** Calls `listener` with the optics now and after every change. Returns the unsubscribe. */
  subscribe(listener: (state: OpticalState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stops stepping on the frame loop, keeping targets, pending changes and listeners. `resume()`, `to()` or `impulse()` continues. */
  pause(): void {
    moving.delete(this);
  }

  /** Continues on the frame loop if anything is still moving or waiting. */
  resume(): void {
    if (!this.settled) this.wake();
  }

  /** Stops motion and drops pending targets and listeners. A later `to()` starts it again. */
  dispose(): void {
    moving.delete(this);
    this.pending = [];
    this.listeners.clear();
  }

  private springFor(key: keyof OpticalState): Required<SpringConfig> {
    const channel = CHANNEL[key];
    return channelSpring(this.base, channel, this.response[channel] ?? 1);
  }

  private apply(target: Partial<OpticalState>): void {
    for (const key of Object.keys(target) as Array<keyof OpticalState>) this.springs[key].target = target[key]!;
  }

  private finish(): void {
    for (const p of this.pending) this.apply(p.target);
    this.pending = [];
    for (const key of KEYS) this.springs[key].snap();
    moving.delete(this);
    this.sync(true);
  }

  private wake(): void {
    if (this.manual) return;
    moving.add(this);
    if (!loopFrame && typeof requestAnimationFrame === 'function') loopFrame = requestAnimationFrame(loop);
  }

  private sync(notify: boolean): void {
    for (const key of KEYS) this.state[key] = this.springs[key].value;
    if (notify) for (const listener of Array.from(this.listeners)) listener(this.state);
  }
}

/** Milliseconds a layer waits in a shared transition: its rank from the leading layer × |stagger| × its spring's period. */
export function staggerDelay(rank: number, physics?: SpringInput, stagger = 0.12): number {
  return Math.max(0, rank) * Math.abs(stagger) * springPeriod(physics) * 1000;
}
