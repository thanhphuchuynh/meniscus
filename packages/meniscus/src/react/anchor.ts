import { useId, useSyncExternalStore, type CSSProperties } from 'react';
import { place, placementSide, POSITION_AREA, type GlassPlacement } from '../core/place';
import { supportsAnchorPositioning } from '../core/support';
import { useIsomorphicLayoutEffect } from './hooks';

const noSubscribe = () => () => {};

/** The margin on the side facing the anchor: CSS flips it with the box. */
const FACING = { top: 'marginBottom', bottom: 'marginTop', left: 'marginRight', right: 'marginLeft' } as const;

export interface AnchorOptions {
  /** Which side of the anchor, and how aligned. */
  placement: GlassPlacement;
  /** Gap between the anchor and the box, px. */
  offset: number;
}

/**
 * Keeps `box` beside `anchor` while `active`. With CSS anchor positioning the
 * browser does it, and flips the box at the viewport's edge. Elsewhere
 * `place()` runs when it opens, then on scroll and resize, at most once a
 * frame, writing `left`, `top` and `data-placement` to the box. Returns the
 * box's style.
 */
export function useAnchor(anchor: HTMLElement | null, box: HTMLElement | null, active: boolean, { placement, offset }: AnchorOptions): CSSProperties {
  const css = useSyncExternalStore(noSubscribe, supportsAnchorPositioning, () => false);
  const name = `--meniscus-anchor-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useIsomorphicLayoutEffect(() => {
    if (!css || !anchor) return;
    anchor.style.setProperty('anchor-name', name);
    return () => {
      anchor.style.removeProperty('anchor-name');
    };
  }, [css, anchor, name]);

  useIsomorphicLayoutEffect(() => {
    if (css || !active || !anchor || !box) return;
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
  }, [css, active, anchor, box, placement, offset]);

  const base: CSSProperties = { position: 'fixed', inset: 'auto', margin: 0 };
  if (!css) return base;
  return {
    ...base,
    positionAnchor: name,
    positionArea: POSITION_AREA[placement],
    positionTryFallbacks: 'flip-block, flip-inline',
    [FACING[placementSide(placement)]]: offset,
  } as CSSProperties;
}
