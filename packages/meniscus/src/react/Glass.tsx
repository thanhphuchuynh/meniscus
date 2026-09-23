import {
  createElement,
  forwardRef,
  useCallback,
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
import { DEFAULTS, VARIANTS, glassHighlight, glassTiles, resolveGlass, type GlassOptions, type HighlightURL } from '../core/glass';
import type { Radius } from '../core/shape';
import { REDUCED_MOTION, REDUCED_TRANSPARENCY, type RenderModePreference } from '../core/support';
import { GlassFilter } from './GlassFilter';
import { useGlassDefaults } from './context';
import { useElementSize, useGlassMode, useIsomorphicLayoutEffect, useMediaQuery, usePixelRatio } from './hooks';
import { useLiquidInteraction, type InteractionHandlers } from './interaction';
import { useAppear } from './appear';
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
  /** Drop shadow under the glass, or `false` for none. */
  shadow?: string | false;
  children?: ReactNode;
}

export type GlassProps<T extends ElementType = 'div'> = GlassOwnProps & { as?: T } & Omit<ComponentPropsWithoutRef<T>, keyof GlassOwnProps | 'as'>;

/** Elements that can't hold the glass's layers. They render with the frosted surface only. */
const CHILDLESS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'textarea', 'select']);
let warnedChildless = false;

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
  const { as, mode: modePreference, interactive = false, appear = false, shadow, style, children, ...rest } = props as GlassProps<ElementType> & {
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
  const handlers = useLiquidInteraction(ref, interactive, reducedMotion);

  const bare = mode === 'none';
  const g = size && size.width > 0 && size.height > 0 ? resolveGlass(options, size.width, size.height) : null;
  const radiusRef = useRef(0);
  radiusRef.current = g ? g.radius : 0;
  useIsomorphicLayoutEffect(() => {
    if (!group || !node) return;
    return group.register(node, () => radiusRef.current);
  }, [group, node]);
  const hidden = useAppear(node, appear, reducedMotion, g !== null);
  const tiles = g && mode === 'refract' && !reducedTransparency && !childless ? glassTiles(g) : null;
  const highlight = g && !bare && !childless ? glassHighlight(g, pixelRatio) : null;

  const variant = VARIANTS[options.variant ?? 'regular'] ?? VARIANTS.regular;
  const blur = g?.blur ?? options.blur ?? variant.blur;
  const saturation = g?.saturation ?? options.saturation ?? variant.saturation;
  const tint = g?.tint ?? options.tint ?? variant.tint;
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

  const rootStyle: CSSProperties = {
    borderRadius: g ? `${g.radius}px` : cssRadius(options.radius ?? DEFAULTS.radius),
    ...(bare
      ? null
      : {
          backgroundColor: reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${tint})` : tint,
          backdropFilter: tiles ? `url(#${filterId}) ${frost}` : frost,
          ...(tiles ? null : { WebkitBackdropFilter: frost }),
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

  const elementProps = { ...rest, ...events, ref: setRef, style: rootStyle, 'data-meniscus': bare ? 'none' : tiles ? 'refract' : 'frost' };
  if (childless) return createElement(tag, elementProps);

  return createElement(
    tag,
    elementProps,
    tiles && g ? <GlassFilter id={filterId} width={g.width} height={g.height} tiles={tiles} aberration={g.aberration} /> : null,
    highlight && g ? <span aria-hidden="true" data-meniscus-layer="highlight" style={highlightStyle(highlight, g.radius)} /> : null,
    interactive ? (
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
