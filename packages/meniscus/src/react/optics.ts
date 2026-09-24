import type { CSSProperties } from 'react';
import { presenceOpacity, type GlassPhysics, type OpticalState } from '../core/physics';
import { useIsomorphicLayoutEffect } from './hooks';

const lift = 'var(--meniscus-shadow, 1)';

/** The default shadow scaled by the lift channel. At rest it is exactly `DEFAULT_SHADOW`. */
export const OPTIC_SHADOW = `0 calc(${lift} * 1px) calc(${lift} * 2px) rgba(0, 0, 0, calc(${lift} * 0.08)), 0 calc(${lift} * 10px) calc(${lift} * 28px) -6px rgba(0, 0, 0, calc(${lift} * 0.18))`;

/** A tint whose opacity follows the tint channel. At rest it is the tint itself. */
export function opticTint(tint: string): string {
  return `color-mix(in srgb, ${tint} calc(var(--meniscus-tint, 1) * 100%), transparent)`;
}

/** Opacity that follows presence (see `presenceOpacity`), composed with the app's own. */
export function opticOpacity(own: CSSProperties['opacity']): string {
  return own === undefined ? 'var(--meniscus-opacity, 1)' : `calc(var(--meniscus-opacity, 1) * ${own})`;
}

/** A soft specular spot that follows the highlight channel. Invisible at rest. */
export const SPOT: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  borderRadius: 'inherit',
  pointerEvents: 'none',
  background:
    'radial-gradient(circle at calc(50% + var(--meniscus-hx, 0) * 50%) calc(50% + var(--meniscus-hy, 0) * 50%), rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0) 55%)',
  opacity: 'min(1, calc((var(--meniscus-hx, 0) * var(--meniscus-hx, 0) + var(--meniscus-hy, 0) * var(--meniscus-hy, 0)) * 6))' as unknown as number,
  mixBlendMode: 'screen',
};

const PROPS = ['presence', 'opacity', 'tint', 'shadow', 'hx', 'hy'] as const;
const n = (x: number) => String(Math.round(x * 1e4) / 1e4);

/** Presence and opacity for a glass's first render, before its springs run: server markup shows an absent glass hidden. */
export function opticVars(s: OpticalState): CSSProperties {
  const presence = Math.max(0, s.presence);
  return { '--meniscus-presence': n(presence), '--meniscus-opacity': n(presenceOpacity(presence)) } as CSSProperties;
}
const maps = (node: HTMLElement) => node.querySelectorAll<SVGElement>(':scope > svg feDisplacementMap[data-scale]');

/**
 * Writes a glass's optics to its element on every change: custom properties
 * its styles read, and the refraction filter's strength. Nothing re-renders.
 * `filterKey` changes when the filter is rebuilt, so its strength is written
 * again.
 */
export function useOptics(node: HTMLElement | null, optics: GlassPhysics | undefined, filterKey: unknown): void {
  useIsomorphicLayoutEffect(() => {
    if (!node || !optics) return;
    const apply = (s: OpticalState) => {
      // Presence may pass 1 briefly on a bouncy spring: entrances overshoot, opacity doesn't.
      const presence = Math.max(0, s.presence);
      node.style.setProperty('--meniscus-presence', n(presence));
      node.style.setProperty('--meniscus-opacity', n(presenceOpacity(presence)));
      node.style.setProperty('--meniscus-tint', n(Math.max(0, s.tint)));
      node.style.setProperty('--meniscus-shadow', n(Math.max(0, s.shadow)));
      node.style.setProperty('--meniscus-hx', n(s.highlightX));
      node.style.setProperty('--meniscus-hy', n(s.highlightY));
      const k = Math.max(0, s.refraction) * presence;
      maps(node).forEach((map) => map.setAttribute('scale', n(Number(map.getAttribute('data-scale')) * k)));
    };
    const off = optics.subscribe(apply);
    return () => {
      off();
      for (const name of PROPS) node.style.removeProperty(`--meniscus-${name}`);
      maps(node).forEach((map) => map.setAttribute('scale', map.getAttribute('data-scale') ?? '0'));
    };
  }, [node, optics, filterKey]);
}
