import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ABERRATION_SPREAD } from '../core/filter';
import { lightingProfile, glassProfile, resolveGlass, type GlassOptions, type ResolvedGlass } from '../core/glass';
import { toDataURL } from '../core/encode';
import type { RenderModePreference } from '../core/support';
import { unionJob, unionKernel, unionPixelScale, unionReach, type UnionJob, type UnionShape } from '../core/union';
import { buildUnionInWorker, type UnionURLs } from '../core/unionWorker';
import { GLASS_OPTION_KEYS } from '../core/constants';
import type { Media } from '../webgl/media';
import { optionsKey, useGlassDefaults } from './context';
import { useGlassMode, useGlassPreferences, useIsomorphicLayoutEffect } from './hooks';
import { GroupContext, useGlassGroup } from './group';
import { useMergedRef } from './refs';
import { useElementCopy, useFallback, type Backdrop } from './backdrop';
import { MediaLayer, type MediaFrame } from './MediaLayer';

export { useGlassGroup };

export interface GlassGroupProps extends GlassOptions, Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** How far apart two glass outlines can be and still bridge, px: the surface tension. 0 never merges. Within twice this, outlines lean toward each other. */
  spacing?: number;
  /** Rendering path for the merged surface. */
  mode?: RenderModePreference;
  /** Shadow under the merged surface, or `false` for none. */
  shadow?: boolean;
  /**
   * What lies behind the group, for browsers that can't refract the live
   * page. An image, video or canvas is refracted in WebGL (Safari, Firefox);
   * any other element is refracted as a live copy in Firefox. Ignored where
   * live refraction works.
   */
  backdrop?: Backdrop;
  as?: ElementType;
  children?: ReactNode;
}

const LAYER: CSSProperties = { position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' };
const FILL: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };
const MOVING_BUDGET = 40_000;
const SETTLED_BUDGET = 110_000;
const SETTLE_MS = 140;
/** Room around the merged outline for the shadow's blur and drop, px. */
const SHADE_PAD = 36;
const SHADE_DROP = 9;
/** Page around a copied backdrop, so its blur has something to draw from at the rim, px. */
const COPY_MARGIN = 16;

/** The members' outlines in the group's layout px, and the glass they share. */
interface Measured {
  shapes: UnionShape[];
  glass: ResolvedGlass;
  /** Bounding box of the outlines, grown by how far a bridge can bulge. */
  box: { x: number; y: number; width: number; height: number };
  signature: string;
}

function measure(node: HTMLElement, members: Map<HTMLElement, () => number>, options: GlassOptions, spacing: number): Measured | null {
  const host = node.getBoundingClientRect();
  const sx = node.offsetWidth ? host.width / node.offsetWidth : 1;
  const sy = node.offsetHeight ? host.height / node.offsetHeight : 1;
  const shapes: UnionShape[] = [];
  let minR = Infinity;
  let signature = `${host.width.toFixed(1)}x${host.height.toFixed(1)}`;
  for (const [el, radius] of members) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const x = (r.left - host.left) / sx - node.clientLeft;
    const y = (r.top - host.top) / sy - node.clientTop;
    const w = r.width / sx;
    const h = r.height / sy;
    // A pressed member swells through `scale`; its radius swells with it.
    const scale = el.offsetWidth ? w / el.offsetWidth : 1;
    const rad = Math.min(radius() * scale, w / 2, h / 2);
    shapes.push({ x, y, width: w, height: h, radius: rad });
    minR = Math.min(minR, rad);
    signature += `|${x.toFixed(1)},${y.toFixed(1)},${w.toFixed(1)},${h.toFixed(1)},${rad.toFixed(1)}`;
  }
  if (!shapes.length) return null;
  const pad = unionReach(spacing) + 2;
  const x0 = Math.min(...shapes.map((q) => q.x)) - pad;
  const y0 = Math.min(...shapes.map((q) => q.y)) - pad;
  const x1 = Math.max(...shapes.map((q) => q.x + q.width)) + pad;
  const y1 = Math.max(...shapes.map((q) => q.y + q.height)) + pad;
  // The shared glass, resolved as one rounded rectangle of the tightest radius.
  const glass = resolveGlass({ ...options, radius: minR, bezel: options.bezel ?? Math.min(minR, 32) }, minR * 2, minR * 2);
  return { shapes, glass, box: { x: x0, y: y0, width: Math.ceil(x1 - x0), height: Math.ceil(y1 - y0) }, signature };
}

/** Map-building work for one drawing, positioned in the union box. */
function jobFor(m: Measured, spacing: number, budget: number): UnionJob {
  const { box, glass: g } = m;
  return unionJob({
    shapes: m.shapes.map((q) => ({ ...q, x: q.x - box.x, y: q.y - box.y })),
    width: box.width,
    height: box.height,
    smoothing: spacing,
    bezel: g.bezel,
    profile: glassProfile(g),
    lighting: lightingProfile(g),
    light: { angle: g.lightAngle, elevation: g.lightElevation, specular: g.specular, rim: g.rim, shade: g.shade },
    pixelScale: unionPixelScale(box.width, box.height, budget),
  });
}

function onMainThread(job: UnionJob): UnionURLs {
  const px = unionKernel(job);
  return {
    displacement: toDataURL({ data: px.disp, width: px.width, height: px.height }),
    highlight: toDataURL({ data: px.glow, width: px.width, height: px.height }),
  };
}

function setMask(el: HTMLElement, image: string, extra?: { position: string; size: string }): void {
  el.style.maskImage = image;
  el.style.setProperty('-webkit-mask-image', image);
  if (extra) {
    el.style.maskPosition = extra.position;
    el.style.maskSize = extra.size;
    el.style.setProperty('-webkit-mask-position', extra.position);
    el.style.setProperty('-webkit-mask-size', extra.size);
  }
}

/**
 * Glass that behaves like liquid. Every `Glass` inside a group is drawn as
 * one surface: outlines closer than `spacing` grow a neck between them and
 * fuse the way two drops do, and pull apart again as they separate. Lay the
 * children out with CSS and animate them however you like; the surface
 * follows every frame.
 */
function GlassGroupImpl(props: GlassGroupProps, forwardedRef: ForwardedRef<HTMLElement>) {
  const defaults = useGlassDefaults();
  const { spacing = 24, mode: modePreference, shadow = true, backdrop, as, style, children, ...rest } = props as GlassGroupProps & Record<string, unknown>;
  const options: GlassOptions = {};
  for (const key of GLASS_OPTION_KEYS) {
    const value = (rest as Record<string, unknown>)[key] ?? defaults[key];
    if (value !== undefined) (options as Record<string, unknown>)[key] = value;
    delete (rest as Record<string, unknown>)[key];
  }

  const [node, setNode] = useState<HTMLElement | null>(null);
  const setRef = useMergedRef(forwardedRef, setNode);
  const mode = useGlassMode(modePreference);
  const { reducedTransparency } = useGlassPreferences();
  const refract = mode === 'refract' && !reducedTransparency;
  const fallback = useFallback(backdrop, node, modePreference, mode);
  const copying = fallback.path === 'element';
  const webgl = fallback.path === 'webgl';
  const filtered = refract || copying;
  const id = `meniscus-group-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const members = useRef(new Map<HTMLElement, () => number>());
  const dirty = useRef(true);
  const register = useCallback((el: HTMLElement, radius: () => number) => {
    members.current.set(el, radius);
    dirty.current = true;
    return () => {
      members.current.delete(el);
      dirty.current = true;
    };
  }, []);
  const context = useMemo(() => ({ register }), [register]);

  const surface = useRef<HTMLSpanElement>(null);
  const copy = useRef<HTMLSpanElement>(null);
  const copyTint = useRef<HTMLSpanElement>(null);
  const light = useRef<HTMLSpanElement>(null);
  const shade = useRef<HTMLSpanElement>(null);
  const shadeInner = useRef<HTMLSpanElement>(null);
  const filterRef = useRef<SVGFilterElement>(null);
  const optionsRef = useRef(options);
  useIsomorphicLayoutEffect(() => {
    optionsRef.current = options;
    dirty.current = true;
  });

  // Position roots that would otherwise be static, as Glass does.
  useIsomorphicLayoutEffect(() => {
    if (!node || (style as CSSProperties | undefined)?.position) return;
    if (getComputedStyle(node).position === 'static') node.style.position = 'relative';
  }, [node]);

  useElementCopy(copy, fallback.element, copying);

  // Maps engine: build displacement and light maps for the merged outline
  // (in a worker where possible) whenever the members move.
  useEffect(() => {
    if (!node || webgl) return;
    let frame = 0;
    let alive = true;
    let visible = true;
    let lastSignature = '';
    let lastChange = 0;
    let sharp = true;
    let busy = false;
    let queued: number | null = null;

    const apply = (m: Measured, urls: UnionURLs, scale: number) => {
      const s = surface.current;
      if (!s) return;
      const { box, glass: g } = m;
      const { width: bw, height: bh } = box;
      const place = { left: `${box.x}px`, top: `${box.y}px`, width: `${bw}px`, height: `${bh}px` };
      for (const el of [s, light.current]) if (el) Object.assign(el.style, place);
      const frost = `blur(${g.blur}px) saturate(${g.saturation})`;
      const mask = `url("${urls.displacement}")`;
      const tint = reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${g.tint})` : g.tint;
      s.style.visibility = 'visible';
      setMask(s, mask);
      s.style.backgroundColor = copying ? 'transparent' : tint;
      s.style.backdropFilter = frost;
      s.style.setProperty('-webkit-backdrop-filter', frost);

      const f = filterRef.current;
      if (filtered && f && scale > 0) {
        // A copied backdrop is drawn with a margin, so the map sits inside it.
        const m0 = copying ? COPY_MARGIN : 0;
        f.setAttribute('width', String(bw + 2 * m0));
        f.setAttribute('height', String(bh + 2 * m0));
        const image = f.querySelector('feImage');
        image?.setAttribute('href', urls.displacement);
        image?.setAttribute('x', String(m0));
        image?.setAttribute('y', String(m0));
        image?.setAttribute('width', String(bw));
        image?.setAttribute('height', String(bh));
        const spread = g.aberration * ABERRATION_SPREAD;
        f.querySelectorAll('feDisplacementMap').forEach((d, i) => {
          const k = spread > 0 ? ([1 + spread, 1, 1 - spread][i] ?? 1) : 1;
          d.setAttribute('scale', String(scale * k));
        });
        if (refract) {
          s.style.backdropFilter = `url(#${id}) ${frost}`;
          s.style.removeProperty('-webkit-backdrop-filter');
        }
      }
      if (copying && copy.current && copyTint.current) {
        Object.assign(copy.current.style, {
          left: `${-COPY_MARGIN}px`,
          top: `${-COPY_MARGIN}px`,
          width: `${bw + 2 * COPY_MARGIN}px`,
          height: `${bh + 2 * COPY_MARGIN}px`,
          filter: `url(#${id}) ${frost}`,
        });
        copyTint.current.style.backgroundColor = tint;
      }
      if (light.current) light.current.style.backgroundImage = `url("${urls.highlight}")`;

      // The shadow falls outside the glass only: a blurred, dropped copy of
      // the outline with the outline itself cut back out, so it never
      // clouds the glass from underneath.
      const outer = shade.current;
      const inner = shadeInner.current;
      if (outer && inner) {
        Object.assign(outer.style, { left: `${box.x - SHADE_PAD}px`, top: `${box.y - SHADE_PAD}px`, width: `${bw + 2 * SHADE_PAD}px`, height: `${bh + 2 * SHADE_PAD}px` });
        setMask(outer, `${mask}, linear-gradient(#000, #000)`, { position: `${SHADE_PAD}px ${SHADE_PAD}px, 0 0`, size: `${bw}px ${bh}px, 100% 100%` });
        Object.assign(inner.style, { left: `${SHADE_PAD}px`, top: `${SHADE_PAD + SHADE_DROP}px`, width: `${bw}px`, height: `${bh}px` });
        setMask(inner, mask);
      }
    };

    const draw = (budget: number) => {
      if (busy) {
        queued = budget;
        return;
      }
      const m = measure(node, members.current, optionsRef.current, spacing);
      if (!m) {
        if (surface.current) surface.current.style.visibility = 'hidden';
        return;
      }
      busy = true;
      const job = jobFor(m, spacing, budget);
      const scale = 2 * job.maxDisplacement;
      const done = () => {
        busy = false;
        if (queued !== null && alive) {
          const next = queued;
          queued = null;
          draw(next);
        }
      };
      const show = (urls: UnionURLs) => {
        if (!alive) return;
        // Swap maps only once the new one is decoded, so the surface never flashes empty.
        const img = new Image();
        img.src = urls.displacement;
        const swap = () => {
          if (alive) apply(m, urls, scale);
          done();
        };
        if (typeof img.decode === 'function') img.decode().then(swap, swap);
        else swap();
      };
      const pending = buildUnionInWorker(job);
      if (pending) pending.then(show, () => show(onMainThread(job)));
      else show(onMainThread(job));
    };

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!visible) return;
      const host = node.getBoundingClientRect();
      let signature = `${host.width.toFixed(1)}x${host.height.toFixed(1)}`;
      for (const [el, radius] of members.current) {
        const r = el.getBoundingClientRect();
        signature += `|${(r.left - host.left).toFixed(1)},${(r.top - host.top).toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)},${radius().toFixed(1)}`;
      }
      if (signature !== lastSignature || dirty.current) {
        lastSignature = signature;
        dirty.current = false;
        lastChange = now;
        sharp = false;
        draw(MOVING_BUDGET);
      } else if (!sharp && now - lastChange > SETTLE_MS) {
        sharp = true;
        draw(SETTLED_BUDGET);
      }
    };

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
          })
        : null;
    io?.observe(node);
    frame = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      io?.disconnect();
    };
  }, [node, spacing, refract, copying, filtered, webgl, reducedTransparency, id]);

  // WebGL engine: the members as panes on the backdrop media, merged in the shader.
  const mediaFrame = useCallback((): MediaFrame | null => {
    if (!node) return null;
    const opts = optionsRef.current;
    const m = measure(node, members.current, opts, spacing);
    if (!m) return null;
    const bezel = opts.bezel ?? m.glass.bezel;
    const panes = m.shapes.map((q) => ({ x: q.x, y: q.y, el: node, glass: resolveGlass({ ...opts, radius: q.radius, bezel }, q.width, q.height) }));
    const box = { x: m.box.x - SHADE_PAD, y: m.box.y - SHADE_PAD, width: m.box.width + 2 * SHADE_PAD, height: m.box.height + 2 * SHADE_PAD };
    return { panes, box, merge: spacing, shadow, key: `${m.signature}|${spacing}|${shadow}|${optionsKey(opts)}` };
  }, [node, spacing, shadow]);

  const g0 = resolveGlass(options, 100, 100);
  const channels = g0.aberration > 0 ? 3 : 1;
  const path = webgl ? 'webgl' : copying ? 'element' : refract ? 'refract' : 'frost';

  return createElement(
    as ?? 'div',
    { ...rest, ref: setRef, style, 'data-meniscus-group': path },
    webgl && node && fallback.element ? (
      <MediaLayer key="webgl" host={node} media={fallback.element as Media} frame={mediaFrame} onFail={fallback.fail} />
    ) : (
      [
        shadow ? (
          <span
            key="shade"
            ref={shade}
            aria-hidden="true"
            style={{ ...LAYER, filter: 'blur(14px)', opacity: 0.22, maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskComposite: 'exclude', WebkitMaskComposite: 'xor' }}
          >
            <span ref={shadeInner} style={{ position: 'absolute', background: '#000', maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />
          </span>
        ) : null,
        <span key="surface" ref={surface} aria-hidden="true" data-meniscus-layer="surface" style={{ ...LAYER, visibility: 'hidden', maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }}>
          {copying ? (
            <>
              <span ref={copy} data-meniscus-layer="copy" style={{ position: 'absolute', pointerEvents: 'none' }} />
              <span ref={copyTint} style={FILL} />
            </>
          ) : null}
        </span>,
        <span key="light" ref={light} aria-hidden="true" data-meniscus-layer="highlight" style={{ ...LAYER, backgroundSize: '100% 100%' }} />,
      ]
    ),
    filtered && !webgl ? (
      <svg key="filter" aria-hidden="true" focusable="false" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <filter ref={filterRef} id={id} x="0" y="0" width="1" height="1" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
          {channels === 1 ? (
            <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" />
          ) : (
            <>
              <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="shiftR" />
              <feColorMatrix in="shiftR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="shiftG" />
              <feColorMatrix in="shiftG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" result="shiftB" />
              <feColorMatrix in="shiftB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
              <feBlend in="red" in2="green" mode="screen" result="rg" />
              <feBlend in="rg" in2="blue" mode="screen" />
            </>
          )}
        </filter>
      </svg>
    ) : null,
    <GroupContext.Provider key="members" value={context}>
      {children}
    </GroupContext.Provider>,
  );
}

export const GlassGroup = forwardRef(GlassGroupImpl) as (props: GlassGroupProps & { ref?: ForwardedRef<HTMLElement> }) => ReactElement | null;
