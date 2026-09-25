import { Glass, GlassButton, GlassCheckbox, GlassGlyph, GlassIndicator, GlassPanel, GlassProvider, GlassSelect, GlassTextField } from 'meniscus';
import { useState, type ReactNode } from 'react';
import { CodeBlock, Plate } from '../shared/chrome';
import { Switch } from '../shared/controls';
import { Icon } from '../shared/Icon';
import { sitePath } from '../shared/paths';
import { plateSrc, useTheme } from '../shared/theme';

const NAV_CODE = `import { useState } from 'react';
import { Glass, GlassButton, GlassIndicator } from 'meniscus';

const PAGES = ['Plates', 'Figures', 'Notes'];

export function LibraryNav() {
  const [page, setPage] = useState('Plates');
  const [current, setCurrent] = useState<HTMLElement | null>(null);
  return (
    <Glass as="nav" aria-label="Library" radius="capsule" className="nav">
      <strong>Opticks</strong>
      <div className="nav__links">
        <GlassIndicator target={current} tint="var(--glass-spot)" />
        {PAGES.map((name) => (
          <button
            key={name}
            type="button"
            ref={name === page ? setCurrent : undefined}
            aria-current={name === page ? 'page' : undefined}
            onClick={() => setPage(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <GlassButton>Subscribe</GlassButton>
    </Glass>
  );
}`;

const FORM_CODE = `import { useState } from 'react';
import { GlassButton, GlassCheckbox, GlassPanel, GlassSelect, GlassTextField } from 'meniscus';

export function PrintRequest() {
  const [sent, setSent] = useState(false);
  return (
    <form onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
      <GlassPanel radius={28} role="region" aria-labelledby="print-title">
        <h3 id="print-title">Order a print</h3>
        <GlassTextField label="Email" name="email" type="email" required />
        <GlassSelect label="Plate" name="plate" defaultValue="2">
          <option value="2">Book I, Plate II</option>
          <option value="4">Book I, Plate IV</option>
        </GlassSelect>
        <GlassCheckbox label="Framed" name="framed" />
        <GlassButton type="submit">Order print</GlassButton>
        <p role="status">{sent ? 'Ordered. A proof is on its way.' : ''}</p>
      </GlassPanel>
    </form>
  );
}`;

const ICON_CODE = `import { GlassGlyph } from 'meniscus';

// Each shape is its own piece of glass; where they overlap they tint each other.
function Layer({ children }) {
  return (
    <GlassGlyph depth={2.6} style={{ position: 'absolute', inset: 0 }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">{children}</svg>
    </GlassGlyph>
  );
}

export function LensIcon() {
  return (
    <div role="img" aria-label="Lens" style={{ position: 'relative', width: 104, height: 104, borderRadius: 26, background: '#ff4a1c' }}>
      <Layer><circle cx="38" cy="50" r="24" fill="#f6f8f9" /></Layer>
      <Layer><circle cx="62" cy="50" r="24" fill="#c4e4ec" /></Layer>
    </div>
  );
}`;

const SLAB = 'M20 50Q20 44 26 41L46 31Q50 29 54 31L74 41Q80 44 80 50Q80 56 74 59L54 69Q50 71 46 69L26 59Q20 56 20 50Z';

/** One shape of an icon, as its own piece of glass. */
function Layer({ children }: { children: ReactNode }) {
  return (
    <GlassGlyph depth={2.6} style={{ position: 'absolute', inset: 0 }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        {children}
      </svg>
    </GlassGlyph>
  );
}

function AppIcon({ label, tile, children }: { label: string; tile: string; children: ReactNode }) {
  return (
    <div className="app-icon">
      <div className="app-icon__tile" role="img" aria-label={label} style={{ background: tile }}>
        {children}
      </div>
      <span className="app-icon__label">{label}</span>
    </div>
  );
}

function Icons() {
  return (
    <div className="app-icons">
      <AppIcon label="Plates" tile="#0f1a24">
        <Layer><path d={SLAB} transform="translate(0 14)" fill="#3f8ea3" /></Layer>
        <Layer><path d={SLAB} fill="#ff643a" /></Layer>
        <Layer><path d={SLAB} transform="translate(0 -14)" fill="#c4e4ec" /></Layer>
      </AppIcon>
      <AppIcon label="Lens" tile="#ff4a1c">
        <Layer><circle cx="38" cy="50" r="24" fill="#f6f8f9" /></Layer>
        <Layer><circle cx="62" cy="50" r="24" fill="#c4e4ec" /></Layer>
      </AppIcon>
      <AppIcon label="Prism" tile="#07101a">
        <Layer><path d="M4 53 36 47 38 52 5 58Z" fill="#f6f8f9" /></Layer>
        <Layer>
          <path d="M62 50 97 36 97 43Z" fill="#ff4a1c" />
          <path d="M62 51 97 45 97 53Z" fill="#f5c542" />
          <path d="M62 52 97 55 97 63Z" fill="#4f8df0" />
        </Layer>
        <Layer><path d="M50 20Q52 20 53 22L79 70Q80 73 77 73H23Q20 73 21 70L47 22Q48 20 50 20Z" fill="#c4e4ec" /></Layer>
      </AppIcon>
      <AppIcon label="Eye" tile="#c4e4ec">
        <Layer><path d="M12 50Q50 16 88 50Q50 84 12 50Z" fill="#f6f8f9" /></Layer>
        <Layer><circle cx="50" cy="50" r="18" fill="#3f8ea3" /></Layer>
        <Layer><circle cx="50" cy="50" r="7" fill="#0f1a24" /></Layer>
      </AppIcon>
    </div>
  );
}

const PAGES = ['Plates', 'Figures', 'Notes'];

function LibraryNav() {
  const [page, setPage] = useState('Plates');
  const [current, setCurrent] = useState<HTMLElement | null>(null);
  return (
    <Glass as="nav" aria-label="Library" radius="capsule" className="ui-nav">
      <strong className="ui-nav__brand">Opticks</strong>
      <div className="ui-nav__links">
        <GlassIndicator target={current} tint="var(--glass-spot)" />
        {PAGES.map((name) => (
          <button key={name} type="button" ref={name === page ? setCurrent : undefined} aria-current={name === page ? 'page' : undefined} onClick={() => setPage(name)}>
            {name}
          </button>
        ))}
      </div>
      <GlassButton className="ui-button">Subscribe</GlassButton>
    </Glass>
  );
}

function PrintRequest() {
  const [sent, setSent] = useState(false);
  return (
    <form
      className="ui-form"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <GlassPanel radius={28} role="region" aria-labelledby="print-title" className="ui-form__panel">
        <h3 id="print-title">Order a print</h3>
        <GlassTextField label="Email" name="email" type="email" required />
        <GlassSelect label="Plate" name="plate" defaultValue="2">
          <option value="2">Book I, Plate II</option>
          <option value="4">Book I, Plate IV</option>
        </GlassSelect>
        <GlassCheckbox label="Framed" name="framed" />
        <GlassButton type="submit" className="ui-button">
          Order print
        </GlassButton>
        <p role="status" className="ui-form__status">
          {sent ? 'Ordered. A proof is on its way.' : ''}
        </p>
      </GlassPanel>
    </form>
  );
}

function Exhibit({ id, fig, title, code, children }: { id: string; fig: string; title: string; code: string; children: ReactNode }) {
  return (
    <figure className={`exhibit exhibit--${id}`} aria-labelledby={`${id}-cap`}>
      <div className="exhibit__stage">{children}</div>
      <figcaption id={`${id}-cap`} className="caption">
        <b>{fig}</b> {title}
      </figcaption>
      <details className="specimen__code">
        <summary>
          <Icon name="forward" className="specimen__chevron" />
          View code
        </summary>
        <CodeBlock code={code} label={`Code for ${title}`} />
      </details>
    </figure>
  );
}

export function PlateInterfaces() {
  const theme = useTheme();
  const [glass, setGlass] = useState(true);
  return (
    <Plate folio="Plate VI" id="interfaces" className="interfaces" label="Interfaces">
      <div className="interfaces__text">
        <h2>Interfaces</h2>
        <p>
          Compose the same surface into navigation, a form, and glass glyphs. Switch these examples between glass and flat UI to see what the material adds.
        </p>
      </div>
      <div className="interfaces__switch">
        <Switch checked={glass} onChange={setGlass} label="Glass in these examples">
          <span className="interfaces__switch-label">
            Glass <b>{glass ? 'on' : 'off'}</b>
          </span>
        </Switch>
      </div>
      {/* Off, meniscus steps aside (mode "none") and plain surfaces take over. */}
      <GlassProvider mode={glass ? undefined : 'none'}>
        <div className="interfaces__sheet" data-glass={glass ? 'on' : 'off'} style={{ ['--sheet' as string]: `url(${plateSrc('opticks-plate-4', theme)})` }}>
          <Exhibit id="nav" fig="Fig. 6a." title="A navigation bar: a selection that flows, and a call to action." code={NAV_CODE}>
            <LibraryNav />
          </Exhibit>
          <Exhibit id="form" fig="Fig. 6b." title="A form: fields, a choice and a submit button on a glass panel." code={FORM_CODE}>
            <PrintRequest />
          </Exhibit>
          <Exhibit id="icons" fig="Fig. 6c." title="Icons whose glyphs are glass: translucent layers with lit rims that tint each other where they overlap, as in Icon Composer." code={ICON_CODE}>
            <Icons />
          </Exhibit>
        </div>
      </GlassProvider>
      <a className="action action--quiet interfaces__more" href={sitePath('/components/#patterns')}>Compare more interface patterns</a>
    </Plate>
  );
}
