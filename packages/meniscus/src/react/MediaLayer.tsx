import { useEffect, useRef, type CSSProperties } from 'react';
import type { ResolvedGlass } from '../core/glass';
import { resolveTint } from '../webgl/color';
import { isVideo, mediaRect, sourceReady, sourceSize, type Media } from '../webgl/media';
import type { GlassRenderer, PaneFrame } from '../webgl/renderer';

/** One pane of glass, in the host's layout px. */
export interface MediaPane {
  x: number;
  y: number;
  glass: ResolvedGlass;
  /** Where CSS custom properties in the tint resolve. */
  el: HTMLElement;
}

export interface MediaFrame {
  panes: MediaPane[];
  /** The part of the host to draw, layout px: the panes plus room for the shadow. */
  box: { x: number; y: number; width: number; height: number };
  merge: number;
  shadow: boolean;
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

const SHADOW = { strength: 0.22, drop: 9, blur: 16.5 };
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
    let visible = true;
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

    const loop = () => {
      if (!running || !renderer) return;
      raf = requestAnimationFrame(loop);
      if (!visible || !sourceReady(media)) return;
      const live = (isVideo(media) && !media.paused && !media.ended) || media instanceof HTMLCanvasElement;
      if (!uploaded || live) {
        const [w, h] = sourceSize(media);
        try {
          renderer.setSource(media, w, h);
          uploaded = true;
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

      const hostRect = host.getBoundingClientRect();
      const sx = host.offsetWidth ? hostRect.width / host.offsetWidth : 1;
      const sy = host.offsetHeight ? hostRect.height / host.offsetHeight : 1;
      const pr = Math.min(maxPixelRatio, window.devicePixelRatio || 1);
      const { box } = f;
      const cw = Math.max(1, Math.round(box.width * pr));
      const ch = Math.max(1, Math.round(box.height * pr));
      // The media's drawn rect, from viewport px into the canvas's layout px.
      const m = mediaRect(media);
      const placement = {
        x: (m.x - hostRect.left) / sx - host.clientLeft - box.x,
        y: (m.y - hostRect.top) / sy - host.clientTop - box.y,
        width: m.width / sx,
        height: m.height / sy,
      };
      const key = `${f.key}|${box.x.toFixed(2)},${box.y.toFixed(2)},${cw}x${ch}|${placement.x.toFixed(2)},${placement.y.toFixed(2)},${placement.width.toFixed(2)},${placement.height.toFixed(2)}`;
      if (!live && key === last) return;
      last = key;

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      Object.assign(canvas.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px`, visibility: 'visible' });
      panes.length = 0;
      for (const p of f.panes) panes.push({ x: p.x - box.x, y: p.y - box.y, glass: p.glass, tint: resolveTint(p.el, p.glass.tint) });
      renderer.render(panes, placement, pr, { merge: f.merge, panesOnly: true, shadow: f.shadow ? SHADOW : null });
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
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
            last = '';
          })
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
