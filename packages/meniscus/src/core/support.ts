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
export const REDUCED_TRANSPARENCY = '(prefers-reduced-transparency: reduce)';

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
