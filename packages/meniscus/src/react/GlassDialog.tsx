import { useEffect, useState, type CSSProperties, type FormEvent, type ReactElement } from 'react';
import { presenceOpacity } from '../core/physics';
import type { SpringInput } from '../core/spring';
import { DEV } from './dev';
import { useDragDismiss } from './drag';
import { firstFocusable } from './focus';
import { Glass, type GlassProps } from './Glass';
import { useIsomorphicLayoutEffect } from './hooks';
import { useOpenState, useOverlay } from './overlay';
import { useTrigger } from './trigger';

/** Where a dialog's panel sits: `center` is a modal card, `bottom` a sheet, `left` and `right` drawers. */
export type GlassDialogPlacement = 'center' | 'bottom' | 'left' | 'right';

export interface GlassDialogProps extends Omit<GlassProps<'div'>, 'as' | 'appear' | 'optics' | 'interactive'> {
  /** Accessible name. Or pass `aria-labelledby` naming your own heading. */
  label?: string;
  /** `center` (the default): a modal card. `bottom`: a sheet. `left` or `right`: a drawer. */
  placement?: GlassDialogPlacement;
  /** An element that opens the dialog, such as a `GlassButton`. Focus returns to it on close. */
  trigger?: ReactElement;
  /** Open, controlled. Pair it with `onOpenChange`: a controlled dialog stays open until you close it. */
  open?: boolean;
  /** Open at first, uncontrolled. It opens after hydration. */
  defaultOpen?: boolean;
  /** Called with `true` from the trigger, and with `false` from Escape, the dimmed page, a drag away or a `<form method="dialog">`. */
  onOpenChange?: (open: boolean) => void;
  /** The spring for the entrance and exit. Default `'snappy'`. */
  physics?: SpringInput;
}

const BACKDROP = '[data-meniscus-dialog]::backdrop{background:transparent}';
const PRESENCE = 'var(--meniscus-presence, 1)';

const DIALOG: CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  maxWidth: 'none',
  maxHeight: 'none',
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  overflow: 'hidden',
  outline: 'none',
};
const FILL: CSSProperties = { position: 'absolute', inset: 0 };
const SCRIM: CSSProperties = {
  ...FILL,
  background: 'var(--meniscus-scrim, light-dark(rgb(8 10 14 / 0.16), rgb(0 0 0 / 0.42)))',
  opacity: 'var(--meniscus-scrim-opacity, 0)' as unknown as number,
};

const LAYOUT: Readonly<Record<GlassDialogPlacement, CSSProperties>> = {
  center: { display: 'grid', placeItems: 'center', padding: '1rem' },
  bottom: { display: 'grid', alignItems: 'end', justifyItems: 'center', padding: 8 },
  left: { display: 'grid', justifyItems: 'start', alignItems: 'stretch', padding: 8 },
  right: { display: 'grid', justifyItems: 'end', alignItems: 'stretch', padding: 8 },
};

const SIDE: CSSProperties = { width: 'min(22rem, 100% - 3rem)', height: '100%', overflow: 'auto', padding: '1.5rem', boxSizing: 'border-box', touchAction: 'pan-y' };
const PANEL: Readonly<Record<GlassDialogPlacement, CSSProperties>> = {
  center: { width: 'min(32rem, 100%)', maxHeight: '100%', overflow: 'auto', padding: '1.5rem', boxSizing: 'border-box' },
  bottom: { width: 'min(40rem, 100%)', maxHeight: 'calc(100% - 3rem)', overflow: 'auto', padding: '2rem 1.5rem 1.5rem', boxSizing: 'border-box' },
  left: SIDE,
  right: SIDE,
};

/** The card swells in; sheets and drawers slide in from their edge, plus any drag. */
const MOTION: Readonly<Record<GlassDialogPlacement, CSSProperties>> = {
  center: { scale: `calc(0.94 + 0.06 * ${PRESENCE})` },
  bottom: { translate: `0 calc((1 - ${PRESENCE}) * (100% + 8px) + var(--meniscus-drag, 0px))` },
  left: { translate: `calc((${PRESENCE} - 1) * (100% + 8px) + var(--meniscus-drag, 0px)) 0` },
  right: { translate: `calc((1 - ${PRESENCE}) * (100% + 8px) + var(--meniscus-drag, 0px)) 0` },
};

/** Which way each draggable placement leaves. */
const EDGE = { bottom: { axis: 'y', direction: 1 }, left: { axis: 'x', direction: -1 }, right: { axis: 'x', direction: 1 } } as const;

const GRABBER: CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, height: 28, display: 'grid', placeItems: 'center', touchAction: 'none', cursor: 'grab' };
const BAR: CSSProperties = { width: 36, height: 5, borderRadius: 3, background: 'currentColor', opacity: 0.35 };

let warnedUnnamed = false;

/**
 * A modal dialog of glass: a centered card, a sheet or a drawer. It renders
 * where you put it and opens in the browser's top layer, which keeps focus
 * inside and the page behind inert. Escape, a click on the dimmed page, and
 * dragging a sheet or drawer away all ask it to close. A
 * `<form method="dialog">` inside closes it, leaving the submitter's value
 * as the dialog's `returnValue`.
 */
export function GlassDialog({
  label,
  placement = 'center',
  trigger,
  open: openProp,
  defaultOpen,
  onOpenChange,
  physics = 'snappy',
  'aria-labelledby': labelledBy,
  style,
  children,
  ...glass
}: GlassDialogProps) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const overlay = useOverlay(dialog, { open, onRequestClose: () => setOpen(false), kind: 'modal', physics, trigger: anchor });
  const triggerNode = useTrigger(trigger, { 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: () => setOpen(true) }, setAnchor);

  // The scrim fades with the glass.
  useIsomorphicLayoutEffect(() => {
    if (!dialog) return;
    return overlay.optics.subscribe((s) => dialog.style.setProperty('--meniscus-scrim-opacity', String(presenceOpacity(Math.max(0, s.presence)))));
  }, [dialog, overlay.optics]);

  // Focus moves in: an autofocus or first focusable child, else the panel itself.
  useIsomorphicLayoutEffect(() => {
    if (!open || !overlay.shown || !panel || panel.contains(document.activeElement)) return;
    const target = firstFocusable(panel);
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
  }, [open, overlay.shown, panel]);

  const edge = placement === 'center' ? null : EDGE[placement];
  const drag = useDragDismiss(panel, {
    axis: edge?.axis ?? 'y',
    direction: edge?.direction ?? 1,
    fraction: 0.35,
    enabled: !!edge && open && overlay.shown,
    reducedMotion: overlay.reducedMotion,
    onDismiss: () => setOpen(false),
  });
  // Each opening starts undragged.
  useIsomorphicLayoutEffect(() => {
    if (!overlay.shown) panel?.style.removeProperty('--meniscus-drag');
  }, [overlay.shown, panel]);

  useEffect(() => {
    if (!DEV || warnedUnnamed || label || labelledBy) return;
    warnedUnnamed = true;
    console.warn('meniscus: a GlassDialog needs an accessible name. Pass `label`, or `aria-labelledby` naming its heading.');
  }, [label, labelledBy]);

  const onSubmit = (e: FormEvent<HTMLDialogElement>) => {
    const form = e.target as HTMLFormElement;
    if (!dialog || form.getAttribute('method')?.toLowerCase() !== 'dialog') return;
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null;
    dialog.returnValue = submitter?.value ?? '';
    setOpen(false);
  };

  const side = placement === 'left' || placement === 'right' ? drag : null;
  return (
    <>
      {triggerNode}
      <dialog ref={setDialog} data-meniscus-dialog="" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} onSubmit={onSubmit} style={DIALOG}>
        <style>{BACKDROP}</style>
        <div style={{ ...FILL, ...LAYOUT[placement] }}>
          <div aria-hidden="true" data-meniscus-scrim="" style={SCRIM} onClick={() => setOpen(false)} />
          <Glass {...glass} {...side} ref={setPanel} optics={overlay.optics} style={{ ...PANEL[placement], ...(overlay.reducedMotion ? null : MOTION[placement]), ...style }}>
            {placement === 'bottom' ? (
              <span aria-hidden="true" data-meniscus-grabber="" style={GRABBER} {...drag}>
                <span style={BAR} />
              </span>
            ) : null}
            {children}
          </Glass>
        </div>
      </dialog>
    </>
  );
}

GlassDialog.displayName = 'GlassDialog';
