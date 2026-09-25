import { Glass, GlassIndicator, useGlassMode } from 'meniscus';
import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { CodeBlock, Plate } from '../shared/chrome';
import { GlassIcon } from '../shared/GlassIcon';
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
  <GlassIndicator target={selected} tint="var(--glass-spot)" />
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

/**
 * Tabs whose glass selection can be carried: press anywhere on the bar and
 * slide, and the drop lifts and follows the pointer, stretching as it goes;
 * let go and it settles on the tab underneath. A plain click still selects.
 */
function SlideTabs({ tint, lensTint }: { tint: string; lensTint: string }) {
  const nav = useRef<HTMLElement>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const press = useRef<{ id: number; x0: number; moved: boolean } | null>(null);
  const [tab, setTab] = useState(0);
  const [tabEl, setTabEl] = useState<HTMLElement | null>(null);
  const [drag, setDrag] = useState<{ x: number; over: number } | null>(null);
  useLayoutEffect(() => setTabEl(buttons.current[tab] ?? null), [tab]);

  // The tab whose box holds x (nav px), or the nearest one.
  const tabAt = (x: number) => {
    let best = 0;
    let dist = Infinity;
    buttons.current.forEach((b, i) => {
      if (!b) return;
      const d = x < b.offsetLeft ? b.offsetLeft - x : x > b.offsetLeft + b.offsetWidth ? x - b.offsetLeft - b.offsetWidth : 0;
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button === 0) press.current = { id: e.pointerId, x0: e.clientX, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const p = press.current;
    const n = nav.current;
    if (!p || p.id !== e.pointerId || !n) return;
    if (!p.moved) {
      if (Math.abs(e.clientX - p.x0) < 4) return;
      // From here it's a drag: the bar keeps the pointer, so no tab gets a click.
      p.moved = true;
      n.setPointerCapture(e.pointerId);
    }
    const x = e.clientX - n.getBoundingClientRect().left - n.clientLeft;
    setDrag({ x, over: tabAt(x) });
  };
  const onPointerEnd = (e: PointerEvent<HTMLElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (p.moved && drag && e.type === 'pointerup') setTab(drag.over);
    setDrag(null);
  };

  // While dragging, the drop is a box centred on the pointer, as wide as the
  // tab beneath it and kept within the bar.
  let target: HTMLElement | { x: number; y: number; width: number; height: number } | null = tabEl;
  const under = drag ? buttons.current[drag.over] : null;
  const first = buttons.current[0];
  const last = buttons.current[tabs.length - 1];
  if (drag && under && first && last) {
    const w = under.offsetWidth;
    const x = Math.min(Math.max(drag.x - w / 2, first.offsetLeft), last.offsetLeft + last.offsetWidth - w);
    target = { x, y: under.offsetTop, width: w, height: under.offsetHeight };
  }
  const shown = drag ? drag.over : tab;

  return (
    <Glass
      as="nav"
      ref={nav}
      radius="capsule"
      className="tabs"
      tint={tint}
      aria-label="Specimen tabs"
      data-dragging={drag ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <GlassIndicator target={target} className="tabs__lens" tint={lensTint} refraction={1.2} />
      {tabs.map((t, i) => (
        <button
          key={t.label}
          ref={(el) => {
            buttons.current[i] = el;
          }}
          type="button"
          className="tabs__tab"
          aria-current={i === tab ? 'page' : undefined}
          data-shown={i === shown ? '' : undefined}
          onClick={() => setTab(i)}
        >
          <GlassIcon name={t.icon} />
          <span>{t.label}</span>
        </button>
      ))}
    </Glass>
  );
}

export function PlateSpecimens() {
  const theme = useTheme();
  const [playing, setPlaying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // The card materializes when it comes back, not on first load.
  const [revived, setRevived] = useState(false);
  const tint = 'var(--glass-wash)';
  // The card says what the visitor's browser actually draws.
  const refracts = useGlassMode() === 'refract';

  return (
    <Plate folio="Plate IV" id="specimens" className="specimens" label="Specimens">
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
              <GlassIcon name="back" />
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
              tint="var(--glass-spot-strong)"
              refraction={1.3}
            >
              <GlassIcon name={playing ? 'pause' : 'play'} />
            </Glass>
            <button type="button" className="transport__skip" aria-label="Next plate">
              <GlassIcon name="forward" />
            </button>
            <span className="transport__title">
              <b>Opticks</b> Book I, Plate IV
            </span>
          </Glass>
        </Specimen>

        <Specimen
          id="fig4b"
          fig="Fig. 4b."
          title="A tab bar. A drop of spot-tinted glass flows to the current tab; press and slide along the bar to carry it."
          code={TABS}
          className="specimen--tabs"
        >
          <SlideTabs tint={tint} lensTint="var(--glass-spot)" />
        </Specimen>

        <Specimen id="fig4c" fig="Fig. 4c." title="A search field in regular glass, frosted for legibility." code={SEARCH} className="specimen--search">
          <Glass as="label" radius="capsule" variant="regular" blur={10} className="search" tint={tint}>
            <GlassIcon name="search" />
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
              <GlassIcon name="bell" className="notice__icon" />
              <div>
                <h3>Plate IV is ready</h3>
                <p>{refracts ? 'Six figures, refracted in place.' : 'Six figures under frosted glass.'}</p>
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
