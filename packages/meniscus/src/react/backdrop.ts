import { useCallback, useEffect, useState, type RefObject } from 'react';
import { REDUCED_TRANSPARENCY, elementImage, supportsElementCopy, supportsWebGL2, type RenderMode, type RenderModePreference } from '../core/support';
import { isMediaElement } from '../webgl/media';
import { DEV } from './dev';
import { useIsomorphicLayoutEffect, useMediaQuery } from './hooks';

/**
 * What lies behind a glass, for browsers that can't refract the live page:
 * an element, or a ref to one.
 */
export type Backdrop = HTMLElement | null | RefObject<HTMLElement | null>;

/**
 * How a glass refracts where backdrop filters can't take SVG:
 * - `webgl`: the backdrop is an image, video or canvas, drawn and refracted
 *   in WebGL.
 * - `element`: a live copy of the backdrop element (Firefox) refracted
 *   through a plain CSS filter.
 */
export type FallbackPath = 'webgl' | 'element';

export function backdropElement(b: Backdrop | undefined): HTMLElement | null {
  if (!b) return null;
  if ('current' in b) return b.current;
  return b;
}

let warnedAncestor = false;

/** The path a glass takes for its backdrop, or null to stay frosted. */
export function pickFallback(backdrop: HTMLElement | null, host: HTMLElement | null): FallbackPath | null {
  if (!backdrop || !host) return null;
  if (isMediaElement(backdrop) && supportsWebGL2()) return 'webgl';
  if (!supportsElementCopy()) return null;
  // A copy of an ancestor would contain the glass itself.
  if (backdrop.contains(host)) {
    if (DEV && !warnedAncestor) {
      warnedAncestor = true;
      console.warn('meniscus: a glass’s `backdrop` must not contain the glass. Point it at the element behind, such as a sibling.');
    }
    return null;
  }
  return 'element';
}

/**
 * The fallback path for a glass: only when its mode is automatic, live
 * refraction is unavailable, transparency isn't reduced, and a usable
 * backdrop is given. Re-checked after every render, since refs attach late.
 */
export function useFallback(
  backdrop: Backdrop | undefined,
  host: HTMLElement | null,
  preference: RenderModePreference | undefined,
  mode: RenderMode,
  /** Waves need WebGL: take the media path even where live refraction works. */
  preferWebGL = false,
): { path: FallbackPath | null; element: HTMLElement | null; fail: () => void } {
  const reducedTransparency = useMediaQuery(REDUCED_TRANSPARENCY);
  const [state, setState] = useState<{ path: FallbackPath | null; element: HTMLElement | null }>({ path: null, element: null });
  // A path that failed (unreadable media, a lost context) is not tried again.
  const [failed, setFailed] = useState<FallbackPath | null>(null);
  const eligible = !!backdrop && (preference ?? 'auto') === 'auto' && (mode === 'frost' || (preferWebGL && mode === 'refract')) && !reducedTransparency;
  useIsomorphicLayoutEffect(() => {
    const element = eligible ? backdropElement(backdrop) : null;
    let path = pickFallback(element, host);
    // Live refraction already draws everything a copy would; only WebGL adds waves.
    if (path === 'element' && mode !== 'frost') path = null;
    if (path && path === failed) path = null;
    if (path !== state.path || (path ? element : null) !== state.element) setState({ path, element: path ? element : null });
  });
  const fail = useCallback(() => setFailed(state.path), [state.path]);
  return { ...state, fail };
}

let copies = 0;

/** The element's id, assigning one if it has none, for `-moz-element()`. */
export function copyId(el: HTMLElement): string {
  if (!el.id) el.id = `meniscus-backdrop-${++copies}`;
  return el.id;
}

/**
 * Keeps a live copy of `backdrop` painted into `copy` exactly where the
 * backdrop sits on screen, following scroll, layout and transforms every
 * frame while visible.
 */
export function useElementCopy(copy: RefObject<HTMLElement | null>, backdrop: HTMLElement | null, active: boolean): void {
  useEffect(() => {
    const el = copy.current;
    if (!active || !el || !backdrop) return;
    el.style.backgroundImage = elementImage(copyId(backdrop));
    el.style.backgroundRepeat = 'no-repeat';
    let frame = 0;
    let visible = true;
    let last = '';
    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!visible) return;
      const c = el.getBoundingClientRect();
      const b = backdrop.getBoundingClientRect();
      const sx = el.offsetWidth ? c.width / el.offsetWidth : 1;
      const sy = el.offsetHeight ? c.height / el.offsetHeight : 1;
      const key = `${((b.left - c.left) / sx).toFixed(2)}px ${((b.top - c.top) / sy).toFixed(2)}px/${(b.width / sx).toFixed(2)}px ${(b.height / sy).toFixed(2)}px`;
      if (key === last) return;
      last = key;
      const [position, size] = key.split('/');
      el.style.backgroundPosition = position!;
      el.style.backgroundSize = size!;
    };
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
          })
        : null;
    io?.observe(el);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      io?.disconnect();
      el.style.backgroundImage = '';
    };
  }, [copy, backdrop, active]);
}
