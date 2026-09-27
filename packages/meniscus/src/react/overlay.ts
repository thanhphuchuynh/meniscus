import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { presenceOpacity, type GlassPhysics, type OpticalState } from '../core/physics';
import type { SpringInput } from '../core/spring';
import { supportsPopover } from '../core/support';
import { useGlassPreferences, useIsomorphicLayoutEffect } from './hooks';
import { useGlassPhysics } from './useGlassPhysics';

/** A short, critically damped spring. Under reduced motion, overlays and toasts fade on it without moving. */
export const FADE: SpringInput = { mass: 1, stiffness: 900, damping: 60 };

/** Controlled or uncontrolled open state, from `open`, `defaultOpen` and `onOpenChange`. */
export function useOpenState(
  open: boolean | undefined,
  defaultOpen: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
): [boolean, (next: boolean) => void] {
  const [own, setOwn] = useState(!!defaultOpen);
  const controlled = open !== undefined;
  const change = useRef(onOpenChange);
  change.current = onOpenChange;
  const set = useCallback(
    (next: boolean) => {
      if (!controlled) setOwn(next);
      change.current?.(next);
    },
    [controlled],
  );
  return [controlled ? !!open : own, set];
}

const noSubscribe = () => () => {};

/** Popover API support, for rendering. The server and hydration assume it, so markup matches; older browsers learn otherwise after. */
export function usePopoverSupport(): boolean {
  return useSyncExternalStore(noSubscribe, supportsPopover, () => true);
}

/** Without the Popover API an overlay stays where it is in the page: hidden until shown, then fixed above everything. */
export function fallbackStyle(supported: boolean, shown: boolean): CSSProperties | null {
  if (supported) return null;
  return shown ? { zIndex: 2147483000 } : { display: 'none' };
}

export type OverlayKind = 'modal' | 'popover';

const shownPopovers = new WeakSet<HTMLElement>();

function isShown(el: HTMLElement, kind: OverlayKind): boolean {
  return kind === 'modal' ? (el as HTMLDialogElement).open : shownPopovers.has(el);
}

function show(el: HTMLElement, kind: OverlayKind): void {
  if (kind === 'modal') {
    (el as HTMLDialogElement).showModal();
    return;
  }
  shownPopovers.add(el);
  if (supportsPopover()) el.showPopover();
}

function hide(el: HTMLElement, kind: OverlayKind): void {
  if (kind === 'modal') {
    (el as HTMLDialogElement).close();
    return;
  }
  shownPopovers.delete(el);
  if (!supportsPopover()) return;
  try {
    el.hidePopover();
  } catch {
    // Already hidden, or no longer in the document.
  }
}

let locks = 0;
let saved: { overflow: string; gutter: string } | null = null;

/** Stops the page scrolling behind a modal. Counted, so nested modals unlock once. */
function lockScroll(): () => void {
  const root = document.documentElement;
  if (locks++ === 0) {
    saved = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter };
    // Keep the scrollbar's room, so the page doesn't shift sideways.
    if (root.scrollHeight > root.clientHeight) root.style.scrollbarGutter = 'stable';
    root.style.overflow = 'hidden';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0 && saved) {
      root.style.overflow = saved.overflow;
      root.style.scrollbarGutter = saved.gutter;
      saved = null;
    }
  };
}

// Escape goes to the innermost open popover: the one opened last.
const escapeStack: Array<() => void> = [];

function onEscape(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return;
  // Canceling the keydown also keeps an enclosing dialog from closing.
  e.preventDefault();
  e.stopPropagation();
  top();
}

function pushEscape(handler: () => void): () => void {
  if (escapeStack.length === 0) document.addEventListener('keydown', onEscape, true);
  escapeStack.push(handler);
  return () => {
    const i = escapeStack.lastIndexOf(handler);
    if (i >= 0) escapeStack.splice(i, 1);
    if (escapeStack.length === 0) document.removeEventListener('keydown', onEscape, true);
  };
}

export interface OverlayOptions {
  /** Whether the overlay should be open. */
  open: boolean;
  /** Asks to close, after Escape, an outside press or focus leaving. The owner decides. */
  onRequestClose: () => void;
  /** `modal` opens a `<dialog>` with `showModal()`; `popover` shows a `popover="manual"` element. */
  kind: OverlayKind;
  /** The spring for the entrance and exit. Default `'snappy'`. */
  physics?: SpringInput;
  /** What else closes it. A modal's Escape arrives as the dialog's `cancel` event and is always handled. */
  dismiss?: { escape?: boolean; outside?: boolean; focusOut?: boolean };
  /** Where focus returns on close, when it was inside. Defaults to whatever had focus when it opened. */
  trigger?: HTMLElement | null;
  /** Elements that count as inside for outside presses and focus, besides the overlay itself. */
  inside?: () => ReadonlyArray<HTMLElement | null>;
  /** Give focus back when it closes. Off for tooltips, which never take focus. Default true. */
  returnFocus?: boolean;
}

export interface Overlay {
  /** Springs for the overlay's glass, as its `optics`. */
  optics: GlassPhysics;
  /** Whether the element is showing: from show until the exit has faded out. */
  shown: boolean;
  /** Reduced motion is on: fade, don't slide or swell. */
  reducedMotion: boolean;
}

/**
 * Presence and dismissal for a top-layer overlay. Opening shows the element,
 * then springs presence and lift from 0 to 1. Closing springs them back, then
 * hides the element as soon as the glass is invisible (presence 0.15),
 * without waiting for the spring's tail. Reopening mid-exit turns the spring
 * around. A modal locks page scroll while it shows.
 */
export function useOverlay(element: HTMLElement | null, options: OverlayOptions): Overlay {
  const { reducedMotion } = useGlassPreferences();
  const optics = useGlassPhysics({ physics: reducedMotion ? FADE : (options.physics ?? 'snappy'), initial: { presence: 0, shadow: 0 }, reducedMotion: false });
  const [shown, setShown] = useState(false);
  const latest = useRef(options);
  latest.current = options;
  const opener = useRef<HTMLElement | null>(null);
  const { open, kind } = options;

  useIsomorphicLayoutEffect(() => {
    if (!element) return;
    if (open) {
      if (!isShown(element, kind)) {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        show(element, kind);
        setShown(true);
      }
      optics.to({ presence: 1, shadow: 1 });
      return;
    }
    if (!isShown(element, kind)) return;
    optics.to({ presence: 0, shadow: 0 });
    let done = false;
    const finish = (s: OpticalState) => {
      if (done || presenceOpacity(Math.max(0, s.presence)) > 0) return;
      done = true;
      const hadFocus = element.contains(document.activeElement);
      hide(element, kind);
      setShown(false);
      if (latest.current.returnFocus !== false && (hadFocus || document.activeElement === document.body)) {
        (latest.current.trigger ?? opener.current)?.focus({ preventScroll: true });
      }
    };
    const off = optics.subscribe(finish);
    return () => {
      done = true;
      off();
    };
  }, [element, open, kind, optics]);

  // A modal's Escape, and a modal the browser closed by itself (its close watcher, or a stray close()).
  // Unmounting while shown hides the element, after these listeners are gone, so the hide isn't taken for one.
  useEffect(() => {
    if (!element) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      latest.current.onRequestClose();
    };
    const onClose = () => {
      if (!latest.current.open) return;
      setShown(false);
      optics.to({ presence: 0, shadow: 0 });
      if (document.activeElement === document.body || element.contains(document.activeElement)) {
        (latest.current.trigger ?? opener.current)?.focus({ preventScroll: true });
      }
      latest.current.onRequestClose();
    };
    if (kind === 'modal') {
      element.addEventListener('cancel', onCancel);
      element.addEventListener('close', onClose);
    }
    return () => {
      element.removeEventListener('cancel', onCancel);
      element.removeEventListener('close', onClose);
      if (isShown(element, kind)) hide(element, kind);
    };
  }, [element, kind, optics]);

  useEffect(() => {
    if (kind !== 'modal' || !shown) return;
    return lockScroll();
  }, [kind, shown]);

  useEffect(() => {
    if (!element || !shown || !open) return;
    const dismiss = latest.current.dismiss ?? {};
    const inside = (target: EventTarget | null) =>
      target instanceof Node && (element.contains(target) || (latest.current.inside?.() ?? []).some((el) => !!el && el.contains(target)));
    const onPointer = (e: Event) => {
      if (!inside(e.target)) latest.current.onRequestClose();
    };
    const onFocus = (e: FocusEvent) => {
      if (!inside(e.target)) latest.current.onRequestClose();
    };
    const popEscape = kind === 'popover' && dismiss.escape ? pushEscape(() => latest.current.onRequestClose()) : null;
    if (dismiss.outside) document.addEventListener('pointerdown', onPointer, true);
    if (dismiss.focusOut) document.addEventListener('focusin', onFocus, true);
    return () => {
      popEscape?.();
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('focusin', onFocus, true);
    };
  }, [element, shown, open, kind]);

  return { optics, shown, reducedMotion };
}
