import {
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementType,
  type ForwardedRef,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { DEFAULT_SHADOW, GLASS_OPTION_KEYS } from '../core/constants';
import { DEFAULTS, VARIANTS, defaultTint, glassHighlight, glassRefracts, glassTiles, resolveGlass, type GlassOptions, type HighlightURL } from '../core/glass';
import type { Radius } from '../core/shape';
import type { GlassPhysics } from '../core/physics';
import { RippleField } from '../core/ripple';
import { supportsWebGL2, type RenderModePreference } from '../core/support';
import { GlassFilter } from './GlassFilter';
import { useGlassDefaults } from './context';
import { useElementSize, useGlassMode, useGlassPreferences, useIsomorphicLayoutEffect, usePixelRatio } from './hooks';
import { useLiquidInteraction, type InteractionHandlers } from './interaction';
import { registerRipple, useLiquidMotion, warnUndrawnRipple } from './liquid';
import { useAppear } from './appear';
import { OPTIC_SHADOW, SPOT, opticOpacity, opticTint, opticVars, useOptics } from './optics';
import { LayerContext } from './stack';
import { backdropElement, useElementCopy, useFallback, type Backdrop } from './backdrop';
import { MediaLayer, hostOrigin, type MediaFrame } from './MediaLayer';
import { optionsKey } from './context';
import { isMediaElement, type Media } from '../webgl/media';
import { useGlassGroup } from './group';
import { useMergedRef } from './refs';
import { DEV } from './dev';
import { nearViewport, whenNearOrIdle } from './defer';

export { useMergedRef };

export { DEFAULT_SHADOW, GLASS_OPTION_KEYS };

/** Where a glass draws: refracting the live page, frosted, in WebGL over media, over a live copy of its backdrop (Firefox), or nothing of its own. */
export type GlassPath = 'refract' | 'frost' | 'webgl' | 'element' | 'none';

/**
 * Why a glass takes its path: it refracts (`supported`); the browser can't
 * refract the live page (`engine`); reduced transparency or increased
 * contrast frost it (`accessibility`); a `mode` asked (`preference`); WebGL
 * draws its media backdrop (`media`); it bends a live copy of its backdrop
 * (`copy`); a `GlassGroup` draws it (`group`); its element can't hold the
 * layers (`void`); or it has no edge to bend (`flat`).
 */
export type GlassPathReason = 'supported' | 'engine' | 'accessibility' | 'preference' | 'media' | 'copy' | 'group' | 'void' | 'flat';

export interface GlassOwnProps extends GlassOptions {
  /** Rendering path. `auto` refracts in Chromium and frosts elsewhere. */
  mode?: RenderModePreference;
  /**
   * Called with the path this glass draws and why, once it has a size and
   * whenever either changes: `('frost', 'accessibility')` under reduced
   * transparency, `('webgl', 'media')` over a video in Safari.
   */
  onPathChange?: (path: GlassPath, reason: GlassPathReason) => void;
  /** Swell on press, stretch toward the pointer, and glow where it touches. */
  interactive?: boolean;
  /** Materialize on mount: fade in, swell into place on a spring, and let the lens gather its bend. */
  appear?: boolean;
  /**
   * A liquid surface: a tap rings it, a finger drawn across leaves a trail,
   * and moving the glass sloshes it. Waves bend what's behind and catch the
   * light. Needs WebGL: glass over an image, video or canvas `backdrop`
   * (which then draws in WebGL in every browser), or a `GlassPane` in a
   * `GlassStage`. Off under reduced motion.
   */
  ripple?: boolean;
  /**
   * What lies behind the glass, for browsers that can't refract the live
   * page: an image, video or canvas is refracted in WebGL (Safari, Firefox);
   * any other element is refracted as a live copy in Firefox. It must not
   * contain the glass. Ignored where live refraction works.
   */
  backdrop?: Backdrop;
  /** Drop shadow under the glass, or `false` for none. A custom shadow stays as it is under `optics`. */
  shadow?: string | false;
  /**
   * Springs for this glass's optics, from `useGlassPhysics`: presence,
   * refraction, highlight, tint and lift follow it frame by frame without
   * re-rendering. With `interactive`, a press lifts the glass and the release
   * momentum sets it ringing.
   */
  optics?: GlassPhysics;
  children?: ReactNode;
}

export type GlassProps<T extends ElementType = 'div'> = GlassOwnProps & { as?: T } & Omit<ComponentPropsWithoutRef<T>, keyof GlassOwnProps | 'as'>;

/** Elements that can't hold the glass's layers. They render with the frosted surface only. */
const CHILDLESS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'textarea', 'select']);
let warnedChildless = false;
let warnedConfined = false;

/**
 * The nearest ancestor that confines a backdrop filter to its own content,
 * described for a warning, or null. The walk stops at glass: glass in glass
 * is meant to bend the glass around it, faded or not.
 */
function backdropRoot(node: HTMLElement): string | null {
  const set = (value: string | undefined, rest: string) => !!value && value !== rest;
  for (let el = node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (el.hasAttribute('data-meniscus') || set(s.backdropFilter, 'none')) return null;
    const why =
      Number(s.opacity || 1) < 1
        ? `opacity: ${s.opacity}`
        : set(s.filter, 'none')
          ? `filter: ${s.filter}`
          : set(s.clipPath, 'none')
            ? 'clip-path'
            : set(s.maskImage, 'none')
              ? 'mask'
              : set(s.mixBlendMode, 'normal')
                ? `mix-blend-mode: ${s.mixBlendMode}`
                : null;
    if (why) return `<${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? ` class="${el.className}"` : ''}> (${why})`;
  }
  return null;
}

/** Room around a stacked glass's canvas, so the layers beneath refract from real pixels at its rim, px. */
const STACK_MARGIN = 48;

const opticsKey = (s: { presence: number; refraction: number; highlightX: number; highlightY: number; tint: number; shadow: number } | null | undefined) =>
  s ? [s.presence, s.refraction, s.highlightX, s.highlightY, s.tint, s.shadow].map((v) => v.toFixed(3)).join(',') : '';

/** Everything about a resolved glass that changes how it draws. */
const glassKey = (g: { width: number; height: number; radius: number; bezel: number; thickness: number; ior: number; blur: number; saturation: number; tint: string; aberration: number; specular: number; rim: number; shade: number; lightAngle: number; lightElevation: number }) =>
  [g.width, g.height, g.radius, g.bezel, g.thickness, g.ior, g.blur, g.saturation, g.tint, g.aberration, g.specular, g.rim, g.shade, g.lightAngle, g.lightElevation].join(',');

/** Page around a copied backdrop, so its blur has something to draw from at the rim, px. */
const COPY_MARGIN = 16;

/** Clips the pointer glow and press blooms to the glass shape. */
const LIGHT: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  borderRadius: 'inherit',
  overflow: 'hidden',
  pointerEvents: 'none',
};

/**
 * The outline under increased contrast. Forced colors repaint its border in
 * the system's own color, so the glass keeps an edge in Windows High Contrast.
 */
const EDGE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 'inherit',
  border: '1px solid color-mix(in srgb, CanvasText 55%, transparent)',
  pointerEvents: 'none',
};

const GLOW: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at var(--meniscus-x, 50%) var(--meniscus-y, 50%), rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0) 70%)',
  opacity: 'var(--meniscus-glow, 0)' as unknown as number,
  mixBlendMode: 'screen',
};

function highlightStyle(h: HighlightURL, radius: number): CSSProperties {
  return {
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    pointerEvents: 'none',
    borderStyle: 'solid',
    borderWidth: 0,
    borderColor: 'transparent',
    borderImageSource: `url("${h.url}")`,
    borderImageSlice: `${h.slice} fill`,
    borderImageWidth: `${radius}px`,
    borderImageRepeat: 'stretch',
    // Hover and press energize the rim: brightness follows the glow spring.
    filter: 'brightness(calc(1 + 0.55 * var(--meniscus-glow, 0)))',
  };
}

function cssRadius(radius: Radius): string {
  return radius === 'capsule' ? '9999px' : `${Math.max(0, radius)}px`;
}

type AnyHandler = ((e: SyntheticEvent) => void) | undefined;

function chain(ours: AnyHandler, theirs: AnyHandler): AnyHandler {
  if (!ours) return theirs;
  if (!theirs) return ours;
  return (e) => {
    theirs(e);
    ours(e);
  };
}

function GlassImpl(props: GlassProps<ElementType>, forwardedRef: ForwardedRef<HTMLElement>) {
  const defaults = useGlassDefaults();
  const { as, mode: modePreference, onPathChange, interactive = false, appear = false, ripple = false, backdrop, shadow, optics, style, children, ...rest } = props as GlassProps<ElementType> & {
    style?: CSSProperties;
  } & Record<string, unknown>;

  const options: GlassOptions = {};
  for (const key of GLASS_OPTION_KEYS) {
    const value = (rest as Record<string, unknown>)[key] ?? defaults[key];
    if (value !== undefined) (options as Record<string, unknown>)[key] = value;
    delete (rest as Record<string, unknown>)[key];
  }

  const tag = as ?? 'div';
  const childless = typeof tag === 'string' && CHILDLESS.has(tag);
  if (childless && !warnedChildless && DEV) {
    warnedChildless = true;
    console.warn(`meniscus: <Glass as="${tag}"> can't hold the glass layers, so it renders frosted without refraction or highlights. Wrap the element in a <Glass> instead.`);
  }

  const ref = useRef<HTMLElement | null>(null);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const onNode = useCallback((n: HTMLElement | null) => {
    ref.current = n;
    setNode(n);
  }, []);
  const setRef = useMergedRef(forwardedRef, onNode);

  const size = useElementSize(node);
  const group = useGlassGroup();
  // Inside a GlassGroup the group draws one merged surface; this glass keeps
  // only its shape, content and interaction.
  const ownMode = useGlassMode(modePreference);
  const mode = group ? 'none' : ownMode;
  const { reducedTransparency, reducedMotion, increasedContrast } = useGlassPreferences();
  const pixelRatio = usePixelRatio();
  const filterId = `meniscus-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // A disabled control doesn't answer the pointer, so its glass doesn't either.
  const disabled = !!rest.disabled || rest['aria-disabled'] === true || rest['aria-disabled'] === 'true';
  const handlers = useLiquidInteraction(ref, interactive && !disabled, reducedMotion);

  const bare = mode === 'none';
  const g = size && size.width > 0 && size.height > 0 ? resolveGlass(options, size.width, size.height) : null;
  const radiusRef = useRef(0);
  radiusRef.current = g ? g.radius : 0;
  useIsomorphicLayoutEffect(() => {
    if (!group || !node) return;
    return group.register(node, () => radiusRef.current);
  }, [group, node]);
  const hidden = useAppear(node, appear, reducedMotion, g !== null);
  // A control layer of a stack: its WebGL preference, and the glass beneath it.
  const layer = useContext(LayerContext);
  const fallback = useFallback(childless ? undefined : backdrop, node, modePreference, mode, (ripple && !reducedMotion) || !!layer?.preferWebGL);
  const copying = fallback.path === 'element';
  const webgl = fallback.path === 'webgl';
  // Only WebGL draws waves: this glass's own media layer, or a stage drawing it (mode none).
  const rippling = ripple && !reducedMotion && !group && !childless && (webgl || ownMode === 'none');
  const fieldRef = useRef<RippleField | null>(null);
  const field = rippling ? (fieldRef.current ??= new RippleField()) : null;
  useIsomorphicLayoutEffect(() => {
    if (field && g) field.resize(g.width, g.height, g.radius);
  }, [field, g?.width, g?.height, g?.radius]);
  useIsomorphicLayoutEffect(() => (field && node ? registerRipple(node, field) : undefined), [field, node]);
  useLiquidMotion(node, { squash: interactive && !disabled, ripple: disabled ? null : field, reducedMotion, optics: interactive && !disabled ? (optics ?? null) : null });
  useEffect(() => {
    if (!ripple || reducedMotion || group || ownMode === 'none') return;
    // Judged from the inputs, not the fallback state, which settles a render later.
    const media = backdropElement(backdrop);
    const drawable = !!media && isMediaElement(media) && supportsWebGL2() && (modePreference ?? 'auto') === 'auto' && !reducedTransparency;
    if (!drawable) warnUndrawnRipple();
  });
  const refracts = !!g && (mode === 'refract' || copying) && !reducedTransparency && !childless && glassRefracts(g);
  const lit = !!g && !bare && !childless && !webgl;
  // Glass on screen builds its maps before it paints; glass off screen waits
  // for idle time or for the page to scroll it near, and draws frost till then.
  const [built, setBuilt] = useState(false);
  const build = useRef(() => {});
  build.current = () => {
    if (refracts) glassTiles(g!);
    if (lit) glassHighlight(g!, pixelRatio);
  };
  // Judged as the element mounts, a render before it's measured, so glass on
  // screen has its maps in the first render that can draw them.
  const deferrable = !built && !bare && !childless;
  useIsomorphicLayoutEffect(() => {
    if (!deferrable || !node) return;
    if (nearViewport(node)) {
      setBuilt(true);
      return;
    }
    return whenNearOrIdle(node, () => {
      build.current();
      setBuilt(true);
    });
  }, [deferrable, node]);
  const tiles = refracts && built ? glassTiles(g!) : null;
  const highlight = lit && built ? glassHighlight(g!, pixelRatio) : null;
  useOptics(node, optics, tiles);
  // Refraction off (or unmeasured yet) leaves nothing to copy: plain frost.
  const copyActive = copying && !!tiles;
  const copy = useRef<HTMLSpanElement>(null);
  useElementCopy(copy, fallback.element, copyActive);
  const gRef = useRef(g);
  gRef.current = g;
  const opticsRef = useRef(optics);
  opticsRef.current = optics;
  const layerRef = useRef(layer);
  layerRef.current = layer;
  useIsomorphicLayoutEffect(() => (layer ? layer.bind(() => gRef.current) : undefined), [layer]);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mediaFrame = useCallback((): MediaFrame | null => {
    const glass = gRef.current;
    if (!node || !glass) return null;
    const box = { x: -node.clientLeft, y: -node.clientTop, width: node.offsetWidth, height: node.offsetHeight };
    const own = opticsRef.current?.state ?? null;
    const key = `${box.width}x${box.height}|${optionsKey(optionsRef.current)}|${opticsKey(own)}`;
    // Its own canvas sits inside the element, whose opacity already fades it: keep only the bend.
    const self = { x: box.x, y: box.y, glass, el: node, optics: own ? { ...own, presence: 1, refraction: own.refraction * Math.max(0, own.presence) } : null };
    const below = layerRef.current?.below() ?? [];
    if (!below.length) return { panes: [self], box, merge: 0, shadow: false, key };
    // Stacked: draw the glass beneath, back to front, and keep only this one.
    const origin = hostOrigin(node);
    const panes: MediaFrame['panes'] = below.map((b) => {
      const r = b.el.getBoundingClientRect();
      return { x: (r.left - origin.left) / origin.sx - node.clientLeft, y: (r.top - origin.top) / origin.sy - node.clientTop, glass: b.glass, el: b.el, optics: b.optics.state };
    });
    panes.push(self);
    const m = STACK_MARGIN;
    const wide = { x: box.x - m, y: box.y - m, width: box.width + 2 * m, height: box.height + 2 * m };
    // Lower layers redraw this one when they move, animate, resize or change their glass.
    const stackKey = panes.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)},${glassKey(p.glass)},${opticsKey(p.optics)}`).join(';');
    return { panes, box: wide, merge: 0, shadow: false, layered: true, clip: panes.length - 1, key: `${key}|${stackKey}` };
  }, [node]);

  const variant = VARIANTS[options.variant ?? 'regular'] ?? VARIANTS.regular;
  const blur = g?.blur ?? options.blur ?? variant.blur;
  const saturation = g?.saturation ?? options.saturation ?? variant.saturation;
  const tint = g?.tint ?? options.tint ?? defaultTint(options.variant, options.appearance);
  const frost = `blur(${blur}px) saturate(${saturation})`;

  // The layers inside need a positioned root. Setting `position: relative`
  // inline would override an app's own `absolute` or `fixed` from a class, so
  // it is only applied to roots that would otherwise be static, and checked
  // again whenever the element, its classes or its size change.
  const positioned = useRef(false);
  const className = (rest as { className?: string }).className;
  useIsomorphicLayoutEffect(() => {
    if (!node || style?.position || childless) return;
    if (positioned.current) {
      node.style.position = '';
      positioned.current = false;
    }
    if (getComputedStyle(node).position === 'static') {
      node.style.position = 'relative';
      positioned.current = true;
    }
  }, [node, className, style?.position, size?.width, size?.height, childless]);

  const liveTiles = tiles && !copying;
  const rootStyle: CSSProperties = {
    borderRadius: g ? `${g.radius}px` : cssRadius(options.radius ?? DEFAULTS.radius),
    ...(bare
      ? null
      : webgl
        ? // WebGL draws the whole glass, tint and light included.
          { isolation: 'isolate' }
        : {
            // A copied backdrop carries the tint above itself.
            backgroundColor: copyActive ? 'transparent' : reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : optics ? opticTint(tint) : tint,
            backdropFilter: liveTiles ? `url(#${filterId}) ${frost}` : frost,
            ...(liveTiles ? null : { WebkitBackdropFilter: frost }),
            ...(copyActive ? { isolation: 'isolate' as const } : null),
          }),
    boxShadow: shadow === false || (group && shadow === undefined) ? undefined : (shadow ?? (optics ? OPTIC_SHADOW : DEFAULT_SHADOW)),
    // Glass with a backdrop filter is already a stacking context; bare glass
    // needs one so the pointer glow (z-index -1) stays above what's behind.
    ...(bare && interactive ? { isolation: 'isolate' as const } : null),
    ...style,
    ...(optics ? { ...opticVars(optics.state), opacity: opticOpacity(style?.opacity) as unknown as number } : null),
    ...(hidden ? { opacity: 0 } : null),
  };

  const events: Partial<Record<keyof InteractionHandlers<HTMLElement>, AnyHandler>> = {};
  if (handlers) {
    for (const key of Object.keys(handlers) as Array<keyof InteractionHandlers<HTMLElement>>) {
      events[key] = chain(handlers[key] as AnyHandler, rest[key] as AnyHandler);
    }
  }

  // The path this glass draws once its maps are built, which off-screen glass reports ahead of time.
  const path: GlassPath = bare ? 'none' : webgl ? 'webgl' : refracts ? (copying ? 'element' : 'refract') : 'frost';
  const reason: GlassPathReason =
    path === 'none'
      ? group
        ? 'group'
        : 'preference'
      : path === 'webgl'
        ? 'media'
        : path === 'element'
          ? 'copy'
          : path === 'refract'
            ? 'supported'
            : childless
              ? 'void'
              : reducedTransparency
                ? 'accessibility'
                : ownMode === 'frost'
                  ? (modePreference ?? defaults.mode) === 'frost'
                    ? 'preference'
                    : 'engine'
                  : 'flat';
  // Unmeasured glass is always frosted for a moment; report the path it settles on.
  const measured = g !== null || childless;
  const onPathChangeRef = useRef(onPathChange);
  onPathChangeRef.current = onPathChange;
  useEffect(() => {
    if (measured) onPathChangeRef.current?.(path, reason);
  }, [measured, path, reason]);
  useEffect(() => {
    if (!DEV || warnedConfined || path !== 'refract' || !node) return;
    // Checked once entrances settle: a parent fading in is below full opacity for a moment.
    const id = setTimeout(() => {
      const root = warnedConfined ? null : backdropRoot(node);
      if (!root) return;
      warnedConfined = true;
      console.warn(`meniscus: ${root} confines this glass's backdrop filter to its own content, so the glass can't bend the page behind it. Fade or filter the glass itself, not an ancestor.`);
    }, 1000);
    return () => clearTimeout(id);
  }, [node, path]);
  const elementProps = { ...rest, ...events, ref: setRef, style: rootStyle, 'data-meniscus': path };
  if (childless) return createElement(tag, elementProps);

  return createElement(
    tag,
    elementProps,
    tiles && g ? <GlassFilter id={filterId} width={g.width} height={g.height} tiles={tiles} aberration={g.aberration} offset={copyActive ? COPY_MARGIN : 0} /> : null,
    copyActive ? (
      <span aria-hidden="true" data-meniscus-layer="copy" style={LIGHT}>
        <span
          ref={copy}
          style={{ position: 'absolute', left: -COPY_MARGIN, top: -COPY_MARGIN, width: `calc(100% + ${2 * COPY_MARGIN}px)`, height: `calc(100% + ${2 * COPY_MARGIN}px)`, filter: `url(#${filterId}) ${frost}` }}
        />
        <span style={{ position: 'absolute', inset: 0, backgroundColor: reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : optics ? opticTint(tint) : tint }} />
      </span>
    ) : null,
    webgl && node && fallback.element ? <MediaLayer host={node} media={fallback.element as Media} frame={mediaFrame} onFail={fallback.fail} style={{ zIndex: -1 }} /> : null,
    highlight && g ? <span aria-hidden="true" data-meniscus-layer="highlight" style={highlightStyle(highlight, g.radius)} /> : null,
    optics && !bare && !webgl && !childless ? <span aria-hidden="true" data-meniscus-layer="spot" style={SPOT} /> : null,
    increasedContrast ? <span aria-hidden="true" data-meniscus-layer="edge" style={EDGE} /> : null,
    interactive && !disabled ? (
      <span aria-hidden="true" data-meniscus-layer="light" style={LIGHT}>
        <span data-meniscus-layer="glow" style={GLOW} />
      </span>
    ) : null,
    // Glass inside this one is not part of the stack.
    layer ? <LayerContext.Provider value={null}>{children}</LayerContext.Provider> : children,
  );
}

/**
 * A surface of liquid glass. Renders `as` (a `div` by default) with the glass
 * behind its children: refraction in Chromium, frosted glass elsewhere, rim
 * light everywhere.
 */
export const Glass = forwardRef(GlassImpl) as unknown as (<T extends ElementType = 'div'>(
  props: GlassProps<T> & { ref?: ComponentPropsWithRef<T>['ref'] },
) => ReactElement | null) & { displayName?: string };

Glass.displayName = 'Glass';
