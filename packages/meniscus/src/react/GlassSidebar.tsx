import { createElement, useId, type CSSProperties } from 'react';
import { Glass, type GlassProps } from './Glass';
import { GlassDialog } from './GlassDialog';
import { useMediaQuery } from './hooks';

export interface GlassSidebarProps extends Omit<GlassProps<'aside'>, 'as'> {
  /** Accessible name of the landmark, and of the drawer it becomes. */
  label: string;
  /** `aside` (the default), or `nav` for a sidebar of links. */
  as?: 'aside' | 'nav';
  /** Below this viewport width, px, it becomes a drawer. Default 768. 0 never collapses. */
  collapseBelow?: number;
  /** The side the drawer opens from. Default `'left'`. */
  side?: 'left' | 'right';
  /** Gap from the viewport's edges, px. Default 12. */
  inset?: number;
  /** The drawer's open state, controlled. Ignored while it is a column. */
  open?: boolean;
  /** The drawer starts open, uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the drawer's requested state. */
  onOpenChange?: (open: boolean) => void;
}

function column(inset: number): CSSProperties {
  return { position: 'sticky', top: inset, height: `calc(100dvh - ${2 * inset}px)`, width: '16rem', flex: 'none', overflow: 'auto', padding: '1rem', boxSizing: 'border-box' };
}

/**
 * A sidebar of glass. On wide screens it is a sticky column. Below
 * `collapseBelow` it is a `GlassDialog` drawer, opened through `open`, with
 * the same children inside the same landmark. The server and hydration
 * render the column, and a media query hides it on narrow screens before
 * any JavaScript runs, so phones never see it flash. The children remount
 * when the layout switches.
 */
export function GlassSidebar({ label, as = 'aside', collapseBelow = 768, side = 'left', inset = 12, open, defaultOpen, onOpenChange, style, className, children, ...glass }: GlassSidebarProps) {
  const key = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const query = collapseBelow > 0 ? `(max-width: ${collapseBelow - 0.02}px)` : 'not all';
  const narrow = useMediaQuery(query);

  if (narrow) {
    return (
      <GlassDialog {...glass} label={label} placement={side} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} className={className} style={style}>
        {createElement(as, { 'aria-label': label }, children)}
      </GlassDialog>
    );
  }
  return (
    <>
      {collapseBelow > 0 ? <style>{`@media ${query}{[data-meniscus-sidebar="${key}"]{display:none!important}}`}</style> : null}
      <Glass {...glass} as={as as 'aside'} aria-label={label} data-meniscus-sidebar={key} className={className} style={{ ...column(inset), ...style }}>
        {children}
      </Glass>
    </>
  );
}

GlassSidebar.displayName = 'GlassSidebar';
