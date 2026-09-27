import type { CSSProperties } from 'react';
import { place, type GlassPlacement } from '../core/place';
import { useIsomorphicLayoutEffect } from './hooks';

export interface AnchorOptions {
  /** Which side of the anchor, and how aligned. */
  placement: GlassPlacement;
  /** Gap between the anchor and the box, px. */
  offset: number;
}

const BASE: CSSProperties = { position: 'fixed', inset: 'auto', margin: 0 };

/**
 * Keeps `box` beside `anchor` while `active`: `place()` runs when it opens,
 * then on scroll and resize, at most once a frame, writing `left`, `top` and
 * `data-placement` to the box. Returns the box's style.
 *
 * CSS anchor positioning would track scrolling without a frame of lag, but
 * Chromium lays a just-opened popover out against a stale scroll position,
 * takes the right side for overflow, and keeps the flipped fallback it
 * picked, so menus opened upward with room below. Checked in Chromium 153.
 */
export function useAnchor(anchor: HTMLElement | null, box: HTMLElement | null, active: boolean, { placement, offset }: AnchorOptions): CSSProperties {
  useIsomorphicLayoutEffect(() => {
    if (!active || !anchor || !box) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const a = anchor.getBoundingClientRect();
      const p = place(
        { x: a.left, y: a.top, width: a.width, height: a.height },
        { width: box.offsetWidth, height: box.offsetHeight },
        placement,
        { offset, viewport: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight } },
      );
      box.style.left = `${p.x}px`;
      box.style.top = `${p.y}px`;
      box.setAttribute('data-placement', p.placement);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
    };
  }, [active, anchor, box, placement, offset]);
  return BASE;
}
