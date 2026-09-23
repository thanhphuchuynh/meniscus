import { useEffect, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from './hooks';

const SWELL_MS = 620;
const FADE_MS = 260;
const LENS_MS = 820;
const FROM_SCALE = 0.9;

let springCurve: string | null = null;

/** A CSS `linear()` easing traced from an underdamped spring, or a close cubic where `linear()` is unsupported. */
function springEasing(): string {
  if (springCurve) return springCurve;
  const supported = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('transition-timing-function', 'linear(0, 1)');
  if (!supported) return (springCurve = 'cubic-bezier(0.2, 0.9, 0.3, 1.18)');
  const k = 300;
  const c = 19;
  const samples = 40;
  const substeps = 8;
  const dt = SWELL_MS / 1000 / samples / substeps;
  let x = 0;
  let v = 0;
  const points: string[] = [];
  for (let i = 0; i < samples; i++) {
    points.push(String(Math.round(x * 1000) / 1000));
    for (let j = 0; j < substeps; j++) {
      v += (-k * (x - 1) - c * v) * dt;
      x += v * dt;
    }
  }
  points.push('1');
  return (springCurve = `linear(${points.join(', ')})`);
}

/**
 * Materializes glass as it mounts: the element fades in while it swells from
 * slightly small on a spring, and the lens gathers its bend a beat behind, so
 * the backdrop visibly curves into place. Reduced motion gets a short fade.
 *
 * Returns true while the element should stay hidden, before it can be
 * measured.
 */
export function useAppear(node: HTMLElement | null, appear: boolean, reducedMotion: boolean, ready: boolean): boolean {
  const [done, setDone] = useState(!appear);
  const frame = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (done || !appear || !node || !ready) return;
    setDone(true);
    if (typeof node.animate !== 'function') return;
    if (reducedMotion) {
      node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      return;
    }
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' });
    node.animate([{ scale: String(FROM_SCALE) }, { scale: '1' }], { duration: SWELL_MS, easing: springEasing(), composite: 'add' });

    // The refraction filter may mount a frame later (refraction switches on
    // after hydration), so the maps are looked up on every frame.
    const start = performance.now();
    const ramp = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / LENS_MS));
      const p = 1 - (1 - t) ** 3;
      node.querySelectorAll<SVGElement>(':scope > svg feDisplacementMap[data-scale]').forEach((map) => {
        const full = Number(map.getAttribute('data-scale'));
        map.setAttribute('scale', String(t < 1 ? full * p : full));
      });
      frame.current = t < 1 ? requestAnimationFrame(ramp) : null;
    };
    ramp(start);
  }, [appear, node, ready, reducedMotion, done]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );

  return !done;
}
