/** Mass, stiffness and damping of a spring. Omitted values come from the `snappy` preset. */
export interface SpringConfig {
  /** Mass of what moves. A heavier spring responds more slowly and rings longer. Default 1. */
  mass?: number;
  /** Pull toward the target per unit of distance. A stiffer spring is faster. Default 300. */
  stiffness?: number;
  /** Resistance to motion. Below critical damping, 2·√(stiffness·mass), the spring overshoots. Default 30. */
  damping?: number;
}

/** Named springs, for `physics` props. */
export const SPRINGS = {
  /** Soft and slow, with barely any overshoot. */
  gentle: { mass: 1, stiffness: 120, damping: 20 },
  /** Quick, with a trace of overshoot. The default. */
  snappy: { mass: 1, stiffness: 300, damping: 30 },
  /** Lively: overshoots and rings once or twice. */
  bouncy: { mass: 1, stiffness: 260, damping: 14 },
  /** Fast and firm, with no visible overshoot. */
  stiff: { mass: 1, stiffness: 520, damping: 44 },
} as const satisfies Record<string, Required<SpringConfig>>;

/** The name of a preset in `SPRINGS`. */
export type SpringPreset = keyof typeof SPRINGS;
/** A spring's physics: a preset name, or mass, stiffness and damping. */
export type SpringInput = SpringConfig | SpringPreset;

const MAX_STEP = 1 / 240;
const MAX_FRAME = 1 / 15;

/** Fills a spring's physics from its preset or the defaults. Non-finite and non-positive values fall back. */
export function resolveSpring(input: SpringInput = 'snappy'): Required<SpringConfig> {
  const base = SPRINGS.snappy;
  if (typeof input === 'string') return { ...(SPRINGS[input] ?? base) };
  const positive = (v: number | undefined, fallback: number) => (v !== undefined && Number.isFinite(v) && v > 0 ? v : fallback);
  const damping = input.damping !== undefined && Number.isFinite(input.damping) && input.damping >= 0 ? input.damping : base.damping;
  return { mass: positive(input.mass, base.mass), stiffness: positive(input.stiffness, base.stiffness), damping };
}

/** Undamped period of a spring, seconds: 2π·√(mass / stiffness). */
export function springPeriod(input?: SpringInput): number {
  const { mass, stiffness } = resolveSpring(input);
  return 2 * Math.PI * Math.sqrt(mass / stiffness);
}

/** Damping ratio: 1 is critical; below it the spring overshoots. */
export function dampingRatio(input?: SpringInput): number {
  const { mass, stiffness, damping } = resolveSpring(input);
  return damping / (2 * Math.sqrt(stiffness * mass));
}

/**
 * A damped spring pulling `value` toward `target`. It steps with semi-implicit
 * Euler in substeps short enough for any stiffness and damping, so a long
 * frame slows it rather than blowing it up.
 */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  config: Required<SpringConfig>;

  constructor(value = 0, config: SpringInput = 'snappy') {
    this.value = value;
    this.target = value;
    this.config = resolveSpring(config);
  }

  /** Advances `dt` seconds, capped at 1/15 s. */
  step(dt: number): void {
    const total = Math.min(MAX_FRAME, Math.max(0, dt));
    if (total === 0) return;
    const { mass, stiffness, damping } = this.config;
    // Short enough for stiffness (ω·h ≤ 1) and for damping (h·d/m ≤ 1).
    const limit = Math.min(MAX_STEP, Math.sqrt(mass / stiffness), damping > 0 ? mass / damping : MAX_STEP);
    const n = Math.ceil(total / limit);
    const h = total / n;
    for (let i = 0; i < n; i++) {
      const force = -stiffness * (this.value - this.target) - damping * this.velocity;
      this.velocity += (force / mass) * h;
      this.value += this.velocity * h;
    }
  }

  /** At the target and still. */
  get settled(): boolean {
    return Math.abs(this.value - this.target) < 1e-4 && Math.abs(this.velocity) < 1e-3;
  }

  /** Jumps to the target and stops. */
  snap(): void {
    this.value = this.target;
    this.velocity = 0;
  }
}
