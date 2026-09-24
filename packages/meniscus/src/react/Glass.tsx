import {
  createElement,
  forwardRef,
  useCallback,
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
import { DEFAULTS, VARIANTS, defaultTint, glassHighlight, glassTiles, resolveGlass, type GlassOptions, type HighlightURL } from '../core/glass';
import type { Radius } from '../core/shape';
import { RippleField } from '../core/ripple';
import { REDUCED_MOTION, REDUCED_TRANSPARENCY, supportsWebGL2, type RenderModePreference } from '../core/support';
import { GlassFilter } from './GlassFilter';
import { useGlassDefaults } from './context';
import { useElementSize, useGlassMode, useIsomorphicLayoutEffect, useMediaQuery, usePixelRatio } from './hooks';
import { useLiquidInteraction, type InteractionHandlers } from './interaction';
import { registerRipple, useLiquidMotion, warnUndrawnRipple } from './liquid';
import { useAppear } from './appear';
import { backdropElement, useElementCopy, useFallback, type Backdrop } from './backdrop';
import { MediaLayer, type MediaFrame } from './MediaLayer';
import { optionsKey } from './context';
import { isMediaElement, type Media } from '../webgl/media';
import { useGlassGroup } from './group';
import { useMergedRef } from './refs';
import { DEV } from './dev';

export { useMergedRef };

export { DEFAULT_SHADOW, GLASS_OPTION_KEYS };

export interface GlassOwnProps extends GlassOptions {
  /** Rendering path. `auto` refracts in Chromium and frosts elsewhere. */
  mode?: RenderModePreference;
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
  /** Drop shadow under the glass, or `false` for none. */
  shadow?: string | false;
  children?: ReactNode;
}

export type GlassProps<T extends ElementType = 'div'> = GlassOwnProps & { as?: T } & Omit<ComponentPropsWithoutRef<T>, keyof GlassOwnProps | 'as'>;

/** Elements that can't hold the glass's layers. They render with the frosted surface only. */
const CHILDLESS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'textarea', 'select']);
let warnedChildless = false;

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
  const { as, mode: modePreference, interactive = false, appear = false, ripple = false, backdrop, shadow, style, children, ...rest } = props as GlassProps<ElementType> & {
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
  const reducedTransparency = useMediaQuery(REDUCED_TRANSPARENCY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
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
  const fallback = useFallback(childless ? undefined : backdrop, node, modePreference, mode, ripple && !reducedMotion);
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
  useLiquidMotion(node, { squash: interactive && !disabled, ripple: disabled ? null : field, reducedMotion });
  useEffect(() => {
    if (!ripple || reducedMotion || group || ownMode === 'none') return;
    // Judged from the inputs, not the fallback state, which settles a render later.
    const media = backdropElement(backdrop);
    const drawable = !!media && isMediaElement(media) && supportsWebGL2() && (modePreference ?? 'auto') === 'auto' && !reducedTransparency;
    if (!drawable) warnUndrawnRipple();
  });
  const tiles = g && (mode === 'refract' || copying) && !reducedTransparency && !childless ? glassTiles(g) : null;
  const highlight = g && !bare && !childless && !webgl ? glassHighlight(g, pixelRatio) : null;
  // Refraction off (or unmeasured yet) leaves nothing to copy: plain frost.
  const copyActive = copying && !!tiles;
  const copy = useRef<HTMLSpanElement>(null);
  useElementCopy(copy, fallback.element, copyActive);
  const gRef = useRef(g);
  gRef.current = g;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mediaFrame = useCallback((): MediaFrame | null => {
    const glass = gRef.current;
    if (!node || !glass) return null;
    const box = { x: -node.clientLeft, y: -node.clientTop, width: node.offsetWidth, height: node.offsetHeight };
    return { panes: [{ x: box.x, y: box.y, glass, el: node }], box, merge: 0, shadow: false, key: `${box.width}x${box.height}|${optionsKey(optionsRef.current)}` };
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
            backgroundColor: copyActive ? 'transparent' : reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : tint,
            backdropFilter: liveTiles ? `url(#${filterId}) ${frost}` : frost,
            ...(liveTiles ? null : { WebkitBackdropFilter: frost }),
            ...(copyActive ? { isolation: 'isolate' as const } : null),
          }),
    boxShadow: shadow === false || (group && shadow === undefined) ? undefined : (shadow ?? DEFAULT_SHADOW),
    // Glass with a backdrop filter is already a stacking context; bare glass
    // needs one so the pointer glow (z-index -1) stays above what's behind.
    ...(bare && interactive ? { isolation: 'isolate' as const } : null),
    ...style,
    ...(hidden ? { opacity: 0 } : null),
  };

  const events: Partial<Record<keyof InteractionHandlers<HTMLElement>, AnyHandler>> = {};
  if (handlers) {
    for (const key of Object.keys(handlers) as Array<keyof InteractionHandlers<HTMLElement>>) {
      events[key] = chain(handlers[key] as AnyHandler, rest[key] as AnyHandler);
    }
  }

  const path = bare ? 'none' : webgl ? 'webgl' : copyActive ? 'element' : tiles ? 'refract' : 'frost';
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
        <span style={{ position: 'absolute', inset: 0, backgroundColor: reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : tint }} />
      </span>
    ) : null,
    webgl && node && fallback.element ? <MediaLayer host={node} media={fallback.element as Media} frame={mediaFrame} onFail={fallback.fail} style={{ zIndex: -1 }} /> : null,
    highlight && g ? <span aria-hidden="true" data-meniscus-layer="highlight" style={highlightStyle(highlight, g.radius)} /> : null,
    interactive && !disabled ? (
      <span aria-hidden="true" data-meniscus-layer="light" style={LIGHT}>
        <span data-meniscus-layer="glow" style={GLOW} />
      </span>
    ) : null,
    children,
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
