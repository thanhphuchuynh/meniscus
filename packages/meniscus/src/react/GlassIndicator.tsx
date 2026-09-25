import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties, type ForwardedRef, type ReactElement } from 'react';
import { Glass, type GlassProps } from './Glass';
import { useMergedRef } from './refs';
import { useGlassPreferences, useIsomorphicLayoutEffect } from './hooks';
import { DEV } from './dev';

/** A box in the indicator's offset-parent coordinates, px: for following a finger rather than an element. */
export interface IndicatorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GlassIndicatorProps extends Omit<GlassProps<'span'>, 'as' | 'interactive'> {
  /**
   * The element to sit under, such as the selected tab, sharing the
   * indicator's offset parent; or a box, to follow a pointer while dragging.
   */
  target: HTMLElement | IndicatorBox | null;
  /** Space between the target's box and the indicator, px. Negative values grow past the target. */
  inset?: number;
  /** How liquid the move is. 0 slides rigidly; 1 lets the leading edge run ahead and the trailing edge catch up. */
  stretch?: number;
}

interface Edge {
  value: number;
  velocity: number;
  target: number;
}

const edge = (v = 0): Edge => ({ value: v, velocity: 0, target: v });
let warnedStatic = false;
const FAST = { k: 560, c: 38 };
const SLOW = { k: 240, c: 27 };

function step(e: Edge, k: number, c: number, dt: number): void {
  const force = -k * (e.value - e.target) - c * e.velocity;
  e.velocity += force * dt;
  e.value += e.velocity * dt;
}

function settled(e: Edge): boolean {
  return Math.abs(e.value - e.target) < 0.05 && Math.abs(e.velocity) < 0.5;
}

/** The target's box in its offset parent's coordinates, unaffected by transforms. */
function boxOf(target: HTMLElement | IndicatorBox, host: HTMLElement): { x: number; y: number; w: number; h: number } | null {
  if (!(target instanceof HTMLElement)) return { x: target.x, y: target.y, w: target.width, h: target.height };
  const parent = host.offsetParent as HTMLElement | null;
  if (target.offsetParent === parent) {
    return { x: target.offsetLeft, y: target.offsetTop, w: target.offsetWidth, h: target.offsetHeight };
  }
  if (!parent) return null;
  const t = target.getBoundingClientRect();
  const p = parent.getBoundingClientRect();
  return { x: t.left - p.left - parent.clientLeft + parent.scrollLeft, y: t.top - p.top - parent.clientTop + parent.scrollTop, w: t.width, h: t.height };
}

/**
 * A glass lens that moves to whichever element you point it at, like the
 * selection in a tab bar. Its four edges are springs: moving right, the right
 * edge is stiff and the left edge soft, so the glass stretches toward the new
 * target, thins a little to keep its volume, and draws itself back together.
 * Resizing costs nothing, because glass maps are built per corner shape.
 *
 * Place it inside the positioned container that holds the targets, before
 * them in the DOM, and give the targets `position: relative` so their
 * content paints above the glass.
 */
function GlassIndicatorImpl({ target, inset = 0, stretch = 1, style, radius = 'capsule', ...rest }: GlassIndicatorProps, forwardedRef: ForwardedRef<HTMLSpanElement>) {
  const [node, setNode] = useState<HTMLSpanElement | null>(null);
  const setRef = useMergedRef(forwardedRef, setNode);
  const { reducedMotion } = useGlassPreferences();
  const edges = useRef({ l: edge(), r: edge(), t: edge(), b: edge() });
  const placed = useRef(false);
  const anchor = useRef<Element | null>(null);
  const frame = useRef<number | null>(null);
  const last = useRef(0);
  const [visible, setVisible] = useState(false);

  const write = useCallback(() => {
    if (!node) return;
    const { l, r, t, b } = edges.current;
    const width = Math.max(0, r.value - l.value);
    const targetWidth = Math.max(1, r.target - l.target);
    // Thin while stretched, so the drop keeps roughly its volume.
    const stretched = Math.max(0, width / targetWidth - 1);
    const thin = Math.min(0.2, stretched * 0.5) * (b.value - t.value);
    node.style.left = `${l.value}px`;
    node.style.width = `${width}px`;
    node.style.top = `${t.value + thin / 2}px`;
    node.style.height = `${Math.max(0, b.value - t.value - thin)}px`;
  }, [node]);

  const tick = useCallback(
    (now: number) => {
      const dt = Math.min(1 / 30, (now - last.current) / 1000 || 1 / 60);
      last.current = now;
      const e = edges.current;
      const movingRight = e.r.target + e.l.target > e.r.value + e.l.value;
      const movingDown = e.b.target + e.t.target > e.b.value + e.t.value;
      const soft = {
        k: FAST.k + (SLOW.k - FAST.k) * stretch,
        c: FAST.c + (SLOW.c - FAST.c) * stretch,
      };
      step(e.l, movingRight ? soft.k : FAST.k, movingRight ? soft.c : FAST.c, dt);
      step(e.r, movingRight ? FAST.k : soft.k, movingRight ? FAST.c : soft.c, dt);
      step(e.t, movingDown ? soft.k : FAST.k, movingDown ? soft.c : FAST.c, dt);
      step(e.b, movingDown ? FAST.k : soft.k, movingDown ? FAST.c : soft.c, dt);
      write();
      if ([e.l, e.r, e.t, e.b].every(settled)) {
        for (const x of [e.l, e.r, e.t, e.b]) {
          x.value = x.target;
          x.velocity = 0;
        }
        write();
        frame.current = null;
        return;
      }
      frame.current = requestAnimationFrame(tick);
    },
    [stretch, write],
  );

  const moveTo = useCallback(() => {
    if (!node || !target) return;
    const box = boxOf(target, node);
    if (!box) return;
    const e = edges.current;
    e.l.target = box.x + inset;
    e.r.target = box.x + box.w - inset;
    e.t.target = box.y + inset;
    e.b.target = box.y + box.h - inset;
    // Jump rather than glide on the first placement, and whenever the
    // coordinate space itself changed (a parent Glass positions itself only
    // after its children's first layout).
    const jump = !placed.current || node.offsetParent !== anchor.current;
    if (jump || reducedMotion) {
      for (const x of [e.l, e.r, e.t, e.b]) {
        x.value = x.target;
        x.velocity = 0;
      }
      placed.current = true;
      anchor.current = node.offsetParent;
      write();
      setVisible(true);
      if (!jump && reducedMotion && typeof node.animate === 'function') {
        node.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      }
      return;
    }
    if (frame.current === null) {
      last.current = performance.now();
      frame.current = requestAnimationFrame(tick);
    }
  }, [node, target, inset, reducedMotion, tick, write]);

  useIsomorphicLayoutEffect(() => {
    if (placed.current) {
      moveTo();
      return;
    }
    // Place for the first time once every layout effect has run, so
    // ancestors have finished positioning themselves; until then the
    // indicator stays hidden.
    const id = requestAnimationFrame(() => moveTo());
    return () => cancelAnimationFrame(id);
  }, [moveTo]);

  useEffect(() => {
    if (!DEV || warnedStatic || !(target instanceof HTMLElement) || typeof getComputedStyle !== 'function') return;
    if (getComputedStyle(target).position === 'static') {
      warnedStatic = true;
      console.warn('meniscus: <GlassIndicator> is positioned, so it paints over static targets. Give the targets `position: relative` to keep their content above the glass.');
    }
  }, [target]);

  // Follow the target through layout changes.
  useEffect(() => {
    if (!node || !(target instanceof HTMLElement) || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => moveTo());
    ro.observe(target);
    if (node.offsetParent) ro.observe(node.offsetParent);
    return () => ro.disconnect();
  }, [node, target, moveTo]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );

  const Indicator = Glass as (p: Record<string, unknown>) => ReactElement | null;
  const indicatorStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    pointerEvents: 'none',
    visibility: visible && target ? 'visible' : 'hidden',
    ...style,
  };
  return <Indicator {...rest} as="span" aria-hidden="true" radius={radius} ref={setRef} style={indicatorStyle} data-meniscus-indicator="" />;
}

export const GlassIndicator = forwardRef(GlassIndicatorImpl) as (props: GlassIndicatorProps & { ref?: ForwardedRef<HTMLSpanElement> }) => ReactElement | null;
