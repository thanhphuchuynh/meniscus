import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import { GLASS_OPTION_KEYS } from '../core/constants';
import type { GlassOptions } from '../core/glass';
import { Glass } from './Glass';
import { GlassGroup } from './GlassGroup';
import { useGlassPreferences } from './hooks';

export interface GlassLoaderProps extends GlassOptions, Omit<HTMLAttributes<HTMLElement>, 'children' | 'color'> {
  /** What is loading, for assistive technology; shown as a caption on a loading page. */
  label?: string;
  /** Move: the drops orbit and breathe, merging into one and parting again. Off, they rest apart. */
  animate?: boolean;
  /** Diameter of the loader, px. */
  size?: number;
  /** A whole loading page: frosted glass over the viewport with the loader and its label. */
  page?: boolean;
}

const HIDDEN_LABEL: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const DROPS = [0, 120, 240];
const ORBIT_MS = 2600;
const BREATH_MS = 2000;
const BREATH = 'cubic-bezier(0.45, 0, 0.55, 1)';

/** Three glass drops that share one surface. */
function Drops({ size, animate, options }: { size: number; animate: boolean; options: GlassOptions }) {
  const { reducedMotion } = useGlassPreferences();
  const wheel = useRef<HTMLSpanElement>(null);
  const drops = useRef<Array<HTMLElement | null>>([]);
  // Apart, the drops clear the bridging distance; together, they are one drop.
  // Drop radius plus orbit stays inside the loader's box.
  const drop = size * 0.26;
  const far = size * 0.36;
  const near = size * 0.05;
  const at = (angle: number, r: number) => {
    const a = (angle * Math.PI) / 180;
    return `${(Math.cos(a) * r).toFixed(2)}px ${(Math.sin(a) * r).toFixed(2)}px`;
  };

  useEffect(() => {
    const w = wheel.current;
    if (!animate || !w || typeof w.animate !== 'function') return;
    if (reducedMotion) {
      // No motion: a slow fade says the same thing.
      const pulse = w.animate([{ opacity: 1 }, { opacity: 0.55 }, { opacity: 1 }], { duration: BREATH_MS * 1.4, iterations: Infinity, easing: 'ease-in-out' });
      return () => pulse.cancel();
    }
    const runs = [w.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: ORBIT_MS, iterations: Infinity })];
    drops.current.forEach((d, i) => {
      if (!d) return;
      const angle = DROPS[i]!;
      runs.push(
        // Each half eases on its own, so the drops linger both apart and as one.
        d.animate(
          [
            { translate: at(angle, near), easing: BREATH },
            { translate: at(angle, far), easing: BREATH },
            { translate: at(angle, near) },
          ],
          { duration: BREATH_MS, iterations: Infinity },
        ),
      );
    });
    return () => runs.forEach((r) => r.cancel());
  }, [animate, reducedMotion, size]);

  return (
    <GlassGroup {...options} as="span" aria-hidden="true" spacing={size * 0.22} style={{ position: 'relative', display: 'inline-block', flex: 'none', width: size, height: size }}>
      <span ref={wheel} style={{ position: 'absolute', inset: 0 }}>
        {DROPS.map((angle, i) => (
          <Glass
            key={angle}
            as="span"
            radius="capsule"
            ref={(el: HTMLElement | null) => {
              drops.current[i] = el;
            }}
            // At rest the drops sit apart, close enough to lean toward each other.
            style={{ position: 'absolute', left: '50%', top: '50%', width: drop, height: drop, margin: -drop / 2, translate: at(angle, far * 0.85) }}
          />
        ))}
      </span>
    </GlassGroup>
  );
}

/**
 * A loading indicator made of liquid glass: three drops in one surface that
 * orbit and breathe, fusing into a single drop and parting again. Set `page`
 * for a whole loading page. It announces its label to assistive technology,
 * and under reduced motion it fades instead of moving.
 */
export function GlassLoader({ label = 'Loading', animate = true, size, page = false, style, ...rest }: GlassLoaderProps) {
  const options: GlassOptions = {};
  const attrs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (GLASS_KEYS.has(key)) (options as Record<string, unknown>)[key] = value;
    else attrs[key] = value;
  }

  if (page) {
    return (
      <Glass
        {...options}
        {...attrs}
        role="status"
        aria-live="polite"
        radius={0}
        refraction={0}
        blur={options.blur ?? 14}
        shadow={false}
        style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 18, ...style }}
      >
        <Drops size={size ?? 72} animate={animate} options={options} />
        <span>{label}</span>
      </Glass>
    );
  }

  return (
    <span {...attrs} role="status" aria-live="polite" style={{ display: 'inline-grid', placeItems: 'center', ...style }}>
      <Drops size={size ?? 40} animate={animate} options={options} />
      <span style={HIDDEN_LABEL}>{label}</span>
    </span>
  );
}

const GLASS_KEYS = new Set<string>(GLASS_OPTION_KEYS);
