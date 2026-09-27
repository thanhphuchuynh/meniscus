import { useEffect, useId, useState, type CSSProperties, type ReactElement } from 'react';
import type { GlassPlacement } from '../core/place';
import type { SpringInput } from '../core/spring';
import { useAnchor } from './anchor';
import { firstFocusable } from './focus';
import { Glass, type GlassProps } from './Glass';
import { fallbackStyle, useOpenState, useOverlay, usePopoverSupport } from './overlay';
import { useTrigger } from './trigger';

export interface GlassPopoverProps extends Omit<GlassProps<'div'>, 'as' | 'appear' | 'optics' | 'interactive'> {
  /** Accessible name of the popover. */
  label: string;
  /** The element that opens and closes it, such as a `GlassButton`. It must pass its ref through. */
  trigger: ReactElement;
  /** The side of the trigger, and how it aligns. Default `'bottom'`. It flips where there's no room. */
  placement?: GlassPlacement;
  /** Gap from the trigger, px. Default 8. */
  offset?: number;
  /** Open, controlled. Pair it with `onOpenChange`. */
  open?: boolean;
  /** Open at first, uncontrolled. */
  defaultOpen?: boolean;
  /** Called with `true` or `false` from the trigger, and with `false` from Escape, an outside press or focus leaving. */
  onOpenChange?: (open: boolean) => void;
  /** The spring for its entrance and exit. Default `'snappy'`. */
  physics?: SpringInput;
}

// Taller than the viewport, it scrolls inside itself.
const SURFACE: CSSProperties = { border: 0, padding: '0.75rem 1rem', color: 'inherit', overflow: 'auto', boxSizing: 'border-box', maxWidth: 'min(22rem, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)' };
const SWELL: CSSProperties = { scale: 'calc(0.96 + 0.04 * var(--meniscus-presence, 1))' };

/**
 * Glass content anchored to a trigger: a non-modal dialog in the top layer.
 * Focus moves in when it opens and back to the trigger when it closes.
 * Escape, a press outside, or focus leaving closes it.
 */
export function GlassPopover({ label, trigger, placement = 'bottom', offset = 8, open: openProp, defaultOpen, onOpenChange, physics = 'snappy', radius = 20, style, children, ...glass }: GlassPopoverProps) {
  const id = `meniscus-popover-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const supported = usePopoverSupport();
  const overlay = useOverlay(surface, {
    open,
    onRequestClose: () => setOpen(false),
    kind: 'popover',
    physics,
    trigger: anchor,
    dismiss: { escape: true, outside: true, focusOut: true },
    inside: () => [anchor],
  });
  const position = useAnchor(anchor, surface, overlay.shown, { placement, offset });
  const triggerNode = useTrigger(trigger, { 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': id, onClick: () => setOpen(!open) }, setAnchor);

  useEffect(() => {
    if (!open || !overlay.shown || !surface || surface.contains(document.activeElement)) return;
    (firstFocusable(surface) ?? surface).focus({ preventScroll: true });
  }, [open, overlay.shown, surface]);

  return (
    <>
      {triggerNode}
      <Glass
        {...glass}
        ref={setSurface}
        id={id}
        role="dialog"
        aria-label={label}
        popover="manual"
        tabIndex={-1}
        radius={radius}
        optics={overlay.optics}
        style={{ ...SURFACE, ...position, ...(overlay.reducedMotion ? null : SWELL), ...fallbackStyle(supported, overlay.shown), ...style }}
      >
        {children}
      </Glass>
    </>
  );
}

GlassPopover.displayName = 'GlassPopover';
