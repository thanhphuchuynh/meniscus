import { GlassPane, GlassStage, type StageStatus } from 'meniscus/webgl';
import { useState } from 'react';
import { Plate } from '../shared/chrome';
import { Scale } from '../shared/Scale';
import { plateSrc, useTheme } from '../shared/theme';
import { useReducedMotion } from '../shared/useReducedMotion';

export function PlateDepth() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [depth, setDepth] = useState(22);
  const [status, setStatus] = useState<StageStatus>('pending');
  const move = (x: number, y: number) => setTilt({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  return (
    <Plate folio="Experiment" id="depth" className="depth" label="Through three surfaces">
      <div className="interfaces__text">
        <h2>Through three surfaces.</h2>
        <p>Move across the plate to separate three curved panes. Each bends the image, glass and soft shadows beneath it. Different indices, one beam of light.</p>
      </div>
      <GlassStage source={plateSrc('opticks-plate-4', theme)} layered maxPixelRatio={1.5} onStatus={setStatus}
        className="depth__stage" tabIndex={0} role="group" aria-label="Layered glass experiment" aria-describedby="depth-help"
        onPointerMove={(e) => {
          if (reduced) return;
          const r = e.currentTarget.getBoundingClientRect();
          move((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1);
        }}
        onPointerLeave={() => move(0, 0)} onBlur={() => move(0, 0)}
        onKeyDown={(e) => {
          const deltas: Record<string, [number, number]> = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.2], ArrowDown: [0, 0.2] };
          const d = deltas[e.key];
          if (d) { e.preventDefault(); move(tilt.x + d[0], tilt.y + d[1]); }
          if (e.key === 'Home') { e.preventDefault(); move(0, 0); }
        }}>
        {[1.33, 1.52, 1.62].map((ior, index) => (
          <GlassPane key={ior} className="depth__pane" radius={32} bezel={30} ior={ior} refraction={1.2}
            aberration={0.1} blur={0.5} variant="clear" lightAngle={-40 + tilt.x * 18}
            style={{ left: `${15 + index * 15}%`, top: `${16 + index * 13}%`,
              transform: `translate(${tilt.x * depth * (index + 1)}px, ${tilt.y * depth * (index + 1)}px)` }} />
        ))}
      </GlassStage>
      <div className="depth__legend">
        <p id="depth-help" className="caption">Move your pointer or focus the plate and use arrow keys. Home resets the view. Back to front: <span className="num">n = 1.33 / 1.52 / 1.62</span>. {reduced ? 'Automatic parallax is off for reduced motion; arrow keys still position the layers.' : ''}</p>
        <Scale label="Layer separation" value={depth} min={0} max={32} step={1} onChange={setDepth} unit="px" />
      </div>
      {status === 'fallback' ? <p className="caption" role="status">WebGL is unavailable here. These panes use frosted glass; stacked refraction and refracted shadows need WebGL.</p> : null}
    </Plate>
  );
}
