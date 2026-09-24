import { Glass, GlassIndicator, GlassProvider } from 'meniscus';
import { glassProfile, resolveGlass } from 'meniscus/core';
import { useEffect, useState, type ReactNode } from 'react';
import { CodeBlock, Colophon, Install, Masthead } from '../shared/chrome';
import { useEngine } from '../shared/engine';
import { RayDiagram } from '../shared/RayDiagram';
import { Scale } from '../shared/Scale';
import { plateSrc, useTheme } from '../shared/theme';
import { CODE, GLASS_PROPS, GROUP_PROPS, INDICATOR_PROPS, STAGE_PROPS, type PropRow } from './content';

const SECTIONS = [
  ['install', 'Installation'],
  ['glass', 'The Glass component'],
  ['props', 'Props'],
  ['optics', 'How the refraction works'],
  ['paths', 'Rendering paths'],
  ['provider', 'Defaults and one sun'],
  ['stage', 'The WebGL stage'],
  ['interaction', 'Interaction'],
  ['indicator', 'Selections that flow'],
  ['group', 'Surface tension'],
  ['a11y', 'Accessibility'],
  ['performance', 'Performance'],
  ['core', 'meniscus/core'],
  ['support', 'Browser support'],
  ['limits', 'Limits'],
] as const;

type SectionId = (typeof SECTIONS)[number][0];

function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>('install');
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

function Section({ id, n, title, children }: { id: SectionId; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="manual__section" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>
        <span className="manual__sect" aria-hidden="true">
          §{n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PropsTable({ rows, caption }: { rows: PropRow[]; caption: string }) {
  return (
    <div className="manual__table-wrap">
      <table className="manual__table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Prop</th>
            <th scope="col">Type</th>
            <th scope="col">Default</th>
            <th scope="col">What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">
                <code>{r.name}</code>
              </th>
              <td>
                <code className="manual__type">{r.type}</code>
              </td>
              <td className="manual__default">{r.default}</td>
              <td>{r.body}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Docs() {
  const active = useActiveSection();
  const engine = useEngine();
  const theme = useTheme();
  const g = resolveGlass({ radius: 'capsule' }, 320, 64);
  const [probe, setProbe] = useState(0.22);
  // Remounting the demo button replays its entrance.
  const [summons, setSummons] = useState(0);
  const [tab, setTab] = useState(0);
  const [tabEl, setTabEl] = useState<HTMLElement | null>(null);

  return (
    <GlassProvider>
      <Masthead page="docs" />
      <div className="manual">
        <nav className="manual__toc" aria-label="Manual contents">
          <p className="manual__toc-title">Contents</p>
          <ol>
            {SECTIONS.map(([id, label], i) => (
              <li key={id}>
                <a href={`#${id}`} aria-current={active === id ? 'location' : undefined}>
                  <span className="num">{i + 1}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main id="main" className="manual__body">
          <header className="manual__head">
            <h1>The manual</h1>
            <p>
              Everything <code>meniscus</code> exports, how its optics work, and what each browser draws. Sections are numbered; figures are live.
            </p>
          </header>

          <Section id="install" n={1} title="Installation">
            <Install />
            <p>
              meniscus needs React 18 or newer and ships as ES modules with type definitions. There is no stylesheet to import: every style is inline, so it
              works under server rendering and in any CSS setup.
            </p>
            <CodeBlock code={CODE.quick} label="Quick start" />
          </Section>

          <Section id="glass" n={2} title="The Glass component">
            <p>
              <code>Glass</code> renders one element with the glass behind its children. Give it the element you need with <code>as</code>; every prop that
              element accepts passes through, and refs reach the real DOM node.
            </p>
            <CodeBlock code={CODE.as} label="Rendering other elements" />
            <p>
              Its size comes from your layout. The refraction maps are built per corner shape, not per size, so a glass can resize or animate its width
              without rebuilding anything.
            </p>
            <h3 id="components">Ready-to-use components</h3>
            <p>
              <code>GlassButton</code> is a native button with an interactive lens and a safe <code>type="button"</code> default. <code>GlassPanel</code> is a
              padded glass container. <code>GlassTabs</code> provides the tab list, panels, keyboard navigation, and a flowing indicator together.
              <code>GlassTextField</code>, <code>GlassSelect</code>, and <code>GlassCheckbox</code> wrap native form controls in glass while retaining their
              labels, input props, refs, and form behavior. <code>GlassLoader</code> is a loading indicator of three glass drops that fuse and part,
              inline or as a whole loading page with <code>page</code>; <code>GlassGlyph</code> turns an icon or shape inside glass into glass. They all ship
              from <code>meniscus</code> and need no stylesheet. See their{' '}
              <a href="/components/">live examples</a>.
            </p>
            <CodeBlock code={`import { GlassButton, GlassPanel, GlassTabs } from 'meniscus';

<GlassButton onClick={save}>Save</GlassButton>
<GlassPanel role="region" aria-label="Summary">Ready</GlassPanel>
<GlassTabs label="Views" items={[
  { value: 'all', label: 'All', content: <AllItems /> },
  { value: 'saved', label: 'Saved', content: <SavedItems /> },
]} />`} label="Ready-to-use components" />
          </Section>

          <Section id="props" n={3} title="Props">
            <p>Where regular and clear differ, the default reads regular / clear.</p>
            <PropsTable rows={GLASS_PROPS} caption="Glass props" />
          </Section>

          <Section id="optics" n={4} title="How the refraction works">
            <p>
              A glass has a flat top and a curved rim. meniscus describes the rim by its <em>profile</em>: height as a function of depth into the bezel. For
              each point on the rim it traces one ray from the eye, straight down.
            </p>
            <ol className="manual__steps">
              <li>
                The profile’s slope gives the surface tilt, which is the angle of incidence <span className="var">θ</span>
                <sub>1</sub>.
              </li>
              <li>
                Snell’s law gives the angle inside the glass: sin <span className="var">θ</span>
                <sub>1</sub> = <span className="var">n</span> sin <span className="var">θ</span>
                <sub>2</sub>.
              </li>
              <li>
                The ray leans <span className="var">θ</span>
                <sub>1</sub> − <span className="var">θ</span>
                <sub>2</sub> off vertical and crosses the glass’s local height <span className="var">z</span> before reaching the page, so it lands{' '}
                <span className="var">z</span> tan(<span className="var">θ</span>
                <sub>1</sub> − <span className="var">θ</span>
                <sub>2</sub>) inward. That shift is what the renderers apply.
              </li>
            </ol>
            <figure className="manual__figure">
              <RayDiagram bezel={g.bezel} thickness={g.thickness} ior={g.ior} profile={g.profile} probe={probe * g.bezel} />
              <div className="manual__probe">
                <Scale label="Probe depth" value={probe} min={0.02} max={0.98} step={0.01} onChange={setProbe} format={(v) => (v * g.bezel).toFixed(1)} unit="px" />
              </div>
              <figcaption className="caption">
                <b>Fig. 1.</b> The default capsule, 64 px tall: a {g.bezel} px rim, <span className="var">n</span> = 1.50, largest shift{' '}
                <span className="num">{glassProfile(g).maxDisplacement.toFixed(1)}</span> px. Move the probe to trace another ray.
              </figcaption>
            </figure>
            <p>
              A steep rim can shift neighboring points past each other, so one line in the page would appear twice near the outline. Real thick glass does
              this. By default meniscus limits the shift so the page compresses into the rim instead; set <code>caustics</code> to allow the fold.
            </p>
            <p>
              In the browser, the shifts become an SVG <code>feDisplacementMap</code> inside <code>backdrop-filter</code>. Refraction only varies inside the
              bezel, so the map is nine small tiles (four corners, four one-pixel edge strips, and a neutral plateau) that the filter places and stretches.
              Custom profiles are functions:
            </p>
            <CodeBlock code={CODE.profile} label="A custom profile" />
          </Section>

          <Section id="paths" n={5} title="Rendering paths">
            <p>
              Every glass picks the best path its browser can draw and reports it on the element as <code>data-meniscus</code>.
            </p>
            <dl className="manual__paths">
              <div>
                <dt>refract</dt>
                <dd>SVG displacement inside backdrop-filter, bending live page content. Chromium browsers.</dd>
              </div>
              <div>
                <dt>frost</dt>
                <dd>Blur, saturation, tint and the same rim light, with no refraction. Safari, Firefox, and every browser on iOS.</dd>
              </div>
              <div>
                <dt>webgl</dt>
                <dd>
                  Where live refraction is missing, a glass or group whose <code>backdrop</code> is an image, video or canvas draws itself in WebGL over
                  it. Safari and Firefox.
                </dd>
              </div>
              <div>
                <dt>element</dt>
                <dd>
                  Experimental. In Firefox, a glass whose <code>backdrop</code> is any other element refracts a live copy of it, painted with{' '}
                  <code>-moz-element()</code>, through a plain CSS filter.
                </dd>
              </div>
              <div>
                <dt>none</dt>
                <dd>Shape, shadow and interaction only, for glass another renderer draws. The WebGL stage uses it.</dd>
              </div>
            </dl>
            <p>
              The server and the first client render are always frosted, so markup hydrates without a mismatch; refraction switches on right after. You are
              reading this in {engine.browser}, which {engine.refracts ? 'refracts' : 'frosts'}.
            </p>
            <CodeBlock code={CODE.mode} label="Reading and forcing the path" />
            <p>
              Name what lies behind a glass with <code>backdrop</code> and browsers that can’t refract the live page still bend it. Chromium ignores the
              prop. The backdrop must not contain the glass; point it at a sibling behind it.
            </p>
            <CodeBlock code={CODE.backdrop} label="Refraction without SVG backdrop filters" />
            <aside className="manual__note">
              <p>
                <b>Backdrop roots.</b> A backdrop filter sees only what is painted inside its nearest ancestor with a <code>filter</code>,{' '}
                <code>opacity</code> below 1, <code>mask</code>, <code>clip-path</code>, <code>mix-blend-mode</code> or its own <code>backdrop-filter</code>.
                Under such an ancestor, glass shows that ancestor’s content and nothing behind it. Fade glass by animating its own opacity, not a parent’s.
              </p>
            </aside>
          </Section>

          <Section id="provider" n={6} title="Defaults and one sun">
            <p>
              <code>GlassProvider</code> sets defaults for every glass below it. Nested providers merge. Use it to give a whole page one light source, so
              every highlight agrees.
            </p>
            <CodeBlock code={CODE.provider} label="GlassProvider" />
          </Section>

          <Section id="stage" n={7} title="The WebGL stage">
            <p>
              Safari and Firefox can’t refract live page content, but WebGL can refract media in every browser. <code>GlassStage</code> draws a source you
              give it into a canvas and refracts it under each <code>GlassPane</code> inside, using the same optics tables as the SVG path.
            </p>
            <CodeBlock code={CODE.stage} label="GlassStage with an image" />
            <p>For video or canvas, render the element yourself inside the stage and pass a ref. Where WebGL is missing, the panes frost over your element.</p>
            <CodeBlock code={CODE.video} label="GlassStage with video" />
            <PropsTable rows={STAGE_PROPS} caption="GlassStage props" />
            <p>
              <code>GlassPane</code> takes the same props as <code>Glass</code> except <code>mode</code>. A stage draws up to 16 panes in one pass. The canvas
              only sees the source: other content inside the stage is drawn above it and not refracted.
            </p>
          </Section>

          <Section id="interaction" n={8} title="Interaction">
            <div className="manual__demo" style={{ backgroundImage: `url(${plateSrc('opticks-plate-4', theme)})` }}>
              <Glass key={summons} as="button" type="button" radius="capsule" interactive appear={summons > 0} className="manual__press">
                Press and drag
              </Glass>
              <button type="button" className="action action--quiet manual__replay" onClick={() => setSummons((n) => n + 1)}>
                Materialize it again
              </button>
            </div>
            <p>
              With <code>interactive</code>, glass lifts a little under the pointer and its rim brightens. Pressed, it swells, light blooms from the point of
              contact, and it stretches toward the pointer while held; released, it wobbles back. Space and Enter press it too, blooming from the center.
              Motion goes through the <code>scale</code> and <code>translate</code> properties, so a <code>transform</code> you set keeps working, and your own
              values come back once the spring settles.
            </p>
            <p>
              With <code>appear</code>, glass materializes as it mounts: it fades in, swells into place on a spring, and the lens gathers its bend a beat
              later, so the backdrop visibly curves into place. Before it can be measured the element stays transparent, so a glass that mounts hidden
              materializes when it first shows.
            </p>
            <CodeBlock code={CODE.appear} label="Glass that materializes" />
            <p>
              Under <code>prefers-reduced-motion</code>, the swell, stretch and bloom turn off and only the glow remains; <code>appear</code> becomes a short
              fade.
            </p>
          </Section>

          <Section id="indicator" n={9} title="Selections that flow">
            <div className="manual__demo" style={{ backgroundImage: `url(${plateSrc('opticks-plate-2', theme)})` }}>
              <Glass as="nav" radius="capsule" className="manual__tabs" aria-label="Demo tabs">
                <GlassIndicator target={tabEl} tint="var(--glass-spot)" />
                {['Rays', 'Lenses', 'Prisms', 'Colors'].map((label, i) => (
                  <button key={label} type="button" ref={i === tab ? setTabEl : undefined} aria-current={i === tab ? 'page' : undefined} onClick={() => setTab(i)}>
                    {label}
                  </button>
                ))}
              </Glass>
            </div>
            <p>
              <code>GlassIndicator</code> is a lens that moves to whichever element you point it at: the current tab, the chosen segment, the link under the
              pointer. Its four edges are springs. Moving right, the right edge is stiff and the left edge soft, so the glass stretches toward its target,
              thins to keep its volume, and draws itself back together. Resizing costs nothing, because maps are built per corner shape.
            </p>
            <CodeBlock code={CODE.indicator} label="A tab bar with a flowing selection" />
            <p>
              Put the indicator first inside the positioned container that holds the targets, and give the targets <code>position: relative</code> so their
              content paints above the glass. It follows its target through layout changes. With reduced motion it moves straight to the target with a
              brief fade.
            </p>
            <PropsTable rows={INDICATOR_PROPS} caption="GlassIndicator props" />
          </Section>

          <Section id="group" n={10} title="Surface tension">
            <p>
              Every <code>Glass</code> inside a <code>GlassGroup</code> is drawn as one surface. Outlines closer than <code>spacing</code> grow a neck
              between them, the way two drops bridge; within twice that distance they lean toward each other; pulled apart, the neck thins and lets go. The
              neck refracts and catches light like any other rim. <a href="/#surface-tension">Plate V</a> on the home page lets you drag one.
            </p>
            <CodeBlock code={CODE.group} label="A toolbar and a drop that merge" />
            <p>
              Lay members out and animate them however you like: the group measures them every frame and redraws the surface while anything moves, at a
              lower resolution in motion and sharp once they settle. Members keep their content, events and <code>interactive</code> springs; a pressed
              member swells the shared surface with it. Only the group’s own glass props apply to the surface.
            </p>
            <PropsTable rows={GROUP_PROPS} caption="GlassGroup props" />
            <p>
              Browsers that frost still draw the merged outline, rim light and shadow. Give the group a <code>backdrop</code> and they refract too: over
              an image or video in WebGL, over anything else in Firefox. For media you render yourself, <code>GlassStage</code> merges panes in every
              browser with WebGL2, blending each pane’s glass across the neck:
            </p>
            <CodeBlock code={CODE.merge} label="Panes that merge on the WebGL stage" />
          </Section>

          <Section id="a11y" n={11} title="Accessibility">
            <ul className="manual__list">
              <li>
                Glass is decoration on the element you choose. Semantics come from <code>as</code> and your markup; the filter, highlight and glow layers are
                hidden from assistive technology.
              </li>
              <li>
                Under <code>prefers-reduced-transparency</code>, glass turns nearly opaque (your tint mixed into the system canvas color) and stops refracting.
              </li>
              <li>
                Text on glass needs contrast against the busiest thing behind it. Regular glass frosts and tints for that; with clear glass, keep text off it
                or raise the tint.
              </li>
              <li>
                Under <code>prefers-reduced-motion</code>, springs turn off: presses only glow, indicators move straight to their target with a short fade,
                and <code>appear</code> fades. Motion you drive yourself, such as dragging a group member, stays yours to reduce.
              </li>
              <li>
                <code>GlassIndicator</code> is <code>aria-hidden</code>. Mark the selection itself with <code>aria-current</code>,{' '}
                <code>aria-selected</code> or a checked radio, as you would without it.
              </li>
            </ul>
          </Section>

          <Section id="performance" n={12} title="Performance">
            <ul className="manual__list">
              <li>Each refracting glass is one SVG filter. Its maps are built once per corner shape and cached, so resizing costs nothing.</li>
              <li>
                Aberration triples the displacement passes. Keep it for a few hero surfaces.
              </li>
              <li>Backdrop filters redraw when anything behind them changes. A dozen glasses over scrolling content is fine; hundreds are not.</li>
              <li>The WebGL stage redraws only when a pane moves, the canvas resizes, or a video frame arrives.</li>
              <li>
                A <code>GlassGroup</code> rebuilds its maps while members move, in a worker where the browser allows one: the main thread only swaps
                images. A content security policy without <code>blob:</code> in <code>worker-src</code> keeps the work on the main thread (about 4 ms a
                frame for a toolbar). Maps are drawn at up to 40,000 pixels in motion and 110,000 at rest; the group pauses offscreen and costs nothing
                while still.
              </li>
              <li>
                The <code>webgl</code> path draws one small canvas per glass or group, only while something moves. The <code>element</code> path makes
                Firefox repaint the copied element into the glass every frame it changes; keep backdrops to the region behind the glass where you can.
              </li>
            </ul>
          </Section>

          <Section id="core" n={13} title="meniscus/core">
            <p>
              The optics without React: resolve options, build and encode the maps, write the filter markup, or trace single rays. It has no directives and
              runs on the server, in workers, or in any framework.
            </p>
            <CodeBlock code={CODE.core} label="A filter without React" />
            <CodeBlock code={CODE.trace} label="Tracing rays" />
          </Section>

          <Section id="support" n={14} title="Browser support">
            <div className="manual__table-wrap">
              <table className="manual__table manual__table--support">
                <caption className="visually-hidden">What each browser draws</caption>
                <thead>
                  <tr>
                    <th scope="col">Browser</th>
                    <th scope="col">Glass</th>
                    <th scope="col">WebGL stage</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Chrome, Edge, Opera, Brave, Arc</th>
                    <td>Refracts live content</td>
                    <td>Refracts media</td>
                  </tr>
                  <tr>
                    <th scope="row">Safari (macOS)</th>
                    <td>Frosted; refracts a media backdrop in WebGL</td>
                    <td>Refracts media</td>
                  </tr>
                  <tr>
                    <th scope="row">Firefox</th>
                    <td>Frosted; refracts a media backdrop in WebGL, or a live copy of any other backdrop (experimental)</td>
                    <td>Refracts media</td>
                  </tr>
                  <tr>
                    <th scope="row">Any browser on iOS</th>
                    <td>Frosted; refracts a media backdrop in WebGL</td>
                    <td>Refracts media</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="caption">As of September 2026. The detection follows what each engine draws, not a version list, so a browser that gains SVG backdrop filters gains refraction.</p>
          </Section>

          <Section id="limits" n={15} title="Limits">
            <ul className="manual__list">
              <li>Only rounded rectangles and capsules. Other outlines would need their own distance fields.</li>
              <li>
                Glass inside glass sees its parent’s surface, not the page: the outer backdrop filter is a backdrop root for everything inside it.
              </li>
              <li>The bezel is capped at the corner radius, so a rectangle with sharp corners doesn’t refract.</li>
              <li>The WebGL stage refracts its source only, never the DOM above it.</li>
              <li>
                A <code>GlassGroup</code> shares one glass across its members, with the bezel of the tightest corner. Keep groups to a handful of controls:
                the surface is one map as large as the members’ bounding box.
              </li>
              <li>
                <code>as</code> must be an element that can hold children. Void elements such as <code>input</code> render frosted, without refraction
                or highlights; wrap them in a <code>Glass</code> instead.
              </li>
            </ul>
          </Section>
        </main>
      </div>
      <Colophon />
    </GlassProvider>
  );
}
