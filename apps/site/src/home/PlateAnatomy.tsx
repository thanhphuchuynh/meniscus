import { Glass } from 'meniscus';
import { useState } from 'react';
import { Plate } from '../shared/chrome';
import { SunDial, Switch } from '../shared/controls';
import { plateSrc, useTheme } from '../shared/theme';

type Layer = 'refraction' | 'frost' | 'tint' | 'rim' | 'highlight' | 'aberration';

const LAYERS: Array<{ key: Layer; letter: string; name: string; body: string; prop: string }> = [
  { key: 'refraction', letter: 'A', name: 'Refraction', prop: 'refraction', body: 'The bezel bends rays inward by Snell’s law, so the page compresses into the rim.' },
  { key: 'frost', letter: 'B', name: 'Frost', prop: 'blur', body: 'A backdrop blur, in px. Regular glass frosts for legibility; clear glass barely does.' },
  { key: 'tint', letter: 'C', name: 'Tint', prop: 'tint', body: 'A color laid over the refracted page. Any CSS color, custom properties included.' },
  { key: 'rim', letter: 'D', name: 'Rim', prop: 'rim', body: 'A grazing-angle line along the outline, where the surface turns edge-on.' },
  { key: 'highlight', letter: 'E', name: 'Highlight', prop: 'specular', body: 'The sun reflected off the bezel, with its bounce off the far wall.' },
  { key: 'aberration', letter: 'F', name: 'Aberration', prop: 'aberration', body: 'Red travels a little further than blue. Off by default: it costs two extra passes.' },
];

/** Label position and the feature it points at, in % of the stage. The glass spans 12–86% across and 18–76% down. */
const LEADERS: Array<{ key: Layer; letter: string; from: [number, number]; to: [number, number] }> = [
  { key: 'highlight', letter: 'E', from: [5, 7], to: [15.5, 21.5] },
  { key: 'refraction', letter: 'A', from: [4.5, 47], to: [13.5, 47] },
  { key: 'frost', letter: 'B', from: [42, 7], to: [42, 34] },
  { key: 'tint', letter: 'C', from: [64, 93], to: [64, 64] },
  { key: 'rim', letter: 'D', from: [30, 93], to: [30, 75.6] },
  { key: 'aberration', letter: 'F', from: [95.5, 40], to: [85.6, 40] },
];

export function PlateAnatomy({ sun, onSun }: { sun: number; onSun: (deg: number) => void }) {
  const theme = useTheme();
  const [on, setOn] = useState<Record<Layer, boolean>>({ refraction: true, frost: true, tint: true, rim: true, highlight: true, aberration: false });

  return (
    <Plate folio="Plate III" id="anatomy" className="anatomy" label="Anatomy of a glass">
      <div className="anatomy__text">
        <h2>Anatomy of a glass</h2>
        <p>
          Six layers make the surface, and each is one prop. Switch them off to see what each contributes; the specimen redraws as you go. The sun on the
          ring lights every glass on this page, the masthead included.
        </p>
      </div>

      <div className="anatomy__stage">
        <img className="anatomy__engraving" src={plateSrc('opticks-plate-4', theme)} alt="" width="1200" height="1511" />
        <Glass
          className="anatomy__glass"
          radius={46}
          bezel={40}
          refraction={on.refraction ? 1.3 : 0}
          blur={on.frost ? 1.6 : 0}
          saturation={1.5}
          tint={on.tint ? 'var(--glass-wash-clear)' : 'transparent'}
          rim={on.rim ? 0.7 : 0}
          specular={on.highlight ? 0.85 : 0}
          aberration={on.aberration ? 0.8 : 0}
        />
        {/* Lettered leaders, drawn like the engraving's own callouts. */}
        <svg className="anatomy__leaders" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {LEADERS.map((l) => (
            <g key={l.letter} data-on={on[l.key]}>
              <line x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]} />
              <circle cx={l.to[0]} cy={l.to[1]} r="0.55" />
            </g>
          ))}
        </svg>
        {LEADERS.map((l) => (
          <span key={l.letter} className="anatomy__marker" data-on={on[l.key]} style={{ left: `${l.from[0]}%`, top: `${l.from[1]}%` }} aria-hidden="true">
            {l.letter}
          </span>
        ))}
      </div>

      <ol className="anatomy__legend">
        {LAYERS.map((l) => (
          <li key={l.key} data-on={on[l.key]}>
            <Switch checked={on[l.key]} onChange={(v) => setOn((s) => ({ ...s, [l.key]: v }))} label={`${l.name} layer`}>
              <span className="anatomy__letter">{l.letter}</span>
              <span className="anatomy__name">{l.name}</span>
              <code>{l.prop}</code>
            </Switch>
            <p>{l.body}</p>
            {l.key === 'highlight' ? (
              <div className="anatomy__sun">
                <SunDial angle={sun} onChange={onSun} />
                <p className="caption">
                  One sun, from <span className="num">{((sun % 360) + 360) % 360}°</span>. Drag it around the ring.
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="caption anatomy__caption">
        <b>Fig. 3.</b> One glass over Plate IV of <i>Opticks</i>, lettered by layer. Every letter above is a prop on the same component.
      </p>
    </Plate>
  );
}
