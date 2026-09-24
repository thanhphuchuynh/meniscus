import { Glass } from 'meniscus';
import { glassProfile, resolveGlass, roundedRectSdf, type GlassOptions } from 'meniscus/core';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useLensMotion } from './useLensMotion';
import { useGlassSound } from './useGlassSound';
import { useReducedMotion } from '../shared/useReducedMotion';
import { Scale } from '../shared/Scale';
import { Install, Plate } from '../shared/chrome';
import { useEngine } from '../shared/engine';
import { Icon } from '../shared/Icon';
import { sitePath } from '../shared/paths';
import { RayDiagram } from '../shared/RayDiagram';
import { plateSrc, useTheme } from '../shared/theme';

// A round magnifier: the bezel runs to the middle, so the whole lens is a dome.
const LENS: GlassOptions = { radius: 'capsule', variant: 'clear', refraction: 1, ior: 1.5, bezel: 999 };

export function PlateSpecimen() {
  const engine = useEngine();
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const plate = useRef<HTMLElement>(null);
  const engraving = useRef<HTMLImageElement>(null);
  const lens = useRef<HTMLButtonElement>(null);
  const sound = useGlassSound();
  const { pos, handlers } = useLensMotion(plate, lens, reducedMotion, sound.play);
  const [ior, setIor] = useState(1.5);
  const lightAngle = pos ? Math.atan2(-120 - pos.x, pos.y + 180) * 180 / Math.PI : -45;
  const lensOptions = { ...LENS, ior, aberration: 0.12, lightAngle };
  const [size, setSize] = useState({ w: 220, h: 220 });
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

  const g = resolveGlass(lensOptions, size.w, size.h);
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

  const shown = probe ?? sweep * g.bezel;

  return (
    <Plate folio="Plate I" className="plate-one" label="Glass that bends the page">
      <div className="plate-one__field">
        <h1>Glass that bends the page.</h1>
        <p className="plate-one__lede">
          meniscus is liquid glass for React. Each edge refracts what lies behind it the way real glass does: traced through a curved bezel with Snell’s law,
          then lit by a single sun.
        </p>
        <div className="plate-one__actions">
          <Install />
          <div className="actions-row">
            <a className="action action--primary" href={sitePath('/playground/')}>
              Open the playground
              <Icon name="arrow" />
            </a>
            <a className="action action--quiet" href={sitePath('/docs/')}>
              Read the manual
            </a>
            <a className="action action--quiet" href="https://github.com/thanhphuchuynh/meniscus">
              View on GitHub
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
        <figure className="plate-one__engraving" ref={plate}>
          <img
            ref={engraving}
            src={plateSrc('opticks-plate-2', theme)}
            alt="Newton’s Opticks, Book I, Plate II: rays through the eye’s lens, a prism, and a lens casting candlelight on a grid."
            width="1200"
            height="2191"
          />
          <Glass
            as="button"
            type="button"
            ref={lens}
            {...lensOptions}
            interactive
            ripple
            // Where live refraction isn't available, the lens refracts the engraving in WebGL.
            backdrop={engraving}
            className="plate-one__lens"
            style={pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden' }}
            aria-label="Glass lens. Drag it, or use the arrow keys, to move it across the engraving."
            {...handlers}
            onPointerMove={(e) => { probeFrom(e); handlers.onPointerMove(e); }}
            onPointerLeave={() => {
              setProbe(null);
              idleUntil.current = performance.now() + 1200;
            }}
          >
            <Icon name="grip" className="plate-one__grip" />
          </Glass>
        </figure>
      </div>

      <div className="plate-one__figure">
        <RayDiagram {...optics} probe={shown} />
        <Scale label="Refractive index n" value={ior} min={1} max={2.42} step={0.01} onChange={setIor} format={(n) => n.toFixed(2)} hint="1.00 air · 1.33 water · 1.50 glass · 2.42 diamond" />
        <button type="button" className="action action--quiet" aria-pressed={sound.enabled} disabled={sound.unavailable} onClick={() => void sound.toggle()}>
          {sound.unavailable ? 'Sound unavailable' : `Glass sound: ${sound.enabled ? 'on' : 'off'}`}
        </button>
        <p className="caption">
          <b>Fig. 1.</b> A meniscus bends the page. Flick the lens and it wobbles as it lands; tap it and ripples run across the glass, bending the engraving’s lines. Change the index to bend them further; the section follows your pointer. Rim {g.bezel.toFixed(0)} px wide,{' '}
          {g.thickness.toFixed(0)} px thick, <span className="var">n</span> = {g.ior.toFixed(2)}; the largest shift is{' '}
          <span className="num">{profile.maxDisplacement.toFixed(1)}</span> px.
        </p>
        {!engine.refracts ? (
          <p className="caption plate-one__notice">
            {engine.browser} can’t refract live page content yet, so this lens refracts its supplied engraving with WebGL when available, and otherwise uses frosted glass.
          </p>
        ) : null}
      </div>

    </Plate>
  );
}
