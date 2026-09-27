import { useRef, useState } from 'react';
import { composite, luminance, parseComputedColor, pickTone, type Tone } from '../core/tone';
import { resolveTint } from '../webgl/color';
import { isMediaElement, isVideo, mediaRect, sourceSize, type Media } from '../webgl/media';
import { backdropElement, type Backdrop } from './backdrop';
import { useIsomorphicLayoutEffect } from './hooks';

/** A region of the viewport, px. */
interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A moving page is sampled at most this often, ms. */
const INTERVAL = 100;
/** A playing video backdrop is sampled this often, ms. */
const VIDEO_INTERVAL = 500;
/** Where under the glass the page is hit-tested, as fractions of its box. */
const POINTS = [
  [0.5, 0.5],
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
] as const;

let sampler: CanvasRenderingContext2D | null | undefined;

function samplerContext(): CanvasRenderingContext2D | null {
  if (sampler !== undefined) return sampler;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (canvas) {
    canvas.width = 8;
    canvas.height = 8;
  }
  // A CPU canvas: reading pixels back from a GPU one would wait for the GPU.
  sampler = (canvas?.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null | undefined) ?? null;
  return sampler;
}

/** For tests: substitute the 8×8 sampling context, or undefined to create one again. */
export function overrideSampler(ctx: CanvasRenderingContext2D | null | undefined): void {
  sampler = ctx;
}

type Sample = number | 'transparent' | 'unreadable';

/**
 * Mean luminance of a media element's pixels under a region of the viewport.
 * `transparent` when nothing is drawn there, `unreadable` when the canvas is
 * tainted (a cross-origin source without CORS) or can't be created.
 */
export function sampleMedia(media: Media, region: Region): Sample {
  const ctx = samplerContext();
  if (!ctx) return 'unreadable';
  const drawn = mediaRect(media);
  const [nw, nh] = sourceSize(media);
  if (!(drawn.width > 0 && drawn.height > 0 && nw > 0 && nh > 0)) return 'transparent';
  const sx = ((region.left - drawn.x) / drawn.width) * nw;
  const sy = ((region.top - drawn.y) / drawn.height) * nh;
  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  const x1 = Math.min(nw, sx + (region.width / drawn.width) * nw);
  const y1 = Math.min(nh, sy + (region.height / drawn.height) * nh);
  if (x1 <= x0 || y1 <= y0) return 'transparent';
  let data: Uint8ClampedArray;
  try {
    ctx.clearRect(0, 0, 8, 8);
    ctx.drawImage(media, x0, y0, x1 - x0, y1 - y0, 0, 0, 8, 8);
    data = ctx.getImageData(0, 0, 8, 8).data;
  } catch {
    return 'unreadable';
  }
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    if (a <= 0) continue;
    sum += luminance([data[i]! / 255, data[i + 1]! / 255, data[i + 2]! / 255]) * a;
    weight += a;
  }
  // Almost nothing drawn (a blank WebGL canvas, say): look further down.
  return weight < 64 * 0.05 ? 'transparent' : sum / weight;
}

/** What lies under one point of the viewport: a luminance, something unreadable, or nothing opaque yet. */
function sampleAt(x: number, y: number, glass: HTMLElement): Sample {
  for (const el of document.elementsFromPoint(x, y)) {
    // The glass, its content, and other glass are translucent: look through them.
    if (glass.contains(el) || el.closest('[data-meniscus]')) continue;
    if (isMediaElement(el)) {
      const s = sampleMedia(el, { left: x - 4, top: y - 4, width: 8, height: 8 });
      if (s === 'transparent') continue;
      return s;
    }
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'unreadable';
    const bg = parseComputedColor(cs.backgroundColor);
    if (bg && bg[3] >= 0.5) return luminance(bg);
  }
  return 'transparent';
}

/** Luminance of the page's canvas color, under its color scheme. */
function canvasLuminance(): number {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;display:none;color:Canvas';
  document.documentElement.appendChild(probe);
  const color = parseComputedColor(getComputedStyle(probe).color);
  probe.remove();
  return color ? luminance(color) : 1;
}

/**
 * Mean luminance of what is behind a glass, or null when nothing there can
 * be read. Media named as its `backdrop` is read first. Otherwise the page is
 * hit-tested at five points under the glass, and each point takes the first
 * media or solid background color below it. Elements with
 * `pointer-events: none` are invisible to hit testing.
 */
export function sampleBackdrop(glass: HTMLElement, backdrop: HTMLElement | null): number | null {
  const r = glass.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return null;
  if (isMediaElement(backdrop)) {
    const s = sampleMedia(backdrop, r);
    if (typeof s === 'number') return s;
  }
  if (typeof document.elementsFromPoint !== 'function') return null;
  let sum = 0;
  let count = 0;
  let page: number | null = null;
  for (const [fx, fy] of POINTS) {
    const s = sampleAt(r.left + r.width * fx, r.top + r.height * fy, glass);
    if (s === 'unreadable') continue;
    sum += s === 'transparent' ? (page ??= canvasLuminance()) : s;
    count++;
  }
  return count ? sum / count : null;
}

export interface ToneOptions {
  /** Sample at all. */
  enabled: boolean;
  /** The glass's `backdrop`: media there is read before the page. */
  backdrop: Backdrop | undefined;
  /** Tinted glass's tint, composited over the backdrop to decide its ink. Null for adaptive glass. */
  tint: string | null;
}

/**
 * The tone behind a glass, light or dark: null until the first sample, and
 * whenever nothing behind can be read. It samples in a layout effect, before
 * the first client paint, then on resize and on any scroll or window resize.
 * That happens at most every 100 ms, and only while the glass is on screen.
 */
export function useBackdropTone(node: HTMLElement | null, { enabled, backdrop, tint }: ToneOptions): Tone | null {
  const [tone, setTone] = useState<Tone | null>(null);
  const toneRef = useRef<Tone | null>(null);
  const backdropRef = useRef(backdrop);
  backdropRef.current = backdrop;

  useIsomorphicLayoutEffect(() => {
    if (!enabled || !node) {
      toneRef.current = null;
      setTone(null);
      return;
    }
    let last = -Infinity;
    let timer = 0;
    let frame = 0;
    let visible = true;
    const run = () => {
      last = performance.now();
      const behind = sampleBackdrop(node, backdropElement(backdropRef.current));
      const next = behind === null ? null : pickTone(tint ? composite(resolveTint(node, tint), behind) : behind, toneRef.current);
      toneRef.current = next;
      setTone(next);
    };
    const schedule = () => {
      if (!visible || timer || frame) return;
      const wait = INTERVAL - (performance.now() - last);
      if (wait > 0) {
        timer = window.setTimeout(() => {
          timer = 0;
          schedule();
        }, wait);
      } else {
        frame = requestAnimationFrame(() => {
          frame = 0;
          run();
        });
      }
    };
    run();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(node);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
            if (visible) schedule();
          })
        : null;
    io?.observe(node);
    // Scroll events don't bubble, but a capturing listener hears every scroller on the page.
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const media = backdropElement(backdropRef.current);
    const video: HTMLVideoElement | null = isVideo(media) ? media : null;
    const poll = video
      ? window.setInterval(() => {
          if (!video.paused && !video.ended) schedule();
        }, VIDEO_INTERVAL)
      : 0;
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      clearInterval(poll);
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
  }, [node, enabled, tint]);

  return tone;
}
