import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { GlassOptions } from '../core/glass';
import { profileKey } from '../core/profiles';
import type { RenderModePreference } from '../core/support';

export interface GlassDefaults extends GlassOptions {
  /** Rendering path for every glass below: `auto` refracts where the browser can. */
  mode?: RenderModePreference;
  /**
   * Draw glass opaque, without refraction, as under the system's Reduce
   * Transparency. For an app's own setting: Safari doesn't report that
   * preference to the web. `false` still follows the system.
   */
  reduceTransparency?: boolean;
  /** Replace springs and ambient motion with short fades, as under Reduce Motion. `false` still follows the system. */
  reduceMotion?: boolean;
  /** Draw glass opaque with a hairline edge, as under Increase Contrast or forced colors. `false` still follows the system. */
  increaseContrast?: boolean;
}

const GlassContext = createContext<GlassDefaults>({});

export interface GlassProviderProps extends GlassDefaults {
  children?: ReactNode;
}

/** A value-stable key for options, with functions keyed by identity. */
export function optionsKey(options: object): string {
  return JSON.stringify(options, (_, v) => (typeof v === 'function' ? profileKey(v) : v));
}

/**
 * Sets defaults for every `<Glass>` below it. Nested providers merge, and a
 * prop left undefined inherits from the provider above, so a page can fix one
 * light angle for all glass and a toolbar can still change its own tint.
 */
export function GlassProvider({ children, ...props }: GlassProviderProps) {
  const parent = useContext(GlassContext);
  const own = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined)) as GlassDefaults;
  const key = optionsKey(own);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ ...parent, ...own }), [parent, key]);
  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}

export function useGlassDefaults(): GlassDefaults {
  return useContext(GlassContext);
}
