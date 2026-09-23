import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { useIsomorphicLayoutEffect } from './hooks';

/** A damped spring, integrated per frame. Underdamped: one overshoot, then it settles. */
class Spring {
  value: number;
  velocity = 0;
  target: number;
  constructor(readonly rest: number, private stiffness = 420, private damping = 24) {
    this.value = rest;
    this.target = rest;
  }
  step(dt: number): void {
    const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
    this.velocity += force * dt;
    this.value += this.velocity * dt;
  }
  get settled(): boolean {
    return Math.abs(this.value - this.target) < 1e-4 && Math.abs(this.velocity) < 1e-3;
  }
  get atRest(): boolean {
    return this.settled && Math.abs(this.target - this.rest) < 1e-9;
  }
  snap(): void {
    this.value = this.target;
    this.velocity = 0;
  }
  reset(): void {
    this.target = this.rest;
    this.snap();
  }
}

export interface InteractionHandlers<T extends HTMLElement> {
  onPointerEnter: (e: PointerEvent<T>) => void;
  onPointerMove: (e: PointerEvent<T>) => void;
  onPointerLeave: (e: PointerEvent<T>) => void;
  onPointerDown: (e: PointerEvent<T>) => void;
  onPointerUp: (e: PointerEvent<T>) => void;
  onPointerCancel: (e: PointerEvent<T>) => void;
  onKeyDown: (e: KeyboardEvent<T>) => void;
  onKeyUp: (e: KeyboardEvent<T>) => void;
}

const PRESS_SCALE = 1.045;
const HOVER_SCALE = 1.012;
const STRETCH = 0.05;
const PULL = 3;
const BLOOM_MS = 560;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The element's own `scale` and `translate` before the spring took over, to compose with and restore. */
interface Base {
  scale: [number, number];
  translate: [string, string];
  inlineScale: string;
  inlineTranslate: string;
}

function readBase(el: HTMLElement): Base {
  const cs = getComputedStyle(el);
  const s = cs.scale && cs.scale !== 'none' ? cs.scale.split(/\s+/).map(Number) : [1, 1];
  const t = cs.translate && cs.translate !== 'none' ? cs.translate.split(/\s+/) : [];
  return {
    scale: [Number.isFinite(s[0]) ? s[0]! : 1, Number.isFinite(s[1]) ? s[1]! : Number.isFinite(s[0]) ? s[0]! : 1],
    translate: [t[0] ?? '0px', t[1] ?? '0px'],
    inlineScale: el.style.scale,
    inlineTranslate: el.style.translate,
  };
}

/**
 * Liquid response to pointer and press. Pressing swells the glass, dragging
 * stretches it toward the pointer, and releasing lets it wobble back. A glow
 * follows the pointer. Motion goes through the `scale` and `translate`
 * properties, composed with whatever the app already set there, and the
 * app's values are restored as soon as the spring settles.
 */
export function useLiquidInteraction<T extends HTMLElement>(ref: RefObject<T | null>, enabled: boolean, reducedMotion: boolean): InteractionHandlers<T> | null {
  const springs = useRef({
    sx: new Spring(1),
    sy: new Spring(1),
    tx: new Spring(0),
    ty: new Spring(0),
    glow: new Spring(0, 260, 30),
  });
  const state = useRef({ hover: false, pressed: false, nx: 0, ny: 0 });
  const frame = useRef<number | null>(null);
  const last = useRef(0);
  const base = useRef<Base | null>(null);

  const release = useCallback((el: HTMLElement | null) => {
    if (!el || !base.current) return;
    el.style.scale = base.current.inlineScale;
    el.style.translate = base.current.inlineTranslate;
    base.current = null;
  }, []);

  const apply = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const s = springs.current;
    el.style.setProperty('--meniscus-glow', s.glow.value.toFixed(3));
    if (reducedMotion) return;
    if (s.sx.atRest && s.sy.atRest && s.tx.atRest && s.ty.atRest) {
      release(el);
      return;
    }
    base.current ??= readBase(el);
    const b = base.current;
    el.style.scale = `${(b.scale[0] * s.sx.value).toFixed(4)} ${(b.scale[1] * s.sy.value).toFixed(4)}`;
    el.style.translate = `calc(${b.translate[0]} + ${s.tx.value.toFixed(2)}px) calc(${b.translate[1]} + ${s.ty.value.toFixed(2)}px)`;
  }, [ref, reducedMotion, release]);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const dt = Math.min(1 / 30, (now - last.current) / 1000 || 1 / 60);
      last.current = now;
      const all = Object.values(springs.current);
      for (const s of all) s.step(dt);
      if (all.every((s) => s.settled)) {
        for (const s of all) s.snap();
        apply();
        frame.current = null;
        return;
      }
      apply();
      frame.current = requestAnimationFrame(tick);
    },
    [apply],
  );

  const retarget = useCallback(() => {
    const { hover, pressed, nx, ny } = state.current;
    const s = springs.current;
    s.glow.target = pressed ? 1 : hover ? 0.55 : 0;
    const motion = pressed && !reducedMotion;
    const lift = hover && !pressed && !reducedMotion ? HOVER_SCALE : 1;
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    s.sx.target = motion ? PRESS_SCALE + STRETCH * ax - STRETCH * 0.4 * ay : lift;
    s.sy.target = motion ? PRESS_SCALE + STRETCH * ay - STRETCH * 0.4 * ax : lift;
    s.tx.target = motion ? PULL * nx : 0;
    s.ty.target = motion ? PULL * ny : 0;
    if (frame.current === null) {
      last.current = performance.now();
      frame.current = requestAnimationFrame(tick);
    }
  }, [reducedMotion, tick]);

  const track = useCallback(
    (e: PointerEvent<T>) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty('--meniscus-x', `${x.toFixed(1)}px`);
      el.style.setProperty('--meniscus-y', `${y.toFixed(1)}px`);
      state.current.nx = clamp((x / r.width) * 2 - 1, -1, 1);
      state.current.ny = clamp((y / r.height) * 2 - 1, -1, 1);
    },
    [ref],
  );

  /**
   * A bloom of light that spreads from the point of contact across the glass
   * and fades, like a ripple running out from a touch. It lives in the
   * glass's light layer, which clips it to the glass shape.
   */
  const bloom = useCallback(
    (x: number, y: number) => {
      const el = ref.current;
      const layer = el?.querySelector<HTMLElement>(':scope > [data-meniscus-layer="light"]');
      if (!el || !layer || typeof layer.animate !== 'function') return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const reach = 2 * Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
      const drop = document.createElement('span');
      drop.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${reach}px;height:${reach}px;border-radius:50%;pointer-events:none;mix-blend-mode:screen;background:radial-gradient(circle,rgba(255,255,255,0.5) 0%,rgba(255,255,255,0.16) 38%,rgba(255,255,255,0) 62%),radial-gradient(circle,rgba(255,255,255,0) 64%,rgba(255,255,255,0.35) 68%,rgba(255,255,255,0) 72%);`;
      layer.appendChild(drop);
      const anim = drop.animate(
        reducedMotion
          ? [{ opacity: 0.7, transform: 'translate(-50%, -50%) scale(0.6)' }, { opacity: 0, transform: 'translate(-50%, -50%) scale(0.6)' }]
          : [
              { opacity: 0.9, transform: 'translate(-50%, -50%) scale(0.05)' },
              { opacity: 0.55, transform: 'translate(-50%, -50%) scale(0.55)', offset: 0.45 },
              { opacity: 0, transform: 'translate(-50%, -50%) scale(1)' },
            ],
        { duration: reducedMotion ? 220 : BLOOM_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
      anim.onfinish = () => drop.remove();
      anim.oncancel = () => drop.remove();
    },
    [ref, reducedMotion],
  );

  // Turning interaction off, entering reduced motion, or unmounting stops any
  // motion in flight and gives the element back exactly as the app styled it.
  useEffect(() => {
    if (enabled && !reducedMotion) return;
    stop();
    state.current = { hover: false, pressed: false, nx: 0, ny: 0 };
    for (const s of Object.values(springs.current)) s.reset();
    const el = ref.current;
    release(el);
    el?.style.setProperty('--meniscus-glow', '0');
  }, [enabled, reducedMotion, ref, release, stop]);

  useEffect(
    () => () => {
      stop();
      release(ref.current);
    },
    [ref, release, stop],
  );

  // Stable handlers that always call the latest callbacks.
  const latest = useRef({ retarget, track, bloom });
  useIsomorphicLayoutEffect(() => {
    latest.current = { retarget, track, bloom };
  });

  const handlers = useMemo<InteractionHandlers<T>>(() => {
    const set = (patch: Partial<typeof state.current>) => {
      Object.assign(state.current, patch);
      latest.current.retarget();
    };
    return {
      onPointerEnter: (e) => {
        latest.current.track(e);
        set({ hover: true });
      },
      onPointerMove: (e) => {
        latest.current.track(e);
        if (state.current.pressed || state.current.hover) latest.current.retarget();
      },
      onPointerLeave: () => set({ hover: false, pressed: false, nx: 0, ny: 0 }),
      onPointerDown: (e) => {
        latest.current.track(e);
        const r = e.currentTarget.getBoundingClientRect();
        const sx = e.currentTarget.offsetWidth ? r.width / e.currentTarget.offsetWidth : 1;
        const sy = e.currentTarget.offsetHeight ? r.height / e.currentTarget.offsetHeight : 1;
        latest.current.bloom((e.clientX - r.left) / sx, (e.clientY - r.top) / sy);
        set({ pressed: true });
      },
      onPointerUp: () => set({ pressed: false }),
      onPointerCancel: () => set({ pressed: false, hover: false }),
      onKeyDown: (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          const el = e.currentTarget;
          latest.current.bloom(el.offsetWidth / 2, el.offsetHeight / 2);
          set({ pressed: true, nx: 0, ny: 0 });
        }
      },
      onKeyUp: (e) => {
        if (e.key === ' ' || e.key === 'Enter') set({ pressed: false });
      },
    };
  }, []);

  return enabled ? handlers : null;
}
