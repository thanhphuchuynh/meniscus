/**
 * Rendering paths:
 * - `refract`: SVG displacement inside `backdrop-filter` bends live page
 *   content. Chromium only.
 * - `frost`: blur, saturation, tint and rim light through CSS. Every browser.
 * - `none`: shape, shadow and interaction only, for glass drawn by another
 *   renderer (the WebGL stage uses this).
 */
export type RenderMode = 'refract' | 'frost' | 'none';
export type RenderModePreference = 'auto' | RenderMode;

interface NavigatorUAData {
  brands?: Array<{ brand: string }>;
}

let refractionSupport: boolean | undefined;

/**
 * Whether this browser applies SVG filters inside `backdrop-filter`.
 *
 * Feature queries can't answer this: Safari and Firefox parse
 * `backdrop-filter: url(#f)` as valid and then draw nothing. Only Blink
 * renders it, so detection asks for a Blink engine (and never iOS, where every
 * browser runs WebKit).
 */
export function supportsBackdropRefraction(): boolean {
  if (refractionSupport !== undefined) return refractionSupport;
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  refractionSupport = detect();
  return refractionSupport;
}

function detect(): boolean {
  const nav = navigator as Navigator & { userAgentData?: NavigatorUAData };
  const ua = nav.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  if (iOS) return false;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && !CSS.supports('backdrop-filter', 'blur(1px)')) return false;
  const brands = nav.userAgentData?.brands;
  if (brands && brands.length) return brands.some((b) => /Chromium/i.test(b.brand));
  if (/Firefox\/|FxiOS/.test(ua)) return false;
  return /Chrome\/|Chromium\//.test(ua);
}

export function resolveRenderMode(preference: RenderModePreference = 'auto'): RenderMode {
  if (preference !== 'auto') return preference;
  return supportsBackdropRefraction() ? 'refract' : 'frost';
}

/** For tests and for hosts that know better than the sniffing above. */
export function overrideRefractionSupport(value: boolean | undefined): void {
  refractionSupport = value;
}

export function matchesMedia(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
/** Chromium only: Safari has no such query and Firefox keeps it behind a flag, so `GlassProvider reduceTransparency` exists for apps' own settings. */
export const REDUCED_TRANSPARENCY = '(prefers-reduced-transparency: reduce)';
export const MORE_CONTRAST = '(prefers-contrast: more)';
export const FORCED_COLORS = '(forced-colors: active)';

let elementCopy: boolean | undefined;

/**
 * Whether the browser can paint a live copy of an element as an image
 * (Firefox's `-moz-element()`), which lets glass refract a named backdrop
 * through a plain CSS filter where backdrop filters can't take SVG.
 */
export function supportsElementCopy(): boolean {
  if (elementCopy !== undefined) return elementCopy;
  elementCopy = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('background-image', '-moz-element(#a)');
  return elementCopy;
}

/** For tests: force element copies on or off, or undefined to detect again. */
export function overrideElementCopy(value: boolean | undefined): void {
  elementCopy = value;
}

/** The CSS image that paints a live copy of the element with this id. */
export function elementImage(id: string): string {
  return copyImage ? copyImage(id) : `-moz-element(#${CSS.escape(id)})`;
}

let copyImage: ((id: string) => string) | undefined;

/** For tests: substitute the copy image, e.g. a plain url() where `-moz-element()` doesn't exist. */
export function overrideElementImage(fn: ((id: string) => string) | undefined): void {
  copyImage = fn;
}

let webgl2Support: boolean | undefined;

/** Whether WebGL2 is available. Probed once; the probe context is released right away. */
export function supportsWebGL2(): boolean {
  if (webgl2Support !== undefined) return webgl2Support;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    webgl2Support = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Support = false;
  }
  return webgl2Support;
}

/** For tests: force WebGL2 support on or off, or undefined to probe again. */
export function overrideWebGL2(value: boolean | undefined): void {
  webgl2Support = value;
}
