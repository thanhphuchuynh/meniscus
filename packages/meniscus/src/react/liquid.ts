import { useEffect } from 'react';
import type { GlassPhysics } from '../core/physics';
import type { RippleField } from '../core/ripple';
import { DEV } from './dev';
import { Spring } from './interaction';

/** Most a moving glass stretches: 0.15 is about 16% along its path, area kept. */
export const MAX_SQUASH = 0.15;
/** Speeds below this don't squash, so a press's own small pull never does. */
const SQUASH_FLOOR = 100;
const SQUASH_SPEED = 1800;
const MAX_ACCELERATION = 30000;
const REST_FRAMES = 6;
const RELEASE_MS = 2000;
const TRAIL_SPEED = 30;

const fields = new WeakMap<HTMLElement, RippleField>();

/** The liquid surface a rippling glass registered for its element, for the renderer that draws it. */
export function rippleOf(el: HTMLElement): RippleField | undefined {
  return fields.get(el);
}

export function registerRipple(el: HTMLElement, field: RippleField): () => void {
  fields.set(el, field);
  return () => {
    if (fields.get(el) === field) fields.delete(el);
  };
}

let warned = false;
/** Development hint, once a page: `ripple` was asked for where nothing can draw it. */
export function warnUndrawnRipple(): void {
  if (!DEV || warned) return;
  warned = true;
  console.warn('meniscus: `ripple` needs WebGL to draw its waves. Give the glass an image, video or canvas `backdrop`, or place it in a GlassStage as a GlassPane.');
}

/**
 * The stretch a velocity asks for, as (s·cos 2θ, s·sin 2θ): doubling the
 * angle makes opposite directions the same stretch, with no wrap-around.
 */
export function squashTarget(vx: number, vy: number): [number, number] {
  const speed = Math.hypot(vx, vy);
  const over = speed - SQUASH_FLOOR;
  if (!(over > 0)) return [0, 0];
  const s = MAX_SQUASH * Math.tanh(over / SQUASH_SPEED);
  const c = vx / speed;
  const n = vy / speed;
  return [s * (c * c - n * n), s * 2 * c * n];
}

/** The area-preserving 2D matrix [m11, m12, m21, m22] for the stretch (a, b). */
export function squashMatrix(a: number, b: number): [number, number, number, number] {
  const k = 1 / Math.sqrt(Math.max(1e-3, 1 - a * a - b * b));
  return [(1 + a) * k, b * k, b * k, (1 - a) * k];
}

const clamp = (v: number) => Math.max(-MAX_ACCELERATION, Math.min(MAX_ACCELERATION, v));

function transformed(el: HTMLElement): boolean {
  const t = getComputedStyle(el).transform;
  return !!t && t !== 'none';
}

export interface LiquidMotionOptions {
  /** Squash along the path and wobble at a stop. */
  squash: boolean;
  /** A surface to drop beads, draw trails and slosh on. */
  ripple: RippleField | null;
  reducedMotion: boolean;
  /** Optics to lift on press and to set ringing with the release momentum. */
  optics?: GlassPhysics | null;
}

/**
 * Liquid response to motion. From a press until the glass comes to rest, it
 * follows the element on screen: the glass squashes along its path and
 * wobbles as it stops, and a rippling glass takes beads, trails and the
 * slosh of its own acceleration. Glass that never moves is left alone, and
 * a glass the app transforms keeps its transform.
 */
export function useLiquidMotion(node: HTMLElement | null, { squash, ripple, reducedMotion, optics = null }: LiquidMotionOptions): void {
  useEffect(() => {
    if (!node || reducedMotion || (!squash && !ripple && !optics)) return;
    const a = new Spring(0, 260, 14);
    const b = new Spring(0, 260, 14);
    let frame = 0;
    let pointerId: number | null = null;
    let releasedAt = 0;
    let last: { x: number; y: number; t: number } | null = null;
    let vx = 0;
    let vy = 0;
    let ax = 0;
    let ay = 0;
    let still = 0;
    let owned = false;
    let inline = '';
    // The transform last written, as the element reads it back; null while resting.
    let written: string | null = null;
    let trail: { x: number; y: number; t: number } | null = null;

    const local = (clientX: number, clientY: number) => {
      const r = node.getBoundingClientRect();
      const sx = node.offsetWidth ? r.width / node.offsetWidth : 1;
      const sy = node.offsetHeight ? r.height / node.offsetHeight : 1;
      return { x: (clientX - r.left) / sx, y: (clientY - r.top) / sy };
    };

    const finish = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = null;
      vx = vy = ax = ay = 0;
      still = 0;
      a.reset();
      b.reset();
      // Only undo our own squash: a transform the app set since is theirs.
      if (owned && written !== null && node.style.transform === written) node.style.transform = inline;
      owned = false;
      written = null;
    };

    const tick = (now: number) => {
      frame = 0;
      const r = node.getBoundingClientRect();
      const x = r.left + r.width / 2 + window.scrollX;
      const y = r.top + r.height / 2 + window.scrollY;
      let dt = 1 / 60;
      let moved = 0;
      if (last) {
        dt = Math.min(1 / 30, Math.max(1 / 240, (now - last.t) / 1000));
        const nvx = vx + 0.5 * ((x - last.x) / dt - vx);
        const nvy = vy + 0.5 * ((y - last.y) / dt - vy);
        ax = clamp(ax + 0.5 * ((nvx - vx) / dt - ax));
        ay = clamp(ay + 0.5 * ((nvy - vy) / dt - ay));
        vx = nvx;
        vy = nvy;
        moved = Math.hypot(x - last.x, y - last.y);
      }
      last = { x, y, t: now };
      ripple?.accelerate(ax, ay);
      if (owned && node.style.transform !== (written ?? inline)) {
        // The app took the transform mid-gesture (a drag library, a press effect): it's theirs now.
        owned = false;
        written = null;
        a.reset();
        b.reset();
      }
      if (owned) {
        [a.target, b.target] = squashTarget(vx, vy);
        a.step(dt);
        b.step(dt);
        const resting = a.settled && b.settled && Math.abs(a.value) < 1e-4 && Math.abs(b.value) < 1e-4;
        if (resting) {
          if (written !== null) {
            node.style.transform = inline;
            written = null;
          }
        } else {
          const [m11, m12, m21, m22] = squashMatrix(a.value, b.value);
          node.style.transform = `matrix(${m11.toFixed(4)}, ${m21.toFixed(4)}, ${m12.toFixed(4)}, ${m22.toFixed(4)}, 0, 0)`;
          written = node.style.transform;
        }
      }
      still = moved < 0.1 ? still + 1 : 0;
      if (pointerId === null && ((still >= REST_FRAMES && a.settled && b.settled) || now - releasedAt > RELEASE_MS)) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || pointerId !== null) return;
      pointerId = e.pointerId;
      optics?.to({ shadow: 1.25 });
      if (!frame) {
        // Decided once a gesture, before any squash of ours is on the element.
        owned = squash && !transformed(node);
        inline = node.style.transform;
        frame = requestAnimationFrame(tick);
      }
      if (ripple) {
        const p = local(e.clientX, e.clientY);
        ripple.drop(p.x, p.y);
        trail = { ...p, t: e.timeStamp };
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!ripple || e.pointerId !== pointerId || !trail) return;
      const p = local(e.clientX, e.clientY);
      const dt = Math.max(0.004, (e.timeStamp - trail.t) / 1000);
      const speed = Math.hypot(p.x - trail.x, p.y - trail.y) / dt;
      // A glass dragged along with the finger has nothing moving across it.
      if (speed > TRAIL_SPEED && Math.hypot(vx, vy) < speed * 0.25) ripple.stroke(trail.x, trail.y, p.x, p.y, speed);
      trail = { ...p, t: e.timeStamp };
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      trail = null;
      releasedAt = performance.now();
      optics?.to({ shadow: 1 });
      optics?.impulse(vx, vy);
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      trail = null;
      // The browser took the touch for a scroll or a zoom: stop following the glass.
      finish();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!ripple || e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
      ripple.drop(node.offsetWidth / 2, node.offsetHeight / 2);
    };

    node.addEventListener('pointerdown', onDown);
    node.addEventListener('pointermove', onMove);
    node.addEventListener('keydown', onKey);
    // Releases can land anywhere once the pointer leaves the glass.
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    return () => {
      node.removeEventListener('pointerdown', onDown);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      finish();
    };
  }, [node, squash, ripple, reducedMotion, optics]);
}
