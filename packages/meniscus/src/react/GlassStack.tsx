import {
  createContext,
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';
import type { GlassOptions, ResolvedGlass } from '../core/glass';
import { staggerDelay, type GlassPhysics } from '../core/physics';
import type { SpringInput } from '../core/spring';
import { isMediaElement } from '../webgl/media';
import { DEV } from './dev';
import { Glass, type GlassOwnProps } from './Glass';
import { useIsomorphicLayoutEffect } from './hooks';
import { useMergedRef } from './refs';
import { InsideLayerContext, LayerContext, type LayerHandle, type StackPane } from './stack';
import { useGlassPhysics } from './useGlassPhysics';

/** How a stack's control layers draw. */
export type StackRenderer = 'auto' | 'css' | 'webgl';

type ContextMedia = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

export interface GlassStackProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** The spring for every layer that sets none: a preset name, or mass, stiffness and damping. Default `'snappy'`. */
  physics?: SpringInput;
  /**
   * The wait between depth ranks in a shared transition, as a fraction of each
   * layer's spring period. Nearer layers lead and deeper ones follow; a
   * negative value reverses the order, and 0 moves every layer together.
   * Default 0.12.
   */
  stagger?: number;
  /**
   * How control layers draw. `'auto'` refracts the live page where the browser
   * can and uses WebGL over a media context elsewhere; `'css'` never uses
   * WebGL; `'webgl'` uses WebGL over a media context everywhere. Default
   * `'auto'`.
   */
  renderer?: StackRenderer;
  /** Layers shown on mount enter from hidden, staggered by depth. Default false. */
  appear?: boolean;
  /** The element to render. Default `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

export interface GlassLayerProps extends Omit<GlassOwnProps, 'optics' | 'backdrop'>, Omit<HTMLAttributes<HTMLElement>, 'children' | 'color'> {
  /** Stacking order: higher is nearer the viewer. Sets `z-index`; without it, layers stack in page order. */
  depth?: number;
  /**
   * `'control'` (the default) is glass that refracts everything beneath it,
   * lower layers included. `'context'` is the scene behind: images, video,
   * gradients or any content, drawn as it is.
   */
  kind?: 'context' | 'control';
  /** For a context layer: the media the WebGL path draws. Defaults to the first `img`, `video` or `canvas` inside. */
  source?: ContextMedia | RefObject<ContextMedia | null>;
  /** Whether the layer is shown. Changes animate on its springs, staggered with the other layers changing in the same render. Default true. */
  present?: boolean;
  /** This layer's spring, over the stack's: a preset name, or mass, stiffness and damping. It also sets the layer's place in a stagger. */
  physics?: SpringInput;
  /** The element to render. Default `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

interface LayerRecord {
  el: HTMLElement;
  kind: 'context' | 'control';
  depth: number | undefined;
  physics: SpringInput | undefined;
  optics: GlassPhysics | null;
  glass: (() => ResolvedGlass | null) | null;
}

interface StackValue {
  physics: SpringInput | undefined;
  renderer: StackRenderer;
  appear: boolean;
  source: ContextMedia | null;
  setSource(media: ContextMedia | null): void;
  register(record: LayerRecord): () => void;
  update(el: HTMLElement, patch: Partial<LayerRecord>): void;
  present(el: HTMLElement, present: boolean): void;
  below(el: HTMLElement): StackPane[];
}

const StackContext = createContext<StackValue | null>(null);

let warnedOutside = false;
let warnedNested = false;

/**
 * Layers of glass over a scene. Control layers refract everything painted
 * beneath them, lower glass included: live in Chromium, in WebGL over media
 * in Safari and Firefox. Each layer's optics move on springs, and layers that
 * change together are staggered by depth.
 */
function GlassStackImpl({ physics, stagger = 0.12, renderer = 'auto', appear = false, as, style, children, ...rest }: GlassStackProps, ref: ForwardedRef<HTMLElement>) {
  const inside = useContext(InsideLayerContext);
  useEffect(() => {
    if (!inside || !DEV || warnedNested) return;
    warnedNested = true;
    console.warn('meniscus: a <Glass.Stack> inside a control layer can’t see past that layer’s glass. Place stacks side by side, not inside glass.');
  }, [inside]);

  const records = useRef(new Map<HTMLElement, LayerRecord>());
  const [source, setSourceState] = useState<ContextMedia | null>(null);
  const settings = useRef({ physics, stagger });
  settings.current = { physics, stagger };
  const queue = useRef<Array<{ el: HTMLElement; present: boolean }>>([]);
  const scheduled = useRef(false);

  const depthOf = useCallback((el: HTMLElement): number => {
    const record = records.current.get(el);
    if (record?.depth !== undefined) return record.depth;
    // Without a depth, later in the page is nearer.
    let index = 0;
    for (const other of records.current.keys()) if (other.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) index++;
    return index;
  }, []);

  const flush = useCallback(() => {
    scheduled.current = false;
    const { physics: base, stagger: gap } = settings.current;
    const batch = queue.current.splice(0).filter((b) => records.current.get(b.el)?.optics);
    batch.sort((a, b) => depthOf(b.el) - depthOf(a.el));
    if (gap < 0) batch.reverse();
    batch.forEach(({ el, present }, rank) => {
      const record = records.current.get(el)!;
      const to = present ? 1 : 0;
      record.optics!.to({ presence: to, shadow: to }, { delay: staggerDelay(rank, record.physics ?? base, gap) });
    });
  }, [depthOf]);

  const value = useMemo<StackValue>(
    () => ({
      physics,
      renderer,
      appear,
      source,
      setSource: (media) => setSourceState((prev) => (prev === media ? prev : media)),
      register(record) {
        records.current.set(record.el, record);
        return () => {
          records.current.delete(record.el);
          queue.current = queue.current.filter((q) => q.el !== record.el);
        };
      },
      update(el, patch) {
        const record = records.current.get(el);
        if (record) Object.assign(record, patch);
      },
      present(el, present) {
        queue.current = queue.current.filter((q) => q.el !== el);
        queue.current.push({ el, present });
        if (scheduled.current) return;
        scheduled.current = true;
        // Every layer's layout effect in one commit runs before this microtask: one batch per commit.
        queueMicrotask(flush);
      },
      below(el) {
        const mine = depthOf(el);
        const out: Array<StackPane & { depth: number }> = [];
        for (const record of records.current.values()) {
          if (record.el === el || record.kind !== 'control' || !record.optics || !record.glass) continue;
          const glass = record.glass();
          const depth = depthOf(record.el);
          if (glass && depth < mine) out.push({ el: record.el, glass, optics: record.optics, depth });
        }
        return out.sort((a, b) => a.depth - b.depth).map(({ el: e, glass, optics }) => ({ el: e, glass, optics }));
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(physics ?? null), renderer, appear, source, flush, depthOf],
  );

  return createElement(
    as ?? 'div',
    { ...rest, ref, 'data-meniscus-stack': '', style: { position: 'relative', isolation: 'isolate', ...style } },
    <StackContext.Provider value={value}>{children}</StackContext.Provider>,
  );
}

function ContextLayer({ depth, source, as, style, children, ...rest }: GlassLayerProps, ref: ForwardedRef<HTMLElement>) {
  const stack = useContext(StackContext);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const setRef = useMergedRef(ref, setEl);
  useIsomorphicLayoutEffect(() => {
    if (!stack || !el) return;
    return stack.register({ el, kind: 'context', depth, physics: undefined, optics: null, glass: null });
  }, [stack?.register, el]);
  useIsomorphicLayoutEffect(() => {
    if (!stack || !el) return;
    stack.update(el, { depth });
    const explicit = source && 'current' in source ? source.current : source;
    const found = explicit ?? el.querySelector('img, video, canvas');
    stack.setSource(found && isMediaElement(found) ? (found as ContextMedia) : null);
  });
  const glassKeys = rest as Record<string, unknown>;
  for (const key of ['kind', 'present', 'physics', 'interactive', 'ripple', 'appear', 'mode', 'shadow', 'intensity', 'variant', 'radius', 'tint', 'refraction', 'blur']) delete glassKeys[key];
  return createElement(as ?? 'div', { ...glassKeys, ref: setRef, 'data-meniscus-layer-kind': 'context', style: { ...(depth !== undefined ? { zIndex: depth } : null), ...style } }, children);
}

function ControlLayer({ depth, physics, present = true, kind: _kind, source: _source, style, children, ...glassProps }: GlassLayerProps, ref: ForwardedRef<HTMLElement>) {
  const stack = useContext(StackContext);
  useEffect(() => {
    if (stack || !DEV || warnedOutside) return;
    warnedOutside = true;
    console.warn('meniscus: <Glass.Layer> belongs inside a <Glass.Stack>; outside one it is a plain glass.');
  }, [stack]);

  const start = stack?.appear ? 0 : present ? 1 : 0;
  const optics = useGlassPhysics({ physics: physics ?? stack?.physics, initial: { presence: start, shadow: start } });
  const [el, setEl] = useState<HTMLElement | null>(null);
  const setRef = useMergedRef(ref, setEl);
  const physicsKey = JSON.stringify(physics ?? null);

  useIsomorphicLayoutEffect(() => {
    if (!stack || !el) return;
    return stack.register({ el, kind: 'control', depth, physics, optics, glass: null });
  }, [stack?.register, el, optics]);
  useIsomorphicLayoutEffect(() => {
    if (stack && el) stack.update(el, { depth, physics });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, el, depth, physicsKey]);

  // A change of `present` joins this commit's shared transition.
  const last = useRef<boolean | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!el) return;
    if (last.current === null) {
      last.current = present;
      if (stack?.appear && present) stack.present(el, true);
      return;
    }
    if (last.current === present) return;
    last.current = present;
    if (stack) stack.present(el, present);
    else optics.to({ presence: present ? 1 : 0, shadow: present ? 1 : 0 });
  }, [stack, el, present, optics]);

  // An absent layer stays in the page but can't be reached.
  useIsomorphicLayoutEffect(() => {
    if (!el) return;
    el.toggleAttribute('inert', !present);
    if (present) el.removeAttribute('aria-hidden');
    else el.setAttribute('aria-hidden', 'true');
  }, [el, present]);

  const handle = useMemo<LayerHandle>(
    () => ({
      preferWebGL: stack?.renderer === 'webgl',
      bind: (glass) => {
        if (!stack || !el) return () => {};
        stack.update(el, { glass });
        return () => stack.update(el, { glass: null });
      },
      below: () => (stack && el ? stack.below(el) : []),
    }),
    [stack, el],
  );

  const backdrop = stack && stack.renderer !== 'css' ? stack.source : undefined;
  const Pane = Glass as (p: Record<string, unknown>) => ReturnType<typeof Glass>;
  return (
    <InsideLayerContext.Provider value={true}>
      <LayerContext.Provider value={handle}>
        <Pane
          {...glassProps}
          ref={setRef}
          optics={optics}
          backdrop={backdrop}
          data-meniscus-layer-kind="control"
          style={{ ...(depth !== undefined ? { zIndex: depth } : null), ...style }}
        >
          {children}
        </Pane>
      </LayerContext.Provider>
    </InsideLayerContext.Provider>
  );
}

const ContextLayerRef = forwardRef(ContextLayer);
const ControlLayerRef = forwardRef(ControlLayer);

function GlassLayerImpl(props: GlassLayerProps, ref: ForwardedRef<HTMLElement>) {
  return props.kind === 'context' ? <ContextLayerRef {...props} ref={ref} /> : <ControlLayerRef {...props} ref={ref} />;
}

/** A stack of glass layers over a scene. See `GlassStackProps`. */
export const GlassStack = forwardRef(GlassStackImpl);
GlassStack.displayName = 'Glass.Stack';

/** One layer of a `Glass.Stack`: a control layer of glass, or the context scene beneath. See `GlassLayerProps`. */
export const GlassLayer = forwardRef(GlassLayerImpl);
GlassLayer.displayName = 'Glass.Layer';

export type { GlassOptions };
