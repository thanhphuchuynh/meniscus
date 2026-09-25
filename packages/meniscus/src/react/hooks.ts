import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import {
  FORCED_COLORS,
  MORE_CONTRAST,
  REDUCED_MOTION,
  REDUCED_TRANSPARENCY,
  supportsBackdropRefraction,
  type RenderMode,
  type RenderModePreference,
} from '../core/support';
import { useGlassDefaults } from './context';

export const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const noopSubscribe = () => () => {};

/**
 * The path glass draws on this page: the browser's support, the provider's
 * `mode`, and reduced transparency or increased contrast, which frost it.
 * The server and the first client render always report `frost`, so markup
 * hydrates cleanly; refraction switches on right after hydration where it
 * can. A glass over a media `backdrop` may draw in WebGL instead: its own
 * `onPathChange` reports that.
 */
export function useGlassMode(preference?: RenderModePreference): RenderMode {
  const defaults = useGlassDefaults();
  const supported = useSyncExternalStore(noopSubscribe, supportsBackdropRefraction, () => false);
  const { reducedTransparency } = useGlassPreferences();
  const pref = preference ?? defaults.mode ?? 'auto';
  const mode = pref !== 'auto' ? pref : supported ? 'refract' : 'frost';
  return mode === 'refract' && reducedTransparency ? 'frost' : mode;
}

interface MediaStore {
  mql: MediaQueryList;
  listeners: Set<() => void>;
}
const mediaStores = new Map<string, MediaStore>();
let mediaSource: Window['matchMedia'] | undefined;

/** One MediaQueryList per query for the whole page, however many glasses ask it. */
function mediaStore(query: string): MediaStore | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  // A replaced matchMedia (a test's stub, a polyfill) starts fresh lists.
  if (window.matchMedia !== mediaSource) {
    mediaStores.clear();
    mediaSource = window.matchMedia;
  }
  let store = mediaStores.get(query);
  if (!store) {
    const listeners = new Set<() => void>();
    const mql = window.matchMedia(query);
    mql.addEventListener?.('change', () => listeners.forEach((listener) => listener()));
    store = { mql, listeners };
    mediaStores.set(query, store);
  }
  return store;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const store = mediaStore(query);
      if (!store) return () => {};
      store.listeners.add(onChange);
      return () => {
        store.listeners.delete(onChange);
      };
    },
    [query],
  );
  const snapshot = useCallback(() => mediaStore(query)?.mql.matches ?? false, [query]);
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

export interface GlassPreferences {
  /** Glass draws opaque, without refraction: Reduce Transparency, or implied by increased contrast. */
  reducedTransparency: boolean;
  /** Springs and ambient motion become short fades. */
  reducedMotion: boolean;
  /** Glass draws opaque with a hairline edge: Increase Contrast or forced colors. */
  increasedContrast: boolean;
}

/**
 * The accessibility settings glass follows: the system's, plus any a
 * `GlassProvider` turns on. A provider can add a setting, never remove one.
 */
export function useGlassPreferences(): GlassPreferences {
  const d = useGlassDefaults();
  // Every query runs on every render: hooks can't sit behind `||`.
  const more = useMediaQuery(MORE_CONTRAST);
  const forced = useMediaQuery(FORCED_COLORS);
  const transparency = useMediaQuery(REDUCED_TRANSPARENCY);
  const motion = useMediaQuery(REDUCED_MOTION);
  const contrast = more || forced || !!d.increaseContrast;
  return { reducedTransparency: transparency || !!d.reduceTransparency || contrast, reducedMotion: motion || !!d.reduceMotion, increasedContrast: contrast };
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
