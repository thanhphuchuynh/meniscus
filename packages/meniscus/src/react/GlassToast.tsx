import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { GlassOptions } from '../core/glass';
import { presenceOpacity } from '../core/physics';
import type { SpringInput } from '../core/spring';
import { DEV } from './dev';
import { useDragDismiss } from './drag';
import { Glass } from './Glass';
import { useGlassPreferences, useIsomorphicLayoutEffect } from './hooks';
import { FADE, fallbackStyle, usePopoverSupport } from './overlay';
import { useGlassPhysics } from './useGlassPhysics';

/** A button on a toast. Choosing it dismisses the toast. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** A second line under the message. */
  description?: ReactNode;
  /** One action, such as Undo. */
  action?: ToastAction;
  /** How long it stays, ms. Default 5000. `Infinity` keeps it until dismissed. Hovering or focusing the toasts pauses the clock. */
  duration?: number;
  /** Reuse an id to replace a toast in place, such as a progress message. */
  id?: string;
}

interface ToastRecord {
  id: string;
  message: ReactNode;
  description?: ReactNode;
  action?: ToastAction;
  duration: number;
}

const EMPTY: readonly ToastRecord[] = [];
let queue: readonly ToastRecord[] = EMPTY;
const listeners = new Set<() => void>();
let serial = 0;
let mounted = 0;
let warnedMissing = false;
let warnedMany = false;

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function show(message: ReactNode, options: ToastOptions = {}): string {
  const id = options.id ?? `meniscus-toast-${++serial}`;
  // A server has no page to show it on, and must not keep state between requests.
  if (typeof window === 'undefined') return id;
  const record: ToastRecord = { id, message, description: options.description, action: options.action, duration: options.duration ?? 5000 };
  const at = queue.findIndex((t) => t.id === id);
  queue = at >= 0 ? queue.map((t, i) => (i === at ? record : t)) : [...queue, record];
  emit();
  if (DEV && mounted === 0 && !warnedMissing) {
    // Checked a moment later, so a toaster mounting in the same update still counts.
    setTimeout(() => {
      if (mounted > 0 || warnedMissing) return;
      warnedMissing = true;
      console.warn('meniscus: toast() was called with no <GlassToaster> on the page. Render one near the root; the toast shows once it mounts.');
    }, 0);
  }
  return id;
}

function dismiss(id?: string): void {
  if (id === undefined) {
    if (!queue.length) return;
    queue = EMPTY;
  } else {
    if (!queue.some((t) => t.id === id)) return;
    queue = queue.filter((t) => t.id !== id);
  }
  emit();
}

/**
 * Shows a toast in the page's `GlassToaster` and returns its id.
 * `toast.dismiss(id)` removes one toast; `toast.dismiss()` removes them all.
 * Toasts made before a toaster mounts wait for it.
 */
export const toast: ((message: ReactNode, options?: ToastOptions) => string) & { dismiss: (id?: string) => void } = Object.assign(show, { dismiss });

type Placement = 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

export interface GlassToasterProps extends GlassOptions {
  /** Where toasts gather. Default `'bottom'`. */
  placement?: Placement;
  /** Accessible name of the region. Default `'Notifications'`. */
  label?: string;
  /** How many show at once. Older ones wait their turn. Default 3. */
  max?: number;
  /** The spring toasts arrive and leave on. Default `'bouncy'`. */
  physics?: SpringInput;
  /** Class for every toast. */
  className?: string;
  /** Style for every toast. */
  style?: CSSProperties;
}

const REGION_BASE: CSSProperties = {
  position: 'fixed',
  inset: 'auto',
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  overflow: 'visible',
  width: 'min(24rem, calc(100vw - 2rem))',
  maxHeight: 'none',
};
const REGION: Readonly<Record<Placement, CSSProperties>> = {
  bottom: { bottom: 16, left: '50%', translate: '-50% 0' },
  'bottom-start': { bottom: 16, left: 16 },
  'bottom-end': { bottom: 16, right: 16 },
  top: { top: 16, left: '50%', translate: '-50% 0' },
  'top-start': { top: 16, left: 16 },
  'top-end': { top: 16, right: 16 },
};
const LIST: CSSProperties = { display: 'flex', gap: 8, margin: 0, padding: 0, listStyle: 'none' };
const TOAST: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.75rem 0.75rem 1rem', boxSizing: 'border-box', touchAction: 'pan-y' };
const TEXT: CSSProperties = { display: 'grid', gap: 2, flex: 1, minWidth: 0 };
const DESCRIPTION: CSSProperties = { fontSize: '0.9em', opacity: 0.75 };
const BUTTON: CSSProperties = { border: 0, borderRadius: 9999, padding: '0.4em 0.8em', background: 'color-mix(in srgb, currentColor 12%, transparent)', color: 'inherit', font: 'inherit', cursor: 'pointer' };
const CLOSE: CSSProperties = { ...BUTTON, display: 'grid', placeItems: 'center', width: 28, height: 28, padding: 0 };
const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };

interface ToastItemProps {
  record: ToastRecord;
  leaving: boolean;
  paused: boolean;
  onLeft: (id: string) => void;
  physics: SpringInput;
  glass: GlassOptions;
  className?: string;
  style?: CSSProperties;
  top: boolean;
}

function ToastItem({ record, leaving, paused, onLeft, physics, glass, className, style, top }: ToastItemProps) {
  const { reducedMotion } = useGlassPreferences();
  const optics = useGlassPhysics({ physics: reducedMotion ? FADE : physics, initial: { presence: 0, shadow: 0 }, reducedMotion: false });
  const [el, setEl] = useState<HTMLElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!leaving) {
      optics.to({ presence: 1, shadow: 1 });
      return;
    }
    optics.to({ presence: 0, shadow: 0 });
    let done = false;
    const off = optics.subscribe((s) => {
      if (done || presenceOpacity(Math.max(0, s.presence)) > 0) return;
      done = true;
      onLeft(record.id);
    });
    return () => {
      done = true;
      off();
    };
  }, [leaving, optics, onLeft, record.id]);

  // The clock runs while the toast shows and nobody is reading the toasts.
  const remaining = useRef(record.duration);
  useEffect(() => {
    remaining.current = record.duration;
  }, [record]);
  useEffect(() => {
    if (leaving || paused || !Number.isFinite(remaining.current)) return;
    const started = Date.now();
    const timer = window.setTimeout(() => toast.dismiss(record.id), Math.max(0, remaining.current));
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [leaving, paused, record]);

  const drag = useDragDismiss(el, { axis: 'x', direction: 0, fraction: 0.4, enabled: !leaving, reducedMotion, onDismiss: () => toast.dismiss(record.id) });
  const motion: CSSProperties | null = reducedMotion
    ? null
    : { translate: `var(--meniscus-drag, 0px) calc((1 - var(--meniscus-presence, 1)) * ${top ? -16 : 16}px)`, scale: 'calc(0.92 + 0.08 * var(--meniscus-presence, 1))' };
  return (
    <Glass as="li" {...glass} {...drag} ref={setEl} optics={optics} className={className} style={{ ...TOAST, ...motion, ...style }}>
      <div style={TEXT}>
        <strong>{record.message}</strong>
        {record.description ? <span style={DESCRIPTION}>{record.description}</span> : null}
      </div>
      {record.action ? (
        <button
          type="button"
          style={BUTTON}
          onClick={() => {
            record.action!.onClick();
            toast.dismiss(record.id);
          }}
        >
          {record.action.label}
        </button>
      ) : null}
      <button type="button" aria-label="Dismiss notification" style={CLOSE} onClick={() => toast.dismiss(record.id)}>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </Glass>
  );
}

/** A toast on screen, and whether it is on its way out. */
interface Shown {
  record: ToastRecord;
  leaving: boolean;
}

/**
 * The toasts on screen, in order: the visible ones, and dismissed ones still
 * fading out where they were. One pushed out by newer toasts waits its turn, unseen.
 */
function arrange(prev: readonly Shown[], visible: readonly ToastRecord[], queued: readonly ToastRecord[]): Shown[] {
  const next: Shown[] = visible.map((record) => ({ record, leaving: false }));
  const has = (id: string) => next.some((n) => n.record.id === id);
  prev.forEach((item, i) => {
    if (has(item.record.id) || queued.some((t) => t.id === item.record.id)) return;
    const after = prev.slice(i + 1).find((p) => has(p.record.id));
    next.splice(after ? next.findIndex((n) => n.record.id === after.record.id) : next.length, 0, { record: item.record, leaving: true });
  });
  return next;
}

/**
 * Where `toast()` messages appear: render one near the root. Toasts arrive
 * on a spring, stack three at a time, pause while read, and swipe away.
 * Screen readers hear each new message without interruption. The region
 * shows in the top layer, lifted above any modal opened since.
 */
export function GlassToaster({ placement = 'bottom', label = 'Notifications', max = 3, physics = 'bouncy', className, style, ...glass }: GlassToasterProps) {
  const toasts = useSyncExternalStore(subscribe, () => queue, () => EMPTY);
  const supported = usePopoverSupport();
  const [region, setRegion] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // What's on screen and what to announce, worked out while rendering, so a dismissed toast never unmounts before its exit.
  const [screen, setScreen] = useState({ toasts: EMPTY, max, items: [] as readonly Shown[], news: EMPTY, turn: 0 });
  const shown = useRef(false);
  if (screen.toasts !== toasts || screen.max !== max) {
    // New and replaced toasts are announced, together when they came together.
    const news = toasts.filter((t) => !screen.toasts.includes(t));
    setScreen({ toasts, max, items: arrange(screen.items, toasts.slice(-Math.max(1, max)), toasts), news: news.length ? news : screen.news, turn: screen.turn + (news.length ? 1 : 0) });
  }

  useEffect(() => {
    mounted++;
    if (DEV && mounted > 1 && !warnedMany) {
      warnedMany = true;
      console.warn('meniscus: more than one <GlassToaster> is mounted, and each shows every toast. Render one near the root.');
    }
    return () => {
      mounted--;
    };
  }, []);

  const onLeft = useCallback((id: string) => setScreen((current) => ({ ...current, items: current.items.filter((i) => i.record.id !== id) })), []);

  const any = screen.items.length > 0;
  const newest = toasts[toasts.length - 1]?.id;
  // Shown while there are toasts. Each change shows it again, which lifts it above any modal opened since.
  useIsomorphicLayoutEffect(() => {
    if (!region || !supported) return;
    if (shown.current) {
      try {
        region.hidePopover();
      } catch {
        // Already hidden.
      }
      shown.current = false;
    }
    if (!any) return;
    region.showPopover();
    shown.current = true;
  }, [region, supported, any, newest]);

  const top = placement.startsWith('top');
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" style={HIDDEN}>
        {screen.news.map((t) => (
          // Keyed by turn, so the same message twice is read twice.
          <div key={`${screen.turn}-${t.id}`}>
            {t.message}
            {t.description ? <> {t.description}</> : null}
          </div>
        ))}
      </div>
      <section
        ref={setRegion}
        aria-label={label}
        popover="manual"
        data-meniscus-toaster=""
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        style={{ ...REGION_BASE, ...REGION[placement], ...fallbackStyle(supported, any) }}
      >
        <ol style={{ ...LIST, flexDirection: top ? 'column-reverse' : 'column' }}>
          {screen.items.map(({ record, leaving }) => (
            <ToastItem
              key={record.id}
              record={record}
              leaving={leaving}
              paused={hovered || focused}
              onLeft={onLeft}
              physics={physics}
              glass={glass}
              className={className}
              style={style}
              top={top}
            />
          ))}
        </ol>
      </section>
    </>
  );
}

GlassToaster.displayName = 'GlassToaster';
