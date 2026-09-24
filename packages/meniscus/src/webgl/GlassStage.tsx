import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ElementType,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { GLASS_OPTION_KEYS } from '../core/constants';
import { resolveGlass, type GlassOptions } from '../core/glass';
import { supportsWebGL2 } from '../core/support';
import { Glass, type GlassProps } from '../react/Glass';
import { useMergedRef } from '../react/refs';
import { optionsKey, useGlassDefaults } from '../react/context';
import { useIsomorphicLayoutEffect } from '../react/hooks';
import { rippleOf } from '../react/liquid';
import { GlassRenderer, type Fit, type PaneFrame } from './renderer';
import { resolveTint, tintVersion } from './color';
import { MERGED_SHADOW, isVideo, sourceReady, sourceSize } from './media';
import { MAX_PANES } from './shaders';

export type StageStatus = 'pending' | 'ready' | 'fallback';

type Source = string | TexImageSource | RefObject<TexImageSource | null>;

interface PaneOptions extends GlassOptions { shadow?: string | false }

interface StageContextValue {
  status: StageStatus;
  register: (el: HTMLElement, options: () => PaneOptions) => () => void;
  /** Whether a pane gets one of the stage's WebGL slots. Panes past the limit frost instead. */
  drawn: (el: HTMLElement) => boolean;
  /** The stage draws the shadows for merged or layered panes. */
  shadowMode: 'css' | 'merged' | 'layered';
}

const StageContext = createContext<StageContextValue | null>(null);

export interface GlassStageProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** An image URL, or a video, canvas, image or bitmap (or a ref to one) rendered by you inside the stage. */
  source: Source;
  /** How the source fills the stage, like `object-fit`. */
  fit?: Fit;
  /** Alt text when `source` is an image URL. */
  alt?: string;
  /** CORS mode for an image URL. Cross-origin images must be served with CORS headers to reach WebGL. */
  crossOrigin?: '' | 'anonymous' | 'use-credentials';
  /** Upper bound on canvas resolution. */
  maxPixelRatio?: number;
  /** Redraw every frame, for canvas sources that change on their own. Video redraws while playing. */
  animate?: boolean;
  /** Called with the rendering path once it's known. */
  onStatus?: (status: StageStatus) => void;
  /** Let panes fuse like drops: outlines closer than this many px bridge into one surface. 0 keeps them apart. */
  merge?: number;
  /** Refract stacked panes and their shadows in registration order, back to front. Adds one pass per pane. Merge takes precedence. */
  layered?: boolean;
  children?: ReactNode;
}

const FILL: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' };

function resolveSource(source: Source, img: HTMLImageElement | null): TexImageSource | null {
  if (typeof source === 'string') return img;
  if (source && typeof source === 'object' && 'current' in source) return source.current;
  return source as TexImageSource;
}

/**
 * True refraction in every browser, over media you provide. The stage draws
 * the source into a WebGL canvas and refracts it under each `GlassPane`
 * inside. Where WebGL2 is missing, or the media can't be read (cross-origin
 * without CORS), panes fall back to frosted glass over the media itself.
 */
export function GlassStage({ source, fit = 'cover', alt = '', crossOrigin, maxPixelRatio = 2, animate = false, onStatus, merge = 0, layered = false, style, children, ...rest }: GlassStageProps) {
  const [status, setStatus] = useState<StageStatus>('pending');
  const [restoreKey, setRestoreKey] = useState(0);
  const [slotsVersion, setSlotsVersion] = useState(0);
  // Error state belongs to one source: a new URL gets a fresh attempt.
  const [blocked, setBlocked] = useState<{ source: Source; cors: boolean; failed: boolean } | null>(null);
  const cors = blocked?.source === source && blocked.cors;
  const failed = blocked?.source === source && blocked.failed;

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const panes = useRef(new Map<HTMLElement, () => PaneOptions>());
  const dirty = useRef(true);
  const onStatusRef = useRef(onStatus);
  useIsomorphicLayoutEffect(() => {
    onStatusRef.current = onStatus;
  });

  const drawn = useCallback(
    (el: HTMLElement) => {
      let i = 0;
      for (const key of panes.current.keys()) {
        if (key === el) return i < MAX_PANES;
        i++;
      }
      return false;
    },
    // slotsVersion re-creates the function so panes re-read their slot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slotsVersion],
  );

  const register = useCallback((el: HTMLElement, options: () => PaneOptions) => {
    panes.current.set(el, options);
    dirty.current = true;
    if (panes.current.size > MAX_PANES) setSlotsVersion((v) => v + 1);
    return () => {
      const overflowed = panes.current.size > MAX_PANES;
      panes.current.delete(el);
      dirty.current = true;
      if (overflowed) setSlotsVersion((v) => v + 1);
    };
  }, []);

  useEffect(() => {
    onStatusRef.current?.(status);
  }, [status]);

  const onImageError = useCallback(() => {
    // In CORS mode a cross-origin image without CORS headers fails to load
    // at all. Retry without CORS: it shows, frosted, but WebGL can't read it.
    // A second failure is a broken image.
    setBlocked((b) => (b?.source === source && b.cors ? { source, cors: true, failed: true } : { source, cors: true, failed: false }));
    setStatus('fallback');
  }, [source]);

  // An error that fired before hydration never reaches React's listener.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0 && typeof source === 'string') onImageError();
  }, [source, onImageError]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    if (cors || failed || !supportsWebGL2()) {
      setStatus('fallback');
      return;
    }
    setStatus('pending');

    let renderer: GlassRenderer;
    try {
      renderer = new GlassRenderer(canvas);
    } catch {
      setStatus('fallback');
      return;
    }

    let frame = 0;
    let visible = true;
    let running = true;
    let lastSignature = '';
    let uploaded: TexImageSource | null = null;
    const frames: PaneFrame[] = [];

    const upload = (src: TexImageSource) => {
      const [w, h] = sourceSize(src);
      try {
        renderer.setSource(src, w, h);
        uploaded = src;
        return true;
      } catch {
        running = false;
        setStatus('fallback');
        return false;
      }
    };

    // A paused video still changes frame when it seeks or loads.
    const initial = resolveSource(source, imgRef.current);
    const reupload = () => {
      uploaded = null;
    };
    if (isVideo(initial)) {
      initial.addEventListener('seeked', reupload);
      initial.addEventListener('loadeddata', reupload);
    }

    const loop = (now: number) => {
      if (!running) return;
      frame = requestAnimationFrame(loop);
      if (!visible) return;
      const src = resolveSource(source, imgRef.current);
      if (!src || !sourceReady(src)) return;

      const live = (isVideo(src) && !src.paused && !src.ended) || animate;
      if (uploaded !== src || live) {
        if (!upload(src)) return;
        dirty.current = true;
      }

      const pr = Math.min(maxPixelRatio, window.devicePixelRatio || 1);
      const box = stage.getBoundingClientRect();
      // Pane rects are in screen px; a scaled ancestor makes those differ from
      // the stage's own layout px, which the canvas is sized in.
      const scaleX = stage.offsetWidth ? box.width / stage.offsetWidth : 1;
      const scaleY = stage.offsetHeight ? box.height / stage.offsetHeight : 1;
      const cw = Math.max(1, Math.round(stage.clientWidth * pr));
      const ch = Math.max(1, Math.round(stage.clientHeight * pr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        dirty.current = true;
      }

      frames.length = 0;
      let signature = `${cw}x${ch}|${tintVersion()}`;
      for (const [el, getOptions] of panes.current) {
        if (frames.length >= MAX_PANES) break;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const options = getOptions();
        const width = r.width / scaleX;
        const height = r.height / scaleY;
        const glass = resolveGlass(options, width, height);
        const x = (r.left - box.left) / scaleX - stage.clientLeft;
        const y = (r.top - box.top) / scaleY - stage.clientTop;
        const ripple = rippleOf(el) ?? null;
        ripple?.advance(now);
        frames.push({ x, y, glass, tint: resolveTint(el, glass.tint), shadow: options.shadow === undefined, ripple });
        signature += `|${x.toFixed(2)},${y.toFixed(2)},${width.toFixed(2)},${height.toFixed(2)},${optionsKey(options)}${ripple ? `~${ripple.version}` : ''}`;
      }

      if (!live && !dirty.current && signature === lastSignature) return;
      lastSignature = signature;
      dirty.current = false;
      // Merged or stacked panes carry their shadows in the renderer.
      try {
        renderer.render(frames, fit, pr, { merge, layered, shadow: merge > 0 || layered ? MERGED_SHADOW : null });
      } catch {
        running = false;
        setStatus('fallback');
        return;
      }
      setStatus((s) => (s === 'ready' ? s : 'ready'));
    };

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
            dirty.current = true;
          })
        : null;
    io?.observe(stage);

    const onLost = (e: Event) => {
      e.preventDefault();
      running = false;
      cancelAnimationFrame(frame);
      setStatus('fallback');
    };
    const onRestored = () => setRestoreKey((k) => k + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    frame = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      io?.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (isVideo(initial)) {
        initial.removeEventListener('seeked', reupload);
        initial.removeEventListener('loadeddata', reupload);
      }
      renderer.dispose();
    };
  }, [source, fit, maxPixelRatio, animate, cors, failed, restoreKey, merge, layered]);

  const value = useMemo<StageContextValue>(() => ({ status, register, drawn, shadowMode: merge > 0 ? 'merged' : layered ? 'layered' : 'css' }), [status, register, drawn, merge, layered]);

  return (
    <StageContext.Provider value={value}>
      <div ref={stageRef} data-meniscus-stage={status} style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate', ...style }} {...rest}>
        {typeof source === 'string' ? (
          <img
            ref={imgRef}
            src={source}
            alt={alt}
            crossOrigin={cors ? undefined : (crossOrigin ?? 'anonymous')}
            onError={onImageError}
            style={{ ...FILL, objectFit: fit }}
            draggable={false}
          />
        ) : null}
        {/* The canvas stays mounted in fallback so a new source or a restored context can try again. */}
        <canvas ref={canvasRef} aria-hidden="true" style={{ ...FILL, pointerEvents: 'none', opacity: status === 'ready' ? 1 : 0 }} />
        {children}
      </div>
    </StageContext.Provider>
  );
}

export type GlassPaneProps<T extends ElementType = 'div'> = Omit<GlassProps<T>, 'mode'>;

function GlassPaneImpl(props: GlassPaneProps<ElementType>, forwardedRef: ForwardedRef<HTMLElement>) {
  const stage = useContext(StageContext);
  const defaults = useGlassDefaults();
  const [el, setEl] = useState<HTMLElement | null>(null);
  const optionsRef = useRef<PaneOptions>({});

  const options: PaneOptions = { shadow: props.shadow };
  for (const key of GLASS_OPTION_KEYS) {
    const value = (props as Record<string, unknown>)[key] ?? defaults[key];
    if (value !== undefined) (options as Record<string, unknown>)[key] = value;
  }
  useIsomorphicLayoutEffect(() => {
    optionsRef.current = options;
  });

  const setRef = useMergedRef(forwardedRef, setEl);
  const register = stage?.register;
  useIsomorphicLayoutEffect(() => {
    if (!register || !el) return;
    return register(el, () => optionsRef.current);
  }, [register, el]);

  const webgl = stage?.status === 'ready' && !!el && stage.drawn(el);
  const Pane = Glass as (p: Record<string, unknown>) => ReactElement | null;
  const keepCSSShadow = stage?.shadowMode === 'css' || (stage?.shadowMode === 'layered' && typeof props.shadow === 'string');
  const shadow = webgl && !keepCSSShadow ? false : props.shadow;
  return <Pane {...props} ref={setRef} shadow={shadow} mode={webgl ? 'none' : 'frost'} ripple={webgl ? props.ripple : false} data-meniscus-pane="" />;
}

/**
 * A glass pane inside a `GlassStage`. Lay it out with CSS like any element;
 * the stage draws its refraction underneath.
 */
export const GlassPane = forwardRef(GlassPaneImpl) as unknown as (<T extends ElementType = 'div'>(
  props: GlassPaneProps<T> & { ref?: ComponentPropsWithRef<T>['ref'] },
) => ReactElement | null) & { displayName?: string };

GlassPane.displayName = 'GlassPane';

export function useGlassStage(): StageStatus | null {
  return useContext(StageContext)?.status ?? null;
}
