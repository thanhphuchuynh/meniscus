import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react';
import type { GlassPlacement } from '../core/place';
import { useAnchor } from './anchor';
import { focusVisible } from './focus';
import { Glass, type GlassProps } from './Glass';
import { fallbackStyle, useOverlay, usePopoverSupport } from './overlay';
import { useTrigger } from './trigger';

export interface GlassTooltipProps extends Omit<GlassProps<'div'>, 'as' | 'children' | 'content' | 'appear' | 'optics' | 'interactive'> {
  /** The hint. Keep it short, and don't make anything depend on it: touch screens never show it. */
  content: ReactNode;
  /** The element it describes. It must pass its ref through. */
  children: ReactElement;
  /** Default `'top'`. It flips where there's no room. */
  placement?: GlassPlacement;
  /** Gap from the element, px. Default 6. */
  offset?: number;
  /** Hover time before it shows, ms. Default 500. Keyboard focus shows it at once. */
  delay?: number;
}

/** Moving to another tooltip within this many ms shows it at once. */
const WARM = 300;
/** Time for the pointer to cross from the element to the tooltip, ms. */
const GRACE = 100;
let lastHidden = -Infinity;

const SURFACE: CSSProperties = {
  border: 0,
  padding: '0.35rem 0.65rem',
  fontSize: '0.85em',
  lineHeight: 1.35,
  color: 'inherit',
  boxSizing: 'border-box',
  maxWidth: 'min(18rem, calc(100vw - 16px))',
  overflow: 'visible',
};

/**
 * A short hint in glass for the element it wraps. It shows after a hover
 * delay, or at once on keyboard focus. The pointer can move onto it, and
 * Escape closes it. It never shows on touch.
 */
export function GlassTooltip({ content, children, placement = 'top', offset = 6, delay = 500, radius = 10, style, ...glass }: GlassTooltipProps) {
  const id = `meniscus-tooltip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const supported = usePopoverSupport();
  const timer = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  const clear = () => window.clearTimeout(timer.current);
  const hideNow = () => {
    clear();
    if (openRef.current) lastHidden = performance.now();
    setOpen(false);
  };
  const showAfter = (wait: number) => {
    clear();
    if (wait <= 0) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), wait);
  };
  const hideSoon = () => {
    clear();
    timer.current = window.setTimeout(hideNow, GRACE);
  };
  useEffect(() => clear, []);

  const overlay = useOverlay(surface, { open, onRequestClose: hideNow, kind: 'popover', physics: 'stiff', dismiss: { escape: true }, returnFocus: false });
  const position = useAnchor(anchor, surface, overlay.shown, { placement, offset });
  const triggerNode = useTrigger(
    children,
    {
      'aria-describedby': id,
      onPointerEnter: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'touch') return;
        showAfter(performance.now() - lastHidden < WARM ? 0 : delay);
      },
      onPointerLeave: hideSoon,
      onPointerDown: hideNow,
      onFocus: (e: FocusEvent<HTMLElement>) => {
        if (focusVisible(e.currentTarget)) showAfter(0);
      },
      onBlur: hideNow,
    },
    setAnchor,
  );

  return (
    <>
      {triggerNode}
      <Glass
        {...glass}
        ref={setSurface}
        id={id}
        role="tooltip"
        popover="manual"
        radius={radius}
        optics={overlay.optics}
        onPointerEnter={clear}
        onPointerLeave={hideSoon}
        style={{ ...SURFACE, ...position, ...fallbackStyle(supported, overlay.shown), ...style }}
      >
        {content}
      </Glass>
    </>
  );
}

GlassTooltip.displayName = 'GlassTooltip';
