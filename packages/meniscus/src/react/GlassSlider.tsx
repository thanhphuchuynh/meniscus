import { forwardRef, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type InputHTMLAttributes } from 'react';
import type { GlassOptions } from '../core/glass';
import { springEasing } from './appear';
import { focusVisible } from './focus';
import { Glass } from './Glass';
import { useGlassPreferences } from './hooks';
import { splitGlassOptions } from './options';
import { useMergedRef } from './refs';
import { useGlassPhysics } from './useGlassPhysics';

export interface GlassSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>, GlassOptions {
  /** Visible label. It also names the slider. */
  label: string;
  /** Formats the value: shown beside the label, and read out as `aria-valuetext`. */
  format?: (value: number) => string;
}

const WRAP: CSSProperties = { display: 'grid', gap: '0.35em', color: 'inherit' };
const HEAD: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1em' };
const VALUE: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const TRACK: CSSProperties = { position: 'relative', height: '1.75em', minHeight: 24 };
const RULE: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  height: 4,
  marginTop: -2,
  borderRadius: 2,
  background: 'light-dark(rgb(15 20 26 / 0.14), rgb(255 255 255 / 0.18))',
};
const FILL: CSSProperties = { ...RULE, right: 'auto', width: 'calc(var(--meniscus-value, 0) * 100%)', background: 'var(--meniscus-accent, #2563eb)' };
const THUMB: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 'calc(var(--meniscus-value, 0) * (100% - 1.75em))',
  width: '1.75em',
  height: '1.25em',
  marginTop: '-0.625em',
  pointerEvents: 'none',
};
const RANGE: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer' };
const RING: CSSProperties = { outline: 'var(--meniscus-focus-ring, auto)', outlineOffset: 2 };
const DISABLED: CSSProperties = { opacity: 0.5 };
const LENS = { tint: 0.15, refraction: 1.6, shadow: 1.4 };
const REST = { tint: 1, refraction: 1, shadow: 1 };
const THUMB_TINT = 'rgb(255 255 255 / 0.92)';

/**
 * A value on a scale: a native range input over a glass track. While you
 * drag, the thumb swells into a lens and bends the fill line beneath it (live
 * in Chromium, frosted elsewhere). Keyboard, forms and assistive technology
 * are the native input's.
 */
export const GlassSlider = forwardRef<HTMLInputElement, GlassSliderProps>(function GlassSlider(
  { label, format, className, style, onChange, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel, ...props },
  ref,
) {
  const [glass, input] = splitGlassOptions(props);
  const generated = useId();
  const id = input.id ?? generated;
  const min = Number(input.min ?? 0);
  const max = Number(input.max ?? 100);
  const controlled = input.value !== undefined;
  const [own, setOwn] = useState(() => Number(input.defaultValue ?? min + (max - min) / 2));
  const value = controlled ? Number(input.value) : own;
  const fraction = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  const disabled = !!input.disabled;
  const { reducedMotion } = useGlassPreferences();
  const thumb = useGlassPhysics();
  const [held, setHeld] = useState(false);
  const [ring, setRing] = useState(false);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const onNode = useCallback((el: HTMLInputElement | null) => {
    inputEl.current = el;
  }, []);
  const setRef = useMergedRef(ref, onNode);

  // The browser rounds an uncontrolled default to the step: read back what it chose.
  useEffect(() => {
    if (!controlled && inputEl.current) setOwn(Number(inputEl.current.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hold = (on: boolean) => {
    setHeld(on);
    thumb.to(on && !reducedMotion ? LENS : REST);
  };
  const text = format?.(value);

  return (
    <div className={className} style={{ ...WRAP, ...(disabled ? DISABLED : null), ...style }}>
      <div style={HEAD}>
        <label htmlFor={id}>{label}</label>
        {text !== undefined ? (
          <output htmlFor={id} style={VALUE}>
            {text}
          </output>
        ) : null}
      </div>
      <div style={{ ...TRACK, '--meniscus-value': fraction } as CSSProperties}>
        <span style={RULE} />
        <span style={FILL} />
        <Glass
          {...glass}
          radius="capsule"
          optics={thumb}
          aria-hidden="true"
          tint={glass.tint ?? THUMB_TINT}
          style={{ ...THUMB, ...(ring ? RING : null), scale: held && !reducedMotion ? '1.35' : '1', transition: reducedMotion ? 'none' : `scale 420ms ${springEasing()}` }}
        />
        <input
          {...input}
          ref={setRef}
          id={id}
          type="range"
          aria-valuetext={text ?? input['aria-valuetext']}
          value={controlled ? input.value : undefined}
          defaultValue={controlled ? undefined : input.defaultValue}
          style={RANGE}
          onChange={(e) => {
            if (!controlled) setOwn(Number(e.target.value));
            onChange?.(e);
          }}
          onPointerDown={(e) => {
            if (!disabled) hold(true);
            onPointerDown?.(e);
          }}
          onPointerUp={(e) => {
            hold(false);
            onPointerUp?.(e);
          }}
          onPointerCancel={(e) => {
            hold(false);
            onPointerCancel?.(e);
          }}
          onFocus={(e) => {
            setRing(focusVisible(e.target));
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setRing(false);
            hold(false);
            onBlur?.(e);
          }}
        />
      </div>
    </div>
  );
});

GlassSlider.displayName = 'GlassSlider';
