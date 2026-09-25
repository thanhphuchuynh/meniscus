import { GlassProvider } from 'meniscus';
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Two inert previews keep duplicate controls out of the focus and accessibility trees. */
export function GlassComparison({ label, children }: { label: string; children: ReactNode }) {
  const [split, setSplit] = useState(50);
  const id = useId();
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const update = (x: number) => {
    const r = stage.current?.getBoundingClientRect();
    if (r) setSplit(Math.max(0, Math.min(100, (x - r.left) / r.width * 100)));
  };
  return (
    <figure className="comparison">
      <figcaption id={id}>{label}</figcaption>
      <div className="comparison__stage" ref={stage}>
        <div className="comparison__view" aria-hidden="true" inert><GlassProvider>{children}</GlassProvider></div>
        <div className="comparison__view comparison__view--flat" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} aria-hidden="true" inert>
          <GlassProvider mode="none">{children}</GlassProvider>
        </div>
        <span className="comparison__label comparison__label--flat">Flat</span>
        <span className="comparison__label comparison__label--glass">Glass</span>
        <div className="comparison__line" style={{ left: `${split}%`, '--split': split } as CSSProperties}>
          <button type="button" role="slider" className="comparison__handle" aria-labelledby={id}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)} aria-valuetext={`${Math.round(split)}% flat, ${100 - Math.round(split)}% glass`}
            onPointerDown={(e) => { if (e.button !== 0 || drag.current !== null) return; drag.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (drag.current === e.pointerId) update(e.clientX); }}
            onPointerUp={(e) => { if (drag.current === e.pointerId) { drag.current = null; e.currentTarget.releasePointerCapture(e.pointerId); } }}
            onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 10 : 2;
              const value = e.key === 'Home' ? 0 : e.key === 'End' ? 100 : ['ArrowRight', 'ArrowUp'].includes(e.key) ? split + step : ['ArrowLeft', 'ArrowDown'].includes(e.key) ? split - step : null;
              if (value !== null) { e.preventDefault(); setSplit(Math.max(0, Math.min(100, value))); }
            }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M12 5v14" /></svg>
          </button>
        </div>
      </div>
    </figure>
  );
}
