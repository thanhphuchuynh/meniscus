import { Glass, SPRINGS, type SpringPreset } from 'meniscus';
import { useRef, useState, type PointerEvent } from 'react';
import { Plate } from '../shared/chrome';
import { Scale } from '../shared/Scale';
import { plateSrc, useTheme } from '../shared/theme';

const PRESETS = Object.keys(SPRINGS) as SpringPreset[];

export function PlateStack() {
  const theme = useTheme();
  const [open, setOpen] = useState(true);
  const [preset, setPreset] = useState<SpringPreset>('snappy');
  const [stagger, setStagger] = useState(0.12);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const clamp = (v: number, r: number) => Math.max(-r, Math.min(r, v));

  const onDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset({ x: clamp(e.clientX - d.x, 220), y: clamp(e.clientY - d.y, 120) });
  };
  const onUp = (e: PointerEvent<HTMLElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  return (
    <Plate folio="Experiment" id="stack" className="stack" label="Glass on glass">
      <div className="interfaces__text">
        <h2>Glass on glass.</h2>
        <p>
          A sidebar and a card, one pane above the other. The card bends the sidebar beneath it as well as the plate. Open them together and the nearer pane
          leads while the deeper one follows, each settling on its own spring. Fling the card and let its light and shadow catch up.
        </p>
      </div>
      {/* A new spring replays the entrance, so the choice shows at once. */}
      <Glass.Stack key={preset} className="stack__stage" physics={preset} stagger={stagger} appear>
        <Glass.Layer kind="context" className="stack__scene">
          <img src={plateSrc('opticks-plate-2', theme)} alt="Newton’s Opticks, Book I, Plate II, behind two panes of glass." />
        </Glass.Layer>
        <Glass.Layer as="nav" depth={1} present={open} className="stack__sidebar" radius={22} aria-label="Plates">
          <a href="#main">Specimen</a>
          <a href="#depth">Three surfaces</a>
          <a href="#stack">Glass on glass</a>
          <a href="#try-online">Start</a>
        </Glass.Layer>
        <Glass.Layer
          depth={2}
          present={open}
          className="stack__card"
          radius={26}
          interactive
          role="region"
          aria-label="Stacked card"
          // At rest the card starts over the sidebar, but never past the stage's right edge.
          style={{ left: `calc(min(38%, 100% - var(--card-w) - 12px) + ${offset.x}px)`, top: `calc(18% + ${offset.y}px)` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <h3>Plate II</h3>
          <p>Drag this card across the sidebar: every edge you pass bends twice.</p>
        </Glass.Layer>
      </Glass.Stack>
      <div className="stack__controls">
        <button type="button" className="action action--primary" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close the panes' : 'Open the panes'}
        </button>
        <label className="stack__preset">
          Spring
          <select value={preset} onChange={(e) => setPreset(e.target.value as SpringPreset)}>
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <Scale label="Stagger" value={stagger} min={-0.6} max={0.6} step={0.02} onChange={setStagger} format={(v) => v.toFixed(2)} hint="Fraction of a spring period between depths. Negative leads with the deeper pane." />
      </div>
    </Plate>
  );
}
