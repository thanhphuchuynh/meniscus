/** Whether a surface reads as light or dark, which decides the ink on it. */
export type Tone = 'light' | 'dark';

/**
 * A surface darker than this relative luminance turns dark, and one lighter
 * than `LIGHT_ABOVE` turns light. Between them it keeps its tone. Black and
 * white text have equal contrast near 0.18, the middle of the margin.
 */
export const DARK_BELOW = 0.16;
export const LIGHT_ABOVE = 0.2;

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance of an sRGB color, channels 0 to 1. */
export function luminance(rgb: readonly number[]): number {
  return 0.2126 * linear(rgb[0] ?? 0) + 0.7152 * linear(rgb[1] ?? 0) + 0.0722 * linear(rgb[2] ?? 0);
}

/** Luminance of a translucent color (rgba, 0 to 1) laid over a backdrop of luminance `backdrop`. */
export function composite(tint: readonly number[], backdrop: number): number {
  const a = Math.max(0, Math.min(1, tint[3] ?? 1));
  return a * luminance(tint) + (1 - a) * backdrop;
}

/** The tone for a luminance. Inside the margin it keeps `previous`, so a surface on the line doesn't flicker. */
export function pickTone(l: number, previous: Tone | null): Tone {
  if (l < DARK_BELOW) return 'dark';
  if (l > LIGHT_ABOVE) return 'light';
  return previous ?? 'light';
}

const channel = (s: string | undefined) => (s === undefined ? NaN : s.endsWith('%') ? (parseFloat(s) / 100) * 255 : parseFloat(s));
const alpha = (s: string | undefined) => (s === undefined ? 1 : s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));

/**
 * Parses a computed color, `rgb(…)`, `rgba(…)` or `color(srgb …)`, into rgba
 * from 0 to 1. It needs no canvas, so it works wherever computed styles do.
 */
export function parseComputedColor(css: string): [number, number, number, number] | null {
  const text = css.trim();
  const fn = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (fn) {
    const p = fn[1]!.split(/[\s,/]+/).filter(Boolean);
    const rgba: [number, number, number, number] = [channel(p[0]) / 255, channel(p[1]) / 255, channel(p[2]) / 255, alpha(p[3])];
    return rgba.every(Number.isFinite) ? rgba : null;
  }
  const srgb = /^color\(srgb\s+([^)]+)\)$/i.exec(text);
  if (srgb) {
    const p = srgb[1]!.split(/[\s/]+/).filter(Boolean);
    const rgba: [number, number, number, number] = [Number(p[0]), Number(p[1]), Number(p[2]), alpha(p[3])];
    return rgba.every(Number.isFinite) ? rgba : null;
  }
  return null;
}
