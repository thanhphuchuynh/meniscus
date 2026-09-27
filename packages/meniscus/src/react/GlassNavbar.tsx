import { forwardRef, useEffect, useState, type CSSProperties } from 'react';
import { useGlassDefaults } from './context';
import { Glass, type GlassProps } from './Glass';
import { useMergedRef } from './refs';
import { useGlassPhysics } from './useGlassPhysics';

export interface GlassNavbarProps extends Omit<GlassProps<'nav'>, 'as' | 'optics'> {
  /** Accessible name of the navigation landmark, such as "Main". */
  label: string;
  /** Gap from the top of its scroll container while stuck, and from each side, px. Default 12. */
  inset?: number;
  /** Clear at the top of the page, with deeper tint and shadow once content scrolls under it. Default true. */
  scrollEdge?: boolean;
}

const AT_TOP = { tint: 0.35, shadow: 0.4 };
const UNDER = { tint: 1, shadow: 1 };
/** Scrolled further than this, px, content is under the bar. */
const EDGE = 4;

function bar(inset: number): CSSProperties {
  return {
    position: 'sticky',
    top: inset,
    marginInline: inset,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem 0.75rem 0.5rem 1.25rem',
    boxSizing: 'border-box',
  };
}

/** The nearest ancestor that scrolls, or null for the page itself. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * A sticky navigation bar of glass. It stays clear over the top of the page,
 * then its tint and shadow deepen on their springs once content scrolls
 * under it, with no re-render and no rebuilt maps. By default it follows
 * what's behind it (`appearance="adaptive"`) unless a provider or prop says
 * otherwise.
 */
export const GlassNavbar = forwardRef<HTMLElement, GlassNavbarProps>(function GlassNavbar(
  { label, inset = 12, scrollEdge = true, radius = 'capsule', appearance, style, ...props },
  ref,
) {
  const defaults = useGlassDefaults();
  const optics = useGlassPhysics({ initial: scrollEdge ? AT_TOP : undefined });
  const [node, setNode] = useState<HTMLElement | null>(null);
  const setRef = useMergedRef(ref, setNode);

  useEffect(() => {
    if (!scrollEdge || !node) return;
    const scroller = scrollParent(node);
    const read = () => (scroller ? scroller.scrollTop : window.scrollY);
    let under = read() > EDGE;
    optics.to(under ? UNDER : AT_TOP);
    const onScroll = () => {
      const next = read() > EDGE;
      if (next === under) return;
      under = next;
      optics.to(next ? UNDER : AT_TOP);
    };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [node, scrollEdge, optics]);

  return (
    <Glass
      {...props}
      as="nav"
      ref={setRef}
      aria-label={label}
      radius={radius}
      appearance={appearance ?? defaults.appearance ?? 'adaptive'}
      optics={scrollEdge ? optics : undefined}
      style={{ ...bar(inset), ...style }}
    />
  );
});

GlassNavbar.displayName = 'GlassNavbar';
