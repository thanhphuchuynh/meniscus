import { Glass, GlassButton, GlassCheckbox, GlassGroup, GlassIndicator, GlassLoader, GlassPanel, GlassProvider, GlassSelect, GlassTabs, GlassTextField } from 'meniscus';
import { GlassPane, GlassStage } from 'meniscus/webgl';
import { useEffect, useState, type ReactNode } from 'react';
import { CodeBlock, Colophon, Install, Masthead } from '../shared/chrome';
import { plateSrc, useTheme } from '../shared/theme';
import { sitePath } from '../shared/paths';

const ITEMS = [
  { id: 'button', name: 'GlassButton', role: 'A native action with glass response' },
  { id: 'tabs', name: 'GlassTabs', role: 'Accessible views with a flowing lens' },
  { id: 'panel', name: 'GlassPanel', role: 'A ready-to-use glass container' },
  { id: 'text-field', name: 'GlassTextField', role: 'A labelled native input' },
  { id: 'select', name: 'GlassSelect', role: 'A labelled native select' },
  { id: 'checkbox', name: 'GlassCheckbox', role: 'A native choice on glass' },
  { id: 'loader', name: 'GlassLoader', role: 'Loading, in liquid glass' },
  { id: 'glass', name: 'Glass', role: 'A glass surface for any element' },
  { id: 'indicator', name: 'GlassIndicator', role: 'A selection that flows' },
  { id: 'group', name: 'GlassGroup', role: 'Surfaces that join' },
  { id: 'stage', name: 'GlassStage', role: 'Refraction over media' },
  { id: 'provider', name: 'GlassProvider', role: 'Shared defaults and one light' },
] as const;

interface PropRow {
  name: string;
  type: string;
  default?: string;
  body: string;
}

const GLASS_OPTIONS: PropRow = { name: '…glass options', type: 'GlassOptions', body: 'variant, radius, tint, blur, refraction, light and the rest, as on Glass. See the manual’s props table.' };

const PROPS: Record<string, PropRow[]> = {
  button: [
    { name: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", body: 'Native button type. It defaults to button so it never submits a form by accident.' },
    { name: 'disabled', type: 'boolean', default: 'false', body: 'Native disabled: out of the tab order, no clicks, no glass response, drawn at half opacity.' },
    { name: 'interactive', type: 'boolean', default: 'true', body: 'Lift on hover, swell and bloom on press. Space and Enter press it too.' },
    { name: 'radius', type: "number | 'capsule'", default: "'capsule'", body: 'Corner radius in px.' },
    GLASS_OPTIONS,
    { name: '…button props', type: 'ButtonHTMLAttributes', body: 'onClick, name, value, form, aria-* and the rest pass to the native button. A ref reaches it.' },
  ],
  tabs: [
    { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the tab list.' },
    { name: 'items', type: 'GlassTabItem[]', default: 'required', body: '{ value, label, content, disabled? } per tab. Values must be unique and stable.' },
    { name: 'defaultValue', type: 'string', default: 'first enabled tab', body: 'Initially selected tab, uncontrolled.' },
    { name: 'value', type: 'string', body: 'Selected tab, controlled. Pair it with onValueChange.' },
    { name: 'onValueChange', type: '(value: string) => void', body: 'Called when the selection changes by click, arrow keys, Home, End, or a form opening a panel.' },
    { name: 'className, style', type: 'string, CSSProperties', body: 'On the wrapper holding the tab list and panels.' },
  ],
  panel: [
    { name: 'children', type: 'ReactNode', body: 'The content. Keep it semantic; the glass stays behind it.' },
    { name: 'role, aria-label(ledby)', type: 'string', body: 'Add role="region" and a name when the panel is a landmark.' },
    { name: 'style', type: 'CSSProperties', default: 'padding: 1.5rem', body: 'Merged over the default padding.' },
    GLASS_OPTIONS,
  ],
  'text-field': [
    { name: 'label', type: 'string', default: 'required', body: 'Visible label; it also names the input for assistive technology.' },
    { name: 'type', type: 'string', default: "'text'", body: 'Native input type: email, search, number…' },
    { name: 'disabled', type: 'boolean', default: 'false', body: 'Native disabled; the glass dims and stops answering the pointer.' },
    { name: 'required, pattern…', type: 'validation attributes', body: 'Native validation, including inside GlassTabs panels.' },
    { name: 'style', type: 'CSSProperties', body: 'On the input itself.' },
    { name: '…input props', type: 'InputHTMLAttributes', body: 'name, value, onChange, placeholder, aria-describedby… pass to the native input. A ref reaches it.' },
  ],
  select: [
    { name: 'label', type: 'string', default: 'required', body: 'Visible label; it also names the select.' },
    { name: 'children', type: '<option> elements', default: 'required', body: 'Real options with real values.' },
    { name: 'disabled', type: 'boolean', default: 'false', body: 'Native disabled; the glass dims.' },
    { name: '…select props', type: 'SelectHTMLAttributes', body: 'name, value, defaultValue, onChange… pass to the native select. A ref reaches it.' },
  ],
  checkbox: [
    { name: 'label', type: 'string', default: 'required', body: 'Visible label; clicking it toggles the box.' },
    { name: 'checked, defaultChecked', type: 'boolean', body: 'Controlled or uncontrolled state, as on a native checkbox.' },
    { name: 'disabled', type: 'boolean', default: 'false', body: 'Native disabled; the glass dims and no longer swells on press.' },
    { name: '…input props', type: 'InputHTMLAttributes', body: 'name, value, onChange, required… pass to the native checkbox. A ref reaches it.' },
  ],
  loader: [
    { name: 'label', type: 'string', default: "'Loading'", body: 'What is loading. Announced politely to assistive technology; shown as a caption on a loading page.' },
    { name: 'animate', type: 'boolean', default: 'true', body: 'The drops orbit and breathe, fusing into one and parting. Off, they rest apart. Under reduced motion they fade instead.' },
    { name: 'size', type: 'number', default: '40 / 72', body: 'Diameter in px, inline / page.' },
    { name: 'page', type: 'boolean', default: 'false', body: 'A whole loading page: frosted glass over the viewport, the loader, and its label.' },
    GLASS_OPTIONS,
  ],
  glass: [
    { name: 'as', type: 'ElementType', default: "'div'", body: 'The element to render; its own props pass through.' },
    { name: 'interactive', type: 'boolean', default: 'false', body: 'Press, hover and pointer-glow response. Off while disabled.' },
    { name: 'appear', type: 'boolean', default: 'false', body: 'Materialize on mount.' },
    { name: 'ripple', type: 'boolean', default: 'false', body: 'Liquid surface over a media backdrop or in a stage.' },
    { name: 'optics', type: 'GlassPhysics', body: 'Springs for presence, refraction, highlight, tint and lift, from useGlassPhysics.' },
    { name: 'intensity', type: "'subtle' | 'regular' | 'strong' | number", default: "'regular'", body: 'Semantic strength; raw refraction, specular and aberration win.' },
    { name: 'backdrop', type: 'HTMLElement | RefObject', body: 'What lies behind, for browsers that can’t refract the live page.' },
    { name: 'mode', type: "'auto' | 'refract' | 'frost' | 'none'", default: "'auto'", body: 'Rendering path.' },
    { name: 'shadow', type: 'string | false', body: 'Box shadow under the glass.' },
    GLASS_OPTIONS,
  ],
  indicator: [
    { name: 'target', type: 'HTMLElement | IndicatorBox | null', default: 'required', body: 'The element to sit under, or a box to follow a pointer. Hidden while null.' },
    { name: 'inset', type: 'number', default: '0', body: 'Space between the target and the glass, px.' },
    { name: 'stretch', type: 'number', default: '1', body: '0 slides rigidly; 1 lets the leading edge run ahead.' },
    { name: 'radius', type: "number | 'capsule'", default: "'capsule'", body: 'Corner radius.' },
    GLASS_OPTIONS,
  ],
  group: [
    { name: 'spacing', type: 'number', default: '24', body: 'Outlines closer than this many px bridge; within twice this they lean.' },
    { name: 'shadow', type: 'boolean', default: 'true', body: 'One shadow outside the merged outline.' },
    { name: 'backdrop', type: 'HTMLElement | RefObject', body: 'Behind the group, for browsers without live refraction.' },
    { name: 'mode', type: "'auto' | 'refract' | 'frost' | 'none'", default: "'auto'", body: 'Rendering path of the surface.' },
    { name: 'as', type: 'ElementType', default: "'div'", body: 'The positioned box members are measured in.' },
    GLASS_OPTIONS,
  ],
  stage: [
    { name: 'source', type: 'string | TexImageSource | RefObject', default: 'required', body: 'An image URL, or media you render inside the stage.' },
    { name: 'alt', type: 'string', default: "''", body: 'Alt text for an image URL.' },
    { name: 'fit', type: "'cover' | 'contain' | 'fill'", default: "'cover'", body: 'How the source fills the stage.' },
    { name: 'merge', type: 'number', default: '0', body: 'Panes closer than this many px flow together.' },
    { name: 'onStatus', type: '(status) => void', body: "'pending', 'ready' or 'fallback'." },
    { name: 'GlassPane', type: 'Glass props except mode', body: 'Each pane: position it absolutely inside the stage.' },
  ],
  provider: [
    { name: '…glass options', type: 'GlassOptions', body: 'Defaults for every glass below: lightAngle, variant, tint…' },
    { name: 'mode', type: "'auto' | 'refract' | 'frost' | 'none'", body: 'Force a rendering path for the subtree.' },
    { name: 'children', type: 'ReactNode', body: 'Nested providers merge; a glass’s own props win.' },
  ],
};

const EXAMPLES = {
  button: `import { useState } from 'react';
import { GlassButton } from 'meniscus';

export function SaveButtons() {
  const [saved, setSaved] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <GlassButton onClick={() => setSaved((s) => !s)}>{saved ? 'Saved' : 'Save changes'}</GlassButton>
      <GlassButton disabled>Delete</GlassButton>
    </div>
  );
}`,
  tabs: `import { useState } from 'react';
import { GlassButton, GlassTabs, GlassTextField } from 'meniscus';

export function SignUp() {
  const [sent, setSent] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(String(new FormData(e.currentTarget).get('email')));
      }}
    >
      <GlassTabs
        label="Sign-up steps"
        items={[
          { value: 'profile', label: 'Profile', content: <GlassTextField label="Name" name="name" defaultValue="Ada" /> },
          { value: 'contact', label: 'Contact', content: <GlassTextField label="Email" name="email" type="email" required /> },
          { value: 'billing', label: 'Billing', content: 'Not yet available.', disabled: true },
        ]}
      />
      <GlassButton type="submit">Create account</GlassButton>
      <p role="status">{sent && \`Sent for \${sent}\`}</p>
    </form>
  );
}`,
  panel: `import { useState } from 'react';
import { GlassPanel } from 'meniscus';

export function Summary() {
  const [clear, setClear] = useState(false);
  return (
    <GlassPanel role="region" aria-labelledby="summary-title" variant={clear ? 'clear' : 'regular'}>
      <h3 id="summary-title">Today's collection</h3>
      <label>
        <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} /> Clear glass
      </label>
    </GlassPanel>
  );
}`,
  'text-field': `import { useState } from 'react';
import { GlassTextField } from 'meniscus';

export function ProjectName({ disabled = false }) {
  const [project, setProject] = useState('');
  return (
    <GlassTextField
      label="Project name"
      name="project"
      placeholder="Name your project"
      value={project}
      onChange={(e) => setProject(e.target.value)}
      disabled={disabled}
    />
  );
}`,
  select: `import { useState } from 'react';
import { GlassSelect } from 'meniscus';

export function Material({ disabled = false }) {
  const [material, setMaterial] = useState('glass');
  return (
    <GlassSelect label="Material" name="material" value={material} onChange={(e) => setMaterial(e.target.value)} disabled={disabled}>
      <option value="glass">Glass</option>
      <option value="water">Water</option>
      <option value="diamond">Diamond</option>
    </GlassSelect>
  );
}`,
  checkbox: `import { useState } from 'react';
import { GlassCheckbox } from 'meniscus';

export function Notifications() {
  const [alerts, setAlerts] = useState(false);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <GlassCheckbox label="Send alerts" name="alerts" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} />
      <GlassCheckbox label="Weekly digest" name="digest" disabled />
    </div>
  );
}`,
  loader: `import { useEffect, useState } from 'react';
import { GlassLoader } from 'meniscus';

export function Plates() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <GlassLoader label="Loading plates" />
      {loading && <GlassLoader page label="Preparing your plates" />}
    </>
  );
}`,
  glass: `import { useState } from 'react';
import { Glass } from 'meniscus';

export function OpenCollection() {
  const [opened, setOpened] = useState(false);
  return (
    <Glass
      as="button"
      type="button"
      radius="capsule"
      interactive
      aria-pressed={opened}
      onClick={() => setOpened((o) => !o)}
      style={{ padding: '15px 27px', border: 0, font: 'inherit' }}
    >
      {opened ? 'Collection opened' : 'Open collection'}
    </Glass>
  );
}`,
  indicator: `import { useState } from 'react';
import { Glass, GlassIndicator } from 'meniscus';

export function Views() {
  const [view, setView] = useState('All');
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  return (
    <Glass as="nav" aria-label="Views" radius="capsule" style={{ display: 'flex', position: 'relative', padding: 5 }}>
      <GlassIndicator target={selected} tint="rgba(255, 74, 28, 0.12)" />
      {['All', 'Saved', 'Recent'].map((name) => (
        <button
          key={name}
          type="button"
          ref={view === name ? setSelected : undefined}
          aria-current={view === name ? 'page' : undefined}
          onClick={() => setView(name)}
          style={{ position: 'relative', padding: '11px 16px', border: 0, background: 'none', font: 'inherit' }}
        >
          {name}
        </button>
      ))}
    </Glass>
  );
}`,
  group: `import { useState } from 'react';
import { Glass, GlassGroup } from 'meniscus';

const PILL = { padding: '13px 23px', border: 0, background: 'none', font: 'inherit' };

export function Dock() {
  const [joined, setJoined] = useState(false);
  return (
    <GlassGroup spacing={36} style={{ display: 'flex', gap: 10, padding: 30 }}>
      <Glass as="button" type="button" radius="capsule" style={PILL}>Archive</Glass>
      <Glass
        as="button"
        type="button"
        radius="capsule"
        aria-pressed={joined}
        onClick={() => setJoined((j) => !j)}
        style={{ ...PILL, translate: joined ? '-34px 0' : '28px 0', transition: 'translate 480ms ease' }}
      >
        {joined ? 'Split' : 'Join'}
      </Glass>
    </GlassGroup>
  );
}`,
  stage: `import { useState } from 'react';
import { GlassPane, GlassStage } from 'meniscus/webgl';

export function Lens() {
  const [x, setX] = useState(50);
  return (
    <>
      <GlassStage source="/image.jpg" alt="A photograph" style={{ height: 320 }}>
        <GlassPane
          radius="capsule"
          style={{ position: 'absolute', left: \`\${x}%\`, top: '50%', translate: '-50% -50%', padding: '15px 27px' }}
        >
          A lens over the image
        </GlassPane>
      </GlassStage>
      <label>
        Pane position <input type="range" min={15} max={85} value={x} onChange={(e) => setX(Number(e.target.value))} />
      </label>
    </>
  );
}`,
  provider: `import { useState } from 'react';
import { Glass, GlassProvider } from 'meniscus';

export function SharedLight() {
  const [angle, setAngle] = useState(315);
  return (
    <>
      <GlassProvider lightAngle={angle} variant="clear">
        <Glass radius="capsule" style={{ padding: '15px 27px' }}>One shared light source</Glass>
        <Glass radius={24} style={{ padding: 24 }}>Every glass agrees</Glass>
      </GlassProvider>
      <label>
        Light angle <input type="range" min={0} max={359} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
      </label>
    </>
  );
}`,
} as const;

function PropsTable({ title, rows }: { title: string; rows: PropRow[] }) {
  return (
    <div className="catalog__props-wrap">
      <table className="catalog__props">
        <caption className="visually-hidden">{title} props</caption>
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
                <code>{r.type}</code>
              </td>
              <td>{r.default ?? '—'}</td>
              <td>{r.body}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Entry({
  id,
  title,
  description,
  children,
  controls,
  note,
}: {
  id: keyof typeof EXAMPLES;
  title: string;
  description: string;
  children?: ReactNode;
  controls?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <section className="catalog__entry" id={id} aria-labelledby={`${id}-title`}>
      <div className="catalog__entry-head">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <a href={sitePath(`/docs/#${['button', 'tabs', 'panel', 'text-field', 'select', 'checkbox', 'loader'].includes(id) ? 'components' : id}`)}>
          API &amp; guidance <span aria-hidden="true">↗</span>
        </a>
      </div>
      {children ? <div className={`catalog__demo catalog__demo--${id}`}>{children}</div> : null}
      {controls ? <div className="catalog__controls">{controls}</div> : null}
      {note ? <p className="catalog__note">{note}</p> : null}
      <PropsTable title={title} rows={PROPS[id]!} />
      <CodeBlock code={EXAMPLES[id]} label={`${title} example`} />
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="catalog__control">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Range({ label, value, min, max, unit = '', onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="catalog__control">
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output className="num">
        {value}
        {unit}
      </output>
    </label>
  );
}

function IndicatorDemo() {
  const [view, setView] = useState('All');
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  return (
    <Glass as="nav" radius="capsule" aria-label="Example views" className="catalog__tabs">
      <GlassIndicator target={selected} tint="var(--glass-spot)" />
      {['All', 'Saved', 'Recent'].map((name) => (
        <button key={name} type="button" ref={view === name ? setSelected : undefined} aria-current={view === name ? 'page' : undefined} onClick={() => setView(name)}>
          {name}
        </button>
      ))}
    </Glass>
  );
}

function TabsDemo() {
  const [sent, setSent] = useState('');
  return (
    <form
      className="catalog__tabs-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(String(new FormData(e.currentTarget).get('email')));
      }}
    >
      <GlassTabs
        label="Sign-up steps"
        className="catalog__complete-tabs"
        items={[
          { value: 'profile', label: 'Profile', content: <GlassTextField label="Name" name="name" defaultValue="Ada" /> },
          { value: 'contact', label: 'Contact', content: <GlassTextField label="Email" name="email" type="email" required /> },
          { value: 'billing', label: 'Billing', content: 'Not yet available.', disabled: true },
        ]}
      />
      <GlassButton type="submit" className="catalog__submit">
        Create account
      </GlassButton>
      <p role="status" className="catalog__status">
        {sent ? `Sent for ${sent}` : 'Submit with the email empty: the Contact tab opens on the missing field.'}
      </p>
    </form>
  );
}

function LoaderDemo({ animate }: { animate: boolean }) {
  const [page, setPage] = useState(false);
  useEffect(() => {
    if (!page) return;
    const id = setTimeout(() => setPage(false), 3000);
    return () => clearTimeout(id);
  }, [page]);
  return (
    <>
      <GlassLoader label="Loading plates" animate={animate} size={56} />
      <GlassButton className="catalog__submit" onClick={() => setPage(true)}>
        Show loading page
      </GlassButton>
      {page ? <GlassLoader page label="Preparing your plates" animate={animate} className="catalog__loading-page" /> : null}
    </>
  );
}

function GroupDemo() {
  const [joined, setJoined] = useState(false);
  return (
    <GlassGroup spacing={36} className="catalog__group">
      <Glass as="button" type="button" radius="capsule" className="catalog__group-main">
        Archive
      </Glass>
      <Glass
        as="button"
        type="button"
        radius="capsule"
        className="catalog__group-drop"
        aria-pressed={joined}
        onClick={() => setJoined((j) => !j)}
        style={{ translate: joined ? '-34px 0' : '28px 0' }}
      >
        {joined ? 'Split' : 'Join'}
      </Glass>
    </GlassGroup>
  );
}

export function Components() {
  const theme = useTheme();
  const [opened, setOpened] = useState(false);
  const [saved, setSaved] = useState(false);
  const [project, setProject] = useState('');
  const [material, setMaterial] = useState('glass');
  const [alerts, setAlerts] = useState(false);
  const [clear, setClear] = useState(false);
  const [fieldOff, setFieldOff] = useState(false);
  const [selectOff, setSelectOff] = useState(false);
  const [paneX, setPaneX] = useState(50);
  const [angle, setAngle] = useState(315);
  const [loaderMoves, setLoaderMoves] = useState(true);

  return (
    <GlassProvider>
      <Masthead page="components" />
      <main id="main" className="catalog">
        <header className="catalog__intro">
          <h1>Components</h1>
          <p>
            The pieces that make meniscus. Start with a single glass surface, then compose selection, shared light, merging surfaces, and media refraction.
            Each example uses the package's React API.
          </p>
          <div className="catalog__intro-actions">
            <Install />
            <a href={sitePath('/docs/#install')}>Read the installation guide <span aria-hidden="true">↗</span></a>
          </div>
        </header>

        <div className="catalog__layout">
          <nav className="catalog__index" aria-label="Components on this page">
            <p>On this page</p>
            <ul>
              {ITEMS.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>
                    <span>{item.name}</span>
                    <small>{item.role}</small>
                  </a>
                </li>
              ))}
              <li><a href="#companions"><span>Companion libraries</span><small>Accessible behavior and app structure</small></a></li>
            </ul>
          </nav>

          <div className="catalog__body">
            <Entry id="button" title="GlassButton" description="A native button with the glass press, hover, and focus response ready to use. It defaults to type=button so it will not submit a form by accident." note="Disabled uses the native disabled attribute. Set type=submit explicitly for form submission.">
              <GlassButton onClick={() => setSaved((value) => !value)}>{saved ? 'Saved' : 'Save changes'}</GlassButton>
              <GlassButton disabled>Delete</GlassButton>
            </Entry>

            <Entry
              id="tabs"
              title="GlassTabs"
              description="A complete tab list and panel. Arrow keys, Home, and End move selection and skip disabled tabs; the active tab keeps the glass lens beneath it."
              note="Inactive panels stay mounted, so their fields keep their values and still submit. When a form’s first invalid field is in a hidden panel, that panel opens so the browser can show the message."
            >
              <TabsDemo />
            </Entry>

            <Entry id="panel" title="GlassPanel" controls={<Toggle label="Clear glass" checked={clear} onChange={setClear} />} description="A padded glass container for grouped content. It keeps the familiar Glass props for tint, radius, blur, and lighting." note="Add a region role and accessible name when the panel is a meaningful landmark.">
              <GlassPanel role="region" aria-labelledby="catalog-panel-title" className="catalog__panel-sample" variant={clear ? 'clear' : 'regular'}>
                <h3 id="catalog-panel-title">Today's collection</h3>
                <p>Keep the content semantic. The glass stays behind it.</p>
              </GlassPanel>
            </Entry>

            <Entry id="text-field" title="GlassTextField" controls={<Toggle label="Disabled" checked={fieldOff} onChange={setFieldOff} />} description="A labelled text input with a glass surface. It passes through native input props, including name, required, disabled, and validation attributes." note="The visible label also names the input for assistive technology. A ref reaches the native input.">
              <div className="catalog__form-sample">
                <GlassTextField label="Project name" name="project" placeholder="Name your project" value={project} onChange={(event) => setProject(event.target.value)} disabled={fieldOff} />
              </div>
            </Entry>

            <Entry id="select" title="GlassSelect" controls={<Toggle label="Disabled" checked={selectOff} onChange={setSelectOff} />} description="A native select on glass. Browser keyboard behavior, options, form submission, and assistive technology support stay intact." note="Use a clear visible label and provide real option values.">
              <div className="catalog__form-sample">
                <GlassSelect label="Material" name="material" value={material} onChange={(event) => setMaterial(event.target.value)} disabled={selectOff}>
                  <option value="glass">Glass</option>
                  <option value="water">Water</option>
                  <option value="diamond">Diamond</option>
                </GlassSelect>
              </div>
            </Entry>

            <Entry id="checkbox" title="GlassCheckbox" description="A native checkbox with a larger glass hit target. Its checked and disabled states use the browser's normal behavior." note="The visible label toggles the checkbox; its value participates in forms normally.">
              <GlassCheckbox label="Send alerts" name="alerts" checked={alerts} onChange={(event) => setAlerts(event.target.checked)} />
              <GlassCheckbox label="Weekly digest" name="digest" disabled />
            </Entry>

            <Entry
              id="loader"
              title="GlassLoader"
              controls={<Toggle label="Animate" checked={loaderMoves} onChange={setLoaderMoves} />}
              description="Loading, in liquid glass: three drops in one surface that orbit and breathe, fusing into a single drop and parting again. Inline, or as a whole loading page."
              note="It is a polite status: screen readers hear the label once, without interrupting. Under reduced motion the drops fade instead of moving."
            >
              <LoaderDemo animate={loaderMoves} />
            </Entry>

            <Entry id="glass" title="Glass" description="The flexible foundation for a lens on a button, navigation bar, card, or sheet. Its children keep their native HTML semantics." note={'Use as="button" for an actual button. Add interactive only when the glass itself should respond to press and hover.'}>
              <Glass as="button" type="button" radius="capsule" interactive className="catalog__sample-button" onClick={() => setOpened((value) => !value)} aria-pressed={opened}>
                {opened ? 'Collection opened' : 'Open collection'}
              </Glass>
              <span className="catalog__demo-hint">Press or hover the lens</span>
            </Entry>

            <Entry id="indicator" title="GlassIndicator" description="Move one lens between selected elements. The target is a real DOM element; the selection stays on the button through aria-current." note="The indicator is decorative. Mark the selected control with aria-current, aria-selected, or checked state for assistive technology.">
              <IndicatorDemo />
            </Entry>

            <Entry id="group" title="GlassGroup" description="Nearby glass members become one surface as they approach. Use it for compact clusters that should feel physically connected." note="The group draws the surface; its members retain their content and events.">
              <GroupDemo />
            </Entry>

            <Entry id="stage" title="GlassStage & GlassPane" controls={<Range label="Pane position" value={paneX} min={15} max={85} unit="%" onChange={setPaneX} />} description="Refract an image, video, or canvas in any browser with WebGL2. A stage shares one renderer across its panes." note="A stage refracts its supplied source, not arbitrary page content. If WebGL2 is unavailable, panes render frosted.">
              <GlassStage source={plateSrc('opticks-plate-4', theme)} alt="Engraving from Newton's Opticks, Plate IV" className="catalog__stage">
                <GlassPane radius="capsule" className="catalog__stage-pane" style={{ left: `${paneX}%` }}>A lens over the engraving</GlassPane>
              </GlassStage>
            </Entry>

            <Entry id="provider" title="GlassProvider" controls={<Range label="Light angle" value={angle} min={0} max={359} unit="°" onChange={setAngle} />} description="Set consistent defaults for a section or the whole app. Nested providers merge, so local examples can tune one property." note="Use a provider for decisions shared by many surfaces, such as light direction or tint. Individual Glass props can override it.">
              <GlassProvider lightAngle={angle} variant="clear">
                <Glass radius="capsule" className="catalog__provider-sample">One shared light source</Glass>
                <Glass radius={24} className="catalog__provider-sample">Every glass agrees</Glass>
              </GlassProvider>
            </Entry>

            <section className="catalog__companions" id="companions" aria-labelledby="companions-title">
              <h2 id="companions-title">Companion libraries</h2>
              <p>Meniscus supplies the surface. These libraries can provide accessible behavior or larger application patterns around it.</p>
              <div className="catalog__resources">
                <a href="https://react-spectrum.adobe.com/react-aria/" target="_blank" rel="noopener noreferrer"><strong>React Aria</strong><span>Accessible hooks and components for controls with richer behavior.</span><span aria-hidden="true">↗</span></a>
                <a href="https://www.radix-ui.com/primitives" target="_blank" rel="noopener noreferrer"><strong>Radix Primitives</strong><span>Unstyled dialogs, menus, and other interaction primitives.</span><span aria-hidden="true">↗</span></a>
                <a href="https://tanstack.com/query/latest" target="_blank" rel="noopener noreferrer"><strong>TanStack Query</strong><span>Server state for data-driven interfaces beneath the visual layer.</span><span aria-hidden="true">↗</span></a>
              </div>
              <p className="catalog__disclaimer">These are independent projects, not dependencies or official integrations.</p>
            </section>
          </div>
        </div>
      </main>
      <Colophon />
    </GlassProvider>
  );
}
