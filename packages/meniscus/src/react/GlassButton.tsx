import { forwardRef, type CSSProperties } from 'react';
import { Glass, type GlassProps } from './Glass';

export type GlassButtonProps = Omit<GlassProps<'button'>, 'as'>;

const DEFAULT_STYLE: CSSProperties = {
  padding: '0.7em 1.25em',
  border: 0,
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
};

const DISABLED: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };

/** A native button with meniscus's interactive glass response. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { type = 'button', radius = 'capsule', interactive = true, style, ...props },
  ref,
) {
  const disabled = props.disabled ? DISABLED : null;
  return <Glass as="button" ref={ref} type={type} radius={radius} interactive={interactive} style={{ ...DEFAULT_STYLE, ...disabled, ...style }} {...props} />;
});
