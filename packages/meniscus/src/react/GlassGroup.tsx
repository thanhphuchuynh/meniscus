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
import { lightingProfile, glassProfile, resolveGlass, type GlassOptions } from '../core/glass';
import { toDataURL } from '../core/encode';
import { REDUCED_TRANSPARENCY, type RenderModePreference } from '../core/support';
import { createUnionMaps, unionPixelScale, unionReach, type UnionShape } from '../core/union';
import { GLASS_OPTION_KEYS } from '../core/constants';
import { useGlassDefaults } from './context';
import { useGlassMode, useIsomorphicLayoutEffect, useMediaQuery } from './hooks';
import { GroupContext, useGlassGroup } from './group';
import { useMergedRef } from './refs';

export { useGlassGroup };

export interface GlassGroupProps extends GlassOptions, Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** How far apart two glass outlines can be and still bridge, px: the surface tension. 0 never merges. Within twice this, outlines lean toward each other. */
  spacing?: number;
  /** Rendering path for the merged surface. */
  mode?: RenderModePreference;
  /** Shadow under the merged surface, or `false` for none. */
  shadow?: boolean;
  as?: ElementType;
  children?: ReactNode;
}

const LAYER: CSSProperties = { position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' };
/** Room around the merged outline for the shadow's blur and drop, px. */
const SHADE_PAD = 36;
const SHADE_DROP = 9;
const MOVING_BUDGET = 40_000;
const SETTLED_BUDGET = 110_000;
const SETTLE_MS = 140;

/**
 * Glass that behaves like liquid. Every `Glass` inside a group is drawn as
 * one surface: outlines closer than `spacing` grow a neck between them and
 * fuse the way two drops do, and pull apart again as they separate. Lay the
 * children out with CSS and animate them however you like; the surface
 * follows every frame.
 */
function GlassGroupImpl(props: GlassGroupProps, forwardedRef: ForwardedRef<HTMLElement>) {
  const defaults = useGlassDefaults();
  const { spacing = 24, mode: modePreference, shadow = true, as, style, children, ...rest } = props as GlassGroupProps & Record<string, unknown>;
  const options: GlassOptions = {};
  for (const key of GLASS_OPTION_KEYS) {
    const value = (rest as Record<string, unknown>)[key] ?? defaults[key];
    if (value !== undefined) (options as Record<string, unknown>)[key] = value;
    delete (rest as Record<string, unknown>)[key];
  }

  const [node, setNode] = useState<HTMLElement | null>(null);
  const setRef = useMergedRef(forwardedRef, setNode);
  const mode = useGlassMode(modePreference);
  const reducedTransparency = useMediaQuery(REDUCED_TRANSPARENCY);
  const refract = mode === 'refract' && !reducedTransparency;
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

  useEffect(() => {
    if (!node) return;
    let frame = 0;
    let visible = true;
    let lastSignature = '';
    let lastChange = 0;
    let sharp = true;
    let busy = false;
    let queued: number | null = null;

    const draw = (budget: number) => {
      if (busy) {
        queued = budget;
        return;
      }
      const host = node.getBoundingClientRect();
      const sx = node.offsetWidth ? host.width / node.offsetWidth : 1;
      const sy = node.offsetHeight ? host.height / node.offsetHeight : 1;
      const shapes: UnionShape[] = [];
      let minR = Infinity;
      for (const [el, radius] of members.current) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const x = (r.left - host.left) / sx - node.clientLeft;
        const y = (r.top - host.top) / sy - node.clientTop;
        const w = r.width / sx;
        const h = r.height / sy;
        // A pressed child swells through `scale`; its radius swells with it.
        const scale = el.offsetWidth ? w / el.offsetWidth : 1;
        const rad = Math.min(radius() * scale, w / 2, h / 2);
        shapes.push({ x, y, width: w, height: h, radius: rad });
        minR = Math.min(minR, rad);
      }
      const s = surface.current;
      if (!s || !shapes.length) {
        if (s) s.style.visibility = 'hidden';
        return;
      }
      const opts = optionsRef.current;
      const pad = unionReach(spacing) + 2;
      const x0 = Math.min(...shapes.map((q) => q.x)) - pad;
      const y0 = Math.min(...shapes.map((q) => q.y)) - pad;
      const x1 = Math.max(...shapes.map((q) => q.x + q.width)) + pad;
      const y1 = Math.max(...shapes.map((q) => q.y + q.height)) + pad;
      const bw = Math.ceil(x1 - x0);
      const bh = Math.ceil(y1 - y0);
      for (const q of shapes) {
        q.x -= x0;
        q.y -= y0;
      }
      // Resolve the shared glass as if it were one rounded rectangle of the smallest radius.
      const g = resolveGlass({ ...opts, radius: minR, bezel: opts.bezel ?? Math.min(minR, 32) }, minR * 2, minR * 2);
      const maps = createUnionMaps({
        shapes,
        width: bw,
        height: bh,
        smoothing: spacing,
        bezel: g.bezel,
        profile: glassProfile(g),
        lighting: lightingProfile(g),
        light: { angle: g.lightAngle, elevation: g.lightElevation, specular: g.specular, rim: g.rim, shade: g.shade },
        pixelScale: unionPixelScale(bw, bh, budget),
      });
      const dispUrl = toDataURL(maps.displacement);
      const lightUrl = toDataURL(maps.highlight);
      busy = true;
      const img = new Image();
      img.src = dispUrl;
      const apply = () => {
        busy = false;
        const box = { left: `${x0}px`, top: `${y0}px`, width: `${bw}px`, height: `${bh}px` };
        for (const el of [s, light.current]) if (el) Object.assign(el.style, box);
        const frost = `blur(${g.blur}px) saturate(${g.saturation})`;
        const mask = `url("${dispUrl}")`;
        s.style.visibility = 'visible';
        s.style.maskImage = mask;
        s.style.setProperty('-webkit-mask-image', mask);
        s.style.backgroundColor = reducedTransparency ? `color-mix(in srgb, Canvas 86%, ${g.tint})` : g.tint;
        const f = filterRef.current;
        if (refract && f && maps.scale > 0) {
          f.setAttribute('width', String(bw));
          f.setAttribute('height', String(bh));
          const image = f.querySelector('feImage');
          image?.setAttribute('href', dispUrl);
          image?.setAttribute('width', String(bw));
          image?.setAttribute('height', String(bh));
          const spread = g.aberration * ABERRATION_SPREAD;
          f.querySelectorAll('feDisplacementMap').forEach((d, i) => {
            const k = spread > 0 ? [1 + spread, 1, 1 - spread][i] ?? 1 : 1;
            d.setAttribute('scale', String(maps.scale * k));
          });
          s.style.backdropFilter = `url(#${id}) ${frost}`;
          s.style.removeProperty('-webkit-backdrop-filter');
        } else {
          s.style.backdropFilter = frost;
          s.style.setProperty('-webkit-backdrop-filter', frost);
        }
        if (light.current) light.current.style.backgroundImage = `url("${lightUrl}")`;
        // The shadow falls outside the glass only: a blurred, dropped copy of
        // the outline with the outline itself cut back out, so it never
        // clouds the glass from underneath.
        const outer = shade.current;
        const inner = shadeInner.current;
        if (outer && inner) {
          Object.assign(outer.style, {
            left: `${x0 - SHADE_PAD}px`,
            top: `${y0 - SHADE_PAD}px`,
            width: `${bw + 2 * SHADE_PAD}px`,
            height: `${bh + 2 * SHADE_PAD}px`,
          });
          const cut = `${mask}, linear-gradient(#000, #000)`;
          const at = `${SHADE_PAD}px ${SHADE_PAD}px, 0 0`;
          const size = `${bw}px ${bh}px, 100% 100%`;
          outer.style.maskImage = cut;
          outer.style.maskPosition = at;
          outer.style.maskSize = size;
          outer.style.setProperty('-webkit-mask-image', cut);
          outer.style.setProperty('-webkit-mask-position', at);
          outer.style.setProperty('-webkit-mask-size', size);
          Object.assign(inner.style, { left: `${SHADE_PAD}px`, top: `${SHADE_PAD + SHADE_DROP}px`, width: `${bw}px`, height: `${bh}px` });
          inner.style.maskImage = mask;
          inner.style.setProperty('-webkit-mask-image', mask);
        }
        if (queued !== null) {
          const next = queued;
          queued = null;
          draw(next);
        }
      };
      // Swap maps only once the new one is decoded, so the surface never flashes empty.
      if (typeof img.decode === 'function') img.decode().then(apply, apply);
      else apply();
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
      cancelAnimationFrame(frame);
      io?.disconnect();
    };
  }, [node, spacing, refract, reducedTransparency, id]);

  const g0 = resolveGlass(options, 100, 100);
  const channels = g0.aberration > 0 ? 3 : 1;

  return createElement(
    as ?? 'div',
    { ...rest, ref: setRef, style, 'data-meniscus-group': refract ? 'refract' : 'frost' },
    shadow ? (
      <span
        key="shade"
        ref={shade}
        aria-hidden="true"
        style={{
          ...LAYER,
          filter: 'blur(14px)',
          opacity: 0.22,
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
        }}
      >
        <span ref={shadeInner} style={{ position: 'absolute', background: '#000', maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />
      </span>
    ) : null,
    <span key="surface" ref={surface} aria-hidden="true" data-meniscus-layer="surface" style={{ ...LAYER, visibility: 'hidden', maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />,
    <span key="light" ref={light} aria-hidden="true" data-meniscus-layer="highlight" style={{ ...LAYER, backgroundSize: '100% 100%' }} />,
    refract ? (
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
