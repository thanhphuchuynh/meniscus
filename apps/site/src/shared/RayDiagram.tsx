import { computeRefractionProfile, resolveProfile, sampleTable, traceRay, type OpticsInput } from 'meniscus/core';
import { useId, useMemo, type Ref } from 'react';

export interface RayDiagramProps extends OpticsInput {
  /** The probed point, px in from the outline. */
  probe: number;
  /** Rays drawn across the bezel besides the probe. */
  rays?: number;
  title?: string;
}

const W = 560;
const H = 330;
const PAGE_Y = 280;
const LEFT = 54;
const SPAN = 400;
const deg = (r: number) => (r * 180) / Math.PI;

/**
 * Section through the glass rim, drawn like a textbook figure. Every line is
 * computed by the library: the bezel is its height profile, each ray's bend
 * is Snell's law, and each landing point is the shift the renderer applies.
 */
export function RayDiagram({ probe, rays = 7, title = 'Section A–A through the rim', ref, ...optics }: RayDiagramProps & { ref?: Ref<HTMLElement> }) {
  const hatch = `hatch-${useId().replace(/:/g, '')}`;
  const arrow = `arrow-${useId().replace(/:/g, '')}`;
  const arrowSpot = `arrow-spot-${useId().replace(/:/g, '')}`;

  const geometry = useMemo(() => {
    const { bezel, thickness } = optics;
    const f = resolveProfile(optics.profile);
    const scale = Math.min(SPAN / bezel, (PAGE_Y - 70) / Math.max(thickness * 1.15, 1));
    const x = (d: number) => LEFT + d * scale;
    const y = (z: number) => PAGE_Y - z * scale;
    const profile = computeRefractionProfile(optics);
    const plateauX = x(bezel);
    const rightX = W - 18;

    let outline = `M ${x(0)} ${PAGE_Y}`;
    for (let i = 0; i <= 96; i++) {
      const t = i / 96;
      outline += ` L ${x(t * bezel).toFixed(2)} ${y(thickness * f(t)).toFixed(2)}`;
    }
    outline += ` L ${rightX} ${y(thickness * f(1)).toFixed(2)}`;
    const body = `${outline} L ${rightX} ${PAGE_Y} Z`;

    const ray = (d: number) => {
      const t = Math.min(1, Math.max(0, d / bezel));
      const trace = traceRay(optics, d);
      const applied = sampleTable(profile.displacement, t);
      const entry = { x: x(d), y: y(trace.height) };
      const land = { x: x(d + applied), y: PAGE_Y };
      return { d, t, trace, applied, entry, land };
    };

    const fan = Array.from({ length: rays }, (_, i) => ray(((i + 0.5) / rays) * bezel * 0.96));
    return { x, y, outline, body, plateauX, fan, ray };
  }, [optics.bezel, optics.thickness, optics.ior, optics.profile, optics.caustics, rays]);

  // The probe can move every frame; only its own ray is traced again.
  const p = geometry.ray(Math.min(optics.bezel * 0.999, Math.max(0.2, probe)));
  const n = { x: -Math.sin(p.trace.incidence), y: -Math.cos(p.trace.incidence) }; // outward normal, screen space
  const normalLen = 58;
  const arcR = 34;
  const up = -Math.PI / 2; // direction back toward the eye
  const outwardAngle = Math.atan2(n.y, n.x);
  const inwardAngle = outwardAngle + Math.PI;
  const refrAngle = Math.atan2(p.land.y - p.entry.y, p.land.x - p.entry.x);
  const arc = (from: number, to: number, r: number) => {
    const a = { x: p.entry.x + Math.cos(from) * r, y: p.entry.y + Math.sin(from) * r };
    const b = { x: p.entry.x + Math.cos(to) * r, y: p.entry.y + Math.sin(to) * r };
    const sweep = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI > 0 ? 1 : 0;
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 ${sweep} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
  };
  const labelAt = (from: number, to: number, r: number) => {
    const mid = from + (((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / 2;
    return { x: p.entry.x + Math.cos(mid) * r, y: p.entry.y + Math.sin(mid) * r };
  };
  const l1 = labelAt(up, outwardAngle, arcR + 15);
  const l2 = labelAt(inwardAngle, refrAngle, arcR + 17);
  const limited = Math.abs(p.applied - p.trace.shift) > 0.5;
  const hasBend = p.trace.incidence > 0.02;

  return (
    <figure className="ray-diagram" ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${hatch}-title`}>
        <title id={`${hatch}-title`}>
          {`${title}: a ray entering ${p.d.toFixed(1)} px from the outline meets the surface at ${deg(p.trace.incidence).toFixed(1)} degrees, refracts to ${deg(p.trace.refraction).toFixed(1)} degrees, and lands ${p.applied.toFixed(1)} px inward.`}
        </title>
        <defs>
          <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--glass-edge)" strokeWidth="1" opacity="0.55" />
          </pattern>
          <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 1.5 L9 5 L0 8.5" fill="none" stroke="var(--ink)" strokeWidth="1.2" />
          </marker>
          <marker id={arrowSpot} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M0 1.5 L9 5 L0 8.5" fill="none" stroke="var(--spot)" strokeWidth="1.4" />
          </marker>
        </defs>

        {/* Glass body in section */}
        <path d={geometry.body} fill="var(--glass-fill)" />
        <path d={geometry.body} fill={`url(#${hatch})`} />
        <path d={geometry.outline} fill="none" stroke="var(--ink)" strokeWidth="1" />

        {/* The page */}
        <line x1="14" y1={PAGE_Y} x2={W - 14} y2={PAGE_Y} stroke="var(--ink)" strokeWidth="1" />
        {Array.from({ length: 34 }, (_, i) => (
          <line key={i} x1={14 + i * 16} y1={PAGE_Y + 1} x2={4 + i * 16} y2={PAGE_Y + 11} stroke="var(--ink-faint)" strokeWidth="1" />
        ))}

        {/* The fan of rays */}
        {geometry.fan.map((r, i) => (
          <g key={i} opacity="0.55">
            <line x1={r.entry.x} y1="16" x2={r.entry.x} y2={r.entry.y} stroke="var(--ink)" strokeWidth="1" />
            <line x1={r.entry.x} y1={r.entry.y} x2={r.land.x} y2={r.land.y} stroke="var(--ink)" strokeWidth="1" markerEnd={`url(#${arrow})`} />
          </g>
        ))}

        {/* The probed ray, in spot ink */}
        <line x1={p.entry.x} y1="16" x2={p.entry.x} y2={p.entry.y} stroke="var(--spot)" strokeWidth="1.5" markerEnd={`url(#${arrowSpot})`} />
        <line x1={p.entry.x} y1={p.entry.y} x2={p.land.x} y2={p.land.y} stroke="var(--spot)" strokeWidth="1.5" markerEnd={`url(#${arrowSpot})`} />

        {hasBend ? (
          <>
            {/* Surface normal */}
            <line
              x1={p.entry.x - n.x * normalLen}
              y1={p.entry.y - n.y * normalLen}
              x2={p.entry.x + n.x * normalLen}
              y2={p.entry.y + n.y * normalLen}
              stroke="var(--ink)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <path d={arc(up, outwardAngle, arcR)} fill="none" stroke="var(--ink)" strokeWidth="1" />
            <path d={arc(inwardAngle, refrAngle, arcR + 4)} fill="none" stroke="var(--spot)" strokeWidth="1" />
            <text x={l1.x} y={l1.y} className="rd-var" textAnchor="middle" dominantBaseline="middle">
              θ<tspan baselineShift="sub" fontSize="0.7em">1</tspan>
            </text>
            <text x={l2.x} y={l2.y} className="rd-var rd-var--spot" textAnchor="middle" dominantBaseline="middle">
              θ<tspan baselineShift="sub" fontSize="0.7em">2</tspan>
            </text>
          </>
        ) : null}

        {/* Shift, dimensioned on the page */}
        {p.applied > 1.5 ? (
          <g>
            <line x1={p.entry.x} y1={PAGE_Y + 20} x2={p.land.x} y2={PAGE_Y + 20} stroke="var(--spot)" strokeWidth="1" markerStart={`url(#${arrowSpot})`} markerEnd={`url(#${arrowSpot})`} />
            <line x1={p.entry.x} y1={PAGE_Y + 13} x2={p.entry.x} y2={PAGE_Y + 27} stroke="var(--spot)" strokeWidth="1" />
            <line x1={p.land.x} y1={PAGE_Y + 13} x2={p.land.x} y2={PAGE_Y + 27} stroke="var(--spot)" strokeWidth="1" />
          </g>
        ) : null}

        {/* Lettering */}
        <text x={geometry.x(0) - 6} y={PAGE_Y - 8} className="rd-letter" textAnchor="end">A</text>
        <text x={geometry.plateauX + 4} y={geometry.y(optics.thickness) - 10} className="rd-letter">B</text>
        <text x={p.entry.x + 7} y={p.entry.y - 7} className="rd-letter rd-letter--spot">P</text>
        <text x={p.land.x + 6} y={PAGE_Y - 7} className="rd-letter rd-letter--spot">Q</text>
        <text x={W - 26} y={PAGE_Y - 16} className="rd-note" textAnchor="end">
          glass, <tspan className="rd-var">n</tspan> = {optics.ior.toFixed(2)}
        </text>
        <text x={W - 26} y="34" className="rd-note" textAnchor="end">
          air, <tspan className="rd-var">n</tspan> = 1.00
        </text>
        <text x="16" y={PAGE_Y + 44} className="rd-note">
          the page
        </text>
        <text x={W - 16} y={PAGE_Y + 44} className="rd-section" textAnchor="end">
          Section A–A
        </text>
      </svg>

      <dl className="rd-readout">
        <div>
          <dt>
            <span className="var">θ</span>
            <sub>1</sub> incidence
          </dt>
          <dd className="num">{deg(p.trace.incidence).toFixed(1)}°</dd>
        </div>
        <div>
          <dt>
            <span className="var">θ</span>
            <sub>2</sub> refraction
          </dt>
          <dd className="num">{deg(p.trace.refraction).toFixed(1)}°</dd>
        </div>
        <div>
          <dt>height at P</dt>
          <dd className="num">{p.trace.height.toFixed(1)} px</dd>
        </div>
        <div>
          <dt>shift PQ</dt>
          <dd className="num rd-spot">
            {p.applied.toFixed(1)} px{limited ? '*' : ''}
          </dd>
        </div>
      </dl>
      {limited ? <p className="rd-footnote">* Held one-to-one at the rim. Raw optics would fold the image here; set <code>caustics</code> to allow it.</p> : null}
    </figure>
  );
}
