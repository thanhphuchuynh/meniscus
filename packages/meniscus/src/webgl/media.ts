/** Media the WebGL renderer can draw from. */
export type Media = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export function isMediaElement(el: Element | null | undefined): el is Media {
  if (!el) return false;
  return (
    (typeof HTMLImageElement !== 'undefined' && el instanceof HTMLImageElement) ||
    (typeof HTMLVideoElement !== 'undefined' && el instanceof HTMLVideoElement) ||
    (typeof HTMLCanvasElement !== 'undefined' && el instanceof HTMLCanvasElement)
  );
}

export function isVideo(s: unknown): s is HTMLVideoElement {
  return typeof HTMLVideoElement !== 'undefined' && s instanceof HTMLVideoElement;
}

export function sourceSize(s: TexImageSource): [number, number] {
  if (isVideo(s)) return [s.videoWidth, s.videoHeight];
  if (typeof HTMLImageElement !== 'undefined' && s instanceof HTMLImageElement) return [s.naturalWidth, s.naturalHeight];
  if (typeof VideoFrame !== 'undefined' && s instanceof VideoFrame) return [s.displayWidth, s.displayHeight];
  const sized = s as { width: number; height: number };
  return [sized.width, sized.height];
}

export function sourceReady(s: TexImageSource): boolean {
  if (isVideo(s)) return s.readyState >= 2 && s.videoWidth > 0;
  if (typeof HTMLImageElement !== 'undefined' && s instanceof HTMLImageElement) return s.complete && s.naturalWidth > 0;
  const [w, h] = sourceSize(s);
  return w > 0 && h > 0;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One axis of `object-position`: a fraction of the free space, plus px. */
interface Offset {
  fraction: number;
  px: number;
}

function parseOffset(token: string | undefined): Offset {
  if (!token) return { fraction: 0.5, px: 0 };
  if (token === 'left' || token === 'top') return { fraction: 0, px: 0 };
  if (token === 'right' || token === 'bottom') return { fraction: 1, px: 0 };
  if (token === 'center') return { fraction: 0.5, px: 0 };
  if (token.endsWith('%')) return { fraction: parseFloat(token) / 100, px: 0 };
  if (token.endsWith('px')) return { fraction: 0, px: parseFloat(token) };
  return { fraction: 0.5, px: 0 };
}

/**
 * Where replaced content is drawn inside its content box, following
 * `object-fit` and `object-position` (keywords, percentages and px).
 */
export function fitRect(box: Rect, natural: [number, number], fit: string, position: string): Rect {
  const [nw, nh] = natural;
  let w = box.width;
  let h = box.height;
  if (nw > 0 && nh > 0 && fit !== 'fill') {
    const contain = Math.min(box.width / nw, box.height / nh);
    const cover = Math.max(box.width / nw, box.height / nh);
    const scale = fit === 'contain' ? contain : fit === 'cover' ? cover : fit === 'scale-down' ? Math.min(1, contain) : 1;
    w = nw * scale;
    h = nh * scale;
  }
  const [px, py] = position.trim().split(/\s+/);
  const ox = parseOffset(px);
  const oy = parseOffset(py ?? px);
  return {
    x: box.x + (box.width - w) * ox.fraction + ox.px,
    y: box.y + (box.height - h) * oy.fraction + oy.px,
    width: w,
    height: h,
  };
}

/** Where a media element's pixels are drawn on screen, in viewport px. */
export function mediaRect(el: Media): Rect {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const sx = el.offsetWidth ? r.width / el.offsetWidth : 1;
  const sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
  const left = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
  const top = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
  const right = (parseFloat(cs.borderRightWidth) || 0) + (parseFloat(cs.paddingRight) || 0);
  const bottom = (parseFloat(cs.borderBottomWidth) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const box = { x: 0, y: 0, width: el.offsetWidth - left - right, height: el.offsetHeight - top - bottom };
  const drawn = fitRect(box, sourceSize(el), cs.objectFit || 'fill', cs.objectPosition || '50% 50%');
  return { x: r.left + (left + drawn.x) * sx, y: r.top + (top + drawn.y) * sy, width: drawn.width * sx, height: drawn.height * sy };
}
