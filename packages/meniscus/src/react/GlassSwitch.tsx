import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type PointerEvent } from 'react';
import type { GlassOptions } from '../core/glass';
import { springEasing } from './appear';
import { focusVisible } from './focus';
import { Glass } from './Glass';
import { useGlassPreferences } from './hooks';
import { splitGlassOptions } from './options';
import { useMergedRef } from './refs';
import { useGlassPhysics } from './useGlassPhysics';

export interface GlassSwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'children'>, GlassOptions {
  /** Visible label. It also names the switch. */
  label: string;
}

const ROW: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.75em', minHeight: 24, color: 'inherit', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' };
const TRACK: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  flex: 'none',
  width: '3.25em',
  height: '2em',
  borderRadius: 9999,
  boxSizing: 'border-box',
  transition: 'background-color 200ms ease',
  touchAction: 'none',
};
const OFF = 'light-dark(rgb(15 20 26 / 0.14), rgb(255 255 255 / 0.18))';
const ON = 'var(--meniscus-accent, #2563eb)';
/** The knob's travel: the track's width less the knob and both gaps. */
const TRAVEL = '1.25em';
const KNOB: CSSProperties = { position: 'absolute', top: '0.15em', left: '0.15em', width: '1.7em', height: '1.7em', pointerEvents: 'none' };
// Pointer input lands on the label, not the checkbox, so the click that ends a drag can be canceled.
const INPUT: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, pointerEvents: 'none' };
const RING: CSSProperties = { outline: 'var(--meniscus-focus-ring, auto)', outlineOffset: 2 };
const DISABLED: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };
const LENS = { tint: 0.15, refraction: 1.6, shadow: 1.4 };
const REST = { tint: 1, refraction: 1, shadow: 1 };
const KNOB_TINT = 'rgb(255 255 255 / 0.92)';

/**
 * An on/off switch: a native checkbox with `role="switch"`, drawn as a track
 * with a glass knob. While pressed or dragged, the knob swells into a clear
 * lens over the track. Dragging it across the middle toggles it, and it
 * settles on a spring. Forms, validation and assistive technology see the
 * native input.
 */
export const GlassSwitch = forwardRef<HTMLInputElement, GlassSwitchProps>(function GlassSwitch({ label, className, style, onChange, onFocus, onBlur, ...props }, ref) {
  const [glass, input] = splitGlassOptions(props);
  const controlled = input.checked !== undefined;
  const [own, setOwn] = useState(!!input.defaultChecked);
  const checked = controlled ? !!input.checked : own;
  const disabled = !!input.disabled;
  const { reducedMotion } = useGlassPreferences();
  const knob = useGlassPhysics();
  const [ring, setRing] = useState(false);
  const [held, setHeld] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const press = useRef<{ id: number; x: number; moved: boolean } | null>(null);
  const swallow = useRef(false);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const onNode = useCallback((el: HTMLInputElement | null) => {
    inputEl.current = el;
  }, []);
  const setRef = useMergedRef(ref, onNode);

  // A form reset changes an uncontrolled switch without a change event.
  useEffect(() => {
    const form = inputEl.current?.form;
    if (!form || controlled) return;
    const reset = () => setTimeout(() => setOwn(!!inputEl.current?.checked));
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, [controlled]);

  const lens = (on: boolean) => knob.to(on && !reducedMotion ? LENS : REST);
  const fractionAt = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const knobWidth = r.height * 0.85;
    const gap = r.height * 0.075;
    return Math.max(0, Math.min(1, (e.clientX - r.left - gap - knobWidth / 2) / (r.width - knobWidth - 2 * gap)));
  };
  const release = () => {
    press.current = null;
    setHeld(false);
    lens(false);
    setDrag(null);
  };

  const track = {
    onPointerDown(e: PointerEvent<HTMLSpanElement>) {
      if (disabled || e.button !== 0) return;
      press.current = { id: e.pointerId, x: e.clientX, moved: false };
      setHeld(true);
      lens(true);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Without capture the drag still works while the pointer stays on the track.
      }
    },
    onPointerMove(e: PointerEvent<HTMLSpanElement>) {
      const p = press.current;
      if (!p || p.id !== e.pointerId || reducedMotion) return;
      if (!p.moved && Math.abs(e.clientX - p.x) < 4) return;
      p.moved = true;
      setDrag(fractionAt(e));
    },
    onPointerUp(e: PointerEvent<HTMLSpanElement>) {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      if (p.moved) {
        // The label would toggle on the click that ends the drag: swallow it, and toggle here only if the knob crossed.
        swallow.current = true;
        setTimeout(() => {
          swallow.current = false;
        }, 0);
        if (fractionAt(e) > 0.5 !== checked) inputEl.current?.click();
      }
      release();
    },
    onPointerCancel: release,
  };

  return (
    <label
      className={className}
      style={{ ...ROW, ...(disabled ? DISABLED : null), ...style }}
      onClickCapture={(e) => {
        if (!swallow.current || e.target === inputEl.current) return;
        swallow.current = false;
        e.preventDefault();
      }}
    >
      <span>{label}</span>
      <span style={{ ...TRACK, background: checked ? ON : OFF, ...(ring ? RING : null) }} {...track}>
        <Glass
          {...glass}
          radius="capsule"
          optics={knob}
          aria-hidden="true"
          tint={glass.tint ?? KNOB_TINT}
          style={{
            ...KNOB,
            translate: `calc(${drag ?? (checked ? 1 : 0)} * ${TRAVEL}) 0`,
            scale: held && !reducedMotion ? '1.35' : '1',
            transition: reducedMotion ? 'none' : drag !== null ? `scale 420ms ${springEasing()}` : `translate 360ms ${springEasing()}, scale 420ms ${springEasing()}`,
          }}
        />
        <input
          {...input}
          ref={setRef}
          type="checkbox"
          role="switch"
          checked={controlled ? checked : undefined}
          defaultChecked={controlled ? undefined : input.defaultChecked}
          style={INPUT}
          onChange={(e) => {
            if (!controlled) setOwn(e.target.checked);
            onChange?.(e);
          }}
          onFocus={(e) => {
            setRing(focusVisible(e.target));
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setRing(false);
            onBlur?.(e);
          }}
        />
      </span>
    </label>
  );
});

GlassSwitch.displayName = 'GlassSwitch';
