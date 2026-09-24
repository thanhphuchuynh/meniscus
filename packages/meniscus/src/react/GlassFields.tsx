import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Glass } from './Glass';

const FIELD: CSSProperties = {
  display: 'grid',
  gap: '0.2em',
  padding: '0.7em 1em',
  color: 'inherit',
};

const CONTROL: CSSProperties = {
  width: '100%',
  minWidth: 0,
  padding: '0.15em 0',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
};

const LABEL: CSSProperties = { fontSize: '0.8em', fontWeight: 600 };

export interface GlassTextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  label: string;
}

/** A labelled native input on a glass surface. Validation and form submission stay native. */
export const GlassTextField = forwardRef<HTMLInputElement, GlassTextFieldProps>(function GlassTextField({ label, type = 'text', style, ...props }, ref) {
  return (
    <Glass as="label" radius={18} style={FIELD}>
      <span style={LABEL}>{label}</span>
      <input ref={ref} type={type} style={{ ...CONTROL, ...style }} {...props} />
    </Glass>
  );
});

export interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

/** A labelled native select on a glass surface. */
export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(function GlassSelect({ label, children, style, ...props }, ref) {
  return (
    <Glass as="label" radius={18} style={FIELD}>
      <span style={LABEL}>{label}</span>
      <select ref={ref} style={{ ...CONTROL, ...style }} {...props}>{children}</select>
    </Glass>
  );
});

export interface GlassCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  label: string;
}

/** A native checkbox with a glass hit target and visible label. */
export const GlassCheckbox = forwardRef<HTMLInputElement, GlassCheckboxProps>(function GlassCheckbox({ label, style, ...props }, ref) {
  return (
    <Glass as="label" radius="capsule" interactive style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65em', padding: '0.65em 1em', color: 'inherit', cursor: props.disabled ? 'not-allowed' : 'pointer' }}>
      <input ref={ref} type="checkbox" style={{ width: '1.1em', height: '1.1em', margin: 0, ...style }} {...props} />
      <span>{label}</span>
    </Glass>
  );
});
