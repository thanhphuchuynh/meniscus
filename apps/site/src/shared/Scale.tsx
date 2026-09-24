import { GlassIndicator } from 'meniscus';
import { useId, useState, type ReactNode } from 'react';

/**
 * A graduated scale: a native range input drawn as an engraved rule with
 * ticks, its value read out in tabular figures.
 */
export function Scale({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
  unit,
  hint,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  unit?: string;
  hint?: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="scale">
      <label htmlFor={id} className="scale__label">
        {label}
      </label>
      <output htmlFor={id} className="scale__value num">
        {format(value)}
        {unit ? <span className="scale__unit">{unit}</span> : null}
      </output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="scale__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A row of mutually exclusive options, drawn as engraved tabs. The selection
 * is a small glass body that flows to the chosen option.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  const name = useId();
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  return (
    <fieldset className={`segmented ${className ?? ''}`}>
      <legend className="scale__label">{label}</legend>
      <div className="segmented__row">
        <GlassIndicator target={selected} className="segmented__glass" radius={11} tint="var(--glass-select)" refraction={0.8} shadow="var(--shadow-select)" />
        {options.map((o) => (
          <label key={o.value} className="segmented__option" title={o.title}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span ref={value === o.value ? setSelected : undefined}>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
