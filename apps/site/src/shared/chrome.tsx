import { Glass, GlassIndicator } from 'meniscus';
import { useEffect, useState, type FocusEvent, type ReactNode } from 'react';
import { highlight } from 'sugar-high';
import { Icon, MeniscusMark } from './Icon';
import { setTheme, useTheme } from './theme';

export type Page = 'home' | 'components' | 'playground' | 'docs';

const HREF: Record<Page, string> = { home: '/', components: '/components/', playground: '/playground/', docs: '/docs/' };

/** The page body behind the masthead. Firefox refracts a live copy of it; Chromium ignores it and refracts the page itself. */
const PAGE_BODY = {
  get current() {
    return typeof document === 'undefined' ? null : document.getElementById('main');
  },
};

export function Install({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText('npm i meniscus');
      setCopied(true);
    } catch {
      /* clipboard blocked: the command stays selectable */
    }
  };
  return (
    <span className="install">
      <span className="prompt" aria-hidden="true">
        $
      </span>
      <span>npm i meniscus</span>
      <button type="button" onClick={copy} data-copied={copied} aria-label={copied ? 'Copied' : 'Copy install command'}>
        <Icon name={copied ? 'check' : 'copy'} />
        {compact ? null : copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

export function Masthead({ page }: { page: Page }) {
  const theme = useTheme();
  const toggle = () => setTheme(theme === 'print' ? 'lantern' : 'print');
  // A lens flows to whichever link the pointer or focus is on, and fades in
  // place when both leave.
  const [lens, setLens] = useState<HTMLElement | null>(null);
  const [lensOn, setLensOn] = useState(false);
  const point = (e: { currentTarget: HTMLElement }) => {
    setLens(e.currentTarget);
    setLensOn(true);
  };
  const leave = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setLensOn(false);
  };
  return (
    <header className="masthead">
      <Glass
        className="masthead__bar"
        radius="capsule"
        variant="regular"
        blur={8}
        refraction={0.9}
        tint="var(--glass-bar)"
        backdrop={PAGE_BODY}
      >
        <a className="wordmark" href={HREF.home} aria-label="meniscus home">
          <MeniscusMark />
          meniscus
        </a>
        <nav aria-label="Site" onPointerLeave={() => setLensOn(false)} onBlur={leave}>
          <GlassIndicator
            target={lens}
            className="masthead__lens"
            data-on={lensOn}
            tint="var(--glass-lens)"
            refraction={1.1}
            shadow="var(--shadow-lens)"
          />
          <a href={HREF.playground} aria-current={page === 'playground' ? 'page' : undefined} onPointerEnter={point} onFocus={point}>
            Playground
          </a>
          <a href={HREF.components} aria-current={page === 'components' ? 'page' : undefined} onPointerEnter={point} onFocus={point}>
            Components
          </a>
          <a href={HREF.docs} aria-current={page === 'docs' ? 'page' : undefined} onPointerEnter={point} onFocus={point}>
            Manual
          </a>
          <Install compact />
          <button type="button" className="icon-button" onClick={toggle} aria-label={theme === 'print' ? 'Switch to lantern slide (dark)' : 'Switch to print (light)'}>
            <Icon name={theme === 'print' ? 'lantern' : 'print'} />
          </button>
        </nav>
      </Glass>
    </header>
  );
}

export function Plate({ folio, id, className, children, label }: { folio?: string; id?: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <section className={`plate ${className ?? ''}`} id={id} aria-label={label}>
      {folio ? (
        <span className="plate__folio" aria-hidden="true">
          {folio}
        </span>
      ) : null}
      <svg className="plate__mark plate__mark--tl" viewBox="0 0 13 13" aria-hidden="true">
        <path d="M6.5 0v13M0 6.5h13" stroke="currentColor" strokeWidth="1" />
      </svg>
      <svg className="plate__mark plate__mark--br" viewBox="0 0 13 13" aria-hidden="true">
        <path d="M6.5 0v13M0 6.5h13" stroke="currentColor" strokeWidth="1" />
      </svg>
      {children}
    </section>
  );
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <figure className="code" aria-label={label}>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
      <span className="copy">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              /* clipboard blocked */
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </span>
    </figure>
  );
}

export function Colophon() {
  return (
    <footer className="colophon">
      <p>
        Set in Archivo and STIX Two Text. Every figure on these pages is computed live by the library it describes. Engravings from Isaac Newton,{' '}
        <i>Opticks</i> (London, 1704), Book I, Plates II and IV: public domain, scanned by the{' '}
        <a href="https://archive.org/details/optickstreatise00newta">Internet Archive</a>, duotoned for this site.
      </p>
      <nav aria-label="Footer">
        <a href={HREF.home}>Plates</a>
        <a href={HREF.components}>Components</a>
        <a href={HREF.playground}>Playground</a>
        <a href={HREF.docs}>Manual</a>
        <a href="/LICENSE.txt">License</a>
        <a href="/THIRD_PARTY_NOTICES.txt">Third-party notices</a>
        <a href="/PRIVACY.txt">Privacy</a>
      </nav>
    </footer>
  );
}
