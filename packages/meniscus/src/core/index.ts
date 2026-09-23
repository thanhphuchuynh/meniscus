export { PROFILES, resolveProfile, profileKey, type Profile, type ProfileFn, type ProfileName } from './profiles';
export {
  computeRefractionProfile,
  sampleTable,
  traceRay,
  DEFAULT_SAMPLES,
  FOLD_LIMIT,
  type OpticsInput,
  type RefractionProfile,
  type RayTrace,
} from './optics';
export { resolveRadius, roundedRectSdf, type Radius, type SdfSample } from './shape';
export {
  createDisplacementTiles,
  createHighlightImage,
  lightVector,
  shadeSurface,
  BOUNCE_STRENGTH,
  DEFAULT_SHININESS,
  RIM_POWER,
  RIM_FLOOR,
  RIM_BACK,
  SHADE_POWER,
  SHADE_FLOOR,
  SHADE_COLOR,
  type DisplacementTiles,
  type HighlightImage,
  type Lighting,
  type RGBAImage,
  type ShadeTerms,
} from './maps';
export { toDataURL, encodePNG } from './encode';
export {
  resolveGlass,
  glassProfile,
  lightingProfile,
  glassTiles,
  glassHighlight,
  VARIANTS,
  DEFAULTS,
  type GlassOptions,
  type GlassVariant,
  type ResolvedGlass,
  type TileURLs,
  type HighlightURL,
} from './glass';
export { describeFilter, filterMarkup, ABERRATION_SPREAD, type FilterNode, type FilterInput, type FilterAttrs } from './filter';
export {
  supportsBackdropRefraction,
  resolveRenderMode,
  overrideRefractionSupport,
  supportsWebGL2,
  matchesMedia,
  REDUCED_MOTION,
  REDUCED_TRANSPARENCY,
  type RenderMode,
  type RenderModePreference,
} from './support';
export { GLASS_OPTION_KEYS, DEFAULT_SHADOW } from './constants';
export { createUnionMaps, unionPixelScale, unionReach, type UnionShape, type UnionInput, type UnionMaps } from './union';
