import { GlassGlyph } from 'meniscus';
import type { SVGProps } from 'react';
import { Icon, type IconName } from './Icon';

/** An icon that sits inside glass, made of glass itself. */
export function GlassIcon({ name, className, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <GlassGlyph depth={1} className="glass-icon">
      <Icon name={name} className={className} {...props} />
    </GlassGlyph>
  );
}
