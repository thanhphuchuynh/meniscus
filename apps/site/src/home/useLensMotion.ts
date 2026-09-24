import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { advanceLens, boundLens, releaseLens, type Bounds, type Point } from './lensMotion';

export function useLensMotion(plate: RefObject<HTMLElement | null>, lens: RefObject<HTMLButtonElement | null>, reduced: boolean, onRelease: () => void) {
  const [pos, setPos] = useState<Point | null>(null);
  const position = useRef<Point | null>(null);
  const frame = useRef(0);
  const drag = useRef<{ id: number; offset: Point; last: Point; time: number; velocity: Point } | null>(null);
  const bounds = useCallback((): Bounds => {
    const p = plate.current;
    const l = lens.current;
    return { minX: -(l?.offsetWidth ?? 0) * 0.25, minY: -(l?.offsetHeight ?? 0) * 0.25,
      maxX: (p?.clientWidth ?? 0) - (l?.offsetWidth ?? 0) * 0.75, maxY: (p?.clientHeight ?? 0) - (l?.offsetHeight ?? 0) * 0.75 };
  }, [plate, lens]);
  const move = useCallback((p: Point) => { position.current = p; setPos(p); }, []);
  const stop = useCallback(() => { cancelAnimationFrame(frame.current); frame.current = 0; }, []);
  useEffect(() => {
    const el = plate.current;
    if (!el) return;
    const place = () => {
      stop();
      drag.current = null;
      move(boundLens(position.current ?? { x: el.clientWidth / 1200 * 800 - (lens.current?.offsetWidth ?? 220) / 2,
        y: el.clientWidth / 1200 * 334 - (lens.current?.offsetHeight ?? 220) / 2 }, bounds()));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    if (lens.current) ro.observe(lens.current);
    const hide = () => { if (document.hidden) { stop(); drag.current = null; } };
    document.addEventListener('visibilitychange', hide);
    return () => { ro.disconnect(); stop(); document.removeEventListener('visibilitychange', hide); };
  }, [plate, lens, bounds, move, stop]);
  useEffect(() => { if (reduced) stop(); }, [reduced, stop]);

  const cancel = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    stop();
  };
  return { pos, handlers: {
    onPointerDown(e: PointerEvent<HTMLButtonElement>) {
      if (e.button !== 0 || drag.current || !position.current || !plate.current) return;
      stop();
      e.currentTarget.setPointerCapture(e.pointerId);
      const r = plate.current.getBoundingClientRect();
      drag.current = { id: e.pointerId, offset: { x: e.clientX - r.left - position.current.x, y: e.clientY - r.top - position.current.y },
        last: position.current, time: performance.now(), velocity: { x: 0, y: 0 } };
    },
    onPointerMove(e: PointerEvent<HTMLButtonElement>) {
      const d = drag.current;
      if (!d || d.id !== e.pointerId || !plate.current) return;
      const r = plate.current.getBoundingClientRect();
      const next = boundLens({ x: e.clientX - r.left - d.offset.x, y: e.clientY - r.top - d.offset.y }, bounds());
      const now = performance.now();
      const dt = Math.max(0.008, (now - d.time) / 1000);
      d.velocity = { x: (next.x - d.last.x) / dt, y: (next.y - d.last.y) / dt };
      d.last = next;
      d.time = now;
      move(next);
    },
    onPointerUp(e: PointerEvent<HTMLButtonElement>) {
      const d = drag.current;
      if (!d || d.id !== e.pointerId || !position.current) return;
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      onRelease();
      if (reduced) return;
      const flight = releaseLens(position.current, performance.now() - d.time < 100 ? d.velocity : { x: 0, y: 0 }, bounds());
      let last = performance.now();
      const tick = (now: number) => {
        const active = advanceLens(flight, (now - last) / 1000, bounds());
        last = now;
        move({ ...flight.position });
        frame.current = active ? requestAnimationFrame(tick) : 0;
      };
      frame.current = requestAnimationFrame(tick);
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
      const step = e.shiftKey ? 40 : 10;
      const delta: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
      const d = delta[e.key];
      if (!d || !position.current) return;
      e.preventDefault();
      stop();
      move(boundLens({ x: position.current.x + d.x, y: position.current.y + d.y }, bounds()));
    },
  } };
}
