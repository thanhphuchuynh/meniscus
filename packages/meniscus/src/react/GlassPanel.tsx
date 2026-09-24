import { forwardRef, type CSSProperties } from 'react';
import { Glass, type GlassProps } from './Glass';

export type GlassPanelProps = Omit<GlassProps<'div'>, 'as'>;

const DEFAULT_STYLE: CSSProperties = { padding: '1.5rem' };

/** A padded glass container. Add a role and accessible label when it represents a named region. */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel({ style, ...props }, ref) {
  return <Glass ref={ref} style={{ ...DEFAULT_STYLE, ...style }} {...props} />;
});
