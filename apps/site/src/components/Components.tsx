import { Glass, GlassButton, GlassCheckbox, GlassGroup, GlassIndicator, GlassPanel, GlassProvider, GlassSelect, GlassTabs, GlassTextField } from 'meniscus';
import { GlassPane, GlassStage } from 'meniscus/webgl';
import { useState, type ReactNode } from 'react';
import { CodeBlock, Colophon, Install, Masthead } from '../shared/chrome';
import { plateSrc, useTheme } from '../shared/theme';

const ITEMS = [
  { id: 'button', name: 'GlassButton', role: 'A native action with glass response' },
  { id: 'tabs', name: 'GlassTabs', role: 'Accessible views with a flowing lens' },
  { id: 'panel', name: 'GlassPanel', role: 'A ready-to-use glass container' },
  { id: 'text-field', name: 'GlassTextField', role: 'A labelled native input' },
  { id: 'select', name: 'GlassSelect', role: 'A labelled native select' },
  { id: 'checkbox', name: 'GlassCheckbox', role: 'A native choice on glass' },
  { id: 'glass', name: 'Glass', role: 'A glass surface for any element' },
  { id: 'indicator', name: 'GlassIndicator', role: 'A selection that flows' },
  { id: 'group', name: 'GlassGroup', role: 'Surfaces that join' },
  { id: 'stage', name: 'GlassStage', role: 'Refraction over media' },
  { id: 'provider', name: 'GlassProvider', role: 'Shared defaults and one light' },
] as const;

const EXAMPLES = {
  button: `import { GlassButton } from 'meniscus';

<GlassButton onClick={save}>Save changes</GlassButton>`,
  tabs: `import { GlassTabs } from 'meniscus';

<GlassTabs label="Library views" items={[
  { value: 'all', label: 'All', content: <AllItems /> },
  { value: 'saved', label: 'Saved', content: <SavedItems /> },
]} />`,
  panel: `import { GlassPanel } from 'meniscus';

<GlassPanel role="region" aria-labelledby="summary-title">
  <h2 id="summary-title">Today</h2>
  <p>Your collection is ready.</p>
</GlassPanel>`,
  'text-field': `import { GlassTextField } from 'meniscus';

<GlassTextField label="Project name" name="project" required />`,
  select: `import { GlassSelect } from 'meniscus';

<GlassSelect label="Material" name="material" defaultValue="glass">
  <option value="glass">Glass</option>
  <option value="water">Water</option>
</GlassSelect>`,
  checkbox: `import { GlassCheckbox } from 'meniscus';

<GlassCheckbox label="Send alerts" name="alerts" value="yes" />`,
  glass: `import { Glass } from 'meniscus';

<Glass as="button" type="button" radius="capsule" interactive>
  Open collection
</Glass>`,
  indicator: `import { Glass, GlassIndicator } from 'meniscus';

<Glass as="nav" aria-label="View" radius="capsule">
  <GlassIndicator target={selectedElement} />
  <button aria-current={view === 'All' ? 'page' : undefined}>All</button>
  <button aria-current={view === 'Saved' ? 'page' : undefined}>Saved</button>
</Glass>`,
  group: `import { Glass, GlassGroup } from 'meniscus';

<GlassGroup spacing={36}>
  <Glass radius="capsule">Archive</Glass>
  <Glass radius="capsule">Share</Glass>
</GlassGroup>`,
  stage: `import { GlassPane, GlassStage } from 'meniscus/webgl';

<GlassStage source="/image.jpg" alt="A photograph" style={{ height: 320 }}>
  <GlassPane radius="capsule">View detail</GlassPane>
</GlassStage>`,
  provider: `import { Glass, GlassProvider } from 'meniscus';

<GlassProvider lightAngle={315} variant="clear">
  <Glass radius="capsule">One shared light source</Glass>
</GlassProvider>`,
} as const;

function Entry({ id, title, description, children, note }: { id: keyof typeof EXAMPLES; title: string; description: string; children?: ReactNode; note?: ReactNode }) {
  return (
    <section className="catalog__entry" id={id} aria-labelledby={`${id}-title`}>
      <div className="catalog__entry-head">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <a href={`/docs/#${['button', 'tabs', 'panel', 'text-field', 'select', 'checkbox'].includes(id) ? 'components' : id}`}>
          API &amp; guidance <span aria-hidden="true">↗</span>
        </a>
      </div>
      {children ? <div className={`catalog__demo catalog__demo--${id}`}>{children}</div> : null}
      {note ? <p className="catalog__note">{note}</p> : null}
      <CodeBlock code={EXAMPLES[id]} label={`${title} example`} />
    </section>
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

export function Components() {
  const theme = useTheme();
  const [opened, setOpened] = useState(false);
  const [saved, setSaved] = useState(false);
  const [project, setProject] = useState('');
  const [material, setMaterial] = useState('glass');
  const [alerts, setAlerts] = useState(false);

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
            <a href="/docs/#install">Read the installation guide <span aria-hidden="true">↗</span></a>
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
            </Entry>

            <Entry id="tabs" title="GlassTabs" description="A complete tab list and panel. Arrow keys, Home, and End move selection; the active tab keeps the glass lens beneath it." note="Give the tab list a clear label. Each item has a stable value, visible label, and panel content.">
              <GlassTabs label="Collection views" className="catalog__complete-tabs" items={[
                { value: 'all', label: 'All', content: 'Every item in your collection.' },
                { value: 'saved', label: 'Saved', content: 'Items you have saved.' },
                { value: 'recent', label: 'Recent', content: 'Items you viewed recently.' },
              ]} />
            </Entry>

            <Entry id="panel" title="GlassPanel" description="A padded glass container for grouped content. It keeps the familiar Glass props for tint, radius, blur, and lighting." note="Add a region role and accessible name when the panel is a meaningful landmark.">
              <GlassPanel role="region" aria-labelledby="catalog-panel-title" className="catalog__panel-sample">
                <h3 id="catalog-panel-title">Today's collection</h3>
                <p>Keep the content semantic. The glass stays behind it.</p>
              </GlassPanel>
            </Entry>

            <Entry id="text-field" title="GlassTextField" description="A labelled text input with a glass surface. It passes through native input props, including name, required, disabled, and validation attributes." note="The visible label also names the input for assistive technology. A ref reaches the native input.">
              <div className="catalog__form-sample">
                <GlassTextField label="Project name" name="project" placeholder="Name your project" value={project} onChange={(event) => setProject(event.target.value)} />
              </div>
            </Entry>

            <Entry id="select" title="GlassSelect" description="A native select on glass. Browser keyboard behavior, options, form submission, and assistive technology support stay intact." note="Use a clear visible label and provide real option values.">
              <div className="catalog__form-sample">
                <GlassSelect label="Material" name="material" value={material} onChange={(event) => setMaterial(event.target.value)}>
                  <option value="glass">Glass</option>
                  <option value="water">Water</option>
                  <option value="diamond">Diamond</option>
                </GlassSelect>
              </div>
            </Entry>

            <Entry id="checkbox" title="GlassCheckbox" description="A native checkbox with a larger glass hit target. Its checked and disabled states use the browser's normal behavior." note="The visible label toggles the checkbox; its value participates in forms normally.">
              <GlassCheckbox label="Send alerts" name="alerts" checked={alerts} onChange={(event) => setAlerts(event.target.checked)} />
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
              <GlassGroup spacing={36} className="catalog__group">
                <Glass as="button" type="button" radius="capsule" className="catalog__group-main">Archive</Glass>
                <Glass as="button" type="button" radius="capsule" className="catalog__group-drop">Share</Glass>
              </GlassGroup>
            </Entry>

            <Entry id="stage" title="GlassStage & GlassPane" description="Refract an image, video, or canvas in any browser with WebGL2. A stage shares one renderer across its panes." note="A stage refracts its supplied source, not arbitrary page content. If WebGL2 is unavailable, panes render frosted.">
              <GlassStage source={plateSrc('opticks-plate-4', theme)} alt="Engraving from Newton's Opticks, Plate IV" className="catalog__stage">
                <GlassPane radius="capsule" className="catalog__stage-pane">A lens over the engraving</GlassPane>
              </GlassStage>
            </Entry>

            <Entry id="provider" title="GlassProvider" description="Set consistent defaults for a section or the whole app. Nested providers merge, so local examples can tune one property." note="Use a provider for decisions shared by many surfaces, such as light direction or tint. Individual Glass props can override it.">
              <GlassProvider lightAngle={315} variant="clear">
                <Glass radius="capsule" className="catalog__provider-sample">One shared light source</Glass>
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
