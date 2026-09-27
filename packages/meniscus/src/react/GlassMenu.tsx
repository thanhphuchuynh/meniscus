import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { GlassPlacement } from '../core/place';
import type { SpringInput } from '../core/spring';
import { useAnchor } from './anchor';
import { Glass, type GlassProps } from './Glass';
import { GlassIndicator } from './GlassIndicator';
import { fallbackStyle, useOpenState, useOverlay, usePopoverSupport } from './overlay';
import { useTrigger } from './trigger';

/** One entry of a `GlassMenu`: an action, or `'separator'`. */
export type GlassMenuItem =
  | {
      /** What the item says. */
      label: ReactNode;
      /** Runs when the item is chosen, as the menu starts to close. */
      onSelect: () => void;
      /** Shown, but can't be chosen, and the arrow keys skip it. */
      disabled?: boolean;
      /** Decorative, before the label. */
      icon?: ReactNode;
      /** Shown after the label. Bind the key yourself. */
      shortcut?: string;
      /** Text for type-to-jump, when `label` isn't plain text. */
      textValue?: string;
    }
  | 'separator';

export interface GlassMenuProps extends Omit<GlassProps<'div'>, 'as' | 'children' | 'appear' | 'optics' | 'interactive'> {
  /** Accessible name of the menu. */
  label: string;
  /** The button that opens it. It must pass its ref through. */
  trigger: ReactElement;
  /** The actions, top to bottom. */
  items: readonly GlassMenuItem[];
  /** Default `'bottom-start'`. It flips where there's no room. */
  placement?: GlassPlacement;
  /** Gap from the trigger, px. Default 6. */
  offset?: number;
  /** Open, controlled. Pair it with `onOpenChange`. */
  open?: boolean;
  /** Open at first, uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the requested state. */
  onOpenChange?: (open: boolean) => void;
  /** The spring for its entrance and exit. Default `'snappy'`. */
  physics?: SpringInput;
}

const SURFACE: CSSProperties = { border: 0, padding: 6, minWidth: '12rem', display: 'grid', gap: 2, color: 'inherit', boxSizing: 'border-box', overflow: 'visible' };
const ITEM: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '0.6em',
  width: '100%',
  minHeight: 32,
  padding: '0.5em 0.75em',
  border: 0,
  borderRadius: 10,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'start',
  cursor: 'default',
  outline: 'none',
};
const DISABLED: CSSProperties = { ...ITEM, opacity: 0.45 };
const SEPARATOR: CSSProperties = { height: 1, margin: '4px 8px', background: 'currentColor', opacity: 0.15 };
const SHORTCUT: CSSProperties = { marginInlineStart: 'auto', paddingInlineStart: '1.5em', opacity: 0.6, fontSize: '0.85em', fontFamily: 'inherit' };
const SWELL: CSSProperties = { scale: 'calc(0.96 + 0.04 * var(--meniscus-presence, 1))' };
const HIGHLIGHT = 'var(--meniscus-menu-highlight, light-dark(rgb(15 20 26 / 0.08), rgb(255 255 255 / 0.16)))';

type Action = Exclude<GlassMenuItem, 'separator'>;
const textOf = (item: Action) => (item.textValue ?? (typeof item.label === 'string' ? item.label : '')).toLowerCase();

/**
 * A menu of actions from a button, in glass. It follows the WAI-ARIA menu
 * button pattern: the arrow keys, Home, End and the first letter of an item
 * move through it; Enter chooses; Escape closes and gives focus back. A glass
 * highlight flows from item to item.
 */
export function GlassMenu({ label, trigger, items, placement = 'bottom-start', offset = 6, open: openProp, defaultOpen, onOpenChange, physics = 'snappy', radius = 16, style, ...glass }: GlassMenuProps) {
  const id = `meniscus-menu-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(-1);
  const supported = usePopoverSupport();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const start = useRef<'first' | 'last'>('first');
  const typed = useRef({ text: '', at: -Infinity });
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

  const enabled = items.flatMap((item, i) => (item !== 'separator' && !item.disabled ? [i] : []));
  const focusItem = (i: number | undefined) => {
    if (i === undefined) return;
    setActive(i);
    buttons.current[i]?.focus({ preventScroll: true });
  };
  const openAt = (where: 'first' | 'last') => {
    start.current = where;
    setOpen(true);
  };

  // Opening focuses the first or last item; after that the keys move focus.
  useEffect(() => {
    if (!open) {
      setActive(-1);
      return;
    }
    if (overlay.shown) focusItem(start.current === 'last' ? enabled[enabled.length - 1] : enabled[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, overlay.shown]);

  const move = (step: 1 | -1) => {
    if (!enabled.length) return;
    const at = enabled.indexOf(active);
    const next = at < 0 ? (step > 0 ? 0 : enabled.length - 1) : (at + step + enabled.length) % enabled.length;
    focusItem(enabled[next]);
  };

  const choose = (i: number) => {
    const item = items[i];
    if (!item || item === 'separator' || item.disabled) return;
    setOpen(false);
    item.onSelect();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'Home') focusItem(enabled[0]);
    else if (e.key === 'End') focusItem(enabled[enabled.length - 1]);
    else if (e.key === 'Tab') {
      setOpen(false);
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = performance.now();
      const t = typed.current;
      t.text = now - t.at > 500 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      // The same letter again moves to the next item starting with it.
      const search = /^(.)\1+$/.test(t.text) ? t.text[0]! : t.text;
      const from = enabled.indexOf(active);
      const order = [...enabled.slice(from + 1), ...enabled.slice(0, from + 1)];
      focusItem(order.find((i) => textOf(items[i] as Action).startsWith(search)));
    } else return;
    e.preventDefault();
  };

  const triggerNode = useTrigger(
    trigger,
    {
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-controls': id,
      onClick: () => (open ? setOpen(false) : openAt('first')),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        openAt(e.key === 'ArrowUp' ? 'last' : 'first');
      },
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
        role="menu"
        aria-label={label}
        popover="manual"
        radius={radius}
        optics={overlay.optics}
        onKeyDown={onMenuKey}
        style={{ ...SURFACE, ...position, ...(overlay.reducedMotion ? null : SWELL), ...fallbackStyle(supported, overlay.shown), ...style }}
      >
        <GlassIndicator target={active >= 0 ? (buttons.current[active] ?? null) : null} radius={10} shadow={false} tint={HIGHLIGHT} />
        {items.map((item, i) =>
          item === 'separator' ? (
            <div key={`separator-${i}`} role="separator" style={SEPARATOR} />
          ) : (
            <button
              key={i}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              aria-disabled={item.disabled || undefined}
              onClick={() => choose(i)}
              onPointerMove={() => {
                if (!item.disabled && active !== i) focusItem(i);
              }}
              style={item.disabled ? DISABLED : ITEM}
            >
              {item.icon ? (
                <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
              {item.shortcut ? <kbd style={SHORTCUT}>{item.shortcut}</kbd> : null}
            </button>
          ),
        )}
      </Glass>
    </>
  );
}

GlassMenu.displayName = 'GlassMenu';
