import { GlassPane, GlassStage, type StageStatus } from 'meniscus/webgl';
import { useRef, useState } from 'react';
import { Plate } from '../shared/chrome';
import { useDrag } from '../shared/controls';
import { useEngine } from '../shared/engine';
import { Icon } from '../shared/Icon';
import { plateSrc, useTheme } from '../shared/theme';

const ROWS = [
  {
    key: 'svg',
    name: 'SVG displacement',
    where: 'Chrome, Edge, Opera, Brave, Arc: every Chromium browser on desktop and Android.',
    what: 'Live page content: text, images, video, the rest of your interface.',
    cost: 'One filter per glass, assembled from nine small maps built once per shape.',
  },
  {
    key: 'frost',
    name: 'Frosted',
    where: 'Safari, Firefox, and every browser on iOS.',
    what: 'Nothing refracts. Blur, saturation, tint and the same rim light, from the same props.',
    cost: 'Plain CSS.',
  },
  {
    key: 'webgl',
    name: 'WebGL stage',
    where: 'Every browser with WebGL2.',
    what: 'An image, video or canvas you hand to the stage.',
    cost: 'One canvas and one draw per frame, shared by every pane on the stage.',
  },
] as const;

const PLATE_IV = { width: 1200, height: 1511 };
/** Panes closer than this fuse on the stage, px. */
const MERGE = 64;

/** Where a point of Plate IV (as fractions of the image) lands in a stage that covers with it. */
function centered(stage: DOMRect, el: HTMLElement, fx: number, fy: number) {
  const scale = Math.max(stage.width / PLATE_IV.width, stage.height / PLATE_IV.height);
  const dw = PLATE_IV.width * scale;
  const dh = PLATE_IV.height * scale;
  const inset = 8;
  return {
    x: Math.min(stage.width - el.offsetWidth - inset, Math.max(inset, (stage.width - dw) / 2 + fx * dw - el.offsetWidth / 2)),
    y: Math.min(stage.height - el.offsetHeight - inset, Math.max(inset, (stage.height - dh) / 2 + fy * dh - el.offsetHeight / 2)),
  };
}

export function PlateRenderers() {
  const engine = useEngine();
  const theme = useTheme();
  const stage = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<StageStatus>('pending');
  // Start each pane over dense linework in the engraving, located in image
  // coordinates and mapped through the stage's cover fit.
  const capsule = useDrag<HTMLDivElement>(stage, (c, el) => centered(c, el, 0.52, 0.355));
  const lens = useDrag<HTMLDivElement>(stage, (c, el) => {
    // On a tall, narrow stage the two start points crowd together; drop the
    // lens to the lower half of Fig. 20 whenever it would touch the capsule.
    const p = centered(c, el, 0.72, 0.5);
    const cap = capsule.ref.current;
    if (!cap) return p;
    const q = centered(c, cap, 0.52, 0.355);
    const gap = 16;
    const touches =
      p.x < q.x + cap.offsetWidth + gap && q.x < p.x + el.offsetWidth + gap && p.y < q.y + cap.offsetHeight + gap && q.y < p.y + el.offsetHeight + gap;
    return touches ? centered(c, el, 0.7, 0.66) : p;
  });
  const current = engine.refracts ? 'svg' : 'frost';

  return (
    <Plate folio="Plate II" id="browser-support" className="renderers" label="One API, three renderers">
      <div className="renderers__text">
        <h2>One API, three renderers</h2>
        <p>
          meniscus picks the best path each browser can draw and says which one it took: every glass carries a <code>data-meniscus</code> attribute, and{' '}
          <code>onPathChange</code> tells your code the path and why.
        </p>
      </div>

      <table className="renderers__table">
        <caption className="visually-hidden">Rendering paths by browser</caption>
        <thead>
          <tr>
            <th scope="col">Renderer</th>
            <th scope="col">Where</th>
            <th scope="col">What refracts</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key} data-current={r.key === current || undefined}>
              <th scope="row">
                {r.name}
                {r.key === current ? <span className="renderers__here">you are here</span> : null}
              </th>
              <td>{r.where}</td>
              <td>{r.what}</td>
              <td>{r.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="renderers__verdict">
        {engine.refracts
          ? `You’re reading this in ${engine.browser}, so the glass on these plates refracts the live page.`
          : `You’re reading this in ${engine.browser}, so the glass on these plates is frosted. The stage below refracts anyway, through WebGL.`}
      </p>

      <figure className="renderers__figure">
        <GlassStage
          className="renderers__stage"
          source={plateSrc('opticks-plate-4', theme)}
          alt="Newton’s Opticks, Book I, Plate IV: prisms and rays, Figs. 17 to 22."
          merge={MERGE}
          onStatus={setStatus}
        >
          <div ref={stage} className="renderers__bounds">
            <GlassPane
              ref={capsule.ref}
              className="renderers__pane renderers__pane--capsule"
              radius="capsule"
              variant="clear"
              refraction={1.1}
              tabIndex={0}
              role="button"
              aria-label="WebGL glass capsule. Drag it, or use the arrow keys."
              style={capsule.style}
              {...capsule.handlers}
            >
              <Icon name="grip" />
            </GlassPane>
            <GlassPane
              ref={lens.ref}
              className="renderers__pane renderers__pane--lens"
              radius="capsule"
              variant="clear"
              refraction={1.5}
              aberration={0.6}
              tabIndex={0}
              role="button"
              aria-label="WebGL glass lens. Drag it, or use the arrow keys."
              style={lens.style}
              {...lens.handlers}
            />
          </div>
        </GlassStage>
        <figcaption className="caption">
          <b>Fig. 2.</b> The WebGL stage refracting Plate IV of <i>Opticks</i>
          {status === 'ready' ? ` in ${engine.browser}` : status === 'fallback' ? `, frosted: ${engine.browser} has no WebGL2 here` : ''}. Drag either pane;
          the lens adds aberration, so its rim splits red from blue.
          {status === 'fallback' ? null : ` Bring them within ${MERGE} px and they flow into one body, wherever WebGL2 runs.`}
        </figcaption>
      </figure>
    </Plate>
  );
}
