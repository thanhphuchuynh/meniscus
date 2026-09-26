import { useEffect, useRef, type CSSProperties } from 'react';
import type { ResolvedGlass } from '../core/glass';
import { NEAR } from '../core/support';
import type { OpticalState } from '../core/physics';
import { resolveTint, tintVersion } from '../webgl/color';
import { MERGED_SHADOW, isVideo, mediaRect, sourceReady, sourceSize, type Media } from '../webgl/media';
import type { GlassRenderer, PaneFrame } from '../webgl/renderer';
import { rippleOf } from './liquid';

/** One pane of glass, in the host's layout px. */
export interface MediaPane {
  x: number;
  y: number;
  glass: ResolvedGlass;
  /** Where CSS custom properties in the tint resolve. */
  el: HTMLElement;
  /** Its optics on springs, if any. */
  optics?: OpticalState | null;
}

export interface MediaFrame {
  panes: MediaPane[];
  /** The part of the host to draw, layout px: the panes plus room for the shadow. */
  box: { x: number; y: number; width: number; height: number };
  merge: number;
  shadow: boolean;
  /** Composite the panes back to front, each refracting those before it. */
  layered?: boolean;
  /** With `layered`: keep only this pane in the output. */
  clip?: number;
  /** Changes whenever anything that affects the drawing changes. */
  key: string;
}

export interface MediaLayerProps {
  /** The positioned element `frame()` measures in; the canvas is placed inside it. */
  host: HTMLElement;
  media: Media;
  /** Called every animation frame while visible; null hides the layer. */
  frame: () => MediaFrame | null;
  /** WebGL or the media turned out unusable: fall back to frosted glass. */
  onFail: () => void;
  maxPixelRatio?: number;
  style?: CSSProperties;
}

const CANVAS: CSSProperties = { position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none', display: 'block' };

/**
 * Glass drawn in WebGL over an image, video or canvas that sits behind it,
 * for browsers that can't refract the live page. The renderer loads on
 * first use. The canvas covers only the glass and its shadow, and draws the
 * media from wherever it is on screen, so the refraction lines up with it.
 */
export function MediaLayer({ host, media, frame, onFail, maxPixelRatio = 2, style }: MediaLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: GlassRenderer | null = null;
    let running = true;
    let raf = 0;
    // Off screen until the observer's first report says otherwise.
    let visible = typeof IntersectionObserver === 'undefined';
    let uploaded = false;
    let last = '';
    const panes: PaneFrame[] = [];

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const fail = () => {
      stop();
      failRef.current();
    };
    const reupload = () => {
      uploaded = false;
    };

    const loop = (now: number) => {
      if (!running || !renderer) return;
      raf = requestAnimationFrame(loop);
      if (!visible || !sourceReady(media)) return;
      const live = (isVideo(media) && !media.paused && !media.ended) || media instanceof HTMLCanvasElement;
      if (!uploaded || live) {
        const [w, h] = sourceSize(media);
        try {
          // False while an image decodes: nothing to draw yet.
          if (!renderer.uploadDecoded(media, w, h)) return;
          uploaded = true;
          // New pixels: draw even if nothing else changed.
          last = '';
        } catch {
          // Cross-origin media without CORS can't be read.
          fail();
          return;
        }
      }
      const f = frameRef.current();
      if (!f || !f.panes.length) {
        canvas.style.visibility = 'hidden';
        last = '';
        return;
      }

      const { left, top, sx, sy } = hostOrigin(host);
      const pr = Math.min(maxPixelRatio, window.devicePixelRatio || 1);
      const { box } = f;
      const cw = Math.max(1, Math.round(box.width * pr));
      const ch = Math.max(1, Math.round(box.height * pr));
      // The media's drawn rect, from viewport px into the canvas's layout px.
      const m = mediaRect(media);
      const placement = {
        x: (m.x - left) / sx - host.clientLeft - box.x,
        y: (m.y - top) / sy - host.clientTop - box.y,
        width: m.width / sx,
        height: m.height / sy,
      };
      let waves = '';
      for (const p of f.panes) {
        const ripple = rippleOf(p.el);
        if (!ripple) continue;
        ripple.advance(now);
        waves += `~${ripple.version}`;
      }
      const key = `${f.key}|${tintVersion()}|${waves}|${box.x.toFixed(2)},${box.y.toFixed(2)},${cw}x${ch}|${placement.x.toFixed(2)},${placement.y.toFixed(2)},${placement.width.toFixed(2)},${placement.height.toFixed(2)}`;
      if (!live && key === last) return;
      last = key;

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      Object.assign(canvas.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`, visibility: 'visible' });
      panes.length = 0;
      for (const p of f.panes) panes.push({ x: p.x - box.x, y: p.y - box.y, glass: p.glass, tint: resolveTint(p.el, p.glass.tint), ripple: rippleOf(p.el) ?? null, optics: p.optics ?? null });
      renderer.render(panes, placement, pr, { merge: f.merge, panesOnly: true, shadow: f.shadow ? MERGED_SHADOW : null, layered: f.layered, clip: f.clip });
    };

    import('../webgl/renderer').then(
      ({ GlassRenderer }) => {
        if (!running) return;
        try {
          renderer = new GlassRenderer(canvas);
        } catch {
          fail();
          return;
        }
        raf = requestAnimationFrame(loop);
      },
      () => fail(),
    );

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              visible = entries.some((e) => e.isIntersecting);
              last = '';
            },
            { rootMargin: NEAR },
          )
        : null;
    io?.observe(host);
    const onLost = (e: Event) => {
      e.preventDefault();
      fail();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    media.addEventListener('load', reupload);
    media.addEventListener('seeked', reupload);
    media.addEventListener('loadeddata', reupload);

    return () => {
      stop();
      io?.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      media.removeEventListener('load', reupload);
      media.removeEventListener('seeked', reupload);
      media.removeEventListener('loadeddata', reupload);
      renderer?.dispose();
    };
  }, [host, media, maxPixelRatio]);

  return <canvas ref={canvasRef} aria-hidden="true" data-meniscus-layer="webgl" style={{ ...CANVAS, ...style }} />;
}

/**
 * Where a host's untransformed box sits on screen: its top left, and the
 * scale its ancestors apply. Its own squash (a centered matrix, area kept) is
 * divided out, anchored at the center, which the squash never moves.
 */
export function hostOrigin(host: HTMLElement): { left: number; top: number; sx: number; sy: number } {
  const r = host.getBoundingClientRect();
  const [ma, mb, mc, md] = ownMatrix(host);
  const w = host.offsetWidth;
  const h = host.offsetHeight;
  const sx = w ? r.width / (Math.abs(ma) * w + Math.abs(mc) * h) : 1;
  const sy = h ? r.height / (Math.abs(mb) * w + Math.abs(md) * h) : 1;
  return { left: r.left + (r.width - w * sx) / 2, top: r.top + (r.height - h * sy) / 2, sx, sy };
}

/** The host's own inline matrix (the squash) as [a, b, c, d]; identity for anything else. */
function ownMatrix(el: HTMLElement): [number, number, number, number] {
  const m = /^matrix\(([^)]*)\)$/.exec(el.style.transform);
  const v = m ? m[1]!.split(',').map(Number) : [];
  return v.length === 6 && v.every(Number.isFinite) ? [v[0]!, v[1]!, v[2]!, v[3]!] : [1, 0, 0, 1];
}
