import { Glass } from 'meniscus';
import { glassProfile, resolveGlass, roundedRectSdf, type GlassOptions } from 'meniscus/core';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Install, Plate } from '../shared/chrome';
import { useEngine } from '../shared/engine';
import { Icon } from '../shared/Icon';
import { RayDiagram } from '../shared/RayDiagram';
import { plateSrc, useTheme } from '../shared/theme';

const LENS: GlassOptions = { radius: 'capsule', variant: 'clear', refraction: 1, ior: 1.5, bezel: 999 };

interface Point {
  x: number;
  y: number;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const on = () => setReduced(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function PlateSpecimen() {
  const engine = useEngine();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const field = useRef<HTMLDivElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);
  const lens = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const [pos, setPos] = useState<Point | null>(null);
  const [size, setSize] = useState({ w: 360, h: 120 });
  const [probe, setProbe] = useState<number | null>(null);
  const [sweep, setSweep] = useState(0.22);
  const idleUntil = useRef(0);

  // Track the lens size: the section figure is drawn from the same optics.
  useEffect(() => {
    const el = lens.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Start the lens over the headline's last line so the bend is the first thing
  // seen. On narrow screens it would cover most of the headline, so it starts
  // over the engraving's eye instead.
  useEffect(() => {
    const place = () => {
      const f = field.current;
      const h = headline.current;
      const l = lens.current;
      if (!f || !h || !l) return;
      const fr = f.getBoundingClientRect();
      if (fr.width < 640) {
        const img = f.querySelector('.plate-one__engraving img');
        const ir = img?.getBoundingClientRect();
        if (ir) {
          setPos({ x: (fr.width - l.offsetWidth) / 2, y: ir.top - fr.top + ir.height * 0.16 - l.offsetHeight / 2 });
          return;
        }
      }
      // Measure the word "page." itself: the headline block is as wide as its
      // longest line, so its box would leave most of the lens over blank stock.
      const range = document.createRange();
      const text = [...h.childNodes].find((n): n is Text => n.nodeType === Node.TEXT_NODE && n.textContent!.includes('page.'));
      let target = h.getBoundingClientRect();
      if (text) {
        const at = text.textContent!.lastIndexOf('page.');
        range.setStart(text, at);
        range.setEnd(text, at + 'page.'.length);
        target = range.getBoundingClientRect();
      }
      const x = Math.min(fr.width - l.offsetWidth - 8, Math.max(8, target.left + target.width / 2 - fr.left - l.offsetWidth / 2));
      // Center the lens on the word, so the whole word bends and the lede below stays readable.
      const y = Math.max(8, target.top - fr.top + target.height / 2 - l.offsetHeight / 2);
      setPos({ x, y });
    };
    place();
    document.fonts?.ready.then(place);
  }, []);

  const clamp = useCallback((p: Point): Point => {
    const f = field.current;
    const l = lens.current;
    if (!f || !l) return p;
    return {
      x: Math.min(Math.max(-l.offsetWidth * 0.25, p.x), f.clientWidth - l.offsetWidth * 0.75),
      y: Math.min(Math.max(-l.offsetHeight * 0.25, p.y), f.clientHeight - l.offsetHeight * 0.75),
    };
  }, []);

  const g = resolveGlass(LENS, size.w, size.h);
  const profile = glassProfile(g);
  const optics = { bezel: g.bezel, thickness: g.thickness, ior: g.ior, profile: g.profile, caustics: g.caustics };

  const probeFrom = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = roundedRectSdf(((e.clientX - r.left) / r.width) * size.w, ((e.clientY - r.top) / r.height) * size.h, size.w, size.h, g.radius);
    setProbe(Math.min(g.bezel, Math.max(0.3, -s.distance)));
    idleUntil.current = performance.now() + 3500;
  };

  // With nobody probing, the figure sweeps its ray slowly across the rim.
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now < idleUntil.current) return;
      const phase = ((now - start) / 9000) * Math.PI * 2;
      setSweep(0.2 + 0.36 * (0.5 - 0.5 * Math.cos(phase)));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const fr = field.current!.getBoundingClientRect();
    drag.current = { id: e.pointerId, dx: e.clientX - fr.left - pos.x, dy: e.clientY - fr.top - pos.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    probeFrom(e);
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const fr = field.current!.getBoundingClientRect();
    setPos(clamp({ x: e.clientX - fr.left - d.dx, y: e.clientY - fr.top - d.dy }));
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 40 : 10;
    const delta: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const m = delta[e.key];
    if (!m || !pos) return;
    e.preventDefault();
    setPos(clamp({ x: pos.x + m.x, y: pos.y + m.y }));
  };

  const shown = probe ?? sweep * g.bezel;

  return (
    <Plate folio="Plate I" className="plate-one" label="Glass that bends the page">
      <div className="plate-one__field" ref={field}>
        <h1 ref={headline}>Glass that bends the page.</h1>
        <p className="plate-one__lede">
          meniscus is liquid glass for React. Each edge refracts what lies behind it the way real glass does: traced through a curved bezel with Snell’s law,
          then lit by a single sun.
        </p>
        <div className="plate-one__actions">
          <Install />
          <div className="actions-row">
            <a className="action action--primary" href="/playground/">
              Open the playground
              <Icon name="arrow" />
            </a>
            <a className="action action--quiet" href="/docs/">
              Read the manual
            </a>
          </div>
        </div>
        <blockquote className="plate-one__quote">
          <p>
            “My Design in this Book is not to explain the Properties of Light by Hypotheses, but to propose and prove them by Reason and Experiments.”
          </p>
          <footer>
            Isaac Newton, <cite>Opticks</cite>, 1704
          </footer>
        </blockquote>
        <figure className="plate-one__engraving">
          <img
            src={plateSrc('opticks-plate-2', theme)}
            alt="Newton’s Opticks, Book I, Plate II: rays through the eye’s lens, a prism, and a lens casting candlelight on a grid."
            width="1200"
            height="2191"
          />
        </figure>

        <Glass
          as="button"
          type="button"
          ref={lens}
          {...LENS}
          interactive
          className="plate-one__lens"
          style={pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden' }}
          aria-label="Glass specimen. Drag it, or use the arrow keys, to move it across the page."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => {
            setProbe(null);
            idleUntil.current = performance.now() + 1200;
          }}
          onKeyDown={onKeyDown}
        >
          <Icon name="grip" className="plate-one__grip" />
        </Glass>
      </div>

      <div className="plate-one__figure">
        <RayDiagram {...optics} probe={shown} />
        <p className="caption">
          <b>Fig. 1.</b> A meniscus bends the page. Drag the glass across the specimen; the section follows your pointer. Rim {g.bezel.toFixed(0)} px wide,{' '}
          {g.thickness.toFixed(0)} px thick, <span className="var">n</span> = {g.ior.toFixed(2)}; the largest shift is{' '}
          <span className="num">{profile.maxDisplacement.toFixed(1)}</span> px.
        </p>
        {!engine.refracts ? (
          <p className="caption plate-one__notice">
            {engine.browser} can’t refract live page content yet, so this plate shows the frosted path. Plate III refracts in every browser with WebGL.
          </p>
        ) : null}
      </div>

    </Plate>
  );
}
