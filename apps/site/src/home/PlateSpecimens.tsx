import { Glass, GlassIndicator } from 'meniscus';
import { useState } from 'react';
import { CodeBlock, Plate } from '../shared/chrome';
import { Icon, type IconName } from '../shared/Icon';
import { plateSrc, useTheme } from '../shared/theme';

const TRANSPORT = `<Glass radius="capsule" className="transport">
  <button aria-label="Previous"><Back /></button>
  <Glass as="button" radius="capsule" interactive aria-label="Play">
    <Play />
  </Glass>
  <button aria-label="Next"><Forward /></button>
</Glass>`;

const TABS = `const [selected, setSelected] = useState<HTMLElement | null>(null);

<Glass as="nav" radius="capsule" aria-label="Sections">
  <GlassIndicator target={selected} tint="rgb(255 74 28 / 0.12)" />
  {tabs.map((tab, i) => (
    <button
      key={tab.label}
      ref={i === current ? setSelected : undefined}
      aria-current={i === current ? 'page' : undefined}
      onClick={() => setCurrent(i)}
    >
      <Icon name={tab.icon} /> {tab.label}
    </button>
  ))}
</Glass>`;

const SEARCH = `<Glass as="label" radius="capsule" variant="regular" blur={10}>
  <SearchIcon />
  <input type="search" placeholder="Search the plates" />
</Glass>`;

const NOTICE = `<Glass as="aside" radius={28} role="status" appear>
  <h3>Plate IV is ready</h3>
  <p>Six figures, refracted in place.</p>
  <button>Open</button>
</Glass>`;

const tabs: Array<{ icon: IconName; label: string }> = [
  { icon: 'eye', label: 'Plates' },
  { icon: 'search', label: 'Search' },
  { icon: 'bookmark', label: 'Saved' },
  { icon: 'share', label: 'Share' },
];

function Specimen({ id, fig, title, code, children, className }: { id: string; fig: string; title: string; code: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className={`specimen ${className ?? ''}`} aria-labelledby={`${id}-cap`}>
      <div className="specimen__stage">{children}</div>
      <figcaption id={`${id}-cap`} className="caption">
        <b>{fig}</b> {title}
      </figcaption>
      <details className="specimen__code">
        <summary>
          <Icon name="forward" className="specimen__chevron" />
          Show the code
        </summary>
        <CodeBlock code={code} label={`Code for ${title}`} />
      </details>
    </figure>
  );
}

export function PlateSpecimens() {
  const theme = useTheme();
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState(0);
  const [tabEl, setTabEl] = useState<HTMLElement | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // The card materializes when it comes back, not on first load.
  const [revived, setRevived] = useState(false);
  const lantern = theme === 'lantern';
  const tint = lantern ? 'rgba(12, 24, 34, 0.3)' : 'rgba(255, 255, 255, 0.2)';

  return (
    <Plate folio="Plate IV" className="specimens" label="Specimens">
      <div className="specimens__text">
        <h2>Specimens</h2>
        <p>
          The component is the whole surface. Nest controls inside it, give it an element with <code>as</code>, and make it answer the pointer with{' '}
          <code>interactive</code>. Everything below is live, laid over the same engraving.
        </p>
      </div>

      <div className="specimens__sheet" style={{ ['--sheet' as string]: `url(${plateSrc('opticks-plate-4', theme)})` }}>
        <Specimen id="fig4a" fig="Fig. 4a." title="Transport controls: a capsule holding an interactive glass button." code={TRANSPORT} className="specimen--transport">
          <Glass radius="capsule" className="transport" tint={tint} blur={4}>
            <button type="button" className="transport__skip" aria-label="Previous plate">
              <Icon name="back" />
            </button>
            <Glass
              as="button"
              type="button"
              radius="capsule"
              interactive
              className="transport__play"
              aria-label={playing ? 'Pause' : 'Play'}
              aria-pressed={playing}
              onClick={() => setPlaying((p) => !p)}
              tint={lantern ? 'rgba(255, 100, 58, 0.24)' : 'rgba(255, 74, 28, 0.14)'}
              refraction={1.3}
            >
              <Icon name={playing ? 'pause' : 'play'} />
            </Glass>
            <button type="button" className="transport__skip" aria-label="Next plate">
              <Icon name="forward" />
            </button>
            <span className="transport__title">
              <b>Opticks</b> Book I, Plate IV
            </span>
          </Glass>
        </Specimen>

        <Specimen id="fig4b" fig="Fig. 4b." title="A tab bar. A drop of spot-tinted glass flows to the current tab." code={TABS} className="specimen--tabs">
          <Glass as="nav" radius="capsule" className="tabs" tint={tint} aria-label="Specimen tabs">
            <GlassIndicator target={tabEl} tint={lantern ? 'rgba(255, 100, 58, 0.2)' : 'rgba(255, 74, 28, 0.12)'} refraction={1.2} />
            {tabs.map((t, i) => (
              <button
                key={t.label}
                ref={i === tab ? setTabEl : undefined}
                type="button"
                className="tabs__tab"
                aria-current={i === tab ? 'page' : undefined}
                onClick={() => setTab(i)}
              >
                <Icon name={t.icon} />
                <span>{t.label}</span>
              </button>
            ))}
          </Glass>
        </Specimen>

        <Specimen id="fig4c" fig="Fig. 4c." title="A search field in regular glass, frosted for legibility." code={SEARCH} className="specimen--search">
          <Glass as="label" radius="capsule" variant="regular" blur={10} className="search" tint={tint}>
            <Icon name="search" />
            <span className="visually-hidden">Search the plates</span>
            <input type="search" placeholder="Search the plates" />
          </Glass>
        </Specimen>

        <Specimen id="fig4d" fig="Fig. 4d." title="A status card with a 28 px radius. Dismiss it and bring it back: it materializes." code={NOTICE} className="specimen--notice">
          {dismissed ? (
            <button
              type="button"
              className="action action--quiet"
              onClick={() => {
                setDismissed(false);
                setRevived(true);
              }}
            >
              <Icon name="reset" /> Bring the card back
            </button>
          ) : (
            <Glass as="aside" radius={28} className="notice" tint={tint} role="status" appear={revived}>
              <Icon name="bell" className="notice__icon" />
              <div>
                <h3>Plate IV is ready</h3>
                <p>Six figures, refracted in place.</p>
              </div>
              <button type="button" className="notice__action" onClick={() => setDismissed(true)}>
                Dismiss
              </button>
            </Glass>
          )}
        </Specimen>
      </div>
    </Plate>
  );
}
