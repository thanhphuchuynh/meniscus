const colorCache = new Map<string, [number, number, number, number] | null>();
let colorCtx: CanvasRenderingContext2D | null | undefined;

/**
 * Parses a CSS color into 0..1 rgba, or returns null when the canvas can't
 * read it (custom properties, currentColor, color-mix in older engines).
 */
export function parseColor(css: string): [number, number, number, number] | null {
  if (colorCache.has(css)) return colorCache.get(css)!;
  if (colorCtx === undefined) colorCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!colorCtx) return null;
  // An unparseable value leaves fillStyle unchanged, so try it over two different sentinels.
  colorCtx.fillStyle = '#000';
  colorCtx.fillStyle = css;
  const a = String(colorCtx.fillStyle);
  colorCtx.fillStyle = '#fff';
  colorCtx.fillStyle = css;
  const b = String(colorCtx.fillStyle);
  if (a !== b) return null;
  let rgba: [number, number, number, number] | null = null;
  const hex = /^#([0-9a-f]{6})$/i.exec(a);
  const fn = /^rgba?\(([^)]+)\)$/i.exec(a);
  const srgb = /^color\(srgb\s+([^)]+)\)$/i.exec(a);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    rgba = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  } else if (fn) {
    const parts = fn[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
    rgba = [(parts[0] ?? 255) / 255, (parts[1] ?? 255) / 255, (parts[2] ?? 255) / 255, parts[3] ?? 1];
  } else if (srgb) {
    const parts = srgb[1]!.split(/[\s/]+/).filter(Boolean).map(Number);
    rgba = [parts[0] ?? 1, parts[1] ?? 1, parts[2] ?? 1, parts[3] ?? 1];
  }
  colorCache.set(css, rgba);
  return rgba;
}

const WHITE_MIST: [number, number, number, number] = [1, 1, 1, 0.1];
const tintCache = new WeakMap<HTMLElement, Map<string, [number, number, number, number]>>();

/**
 * A tint as rgba. Plain colors parse directly; custom properties and
 * currentColor are resolved against the element, where they're defined.
 */
export function resolveTint(el: HTMLElement, css: string): [number, number, number, number] {
  const parsed = parseColor(css);
  if (parsed) return parsed;
  let cache = tintCache.get(el);
  const hit = cache?.get(css);
  if (hit) return hit;
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;display:none;color:${css}`;
  el.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const rgba = parseColor(computed) ?? WHITE_MIST;
  if (!cache) tintCache.set(el, (cache = new Map()));
  cache.set(css, rgba);
  return rgba;
}
