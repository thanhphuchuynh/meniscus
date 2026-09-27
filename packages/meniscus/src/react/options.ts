import { GLASS_OPTION_KEYS } from '../core/constants';
import type { GlassOptions } from '../core/glass';

/** Splits a control's props: glass options for its glass part, the rest for its native element. */
export function splitGlassOptions<P extends object>(props: P): [GlassOptions, Omit<P, keyof GlassOptions>] {
  const glass: Record<string, unknown> = {};
  const rest = { ...props } as Record<string, unknown>;
  for (const key of GLASS_OPTION_KEYS) {
    if (!(key in rest)) continue;
    if (rest[key] !== undefined) glass[key] = rest[key];
    delete rest[key];
  }
  return [glass as GlassOptions, rest as Omit<P, keyof GlassOptions>];
}
