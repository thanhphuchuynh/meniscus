import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';

/** An engraved switch; the knob takes the spot ink when on. */
export function Switch({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; children?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch__track" aria-hidden="true">
        <span className="switch__knob" />
      </span>
      {children}
    </button>
  );
}

/**
 * The single light source, set on a graduated ring. Drag the sun around the
 * ring or use the arrow keys; angles follow the CSS convention (0° at the top,
 * clockwise).
 */
export function SunDial({ angle, onChange, size = 96 }: { angle: number; onChange: (deg: number) => void; size?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const norm = ((angle % 360) + 360) % 360;
  const set = useCallback(
    (e: PointerEvent<SVGSVGElement>) => {
      const r = ref.current!.getBoundingClientRect();
      const a = (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
      onChange(Math.round((a + 360) % 360));
    },
    [onChange],
  );
  const c = size / 2;
  const ring = c - 12;
  const sx = c + Math.sin((norm * Math.PI) / 180) * ring;
  const sy = c - Math.cos((norm * Math.PI) / 180) * ring;
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((norm + step) % 360);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((norm - step + 360) % 360);
    else return;
    e.preventDefault();
  };
  return (
    <svg
      ref={ref}
      className="sundial"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="slider"
      tabIndex={0}
      aria-label="Light angle"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={norm}
      aria-valuetext={`Light from ${norm} degrees`}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) set(e);
      }}
    >
      <circle cx={c} cy={c} r={ring} fill="none" stroke="var(--rule)" strokeWidth="1" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i * 10 * Math.PI) / 180;
        const long = i % 9 === 0;
        const r1 = ring + 3;
        const r2 = ring + (long ? 9 : 6);
        return <line key={i} x1={c + Math.sin(a) * r1} y1={c - Math.cos(a) * r1} x2={c + Math.sin(a) * r2} y2={c - Math.cos(a) * r2} stroke="var(--ink-faint)" strokeWidth="1" />;
      })}
      <line x1={c} y1={c} x2={sx} y2={sy} stroke="var(--spot)" strokeWidth="1" strokeDasharray="2 3" />
      <circle cx={c} cy={c} r="2" fill="var(--ink)" />
      <circle cx={sx} cy={sy} r="7" fill="var(--stock)" stroke="var(--spot)" strokeWidth="1.5" />
      <circle cx={sx} cy={sy} r="2.5" fill="var(--spot)" />
    </svg>
  );
}

/**
 * Drag an absolutely positioned element within its container, by pointer or
 * arrow keys. Positions are px from the container's top-left.
 */
export function useDrag<T extends HTMLElement>(container: RefObject<HTMLElement | null>, initial: (c: DOMRect, el: T) => { x: number; y: number }) {
  const el = useRef<T>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const grab = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const initialRef = useRef(initial);

  const clamp = useCallback(
    (p: { x: number; y: number }) => {
      const c = container.current;
      const e = el.current;
      if (!c || !e) return p;
      return {
        x: Math.min(Math.max(-e.offsetWidth * 0.3, p.x), c.clientWidth - e.offsetWidth * 0.7),
        y: Math.min(Math.max(-e.offsetHeight * 0.3, p.y), c.clientHeight - e.offsetHeight * 0.7),
      };
    },
    [container],
  );

  useEffect(() => {
    const place = () => {
      const c = container.current;
      const e = el.current;
      if (c && e) setPos(clamp(initialRef.current(c.getBoundingClientRect(), e)));
    };
    place();
    document.fonts?.ready.then(place);
    const ro = new ResizeObserver(() => setPos((p) => (p ? clamp(p) : p)));
    if (container.current) ro.observe(container.current);
    return () => ro.disconnect();
  }, [container, clamp]);

  const handlers = {
    onPointerDown: (e: PointerEvent<T>) => {
      if (!pos || !container.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const r = container.current.getBoundingClientRect();
      grab.current = { id: e.pointerId, dx: e.clientX - r.left - pos.x, dy: e.clientY - r.top - pos.y };
    },
    onPointerMove: (e: PointerEvent<T>) => {
      const g = grab.current;
      if (!g || g.id !== e.pointerId || !container.current) return;
      const r = container.current.getBoundingClientRect();
      setPos(clamp({ x: e.clientX - r.left - g.dx, y: e.clientY - r.top - g.dy }));
    },
    onPointerUp: (e: PointerEvent<T>) => {
      if (grab.current?.id === e.pointerId) grab.current = null;
    },
    onPointerCancel: () => {
      grab.current = null;
    },
    onKeyDown: (e: KeyboardEvent<T>) => {
      const step = e.shiftKey ? 40 : 10;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const m = d[e.key];
      if (!m || !pos) return;
      e.preventDefault();
      setPos(clamp({ x: pos.x + m[0], y: pos.y + m[1] }));
    },
  };

  const style = pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden' as const };
  return { ref: el, pos, style, handlers };
}
