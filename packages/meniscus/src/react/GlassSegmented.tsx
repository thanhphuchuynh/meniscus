import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import type { GlassOptions } from '../core/glass';
import { focusVisible } from './focus';
import { GlassIndicator } from './GlassIndicator';

/** One option of a `GlassSegmented`. */
export interface GlassSegmentedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface GlassSegmentedProps extends GlassOptions {
  /** The group's name, shown as its legend. */
  label: string;
  /** The choices, in order. Values must be unique. */
  options: readonly GlassSegmentedOption[];
  /** The chosen option, controlled. Pair it with `onValueChange`. */
  value?: string;
  /** The chosen option at first, uncontrolled. Default: the first enabled option. */
  defaultValue?: string;
  /** Called with the option chosen. */
  onValueChange?: (value: string) => void;
  /** The radio group's name, for forms. Default: a generated name. */
  name?: string;
  className?: string;
  style?: CSSProperties;
}

const FIELDSET: CSSProperties = { margin: 0, padding: 0, border: 0, minWidth: 0, color: 'inherit' };
const LEGEND: CSSProperties = { padding: 0, marginBottom: '0.35em', fontSize: '0.9em' };
const ROW: CSSProperties = { position: 'relative', display: 'inline-flex', gap: 2, padding: 3, borderRadius: 14, background: 'light-dark(rgb(15 20 26 / 0.06), rgb(255 255 255 / 0.08))' };
const OPTION: CSSProperties = { display: 'inline-flex', cursor: 'pointer' };
const DISABLED: CSSProperties = { ...OPTION, opacity: 0.45, cursor: 'not-allowed' };
const TEXT: CSSProperties = { position: 'relative', display: 'inline-block', minHeight: 24, padding: '0.4em 0.9em', borderRadius: 11, lineHeight: 1.5, boxSizing: 'border-box' };
const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const RING: CSSProperties = { outline: 'var(--meniscus-focus-ring, auto)', outlineOffset: 2 };

/**
 * One of a few options: native radio buttons in a `fieldset`, with a glass
 * selection that flows to the chosen one. Arrow keys and forms work as they
 * do for any radio group.
 */
export function GlassSegmented({ label, options, value: valueProp, defaultValue, onValueChange, name, className, style, ...glass }: GlassSegmentedProps) {
  const generated = `meniscus-segmented-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [own, setOwn] = useState(defaultValue ?? options.find((o) => !o.disabled)?.value);
  const value = valueProp ?? own;
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <fieldset className={className} style={{ ...FIELDSET, ...style }}>
      <legend style={LEGEND}>{label}</legend>
      <div style={ROW}>
        <GlassIndicator target={selected} radius={11} {...glass} />
        {options.map((o) => (
          <label key={o.value} style={o.disabled ? DISABLED : OPTION}>
            <input
              type="radio"
              name={name ?? generated}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              style={HIDDEN}
              onChange={() => {
                if (valueProp === undefined) setOwn(o.value);
                onValueChange?.(o.value);
              }}
              onFocus={(e) => setFocused(focusVisible(e.target) ? o.value : null)}
              onBlur={() => setFocused(null)}
            />
            <span ref={value === o.value ? setSelected : undefined} style={focused === o.value ? { ...TEXT, ...RING } : TEXT}>
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

GlassSegmented.displayName = 'GlassSegmented';
