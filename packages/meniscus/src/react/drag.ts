import { useRef, type PointerEvent } from 'react';
import { Spring } from '../core/spring';

/** A release faster than this toward the edge dismisses, px/s. */
export const THROW = 600;
/** Movement before a press becomes a drag, px. Less stays a click. */
const SLOP = 6;
/** How much a drag the wrong way follows the pointer. */
const RESIST = 0.2;

/** Whether a drag released `offset` px toward the edge at `velocity` px/s dismisses an element `size` px long. */
export function dragDismisses(offset: number, velocity: number, size: number, fraction: number): boolean {
  return offset > size * fraction || velocity > THROW;
}

export interface DragDismissOptions {
  /** The axis it moves along. */
  axis: 'x' | 'y';
  /** The way that dismisses: 1 toward right or down, -1 toward left or up, 0 either way. */
  direction: 1 | -1 | 0;
  /** The share of its size a drag must pass to dismiss. */
  fraction: number;
  enabled: boolean;
  /** Settle a short release at once instead of springing back. */
  reducedMotion: boolean;
  onDismiss: () => void;
}

export interface DragHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
}

interface Press {
  id: number;
  start: number;
  last: number;
  time: number;
  velocity: number;
  dragging: boolean;
}

/**
 * Drag an element toward an edge to dismiss it. The offset goes to
 * `--meniscus-drag` (px) on `target`, for its transform to add. A release
 * short of the threshold springs back, and the click a drag would end with is
 * swallowed.
 */
export function useDragDismiss(target: HTMLElement | null, options: DragDismissOptions): DragHandlers {
  const press = useRef<Press | null>(null);
  const settle = useRef(0);
  const latest = useRef(options);
  latest.current = options;

  const write = (px: number) => target?.style.setProperty('--meniscus-drag', `${Math.round(px * 100) / 100}px`);
  const coord = (e: PointerEvent<HTMLElement>) => (latest.current.axis === 'x' ? e.clientX : e.clientY);
  const toward = (v: number) => (latest.current.direction === 0 ? Math.abs(v) : v * latest.current.direction);

  const end = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.dragging) return;
    const swallow = (click: Event) => {
      click.stopPropagation();
      click.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    const delta = p.last - p.start;
    const size = target ? (latest.current.axis === 'x' ? target.offsetWidth : target.offsetHeight) : 0;
    if (!cancelled && dragDismisses(toward(delta), toward(p.velocity), size, latest.current.fraction)) {
      latest.current.onDismiss();
      return;
    }
    if (latest.current.reducedMotion || typeof requestAnimationFrame !== 'function') {
      write(0);
      return;
    }
    const spring = new Spring(delta, 'snappy');
    spring.target = 0;
    let then = performance.now();
    const tick = (now: number) => {
      spring.step((now - then) / 1000);
      then = now;
      if (spring.settled) {
        write(0);
        settle.current = 0;
        return;
      }
      write(spring.value);
      settle.current = requestAnimationFrame(tick);
    };
    settle.current = requestAnimationFrame(tick);
  };

  return {
    onPointerDown(e) {
      if (!latest.current.enabled || e.button !== 0 || press.current) return;
      cancelAnimationFrame(settle.current);
      const c = coord(e);
      press.current = { id: e.pointerId, start: c, last: c, time: performance.now(), velocity: 0, dragging: false };
    },
    onPointerMove(e) {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      const c = coord(e);
      const delta = c - p.start;
      if (!p.dragging) {
        if (Math.abs(delta) < SLOP) return;
        p.dragging = true;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // The pointer is already gone: the drag still works without capture.
        }
      }
      const now = performance.now();
      p.velocity = 0.6 * ((c - p.last) / (Math.max(1, now - p.time) / 1000)) + 0.4 * p.velocity;
      p.last = c;
      p.time = now;
      const d = latest.current.direction;
      write(d === 0 || delta * d > 0 ? delta : delta * RESIST);
    },
    onPointerUp(e) {
      end(e, false);
    },
    onPointerCancel(e) {
      end(e, true);
    },
  };
}
