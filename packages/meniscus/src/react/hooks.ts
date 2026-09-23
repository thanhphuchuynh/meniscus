import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { supportsBackdropRefraction, type RenderMode, type RenderModePreference } from '../core/support';
import { useGlassDefaults } from './context';

export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const noopSubscribe = () => () => {};

/**
 * The rendering path a glass uses. The server and the first client render
 * always report `frost`, so markup hydrates cleanly; refraction switches on
 * right after hydration in browsers that support it.
 */
export function useGlassMode(preference?: RenderModePreference): RenderMode {
  const defaults = useGlassDefaults();
  const supported = useSyncExternalStore(noopSubscribe, supportsBackdropRefraction, () => false);
  const pref = preference ?? defaults.mode ?? 'auto';
  if (pref !== 'auto') return pref;
  return supported ? 'refract' : 'frost';
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  const snapshot = useCallback(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

function subscribePixelRatio(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}
const pixelRatio = () => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
const serverPixelRatio = () => 1;

export function usePixelRatio(): number {
  return useSyncExternalStore(subscribePixelRatio, pixelRatio, serverPixelRatio);
}

export interface Size {
  width: number;
  height: number;
}

/** Border-box size of an element, tracked with a ResizeObserver. Unaffected by transforms. */
export function useElementSize(el: HTMLElement | null): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!el) return;
    const update = (width: number, height: number) =>
      setSize((prev) => (prev && Math.abs(prev.width - width) < 0.01 && Math.abs(prev.height - height) < 0.01 ? prev : { width, height }));
    update(el.offsetWidth, el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const box = entry.borderBoxSize?.[0];
      const horizontal = !getComputedStyle(el).writingMode.startsWith('vertical');
      if (box) update(horizontal ? box.inlineSize : box.blockSize, horizontal ? box.blockSize : box.inlineSize);
      else update(el.offsetWidth, el.offsetHeight);
    });
    ro.observe(el, { box: 'border-box' });
    return () => ro.disconnect();
  }, [el]);
  return size;
}
