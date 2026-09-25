import { Glass, GlassGroup } from 'meniscus';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from 'react';
import { CodeBlock, Plate } from '../shared/chrome';
import { frostReason, useEngine } from '../shared/engine';
import { GlassIcon } from '../shared/GlassIcon';
import { Icon } from '../shared/Icon';
import { Scale, Segmented } from '../shared/Scale';
import { plateSrc, useTheme } from '../shared/theme';

type Medium = 'water' | 'crown' | 'flint' | 'diamond';

const MEDIA: Array<{ value: Medium; label: string; ior: number }> = [
  { value: 'water', label: 'Water', ior: 1.33 },
  { value: 'crown', label: 'Crown', ior: 1.52 },
  { value: 'flint', label: 'Flint', ior: 1.62 },
  { value: 'diamond', label: 'Diamond', ior: 2.42 },
];

const CODE = `import { Glass, GlassGroup } from 'meniscus';

<GlassGroup spacing={36} ior={1.52}>
  <Glass radius="capsule" className="toolbar">
    <Eye /> <Bookmark /> <Share />
  </Glass>
  <Glass radius="capsule" className="drop" interactive style={{ left: x, top: y }}>
    <Search />
  </Glass>
</GlassGroup>`;

interface Point {
  x: number;
  y: number;
}

/** The stage and the capsule in the group's coordinates, and the drop's diameter. */
interface Layout {
  width: number;
  height: number;
  capsule: { x: number; y: number; w: number; h: number };
  size: number;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = matchMedia(REDUCED_MOTION);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    () => matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Distance between the drop's outline and the capsule's, px; negative where they overlap. */
function gapOf(l: Layout, p: Point): number {
  const r = l.size / 2;
  const { x, y, w, h } = l.capsule;
  const round = h / 2;
  const qx = Math.abs(p.x + r - (x + w / 2)) - w / 2 + round;
  const qy = Math.abs(p.y + r - (y + h / 2)) - h / 2 + round;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round - r;
}

function stateOf(gap: number, spacing: number): string {
  if (gap <= 0) return 'One body';
  if (gap < spacing) return 'Bridged';
  if (gap < 2 * spacing) return 'Leaning';
  return 'Apart';
}

export function PlateTension() {
  const theme = useTheme();
  const engine = useEngine();
  const reducedMotion = useReducedMotion();
  const hintId = useId();

  const group = useRef<HTMLDivElement>(null);
  const engraving = useRef<HTMLImageElement>(null);
  const capsule = useRef<HTMLDivElement>(null);
  const drop = useRef<HTMLDivElement>(null);
  const [spacing, setSpacing] = useState(36);
  const [medium, setMedium] = useState<Medium>('crown');
  const [layout, setLayout] = useState<Layout | null>(null);
  const [pos, setPos] = useState<Point | null>(null);

  const gap = layout && pos ? gapOf(layout, pos) : Infinity;
  const fused = gap < spacing;
  const ior = MEDIA.find((m) => m.value === medium)!.ior;

  // Latest values for callbacks that outlive a render (springs, timers, observers).
  const live = useRef({ pos, layout, spacing, fused });
  live.current = { pos, layout, spacing, fused };
  const flight = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const touched = useRef(false);
  const grab = useRef<{ id: number; dx: number; dy: number; x: number; y: number; moved: boolean } | null>(null);

  // At rest the drop sits just outside the bridge, close enough to lean.
  const home = (l: Layout, s: number): Point => ({
    x: Math.min(l.width - l.size - 12, l.capsule.x + l.capsule.w + Math.max(48, s * 1.3)),
    y: l.capsule.y + (l.capsule.h - l.size) / 2,
  });
  const dock = (l: Layout): Point => ({
    x: l.capsule.x + l.capsule.w - l.size * 0.22,
    y: l.capsule.y + (l.capsule.h - l.size) / 2,
  });
  const clampTo = (l: Layout, p: Point): Point => ({
    x: Math.min(Math.max(4, p.x), l.width - l.size - 4),
    y: Math.min(Math.max(4, p.y), l.height - l.size - 4),
  });

  const stopFlight = () => {
    if (flight.current !== null) cancelAnimationFrame(flight.current);
    flight.current = null;
  };
  const stopAutoplay = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  /** Carry the drop to `to` on a spring: one small overshoot, then rest. */
  const fly = useCallback(
    (to: Point) => {
      stopFlight();
      const from = live.current.pos;
      if (!from || reducedMotion) {
        setPos(to);
        return;
      }
      const p = { ...from };
      const v = { x: 0, y: 0 };
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(1 / 30, (now - last) / 1000 || 1 / 60);
        last = now;
        v.x += (-200 * (p.x - to.x) - 21 * v.x) * dt;
        v.y += (-200 * (p.y - to.y) - 21 * v.y) * dt;
        p.x += v.x * dt;
        p.y += v.y * dt;
        const done = Math.hypot(p.x - to.x, p.y - to.y) < 0.25 && Math.hypot(v.x, v.y) < 4;
        setPos(done ? to : { x: p.x, y: p.y });
        flight.current = done ? null : requestAnimationFrame(step);
      };
      flight.current = requestAnimationFrame(step);
    },
    [reducedMotion],
  );

  const toggle = useCallback(() => {
    const { layout: l, spacing: s, fused: f } = live.current;
    if (l) fly(f ? home(l, s) : dock(l));
  }, [fly]);

  // Measure the capsule and seat the drop; again whenever the stage resizes.
  useLayoutEffect(() => {
    const g = group.current;
    const c = capsule.current;
    const d = drop.current;
    if (!g || !c || !d) return;
    const measure = () => {
      const l: Layout = {
        width: g.clientWidth,
        height: g.clientHeight,
        capsule: { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight },
        size: d.offsetWidth,
      };
      const was = live.current.fused && live.current.layout !== null;
      stopFlight();
      setLayout(l);
      setPos(was ? dock(l) : home(l, live.current.spacing));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(g);
    return () => {
      ro.disconnect();
      stopFlight();
    };
  }, []);

  // The first time the plate is in view, the drop fuses with the capsule and
  // pulls away again, once. Any touch cancels it.
  useEffect(() => {
    const g = group.current;
    if (!g || reducedMotion || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || touched.current) return;
        io.disconnect();
        const l = live.current.layout;
        if (!l) return;
        timers.current.push(
          window.setTimeout(() => fly(dock(l)), 700),
          window.setTimeout(() => fly(home(l, live.current.spacing)), 700 + 1900),
        );
      },
      { threshold: 0.6 },
    );
    io.observe(g);
    return () => {
      io.disconnect();
      stopAutoplay();
    };
  }, [reducedMotion, fly]);

  const takeOver = () => {
    touched.current = true;
    stopAutoplay();
    stopFlight();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const p = live.current.pos;
    const g = group.current;
    if (!p || !g || e.button !== 0) return;
    takeOver();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = g.getBoundingClientRect();
    grab.current = { id: e.pointerId, dx: e.clientX - r.left - p.x, dy: e.clientY - r.top - p.y, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const grabbed = grab.current;
    const g = group.current;
    const l = live.current.layout;
    if (!grabbed || grabbed.id !== e.pointerId || !g || !l) return;
    if (!grabbed.moved && Math.hypot(e.clientX - grabbed.x, e.clientY - grabbed.y) < 4) return;
    grabbed.moved = true;
    const r = g.getBoundingClientRect();
    setPos(clampTo(l, { x: e.clientX - r.left - grabbed.dx, y: e.clientY - r.top - grabbed.dy }));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const grabbed = grab.current;
    if (!grabbed || grabbed.id !== e.pointerId) return;
    grab.current = null;
    // A tap, not a drag: absorb or release.
    if (!grabbed.moved) toggle();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const l = live.current.layout;
    const p = live.current.pos;
    if (!l || !p) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      takeOver();
      toggle();
      return;
    }
    const step = e.shiftKey ? 40 : 10;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = move[e.key];
    if (!m) return;
    e.preventDefault();
    takeOver();
    setPos(clampTo(l, { x: p.x + m[0], y: p.y + m[1] }));
  };

  const shown = Number.isFinite(gap) ? Math.max(0, Math.round(gap)) : null;

  return (
    <Plate folio="Plate V" id="surface-tension" className="tension" label="Surface tension">
      <div className="tension__text">
        <h2>Surface tension</h2>
        <p>
          Glass in a <code>GlassGroup</code> is one body of liquid. Bring two shapes within <code>spacing</code> of each other and a neck grows between them,
          bending light like any other rim; pull them apart and it thins, then lets go. The selections on these plates flow the same way.
        </p>
      </div>

      <div className="tension__stage">
        <img ref={engraving} className="tension__engraving" src={plateSrc('opticks-plate-2', theme)} alt="" width="1200" height="2191" />
        <GlassGroup
          ref={group}
          backdrop={engraving}
          className="tension__group"
          spacing={spacing}
          ior={ior}
          refraction={1.25}
          blur={1.2}
          saturation={1.5}
          tint="var(--glass-wash-clear)"
        >
          <Glass ref={capsule} className="tension__capsule" radius="capsule" aria-hidden="true">
            <GlassIcon name="eye" />
            <GlassIcon name="bookmark" />
            <GlassIcon name="share" />
          </Glass>
          <Glass
            ref={drop}
            className="tension__drop"
            radius="capsule"
            interactive
            role="button"
            tabIndex={0}
            aria-label="Absorb the drop into the capsule"
            aria-pressed={fused}
            aria-describedby={hintId}
            style={pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (grab.current = null)}
            onKeyDown={onKeyDown}
          >
            <GlassIcon name="search" />
          </Glass>
        </GlassGroup>
        <span id={hintId} className="visually-hidden">
          Drag the drop, or move it with the arrow keys.
        </span>
      </div>

      <p className="caption tension__caption">
        <b>Fig. 5.</b> A capsule and a drop in one group, over Fig. 12 of <i>Opticks</i>, Plate II. Drag the drop into the capsule, or tap it to absorb and
        release it.
        {engine.refracts
          ? null
          : engine.settingFrosts
            ? ` ${frostReason(engine)}, so this group is frosted.`
            : ` ${frostReason(engine)}, so this group draws itself in WebGL over the engraving it names as its backdrop.`}
      </p>

      <div className="tension__legend">
        <Scale
          label="Surface tension"
          value={spacing}
          min={0}
          max={64}
          step={2}
          onChange={setSpacing}
          unit="px"
          hint="Outlines closer than this bridge; within twice this, they lean toward each other."
        />
        <Segmented<Medium> label="Medium" value={medium} onChange={setMedium} options={MEDIA.map((m) => ({ value: m.value, label: m.label, title: `n = ${m.ior}` }))} />
        <dl className="tension__readout">
          <div>
            <dt>Gap</dt>
            <dd className="num">{shown === null ? '—' : `${shown} px`}</dd>
          </div>
          <div>
            <dt>State</dt>
            <dd data-state={stateOf(gap, spacing).toLowerCase().replace(' ', '-')}>{Number.isFinite(gap) ? stateOf(gap, spacing) : '—'}</dd>
          </div>
          <div>
            <dt>Index</dt>
            <dd className="num">{ior.toFixed(2)}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="action action--quiet"
          onClick={() => {
            takeOver();
            toggle();
          }}
        >
          <Icon name={fused ? 'minus' : 'plus'} />
          {fused ? 'Release the drop' : 'Absorb the drop'}
        </button>
        <details className="specimen__code">
          <summary>
            <Icon name="forward" className="specimen__chevron" />
            Show the code
          </summary>
          <CodeBlock code={CODE} label="Code for Fig. 5" />
        </details>
      </div>
    </Plate>
  );
}
