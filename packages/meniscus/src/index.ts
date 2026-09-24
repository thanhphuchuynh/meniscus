import { Glass as GlassBase } from './react/Glass';
import { GlassLayer, GlassStack } from './react/GlassStack';

/** A surface of liquid glass, with `Glass.Stack` and `Glass.Layer` for layered glass. */
export const Glass = Object.assign(GlassBase, { Stack: GlassStack, Layer: GlassLayer });
export { DEFAULT_SHADOW, GLASS_OPTION_KEYS, type GlassProps, type GlassOwnProps } from './react/Glass';
export { GlassStack, GlassLayer, type GlassStackProps, type GlassLayerProps, type StackRenderer } from './react/GlassStack';
export { GlassButton, type GlassButtonProps } from './react/GlassButton';
export { GlassPanel, type GlassPanelProps } from './react/GlassPanel';
export { GlassGlyph, type GlassGlyphProps } from './react/GlassGlyph';
export { GlassLoader, type GlassLoaderProps } from './react/GlassLoader';
export { GlassTabs, type GlassTabsProps, type GlassTabItem } from './react/GlassTabs';
export { GlassTextField, GlassSelect, GlassCheckbox, type GlassTextFieldProps, type GlassSelectProps, type GlassCheckboxProps } from './react/GlassFields';
export { GlassProvider, useGlassDefaults, type GlassProviderProps, type GlassDefaults } from './react/context';
export { GlassFilter, type GlassFilterProps } from './react/GlassFilter';
export { GlassIndicator, type GlassIndicatorProps, type IndicatorBox } from './react/GlassIndicator';
export { GlassGroup, useGlassGroup, type GlassGroupProps } from './react/GlassGroup';
export { useGlassMode, useElementSize } from './react/hooks';
export { useGlassPhysics } from './react/useGlassPhysics';
export { GlassPhysics, OPTICAL_REST, presenceOpacity, staggerDelay, type OpticalChannel, type OpticalState, type GlassPhysicsOptions, type TransitionOptions } from './core/physics';
export { SPRINGS, type SpringConfig, type SpringInput, type SpringPreset } from './core/spring';
export type { GlassOptions, GlassVariant, GlassAppearance, GlassIntensity, ResolvedGlass } from './core/glass';
export type { Profile, ProfileName, ProfileFn } from './core/profiles';
export type { Radius } from './core/shape';
export type { RenderMode, RenderModePreference } from './core/support';
