# Component Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship ten ready-to-use liquid-glass components (Dialog, Popover, Tooltip, Menu, Toast, Navbar, Sidebar, Switch, Slider, Segmented), a tinted variant and adaptive tint, as meniscus 0.6.0.

**Architecture:**
- **Overlays.** They render where they sit in the React tree and use the browser's top layer: `<dialog>` with `showModal()`, or the Popover API with `popover="manual"`. One shared hook (`useOverlay`) shows the element, springs its presence in on the existing `GlassPhysics`, springs it out, and hides the element once the glass is invisible.
- **Anchored overlays** use CSS anchor positioning where it exists. Elsewhere a pure `place()` function positions them.
- **Tone.** Adaptive and tinted glass hit-test what's behind them (`elementsFromPoint`, plus an 8×8 CPU canvas for media) to choose between light and dark.

**Tech Stack:** TypeScript 6 (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`), React 18 and 19, tsup, Vitest 5 with jsdom 30, Playwright 1.63, pnpm 9 workspace, esbuild 0.27 (for the size check).

**Spec:** `docs/superpowers/specs/2026-09-27-component-kit-design.md`. Read it before starting. Section references below (§3.1 and so on) point to it.

## Global Constraints

- No new runtime dependencies. `meniscus` keeps only its `react` peer dependency.
- Every browser keeps a working path: Chromium refracts, Safari and Firefox frost, and old browsers without the Popover API get fixed positioning.
- Server rendering stays safe: no `window` or `document` access during render, and no hydration mismatches. Values that differ between server and client go through `useSyncExternalStore` with a server snapshot, or into effects.
- The library ships no stylesheet to import. Styles are inline. The only `<style>` elements are the ones a component renders for rules inline styles can't express (the dialog's `::backdrop`, the sidebar's media query).
- Reduced motion, reduced transparency, increased contrast and forced colors apply to everything new. Read them with `useGlassPreferences()`.
- Every public prop and type carries JSDoc.
- Commits carry no `Co-Authored-By` trailer and no other AI attribution.
- Follow the existing idiom:
  - one component per module in `packages/meniscus/src/react/`
  - `Glass…` names
  - `label` as the accessible name
  - `open`, `defaultOpen` and `onOpenChange` for open state
  - `value`, `defaultValue` and `onValueChange` for selection
  - form controls wrap a native input and forward their `ref` to it
  - `displayName` set on every component (the size check looks for it)
- Tests live in `packages/meniscus/test/`. Tests that need a DOM start with `// @vitest-environment jsdom`, and the rest run in node. Run them from `packages/meniscus` with `pnpm exec vitest run <file>`, and the whole suite with `pnpm test` from the repository root.

## Review Focus

The five inputs most likely to break for someone using the kit, which the spec implies but its tests don't cover. Each has a test in the task that owns the code.

1. **The browser closes a modal by itself.** Chrome's close watcher closes a `<dialog>` on a second Escape without user activation, and app code can call `close()` directly. The dialog must report `onOpenChange(false)` and reset, never sit in an "open but not shown" state. Test in Task 12.
2. **An overlay unmounts while open or mid-exit.** For example, on a route change. The page must scroll again, and no listener or popover may linger. Test in Task 12.
3. **Escape inside nested overlays.** A popover or menu open inside an open dialog: Escape closes only the innermost one, and the dialog stays open. Test in Task 13.
4. **A trigger that already has handlers, attributes and a ref.** Its own `onClick`, `aria-label` and `ref` still work after the overlay adds its own. Test in Task 10.
5. **`toast()` before any `GlassToaster` mounts.** For example, during app start-up. The toast appears once the toaster mounts, and its timer starts then. Test in Task 16.

## Files

Created (all paths from the repository root):

| File | Responsibility |
|---|---|
| `packages/meniscus/src/core/place.ts` | `place()`: where an anchored box goes, flipping and shifting to stay in the viewport; `POSITION_AREA` for CSS |
| `packages/meniscus/src/core/tone.ts` | `luminance`, `composite`, `pickTone`, `parseComputedColor`: pure tone math |
| `packages/meniscus/src/react/tone.ts` | `sampleBackdrop`, `sampleMedia`, `useBackdropTone`: reads what is behind a glass |
| `packages/meniscus/src/react/focus.ts` | `focusVisible`, `firstFocusable` |
| `packages/meniscus/src/react/overlay.ts` | `useOverlay`, `useOpenState`, `usePopoverSupport`: presence, show and hide, dismissal, focus return, scroll lock |
| `packages/meniscus/src/react/anchor.ts` | `useAnchor`: CSS anchor positioning, or `place()` on scroll and resize |
| `packages/meniscus/src/react/trigger.tsx` | `useTrigger`: clones the element that opens an overlay |
| `packages/meniscus/src/react/drag.ts` | `useDragDismiss`, `dragDismisses`: drag toward an edge to dismiss |
| `packages/meniscus/src/react/options.ts` | `splitGlassOptions`: glass options from the rest of a control's props |
| `packages/meniscus/src/react/GlassDialog.tsx` | Modal, sheet and drawer |
| `packages/meniscus/src/react/GlassPopover.tsx` | Anchored non-modal dialog |
| `packages/meniscus/src/react/GlassTooltip.tsx` | Hover and focus hint |
| `packages/meniscus/src/react/GlassMenu.tsx` | Menu button and menu |
| `packages/meniscus/src/react/GlassToast.tsx` | `toast()` store and `GlassToaster` |
| `packages/meniscus/src/react/GlassNavbar.tsx` | Sticky bar with a scroll edge |
| `packages/meniscus/src/react/GlassSidebar.tsx` | Column that collapses into a drawer |
| `packages/meniscus/src/react/GlassSwitch.tsx` | Switch with a lens knob |
| `packages/meniscus/src/react/GlassSlider.tsx` | Range with a lens thumb |
| `packages/meniscus/src/react/GlassSegmented.tsx` | Radio group with a flowing indicator |
| `packages/meniscus/test/setup/top-layer.ts` | Test stand-ins for `<dialog>` methods and the Popover API |
| `packages/meniscus/scripts/size.mjs` | Gzipped size of each export, with budgets and a leak check |
| `apps/site/scripts/check-components.mjs` | Top-layer behavior in Chromium, WebKit and Firefox |
| `examples/next-app/app/toast-button.tsx` | Client button that calls `toast()` |

Modified: `packages/meniscus/src/core/{support,glass,index}.ts`, `packages/meniscus/src/react/{Glass,GlassFields,appear}.tsx|ts`, `packages/meniscus/src/webgl/GlassStage.tsx`, `packages/meniscus/src/index.ts`, `packages/meniscus/{package.json,vitest.config.ts}`, `.github/workflows/ci.yml`, `apps/site/src/components/{Components.tsx,components.css}`, `apps/site/src/docs/{Docs.tsx,content.ts}`, `apps/site/package.json`, `examples/next-app/app/page.tsx`, `README.md`, `CHANGELOG.md`.

The spec's §2.1 file list gains four small helpers (`focus.ts`, `trigger.tsx`, `drag.ts`, `options.ts`), so the components don't repeat them.

## Before you start

- [ ] Work on the `feat/component-kit` branch, which holds the spec and this plan: `git switch feat/component-kit`.
- [ ] From the repository root, run `pnpm install --frozen-lockfile && pnpm test && pnpm typecheck`. Expected: every test passes (178 at the start) and typecheck is clean. If not, stop and report; don't build on a red baseline.

---

## Phase 1: Foundations

### Task 1: Support detection for the Popover API and anchor positioning

**Files:**
- Modify: `packages/meniscus/src/core/support.ts` (append after `overrideWebGL2`)
- Modify: `packages/meniscus/src/core/index.ts` (the `./support` export list)
- Test: `packages/meniscus/test/support.test.ts`

**Interfaces:**
- Produces: `supportsPopover(): boolean`, `overridePopoverSupport(value: boolean | undefined): void`, `supportsAnchorPositioning(): boolean`, `overrideAnchorPositioning(value: boolean | undefined): void`. All four are exported from `meniscus/core`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/meniscus/test/support.test.ts
// @vitest-environment jsdom
import { overrideAnchorPositioning, overridePopoverSupport, supportsAnchorPositioning, supportsPopover } from '../src/core';

afterEach(() => {
  overridePopoverSupport(undefined);
  overrideAnchorPositioning(undefined);
  vi.restoreAllMocks();
});

it('detects the Popover API on HTMLElement.prototype', () => {
  const proto = HTMLElement.prototype as { showPopover?: unknown };
  const saved = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
  try {
    delete proto.showPopover;
    overridePopoverSupport(undefined);
    expect(supportsPopover()).toBe(false);
    Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: () => {} });
    overridePopoverSupport(undefined);
    expect(supportsPopover()).toBe(true);
  } finally {
    if (saved) Object.defineProperty(HTMLElement.prototype, 'showPopover', saved);
    else delete proto.showPopover;
  }
});

it('asks CSS for anchor positioning, and an override wins', () => {
  const supports = vi.spyOn(CSS, 'supports').mockReturnValue(false);
  overrideAnchorPositioning(undefined);
  expect(supportsAnchorPositioning()).toBe(false);
  supports.mockReturnValue(true);
  overrideAnchorPositioning(undefined);
  expect(supportsAnchorPositioning()).toBe(true);
  expect(supports).toHaveBeenCalledWith('position-area', 'bottom');
  overrideAnchorPositioning(false);
  expect(supportsAnchorPositioning()).toBe(false);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/support.test.ts`
Expected: FAIL. TypeScript/Vitest reports that `supportsPopover` is not exported from `../src/core`.

- [ ] **Step 3: Implement**

Append to `packages/meniscus/src/core/support.ts`:

```ts
let popoverSupport: boolean | undefined;

/** Whether the browser has the Popover API, which lifts glass overlays into the top layer. */
export function supportsPopover(): boolean {
  if (popoverSupport !== undefined) return popoverSupport;
  // Not cached on the server: the answer there says nothing about the browser.
  if (typeof HTMLElement === 'undefined') return false;
  popoverSupport = typeof (HTMLElement.prototype as { showPopover?: unknown }).showPopover === 'function';
  return popoverSupport;
}

/** For tests and hosts: force Popover API support on or off, or undefined to detect again. */
export function overridePopoverSupport(value: boolean | undefined): void {
  popoverSupport = value;
}

let anchorSupport: boolean | undefined;

/** Whether the browser positions an element against an anchor in CSS (`anchor-name` and `position-area`). */
export function supportsAnchorPositioning(): boolean {
  if (anchorSupport !== undefined) return anchorSupport;
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  anchorSupport = CSS.supports('position-area', 'bottom') && CSS.supports('anchor-name', '--a');
  return anchorSupport;
}

/** For tests and hosts: force CSS anchor positioning on or off, or undefined to detect again. */
export function overrideAnchorPositioning(value: boolean | undefined): void {
  anchorSupport = value;
}
```

In `packages/meniscus/src/core/index.ts`, add the four names to the `./support` export list, after `overrideElementImage,`:

```ts
  supportsPopover,
  overridePopoverSupport,
  supportsAnchorPositioning,
  overrideAnchorPositioning,
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/support.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/core/support.ts packages/meniscus/src/core/index.ts packages/meniscus/test/support.test.ts
git commit -m "feat: detect the Popover API and CSS anchor positioning"
```

### Task 2: `place()` for anchored boxes

**Files:**
- Create: `packages/meniscus/src/core/place.ts`
- Test: `packages/meniscus/test/place.test.ts`

**Interfaces:**
- Produces:
  - `type GlassPlacement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end'`
  - `interface PlaceRect { x: number; y: number; width: number; height: number }`
  - `function place(anchor: PlaceRect, box: { width: number; height: number }, placement: GlassPlacement, options: { offset: number; viewport: PlaceRect; padding?: number }): { x: number; y: number; placement: GlassPlacement }`
  - `const POSITION_AREA: Readonly<Record<GlassPlacement, string>>`
  - `function placementSide(p: GlassPlacement): 'top' | 'bottom' | 'left' | 'right'`

- [ ] **Step 1: Write the failing test**

```ts
// packages/meniscus/test/place.test.ts
import { place, placementSide, POSITION_AREA, type GlassPlacement } from '../src/core/place';

const viewport = { x: 0, y: 0, width: 400, height: 300 };
const anchor = { x: 150, y: 120, width: 100, height: 40 };
const box = { width: 80, height: 50 };

it.each<[GlassPlacement, number, number]>([
  ['bottom', 160, 168],
  ['bottom-start', 150, 168],
  ['bottom-end', 170, 168],
  ['top', 160, 62],
  ['right', 258, 115],
  ['left', 62, 115],
  ['left-start', 62, 120],
  ['right-end', 258, 110],
])('%s puts the box beside the anchor, offset px away', (placement, x, y) => {
  expect(place(anchor, box, placement, { offset: 8, viewport })).toEqual({ x, y, placement });
});

it('flips to the opposite side when the requested one lacks room and the other has more', () => {
  const low = { x: 150, y: 260, width: 100, height: 30 };
  expect(place(low, box, 'bottom', { offset: 8, viewport })).toEqual({ x: 160, y: 202, placement: 'top' });
  expect(place(low, box, 'bottom-end', { offset: 8, viewport }).placement).toBe('top-end');
});

it('keeps the requested side when the other has no more room', () => {
  expect(place(anchor, { width: 80, height: 290 }, 'bottom', { offset: 8, viewport }).placement).toBe('bottom');
});

it('shifts along the edge to stay inside the viewport padding', () => {
  expect(place({ x: 2, y: 120, width: 30, height: 40 }, box, 'bottom', { offset: 8, viewport }).x).toBe(8);
  expect(place({ x: 380, y: 120, width: 20, height: 40 }, box, 'bottom', { offset: 8, viewport }).x).toBe(312);
  expect(place({ x: 150, y: 2, width: 40, height: 20 }, box, 'right', { offset: 8, viewport }).y).toBe(8);
});

it('pins a box wider than the viewport to its start', () => {
  expect(place(anchor, { width: 500, height: 20 }, 'bottom', { offset: 8, viewport }).x).toBe(8);
});

it('maps every placement to a CSS position-area and a side', () => {
  expect(Object.keys(POSITION_AREA)).toHaveLength(12);
  expect(POSITION_AREA['bottom-start']).toBe('bottom span-right');
  expect(POSITION_AREA['left-end']).toBe('left span-top');
  expect(placementSide('right-start')).toBe('right');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/place.test.ts`
Expected: FAIL with "Failed to resolve import ../src/core/place".

- [ ] **Step 3: Implement**

```ts
// packages/meniscus/src/core/place.ts
/** A side of the anchor, optionally aligned to its start or end edge. Without an alignment the box is centered. */
export type GlassPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'left-start'
  | 'left-end'
  | 'right-start'
  | 'right-end';

/** A rectangle in viewport px. */
export interface PlaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';

const OPPOSITE: Readonly<Record<Side, Side>> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** The CSS `position-area` for each placement, for engines with anchor positioning. */
export const POSITION_AREA: Readonly<Record<GlassPlacement, string>> = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
  'top-start': 'top span-right',
  'top-end': 'top span-left',
  'bottom-start': 'bottom span-right',
  'bottom-end': 'bottom span-left',
  'left-start': 'left span-bottom',
  'left-end': 'left span-top',
  'right-start': 'right span-bottom',
  'right-end': 'right span-top',
};

/** The side of the anchor a placement puts the box on. */
export function placementSide(p: GlassPlacement): Side {
  return p.split('-')[0] as Side;
}

function alignOf(p: GlassPlacement): Align {
  const a = p.split('-')[1];
  return a === 'start' || a === 'end' ? a : 'center';
}

const vertical = (side: Side) => side === 'top' || side === 'bottom';

/** Space between the anchor and the viewport's padded edge on one side. */
function room(a: PlaceRect, v: PlaceRect, side: Side, padding: number): number {
  switch (side) {
    case 'top':
      return a.y - (v.y + padding);
    case 'bottom':
      return v.y + v.height - padding - (a.y + a.height);
    case 'left':
      return a.x - (v.x + padding);
    case 'right':
      return v.x + v.width - padding - (a.x + a.width);
  }
}

/**
 * Where a box goes beside an anchor: on the placement's side, `offset` px
 * away, centered or aligned to the anchor's start or end. If that side lacks
 * room and the opposite side has more, it flips. It then shifts along the
 * edge to stay `padding` px inside the viewport. Returns the side it used.
 */
export function place(
  anchor: PlaceRect,
  box: { width: number; height: number },
  placement: GlassPlacement,
  { offset, viewport, padding = 8 }: { offset: number; viewport: PlaceRect; padding?: number },
): { x: number; y: number; placement: GlassPlacement } {
  let side = placementSide(placement);
  const align = alignOf(placement);
  const need = (vertical(side) ? box.height : box.width) + offset;
  const here = room(anchor, viewport, side, padding);
  if (here < need && room(anchor, viewport, OPPOSITE[side], padding) > here) side = OPPOSITE[side];

  let x: number;
  let y: number;
  if (vertical(side)) {
    y = side === 'top' ? anchor.y - offset - box.height : anchor.y + anchor.height + offset;
    x = align === 'start' ? anchor.x : align === 'end' ? anchor.x + anchor.width - box.width : anchor.x + (anchor.width - box.width) / 2;
    x = Math.max(viewport.x + padding, Math.min(x, viewport.x + viewport.width - padding - box.width));
  } else {
    x = side === 'left' ? anchor.x - offset - box.width : anchor.x + anchor.width + offset;
    y = align === 'start' ? anchor.y : align === 'end' ? anchor.y + anchor.height - box.height : anchor.y + (anchor.height - box.height) / 2;
    y = Math.max(viewport.y + padding, Math.min(y, viewport.y + viewport.height - padding - box.height));
  }
  return { x, y, placement: (align === 'center' ? side : `${side}-${align}`) as GlassPlacement };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/place.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/core/place.ts packages/meniscus/test/place.test.ts
git commit -m "feat: place anchored boxes beside their anchor, flipping and shifting to stay on screen"
```

### Task 3: Tone math

**Files:**
- Create: `packages/meniscus/src/core/tone.ts`
- Test: `packages/meniscus/test/tone.test.ts`

**Interfaces:**
- Produces:
  - `type Tone = 'light' | 'dark'`
  - `const DARK_BELOW = 0.16` and `const LIGHT_ABOVE = 0.2`
  - `luminance(rgb: readonly number[]): number`, taking 0..1 sRGB channels
  - `composite(tint: readonly number[], backdrop: number): number`, taking rgba in 0..1
  - `pickTone(l: number, previous: Tone | null): Tone`
  - `parseComputedColor(css: string): [number, number, number, number] | null`

- [ ] **Step 1: Write the failing test**

```ts
// packages/meniscus/test/tone.test.ts
import { composite, DARK_BELOW, LIGHT_ABOVE, luminance, parseComputedColor, pickTone } from '../src/core/tone';

it('computes WCAG relative luminance', () => {
  expect(luminance([1, 1, 1])).toBeCloseTo(1, 6);
  expect(luminance([0, 0, 0])).toBe(0);
  expect(luminance([0.5, 0.5, 0.5])).toBeCloseTo(0.214, 3);
  expect(luminance([0, 1, 0])).toBeCloseTo(0.7152, 4);
});

it('composites a translucent color over a backdrop', () => {
  expect(composite([0, 0, 0, 0.5], 1)).toBeCloseTo(0.5, 6);
  expect(composite([1, 1, 1, 0], 0.3)).toBeCloseTo(0.3, 6);
  expect(composite([1, 1, 1], 0)).toBeCloseTo(1, 6);
});

it('picks a tone, keeping the previous one inside the margin', () => {
  expect(pickTone(DARK_BELOW - 0.01, null)).toBe('dark');
  expect(pickTone(LIGHT_ABOVE + 0.01, 'dark')).toBe('light');
  expect(pickTone(0.18, 'dark')).toBe('dark');
  expect(pickTone(0.18, 'light')).toBe('light');
  expect(pickTone(0.18, null)).toBe('light');
});

it('parses computed colors without a canvas', () => {
  expect(parseComputedColor('rgb(18, 52, 86)')).toEqual([18 / 255, 52 / 255, 86 / 255, 1]);
  expect(parseComputedColor('rgba(0, 0, 0, 0)')).toEqual([0, 0, 0, 0]);
  expect(parseComputedColor('rgb(255 128 0 / 50%)')).toEqual([1, 128 / 255, 0, 0.5]);
  expect(parseComputedColor('color(srgb 0.1 0.2 0.3 / 0.4)')).toEqual([0.1, 0.2, 0.3, 0.4]);
  expect(parseComputedColor('canvas')).toBeNull();
  expect(parseComputedColor('rgb(nope)')).toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/tone.test.ts`
Expected: FAIL with "Failed to resolve import ../src/core/tone".

- [ ] **Step 3: Implement**

```ts
// packages/meniscus/src/core/tone.ts
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
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/tone.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/core/tone.ts packages/meniscus/test/tone.test.ts
git commit -m "feat: tone math for glass that adapts to its backdrop"
```

### Task 4: The tinted variant and `glassTint`

**Files:**
- Modify: `packages/meniscus/src/core/glass.ts`
- Modify: `packages/meniscus/src/react/Glass.tsx` (the `tint` line near 347)
- Modify: `packages/meniscus/src/core/index.ts` (add `glassTint`, `ACCENT`, `TINTED_MIX` to the `./glass` exports)
- Test: `packages/meniscus/test/tinted.test.ts`

**Interfaces:**
- Produces:
  - `GlassVariant` becomes `'regular' | 'clear' | 'tinted'`.
  - `GlassAppearance` becomes `'auto' | 'light' | 'dark' | 'adaptive'`.
  - `const ACCENT = 'var(--meniscus-accent, #2563eb)'` and `const TINTED_MIX = 70`.
  - `glassTint(options: GlassOptions): string`: the tint a glass lays over its backdrop.
  - `resolveGlass(...).tint` now equals `glassTint(options)`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/meniscus/test/tinted.test.ts
import { ACCENT, defaultTint, glassTint, resolveGlass, VARIANTS } from '../src/core/glass';

it('mixes a tinted glass’s color at 70%, defaulting to the accent', () => {
  expect(glassTint({ variant: 'tinted', tint: '#e34720' })).toBe('color-mix(in srgb, #e34720 70%, transparent)');
  expect(glassTint({ variant: 'tinted' })).toBe(`color-mix(in srgb, ${ACCENT} 70%, transparent)`);
});

it('lays other tints over as given; adaptive starts out as auto', () => {
  expect(glassTint({ tint: 'rgba(0, 0, 0, 0.2)' })).toBe('rgba(0, 0, 0, 0.2)');
  expect(glassTint({ appearance: 'adaptive' })).toBe(defaultTint('regular', 'auto'));
  expect(glassTint({ appearance: 'dark' })).toBe(VARIANTS.regular.darkTint);
  expect(glassTint({ variant: 'clear', appearance: 'light' })).toBe(VARIANTS.clear.tint);
});

it('resolves tinted glass with its own frost and light', () => {
  const g = resolveGlass({ variant: 'tinted' }, 120, 44);
  expect(g).toMatchObject({ blur: 4, saturation: 1.8, specular: 0.9, rim: 0.8, shade: 0.25 });
  expect(g.tint).toBe(glassTint({ variant: 'tinted' }));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/tinted.test.ts`
Expected: FAIL. `glassTint` and `ACCENT` aren't exported.

- [ ] **Step 3: Implement**

In `packages/meniscus/src/core/glass.ts`:

1. Replace the two type lines at the top:

```ts
/** `regular` frosts and tints for legibility; `clear` stays transparent over media; `tinted` is colored glass for primary actions. */
export type GlassVariant = 'regular' | 'clear' | 'tinted';
/** Light glass, dark glass, the page's color scheme (`auto`), or what is actually behind it (`adaptive`). */
export type GlassAppearance = 'auto' | 'light' | 'dark' | 'adaptive';
```

2. Update the JSDoc of `variant` and `appearance` in `GlassOptions`:

```ts
  /** `regular` frosts and tints for legibility; `clear` stays transparent over media; `tinted` colors the glass with `tint` or `--meniscus-accent`. */
  variant?: GlassVariant;
  /**
   * Light glass (a pale wash) or dark glass (a smoky one). `auto` follows the
   * page's color scheme, including a site's own theme switch, through CSS
   * `light-dark()`. `adaptive` reads what is behind the glass and turns light
   * or dark with it, setting a readable text color. Only sets the default
   * tint; an explicit `tint` wins.
   */
  appearance?: GlassAppearance;
```

3. Just above `VARIANTS`, add:

```ts
/** The color tinted glass takes without a `tint`: set `--meniscus-accent` once for the whole app. */
export const ACCENT = 'var(--meniscus-accent, #2563eb)';
/** How much of its color tinted glass mixes in, percent. */
export const TINTED_MIX = 70;
const tinted = (color: string) => `color-mix(in srgb, ${color} ${TINTED_MIX}%, transparent)`;
```

4. Add the `tinted` entry to `VARIANTS`:

```ts
export const VARIANTS: Readonly<Record<GlassVariant, VariantDefaults>> = {
  regular: { blur: 5, saturation: 1.6, tint: 'rgba(255, 255, 255, 0.12)', darkTint: 'rgba(22, 26, 32, 0.34)', specular: 0.8, rim: 0.7, shade: 0.35 },
  clear: { blur: 0.5, saturation: 1.15, tint: 'rgba(255, 255, 255, 0.03)', darkTint: 'rgba(8, 10, 14, 0.1)', specular: 0.9, rim: 0.8, shade: 0.3 },
  tinted: { blur: 4, saturation: 1.8, tint: tinted(ACCENT), darkTint: tinted(ACCENT), specular: 0.9, rim: 0.8, shade: 0.25 },
};
```

5. Replace `defaultTint`, and add `glassTint` after it:

```ts
/** The default tint of a variant in an appearance. `adaptive` starts as `auto` until the glass has read its backdrop. */
export function defaultTint(variant: GlassVariant | undefined, appearance: GlassAppearance = 'auto'): string {
  const v = VARIANTS[variant ?? 'regular'] ?? VARIANTS.regular;
  if (appearance === 'light' || v.tint === v.darkTint) return v.tint;
  if (appearance === 'dark') return v.darkTint;
  return `light-dark(${v.tint}, ${v.darkTint})`;
}

/**
 * The tint a glass lays over its backdrop. Tinted glass mixes its `tint` (or
 * the accent) in at `TINTED_MIX`%; any other variant lays `tint` over as
 * given, or its appearance's default.
 */
export function glassTint(options: GlassOptions): string {
  if (options.variant === 'tinted') return tinted(options.tint ?? ACCENT);
  return options.tint ?? defaultTint(options.variant, options.appearance);
}
```

6. In `resolveGlass`, replace `tint: options.tint ?? defaultTint(options.variant, options.appearance),` with:

```ts
    tint: glassTint(options),
```

In `packages/meniscus/src/react/Glass.tsx`:
- Add `glassTint` to the import from `'../core/glass'`, and drop `defaultTint` if nothing else in the file uses it (check with `grep -n defaultTint packages/meniscus/src/react/Glass.tsx`).
- Replace `const tint = g?.tint ?? options.tint ?? defaultTint(options.variant, options.appearance);` with:

```ts
  const tint = g?.tint ?? glassTint(options);
```

In `packages/meniscus/src/core/index.ts`, add `glassTint,`, `ACCENT,` and `TINTED_MIX,` to the `./glass` export list.

- [ ] **Step 4: Run the new test and the whole suite**

Run: `cd packages/meniscus && pnpm exec vitest run test/tinted.test.ts && pnpm exec vitest run && pnpm typecheck`
Expected: PASS. Existing tests still pass, since regular and clear tints are unchanged, and typecheck is clean. If a test enumerates `VARIANTS` and expects two entries, update it to three and say so in the commit message.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/core/glass.ts packages/meniscus/src/core/index.ts packages/meniscus/src/react/Glass.tsx packages/meniscus/test/tinted.test.ts
git commit -m "feat: a tinted glass variant colored by tint or --meniscus-accent"
```

### Task 5: The backdrop sampler

**Files:**
- Create: `packages/meniscus/src/react/tone.ts`
- Test: `packages/meniscus/test/sampler.test.tsx`

**Interfaces:**
- Consumes (Task 3): `luminance`, `composite`, `pickTone`, `parseComputedColor` and `Tone` from `../core/tone`. Existing: `resolveTint(el, css)` from `../webgl/color`; `isMediaElement`, `isVideo`, `mediaRect`, `sourceSize` and `Media` from `../webgl/media`; `backdropElement` and `Backdrop` from `./backdrop`.
- Produces:
  - `sampleBackdrop(glass: HTMLElement, backdrop: HTMLElement | null): number | null`: the mean luminance behind the glass, or null.
  - `sampleMedia(media: Media, region: { left: number; top: number; width: number; height: number }): number | 'transparent' | 'unreadable'`
  - `overrideSampler(ctx: CanvasRenderingContext2D | null | undefined): void`, for tests.
  - `interface ToneOptions { enabled: boolean; backdrop: Backdrop | undefined; tint: string | null }`
  - `useBackdropTone(node: HTMLElement | null, options: ToneOptions): Tone | null`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/sampler.test.tsx
// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { luminance } from '../src/core/tone';
import { overrideSampler, sampleBackdrop, useBackdropTone } from '../src/react/tone';

type Box = { left: number; top: number; width: number; height: number };
function put(el: Element, r: Box) {
  el.getBoundingClientRect = () => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r }) as DOMRect;
}

let stack: Element[] = [];
const hit = vi.fn(() => stack);

beforeEach(() => {
  document.elementsFromPoint = hit as unknown as typeof document.elementsFromPoint;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  stack = [];
  hit.mockClear();
  overrideSampler(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function scene(html: string): HTMLElement {
  document.body.innerHTML = html;
  const glass = document.getElementById('glass')!;
  put(glass, { left: 0, top: 0, width: 100, height: 40 });
  return glass;
}

function image(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  for (const [key, value] of [['naturalWidth', width], ['naturalHeight', height], ['offsetWidth', width], ['offsetHeight', height]] as const) {
    Object.defineProperty(img, key, { value });
  }
  put(img, { left: 0, top: 0, width, height });
  return img;
}

function context(fill: number): CanvasRenderingContext2D {
  const data = new Uint8ClampedArray(8 * 8 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = fill;
    data[i + 3] = 255;
  }
  return { clearRect: vi.fn(), drawImage: vi.fn(), getImageData: vi.fn(() => ({ data })) } as unknown as CanvasRenderingContext2D;
}

it('reads the first solid background behind the glass, skipping glass and its content', () => {
  const glass = scene(
    '<section id="dark" style="background-color: rgb(10, 12, 16)"><div id="other" data-meniscus="refract" style="background-color: rgb(255, 255, 255)"></div><div id="glass" data-meniscus="frost"><span id="text">Hi</span></div></section>',
  );
  stack = [document.getElementById('text')!, glass, document.getElementById('other')!, document.getElementById('dark')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, null)).toBeCloseTo(luminance([10 / 255, 12 / 255, 16 / 255]), 6);
  expect(hit).toHaveBeenCalledTimes(5);
});

it('passes over colors under half opacity and falls back to the page canvas', () => {
  const glass = scene('<section id="veil" style="background-color: rgba(0, 0, 0, 0.3)"><div id="glass" data-meniscus="frost"></div></section>');
  stack = [glass, document.getElementById('veil')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, null)).toBe(1);
});

it('returns null when only a gradient or a background image is behind', () => {
  const glass = scene('<section id="hero" style="background-image: linear-gradient(black, navy)"><div id="glass" data-meniscus="frost"></div></section>');
  stack = [glass, document.getElementById('hero')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, null)).toBeNull();
});

it('averages a media backdrop’s pixels under the glass on an 8×8 canvas', () => {
  const glass = scene('<div id="glass" data-meniscus="frost"></div>');
  const img = image(200, 100);
  const ctx = context(64);
  overrideSampler(ctx);
  expect(sampleBackdrop(glass, img)).toBeCloseTo(luminance([64 / 255, 64 / 255, 64 / 255]), 6);
  expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0, 100, 40, 0, 0, 8, 8);
  expect(hit).not.toHaveBeenCalled();
});

it('treats a tainted canvas as unreadable and hit-tests the page instead', () => {
  const glass = scene('<section id="dark" style="background-color: rgb(0, 0, 0)"><div id="glass" data-meniscus="frost"></div></section>');
  overrideSampler({ clearRect() {}, drawImage() {}, getImageData() { throw new DOMException('tainted', 'SecurityError'); } } as unknown as CanvasRenderingContext2D);
  stack = [glass, document.getElementById('dark')!, document.body, document.documentElement];
  expect(sampleBackdrop(glass, image(200, 100))).toBe(0);
});

function Probe({ enabled = true }: { enabled?: boolean }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const tone = useBackdropTone(el, { enabled, backdrop: undefined, tint: null });
  return <div ref={setEl} data-meniscus="frost" data-tone={tone ?? 'none'} />;
}

it('samples on mount, then at most every 100 ms while the page scrolls', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 40, x: 0, y: 0, right: 100, bottom: 40, toJSON() {} } as DOMRect);
  const dark = document.createElement('section');
  dark.style.backgroundColor = 'rgb(0, 0, 0)';
  document.body.appendChild(dark);
  stack = [dark];
  const { container } = render(<Probe />);
  expect(container.querySelector('[data-tone]')!.getAttribute('data-tone')).toBe('dark');
  expect(hit).toHaveBeenCalledTimes(5);
  act(() => {
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(50);
  });
  expect(hit).toHaveBeenCalledTimes(5);
  act(() => vi.advanceTimersByTime(80));
  expect(hit).toHaveBeenCalledTimes(10);
});

it('never samples while disabled', () => {
  const { container } = render(<Probe enabled={false} />);
  expect(hit).not.toHaveBeenCalled();
  expect(container.querySelector('[data-tone]')!.getAttribute('data-tone')).toBe('none');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/sampler.test.tsx`
Expected: FAIL with "Failed to resolve import ../src/react/tone".

- [ ] **Step 3: Implement**

```ts
// packages/meniscus/src/react/tone.ts
import { useRef, useState } from 'react';
import { composite, luminance, parseComputedColor, pickTone, type Tone } from '../core/tone';
import { resolveTint } from '../webgl/color';
import { isMediaElement, isVideo, mediaRect, sourceSize, type Media } from '../webgl/media';
import { backdropElement, type Backdrop } from './backdrop';
import { useIsomorphicLayoutEffect } from './hooks';

/** A region of the viewport, px. */
interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A moving page is sampled at most this often, ms. */
const INTERVAL = 100;
/** A playing video backdrop is sampled this often, ms. */
const VIDEO_INTERVAL = 500;
/** Where under the glass the page is hit-tested, as fractions of its box. */
const POINTS = [
  [0.5, 0.5],
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
] as const;

let sampler: CanvasRenderingContext2D | null | undefined;

function samplerContext(): CanvasRenderingContext2D | null {
  if (sampler !== undefined) return sampler;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (canvas) {
    canvas.width = 8;
    canvas.height = 8;
  }
  // A CPU canvas: reading pixels back from a GPU one would wait for the GPU.
  sampler = (canvas?.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null | undefined) ?? null;
  return sampler;
}

/** For tests: substitute the 8×8 sampling context, or undefined to create one again. */
export function overrideSampler(ctx: CanvasRenderingContext2D | null | undefined): void {
  sampler = ctx;
}

type Sample = number | 'transparent' | 'unreadable';

/**
 * Mean luminance of a media element's pixels under a region of the viewport.
 * `transparent` when nothing is drawn there, `unreadable` when the canvas is
 * tainted (a cross-origin source without CORS) or can't be created.
 */
export function sampleMedia(media: Media, region: Region): Sample {
  const ctx = samplerContext();
  if (!ctx) return 'unreadable';
  const drawn = mediaRect(media);
  const [nw, nh] = sourceSize(media);
  if (!(drawn.width > 0 && drawn.height > 0 && nw > 0 && nh > 0)) return 'transparent';
  const sx = ((region.left - drawn.x) / drawn.width) * nw;
  const sy = ((region.top - drawn.y) / drawn.height) * nh;
  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  const x1 = Math.min(nw, sx + (region.width / drawn.width) * nw);
  const y1 = Math.min(nh, sy + (region.height / drawn.height) * nh);
  if (x1 <= x0 || y1 <= y0) return 'transparent';
  let data: Uint8ClampedArray;
  try {
    ctx.clearRect(0, 0, 8, 8);
    ctx.drawImage(media, x0, y0, x1 - x0, y1 - y0, 0, 0, 8, 8);
    data = ctx.getImageData(0, 0, 8, 8).data;
  } catch {
    return 'unreadable';
  }
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    if (a <= 0) continue;
    sum += luminance([data[i]! / 255, data[i + 1]! / 255, data[i + 2]! / 255]) * a;
    weight += a;
  }
  // Almost nothing drawn (a blank WebGL canvas, say): look further down.
  return weight < 64 * 0.05 ? 'transparent' : sum / weight;
}

/** What lies under one point of the viewport: a luminance, something unreadable, or nothing opaque yet. */
function sampleAt(x: number, y: number, glass: HTMLElement): Sample {
  for (const el of document.elementsFromPoint(x, y)) {
    // The glass, its content, and other glass are translucent: look through them.
    if (glass.contains(el) || el.closest('[data-meniscus]')) continue;
    if (isMediaElement(el)) {
      const s = sampleMedia(el, { left: x - 4, top: y - 4, width: 8, height: 8 });
      if (s === 'transparent') continue;
      return s;
    }
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'unreadable';
    const bg = parseComputedColor(cs.backgroundColor);
    if (bg && bg[3] >= 0.5) return luminance(bg);
  }
  return 'transparent';
}

/** Luminance of the page's canvas color, under its color scheme. */
function canvasLuminance(): number {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;display:none;color:Canvas';
  document.documentElement.appendChild(probe);
  const color = parseComputedColor(getComputedStyle(probe).color);
  probe.remove();
  return color ? luminance(color) : 1;
}

/**
 * Mean luminance of what is behind a glass, or null when nothing there can
 * be read. Media named as its `backdrop` is read first. Otherwise the page is
 * hit-tested at five points under the glass, and each point takes the first
 * media or solid background color below it. Elements with
 * `pointer-events: none` are invisible to hit testing.
 */
export function sampleBackdrop(glass: HTMLElement, backdrop: HTMLElement | null): number | null {
  const r = glass.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return null;
  if (isMediaElement(backdrop)) {
    const s = sampleMedia(backdrop, r);
    if (typeof s === 'number') return s;
  }
  if (typeof document.elementsFromPoint !== 'function') return null;
  let sum = 0;
  let count = 0;
  let page: number | null = null;
  for (const [fx, fy] of POINTS) {
    const s = sampleAt(r.left + r.width * fx, r.top + r.height * fy, glass);
    if (s === 'unreadable') continue;
    sum += s === 'transparent' ? (page ??= canvasLuminance()) : s;
    count++;
  }
  return count ? sum / count : null;
}

export interface ToneOptions {
  /** Sample at all. */
  enabled: boolean;
  /** The glass's `backdrop`: media there is read before the page. */
  backdrop: Backdrop | undefined;
  /** Tinted glass's tint, composited over the backdrop to decide its ink. Null for adaptive glass. */
  tint: string | null;
}

/**
 * The tone behind a glass, light or dark: null until the first sample, and
 * whenever nothing behind can be read. It samples in a layout effect, before
 * the first client paint, then on resize and on any scroll or window resize.
 * That happens at most every 100 ms, and only while the glass is on screen.
 */
export function useBackdropTone(node: HTMLElement | null, { enabled, backdrop, tint }: ToneOptions): Tone | null {
  const [tone, setTone] = useState<Tone | null>(null);
  const toneRef = useRef<Tone | null>(null);
  const backdropRef = useRef(backdrop);
  backdropRef.current = backdrop;

  useIsomorphicLayoutEffect(() => {
    if (!enabled || !node) {
      toneRef.current = null;
      setTone(null);
      return;
    }
    let last = -Infinity;
    let timer = 0;
    let frame = 0;
    let visible = true;
    const run = () => {
      last = performance.now();
      const behind = sampleBackdrop(node, backdropElement(backdropRef.current));
      const next = behind === null ? null : pickTone(tint ? composite(resolveTint(node, tint), behind) : behind, toneRef.current);
      toneRef.current = next;
      setTone(next);
    };
    const schedule = () => {
      if (!visible || timer || frame) return;
      const wait = INTERVAL - (performance.now() - last);
      if (wait > 0) {
        timer = window.setTimeout(() => {
          timer = 0;
          schedule();
        }, wait);
      } else {
        frame = requestAnimationFrame(() => {
          frame = 0;
          run();
        });
      }
    };
    run();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(node);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
            if (visible) schedule();
          })
        : null;
    io?.observe(node);
    // Scroll events don't bubble, but a capturing listener hears every scroller on the page.
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const media = backdropElement(backdropRef.current);
    const video: HTMLVideoElement | null = isVideo(media) ? media : null;
    const poll = video
      ? window.setInterval(() => {
          if (!video.paused && !video.ended) schedule();
        }, VIDEO_INTERVAL)
      : 0;
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      clearInterval(poll);
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
  }, [node, enabled, tint]);

  return tone;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/sampler.test.tsx && pnpm typecheck`
Expected: PASS, 7 tests, and typecheck is clean.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/tone.ts packages/meniscus/test/sampler.test.tsx
git commit -m "feat: sample what is behind a glass for its tone"
```

### Task 6: Adaptive and tinted tone in `Glass`

**Files:**
- Modify: `packages/meniscus/src/react/Glass.tsx`
- Modify: `packages/meniscus/src/webgl/GlassStage.tsx` (the pane's `register` call)
- Test: `packages/meniscus/test/adaptive.test.tsx`, `packages/meniscus/test/tinted-tone.test.tsx`

**Interfaces:**
- Consumes: `useBackdropTone` (Task 5), `glassTint` (Task 4).
- Produces:
  - Glass elements with `appearance="adaptive"` or `variant="tinted"` carry `data-meniscus-tone="light" | "dark"` once sampled.
  - Their inline `color` becomes `var(--meniscus-ink-on-light, #15181d)` or `var(--meniscus-ink-on-dark, #f7f8fa)`, and the app's `style.color` wins.
  - Adaptive glass's tint is the variant's light or dark tint.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/meniscus/test/adaptive.test.tsx
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { Glass, GlassProvider } from '../src';
import { VARIANTS } from '../src/core/glass';

let stack: Element[] = [];

function behind(css: string) {
  const section = document.createElement('section');
  section.style.cssText = css;
  document.body.appendChild(section);
  stack = [section];
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.elementsFromPoint = (() => stack) as unknown as typeof document.elementsFromPoint;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 200, height: 48, x: 0, y: 0, right: 200, bottom: 48, toJSON() {} } as DOMRect);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 200 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 48 });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  stack = [];
  vi.restoreAllMocks();
});

it('turns dark over dark content, with light ink and the dark tint', () => {
  behind('background-color: rgb(8, 10, 14)');
  const { container } = render(<Glass appearance="adaptive">Menu</Glass>);
  const glass = container.firstElementChild as HTMLElement;
  expect(glass.getAttribute('data-meniscus-tone')).toBe('dark');
  expect(glass.style.color).toContain('--meniscus-ink-on-dark');
  expect(glass.style.backgroundColor).toBe(VARIANTS.regular.darkTint.replace(/\s+/g, ' '));
});

it('turns light over light content', () => {
  behind('background-color: rgb(250, 250, 248)');
  const { container } = render(<Glass appearance="adaptive">Menu</Glass>);
  expect(container.firstElementChild!.getAttribute('data-meniscus-tone')).toBe('light');
});

it('stays as auto, setting no ink, when nothing behind can be read', () => {
  behind('background-image: linear-gradient(black, navy)');
  const { container } = render(<Glass appearance="adaptive">Menu</Glass>);
  const glass = container.firstElementChild as HTMLElement;
  expect(glass.hasAttribute('data-meniscus-tone')).toBe(false);
  expect(glass.style.color).toBe('');
});

it("keeps the app's own color", () => {
  behind('background-color: rgb(8, 10, 14)');
  const { container } = render(<Glass appearance="adaptive" style={{ color: 'red' }}>Menu</Glass>);
  expect((container.firstElementChild as HTMLElement).style.color).toBe('red');
});

it('takes adaptive from a provider, and never samples glass that is not toned', () => {
  behind('background-color: rgb(8, 10, 14)');
  const spy = vi.fn(() => stack);
  document.elementsFromPoint = spy as unknown as typeof document.elementsFromPoint;
  const { container, rerender } = render(<GlassProvider appearance="adaptive"><Glass>Menu</Glass></GlassProvider>);
  expect(container.querySelector('[data-meniscus-tone="dark"]')).not.toBeNull();
  spy.mockClear();
  rerender(<Glass>Plain</Glass>);
  expect(spy).not.toHaveBeenCalled();
});
```

```tsx
// packages/meniscus/test/tinted-tone.test.tsx
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { Glass } from '../src';

// A tinted blue at 70%: dark on its own, lifted by a white page behind it.
vi.mock('../src/webgl/color', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/webgl/color')>()),
  resolveTint: () => [0.145, 0.388, 0.922, 0.7],
}));

let stack: Element[] = [];

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.elementsFromPoint = (() => stack) as unknown as typeof document.elementsFromPoint;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 120, height: 44, x: 0, y: 0, right: 120, bottom: 44, toJSON() {} } as DOMRect);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function behind(color: string) {
  const section = document.createElement('section');
  section.style.backgroundColor = color;
  document.body.appendChild(section);
  stack = [section];
}

it('takes its ink from its color over what is behind it', () => {
  behind('rgb(0, 0, 0)');
  const { container, unmount } = render(<Glass variant="tinted">Order</Glass>);
  expect(container.firstElementChild!.getAttribute('data-meniscus-tone')).toBe('dark');
  unmount();
  behind('rgb(255, 255, 255)');
  const light = render(<Glass variant="tinted">Order</Glass>);
  expect(light.container.firstElementChild!.getAttribute('data-meniscus-tone')).toBe('light');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/adaptive.test.tsx test/tinted-tone.test.tsx`
Expected: FAIL. `data-meniscus-tone` is missing (null instead of 'dark').

- [ ] **Step 3: Implement**

In `packages/meniscus/src/react/Glass.tsx`:

1. Add the import: `import { useBackdropTone } from './tone';`

2. Next to `EDGE`, add:

```ts
/** Ink on adaptive and tinted glass, by tone. Apps restyle both through the custom properties. */
const INK_ON_LIGHT = 'var(--meniscus-ink-on-light, #15181d)';
const INK_ON_DARK = 'var(--meniscus-ink-on-dark, #f7f8fa)';
```

3. Directly after `const bare = mode === 'none';`, add:

```ts
  // Adaptive and tinted glass read what's behind them: adaptive for its tint, both for their ink.
  const toned = options.appearance === 'adaptive' || options.variant === 'tinted';
  const tone = useBackdropTone(node, {
    enabled: toned && !group && !childless && !reducedTransparency,
    backdrop: childless ? undefined : backdrop,
    tint: options.variant === 'tinted' ? glassTint(options) : null,
  });
  if (options.appearance === 'adaptive') options.appearance = tone ?? 'auto';
```

4. In `rootStyle`, directly before `...style,`, add:

```ts
    ...(tone ? { color: tone === 'dark' ? INK_ON_DARK : INK_ON_LIGHT } : null),
```

5. After the `useOptics(node, optics, tiles);` line, add the tone fade:

```ts
  // A change of tone fades tint and ink over 240 ms. The Web Animations API
  // leaves the app's own `transition` alone.
  const painted = useRef<{ background: string; color: string } | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!node || !toned) {
      painted.current = null;
      return;
    }
    const cs = getComputedStyle(node);
    const now = { background: cs.backgroundColor, color: cs.color };
    const before = painted.current;
    painted.current = now;
    if (!before || reducedMotion || typeof node.animate !== 'function') return;
    if (before.background === now.background && before.color === now.color) return;
    node.animate(
      [
        { backgroundColor: before.background, color: before.color },
        { backgroundColor: now.background, color: now.color },
      ],
      { duration: 240, easing: 'ease' },
    );
  }, [node, toned, tone]);
```

6. Change `elementProps` to carry the tone:

```ts
  const elementProps = { ...rest, ...events, ref: setRef, style: rootStyle, 'data-meniscus': path, 'data-meniscus-tone': tone ?? undefined };
```

In `packages/meniscus/src/webgl/GlassStage.tsx`, replace the pane's register effect in `GlassPaneImpl`:

```ts
  useIsomorphicLayoutEffect(() => {
    if (!register || !el) return;
    // An adaptive pane draws with the tone its glass has read, which the element carries.
    return register(el, () => {
      const o = optionsRef.current;
      if (o.appearance !== 'adaptive') return o;
      const tone = el.getAttribute('data-meniscus-tone');
      return { ...o, appearance: tone === 'light' || tone === 'dark' ? tone : 'auto' };
    });
  }, [register, el]);
```

- [ ] **Step 4: Run them to see them pass, then the whole suite**

Run: `cd packages/meniscus && pnpm exec vitest run test/adaptive.test.tsx test/tinted-tone.test.tsx && pnpm exec vitest run && pnpm typecheck`
Expected: PASS. The first assertion on `backgroundColor` compares against the dark tint jsdom normalizes, so if jsdom rewrites `rgba(22, 26, 32, 0.34)` in another form, compare with `toContain('0.34')` instead and note it in the commit message. The whole suite stays green.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/Glass.tsx packages/meniscus/src/webgl/GlassStage.tsx packages/meniscus/test/adaptive.test.tsx packages/meniscus/test/tinted-tone.test.tsx
git commit -m "feat: adaptive glass follows what is behind it, and tinted glass keeps its text readable"
```

### Task 7: Glass in the top layer isn't confined by its parents

**Files:**
- Modify: `packages/meniscus/src/react/Glass.tsx` (`backdropRoot`)
- Test: `packages/meniscus/test/top-layer-glass.test.tsx` (its own file, so the once-per-page warning flag is fresh)

**Interfaces:**
- Produces: `backdropRoot()` returns null for glass that is in, or inside, a top-layer element (`:modal`, `:popover-open`).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/top-layer-glass.test.tsx
// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { Glass } from '../src';
import { overrideRefractionSupport } from '../src/core';

beforeEach(() => {
  overrideRefractionSupport(true);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 240 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 56 });
});

afterEach(() => {
  cleanup();
  overrideRefractionSupport(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('stays quiet about a faded parent outside the top layer', () => {
  vi.useFakeTimers();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // jsdom has no top layer: report the dialog as modal, as browsers do while it is open.
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
    if (selector.includes(':modal')) return this.tagName === 'DIALOG';
    return matches.call(this, selector);
  });
  render(
    <div style={{ opacity: 0.5 }}>
      <dialog open>
        <Glass>Inside</Glass>
      </dialog>
    </div>,
  );
  act(() => vi.advanceTimersByTime(1000));
  expect(warn).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/top-layer-glass.test.tsx`
Expected: FAIL. `console.warn` was called once with "… confines this glass's backdrop filter …".

- [ ] **Step 3: Implement**

In `packages/meniscus/src/react/Glass.tsx`, add above `backdropRoot`:

```ts
/** An open modal dialog or a shown popover: the top layer, where no ancestor confines a backdrop. */
function inTopLayer(el: Element): boolean {
  try {
    return el.matches(':modal, :popover-open');
  } catch {
    // Engines without these pseudo-classes have no top layer to be in.
    return false;
  }
}
```

In `backdropRoot`, return early for top-layer glass and stop the walk at a top-layer ancestor:

```ts
function backdropRoot(node: HTMLElement): string | null {
  const set = (value: string | undefined, rest: string) => !!value && value !== rest;
  if (inTopLayer(node)) return null;
  for (let el = node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
    if (inTopLayer(el)) return null;
    const s = getComputedStyle(el);
    // …the rest of the loop is unchanged
```

- [ ] **Step 4: Run it and the existing warning test**

Run: `cd packages/meniscus && pnpm exec vitest run test/top-layer-glass.test.tsx test/path.test.tsx`
Expected: PASS. The existing "warns once about a faded parent" test still passes.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/Glass.tsx packages/meniscus/test/top-layer-glass.test.tsx
git commit -m "fix: don't warn about confining parents for glass in the top layer"
```

---

## Phase 2: Overlay foundations

### Task 8: `useOverlay`, the open-state hook and the test stand-ins

**Files:**
- Create: `packages/meniscus/test/setup/top-layer.ts`
- Modify: `packages/meniscus/vitest.config.ts`
- Create: `packages/meniscus/src/react/focus.ts`
- Create: `packages/meniscus/src/react/overlay.ts`
- Modify: `packages/meniscus/src/react/GlassFields.tsx` (use `focusVisible` from `./focus`)
- Test: `packages/meniscus/test/overlay.test.tsx`

**Interfaces:**
- Consumes: `useGlassPhysics` (existing, `./useGlassPhysics`), `presenceOpacity` and `OpticalState` from `../core/physics`, `supportsPopover` (Task 1), `useGlassPreferences` and `useIsomorphicLayoutEffect` from `./hooks`.
- Produces:
  - `focusVisible(el: Element): boolean` and `firstFocusable(root: HTMLElement): HTMLElement | null` (in `./focus`).
  - `useOpenState(open: boolean | undefined, defaultOpen: boolean | undefined, onOpenChange: ((open: boolean) => void) | undefined): [boolean, (next: boolean) => void]`
  - `usePopoverSupport(): boolean`: the server and hydration assume support.
  - `FADE: SpringInput`: the short, critically damped spring used under reduced motion.
  - `fallbackStyle(supported: boolean, shown: boolean): CSSProperties | null`: without the Popover API, `display: none` while hidden and `z-index: 2147483000` while shown (spec §2.4).

Under reduced motion, the spec's §2.2 snaps the springs and covers the snap with a 160 ms opacity fade. `useOverlay` runs presence on `FADE` instead, a critically damped spring that settles in about 150 ms. That gives the same short fade with no second animation to keep in step. Components add no slide or swell while `reducedMotion` is true.
  - `type OverlayKind = 'modal' | 'popover'`
  - `interface OverlayOptions { open: boolean; onRequestClose: () => void; kind: OverlayKind; physics?: SpringInput; dismiss?: { escape?: boolean; outside?: boolean; focusOut?: boolean }; trigger?: HTMLElement | null; inside?: () => ReadonlyArray<HTMLElement | null> }`
  - `interface Overlay { optics: GlassPhysics; shown: boolean; reducedMotion: boolean }`
  - `useOverlay(element: HTMLElement | null, options: OverlayOptions): Overlay`

- [ ] **Step 1: Add the test stand-ins and register them**

```ts
// packages/meniscus/test/setup/top-layer.ts
/**
 * jsdom 30 has no dialog methods, no Popover API and no anchor positioning.
 * These stand-ins keep the state browsers keep (the open attribute, the close
 * event, the return value), without a top layer, focus moves or light dismiss.
 */
import { overrideAnchorPositioning } from '../../src/core/support';

if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        if (this.open) throw new DOMException('The dialog is already open.', 'InvalidStateError');
        this.setAttribute('open', '');
      },
    },
    show: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement, result?: string) {
        if (!this.open) return;
        if (result !== undefined) this.returnValue = result;
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    },
  });
  if (!('returnValue' in HTMLDialogElement.prototype)) {
    Object.defineProperty(HTMLDialogElement.prototype, 'returnValue', { configurable: true, writable: true, value: '' });
  }
}

if (typeof HTMLElement !== 'undefined' && typeof (HTMLElement.prototype as { showPopover?: unknown }).showPopover !== 'function') {
  Object.defineProperties(HTMLElement.prototype, {
    showPopover: {
      configurable: true,
      value(this: HTMLElement) {
        this.setAttribute('data-test-popover-open', '');
      },
    },
    hidePopover: {
      configurable: true,
      value(this: HTMLElement) {
        this.removeAttribute('data-test-popover-open');
      },
    },
  });
}

// jsdom's CSS.supports says yes to everything. Tests opt in to the CSS path themselves.
overrideAnchorPositioning(false);
```

Change `packages/meniscus/vitest.config.ts` to:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: ['test/setup/top-layer.ts'],
  },
});
```

Run: `cd packages/meniscus && pnpm exec vitest run`
Expected: every existing test still passes with the setup file in place.

- [ ] **Step 2: Write the failing test**

```tsx
// packages/meniscus/test/overlay.test.tsx
// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Glass } from '../src';
import { useOpenState, useOverlay, type OverlayKind } from '../src/react/overlay';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

const frames = (n: number) => act(() => { for (let i = 0; i < n; i++) vi.advanceTimersByTime(16); });

function Harness({ open, kind = 'modal', onRequestClose = () => {}, trigger = null }: { open: boolean; kind?: OverlayKind; onRequestClose?: () => void; trigger?: HTMLElement | null }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const overlay = useOverlay(el, { open, onRequestClose, kind, trigger, dismiss: { escape: true, outside: kind === 'popover' } });
  const body = <Glass optics={overlay.optics} data-testid="glass"><button type="button">Inside</button></Glass>;
  return kind === 'modal' ? <dialog ref={setEl} data-shown={overlay.shown}>{body}</dialog> : <div ref={setEl} popover="manual" data-shown={overlay.shown}>{body}</div>;
}

const glassOpacity = () => Number(document.querySelector<HTMLElement>('[data-testid="glass"]')!.style.getPropertyValue('--meniscus-opacity'));

it('shows the dialog, then springs the glass in', () => {
  const { container, rerender } = render(<Harness open={false} />);
  const dialog = container.querySelector('dialog')!;
  expect(dialog.open).toBe(false);
  rerender(<Harness open />);
  expect(dialog.open).toBe(true);
  frames(60);
  expect(glassOpacity()).toBeCloseTo(1, 2);
});

it('keeps the dialog open until the glass has faded out, then hides it', () => {
  const { container, rerender } = render(<Harness open />);
  frames(60);
  const dialog = container.querySelector('dialog')!;
  rerender(<Harness open={false} />);
  let hidden = false;
  for (let i = 0; i < 120 && !hidden; i++) {
    frames(1);
    if (glassOpacity() > 0) expect(dialog.open).toBe(true);
    hidden = !dialog.open;
  }
  expect(hidden).toBe(true);
  expect(dialog.getAttribute('data-shown')).toBe('false');
});

it('turns around when reopened mid-exit, without hiding', () => {
  const { container, rerender } = render(<Harness open />);
  frames(60);
  rerender(<Harness open={false} />);
  frames(2);
  rerender(<Harness open />);
  const dialog = container.querySelector('dialog')!;
  for (let i = 0; i < 60; i++) {
    frames(1);
    expect(dialog.open).toBe(true);
  }
  expect(glassOpacity()).toBeCloseTo(1, 2);
});

it('turns a modal’s Escape into a close request', () => {
  const onRequestClose = vi.fn();
  const { container } = render(<Harness open onRequestClose={onRequestClose} />);
  const cancel = new Event('cancel', { cancelable: true });
  container.querySelector('dialog')!.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(onRequestClose).toHaveBeenCalledOnce();
});

it('closes a popover on Escape or an outside press', () => {
  const onRequestClose = vi.fn();
  render(<Harness open kind="popover" onRequestClose={onRequestClose} />);
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.body.dispatchEvent(escape);
  expect(escape.defaultPrevented).toBe(true);
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(onRequestClose).toHaveBeenCalledTimes(2);
});

it('gives Escape to the innermost popover only', () => {
  const outer = vi.fn();
  const inner = vi.fn();
  render(
    <>
      <Harness open kind="popover" onRequestClose={outer} />
      <Harness open kind="popover" onRequestClose={inner} />
    </>,
  );
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(inner).toHaveBeenCalledOnce();
  expect(outer).not.toHaveBeenCalled();
});

it('returns focus to the trigger when the overlay had it', () => {
  function WithTrigger({ open }: { open: boolean }) {
    const trigger = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button type="button" ref={trigger}>Open</button>
        <Harness open={open} trigger={trigger.current} />
      </>
    );
  }
  const { getByText, rerender } = render(<WithTrigger open={false} />);
  rerender(<WithTrigger open />);
  frames(30);
  getByText('Inside').focus();
  rerender(<WithTrigger open={false} />);
  frames(120);
  expect(document.activeElement).toBe(getByText('Open'));
});

it('locks page scroll while a modal shows, and releases it on close and on unmount', () => {
  const root = document.documentElement;
  const { rerender, unmount } = render(<Harness open />);
  expect(root.style.overflow).toBe('hidden');
  rerender(<Harness open={false} />);
  frames(120);
  expect(root.style.overflow).toBe('');
  rerender(<Harness open />);
  expect(root.style.overflow).toBe('hidden');
  unmount();
  expect(root.style.overflow).toBe('');
});

it('keeps controlled state with the parent and uncontrolled state inside', () => {
  const seen: boolean[] = [];
  function Probe({ open }: { open?: boolean }) {
    const [value, set] = useOpenState(open, true, (next) => seen.push(next));
    return <button type="button" onClick={() => set(!value)}>{String(value)}</button>;
  }
  const { getByRole, rerender } = render(<Probe />);
  act(() => getByRole('button').click());
  expect(getByRole('button').textContent).toBe('false');
  rerender(<Probe open />);
  act(() => getByRole('button').click());
  expect(getByRole('button').textContent).toBe('true');
  expect(seen).toEqual([false, false]);
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/overlay.test.tsx`
Expected: FAIL with "Failed to resolve import ../src/react/overlay".

- [ ] **Step 4: Implement the focus helpers**

```ts
// packages/meniscus/src/react/focus.ts
/** Whether focus on `el` came from the keyboard, as `:focus-visible` tells. Engines without it count every focus. */
export function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable=""], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/** Where focus should land inside `root`: an `autofocus` element, else the first focusable one. */
export function firstFocusable(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[autofocus]') ?? root.querySelector<HTMLElement>(FOCUSABLE);
}
```

In `packages/meniscus/src/react/GlassFields.tsx`, delete the local `visible` function, add `import { focusVisible } from './focus';`, and replace the calls to `visible(` with `focusVisible(`. Check with `grep -n "visible(" packages/meniscus/src/react/GlassFields.tsx`.

- [ ] **Step 5: Implement `useOverlay`**

```ts
// packages/meniscus/src/react/overlay.ts
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { presenceOpacity, type GlassPhysics, type OpticalState } from '../core/physics';
import type { SpringInput } from '../core/spring';
import { supportsPopover } from '../core/support';
import { useGlassPreferences, useIsomorphicLayoutEffect } from './hooks';
import { useGlassPhysics } from './useGlassPhysics';

/** A short, critically damped spring. Under reduced motion, overlays and toasts fade on it without moving. */
export const FADE: SpringInput = { mass: 1, stiffness: 900, damping: 60 };

/** Controlled or uncontrolled open state, from `open`, `defaultOpen` and `onOpenChange`. */
export function useOpenState(
  open: boolean | undefined,
  defaultOpen: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
): [boolean, (next: boolean) => void] {
  const [own, setOwn] = useState(!!defaultOpen);
  const controlled = open !== undefined;
  const change = useRef(onOpenChange);
  change.current = onOpenChange;
  const set = useCallback(
    (next: boolean) => {
      if (!controlled) setOwn(next);
      change.current?.(next);
    },
    [controlled],
  );
  return [controlled ? !!open : own, set];
}

const noSubscribe = () => () => {};

/** Popover API support, for rendering. The server and hydration assume it, so markup matches; older browsers learn otherwise after. */
export function usePopoverSupport(): boolean {
  return useSyncExternalStore(noSubscribe, supportsPopover, () => true);
}

/** Without the Popover API an overlay stays where it is in the page: hidden until shown, then fixed above everything. */
export function fallbackStyle(supported: boolean, shown: boolean): CSSProperties | null {
  if (supported) return null;
  return shown ? { zIndex: 2147483000 } : { display: 'none' };
}

export type OverlayKind = 'modal' | 'popover';

const shownPopovers = new WeakSet<HTMLElement>();

function isShown(el: HTMLElement, kind: OverlayKind): boolean {
  return kind === 'modal' ? (el as HTMLDialogElement).open : shownPopovers.has(el);
}

function show(el: HTMLElement, kind: OverlayKind): void {
  if (kind === 'modal') {
    (el as HTMLDialogElement).showModal();
    return;
  }
  shownPopovers.add(el);
  if (supportsPopover()) el.showPopover();
}

function hide(el: HTMLElement, kind: OverlayKind): void {
  if (kind === 'modal') {
    (el as HTMLDialogElement).close();
    return;
  }
  shownPopovers.delete(el);
  if (!supportsPopover()) return;
  try {
    el.hidePopover();
  } catch {
    // Already hidden, or no longer in the document.
  }
}

let locks = 0;
let saved: { overflow: string; gutter: string } | null = null;

/** Stops the page scrolling behind a modal. Counted, so nested modals unlock once. */
function lockScroll(): () => void {
  const root = document.documentElement;
  if (locks++ === 0) {
    saved = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter };
    // Keep the scrollbar's room, so the page doesn't shift sideways.
    if (root.scrollHeight > root.clientHeight) root.style.scrollbarGutter = 'stable';
    root.style.overflow = 'hidden';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0 && saved) {
      root.style.overflow = saved.overflow;
      root.style.scrollbarGutter = saved.gutter;
      saved = null;
    }
  };
}

// Escape goes to the innermost open popover: the one opened last.
const escapeStack: Array<() => void> = [];

function onEscape(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return;
  // Canceling the keydown also keeps an enclosing dialog from closing.
  e.preventDefault();
  e.stopPropagation();
  top();
}

function pushEscape(handler: () => void): () => void {
  if (escapeStack.length === 0) document.addEventListener('keydown', onEscape, true);
  escapeStack.push(handler);
  return () => {
    const i = escapeStack.lastIndexOf(handler);
    if (i >= 0) escapeStack.splice(i, 1);
    if (escapeStack.length === 0) document.removeEventListener('keydown', onEscape, true);
  };
}

export interface OverlayOptions {
  /** Whether the overlay should be open. */
  open: boolean;
  /** Asks to close, after Escape, an outside press or focus leaving. The owner decides. */
  onRequestClose: () => void;
  /** `modal` opens a `<dialog>` with `showModal()`; `popover` shows a `popover="manual"` element. */
  kind: OverlayKind;
  /** The spring for the entrance and exit. Default `'snappy'`. */
  physics?: SpringInput;
  /** What else closes it. A modal's Escape arrives as the dialog's `cancel` event and is always handled. */
  dismiss?: { escape?: boolean; outside?: boolean; focusOut?: boolean };
  /** Where focus returns on close, when it was inside. Defaults to whatever had focus when it opened. */
  trigger?: HTMLElement | null;
  /** Elements that count as inside for outside presses and focus, besides the overlay itself. */
  inside?: () => ReadonlyArray<HTMLElement | null>;
}

export interface Overlay {
  /** Springs for the overlay's glass, as its `optics`. */
  optics: GlassPhysics;
  /** Whether the element is showing: from show until the exit has faded out. */
  shown: boolean;
  /** Reduced motion is on: fade, don't slide or swell. */
  reducedMotion: boolean;
}

/**
 * Presence and dismissal for a top-layer overlay. Opening shows the element,
 * then springs presence and lift from 0 to 1. Closing springs them back, then
 * hides the element as soon as the glass is invisible (presence 0.15),
 * without waiting for the spring's tail. Reopening mid-exit turns the spring
 * around. A modal locks page scroll while it shows.
 */
export function useOverlay(element: HTMLElement | null, options: OverlayOptions): Overlay {
  const { reducedMotion } = useGlassPreferences();
  const optics = useGlassPhysics({ physics: reducedMotion ? FADE : (options.physics ?? 'snappy'), initial: { presence: 0, shadow: 0 }, reducedMotion: false });
  const [shown, setShown] = useState(false);
  const latest = useRef(options);
  latest.current = options;
  const opener = useRef<HTMLElement | null>(null);
  const { open, kind } = options;

  useIsomorphicLayoutEffect(() => {
    if (!element) return;
    if (open) {
      if (!isShown(element, kind)) {
        opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        show(element, kind);
        setShown(true);
      }
      optics.to({ presence: 1, shadow: 1 });
      return;
    }
    if (!isShown(element, kind)) return;
    optics.to({ presence: 0, shadow: 0 });
    let done = false;
    const finish = (s: OpticalState) => {
      if (done || presenceOpacity(Math.max(0, s.presence)) > 0) return;
      done = true;
      const hadFocus = element.contains(document.activeElement);
      hide(element, kind);
      setShown(false);
      if (hadFocus || document.activeElement === document.body) (latest.current.trigger ?? opener.current)?.focus({ preventScroll: true });
    };
    const off = optics.subscribe(finish);
    return () => {
      done = true;
      off();
    };
  }, [element, open, kind, optics]);

  // Unmounting while shown: hide it, so no popover lingers in the top layer.
  useEffect(
    () => () => {
      if (element && isShown(element, kind)) hide(element, kind);
    },
    [element, kind],
  );

  // A modal's Escape, and a modal the browser closed by itself (its close watcher, or a stray close()).
  useEffect(() => {
    if (!element || kind !== 'modal') return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      latest.current.onRequestClose();
    };
    const onClose = () => {
      if (!latest.current.open) return;
      setShown(false);
      optics.to({ presence: 0, shadow: 0 });
      if (document.activeElement === document.body || element.contains(document.activeElement)) {
        (latest.current.trigger ?? opener.current)?.focus({ preventScroll: true });
      }
      latest.current.onRequestClose();
    };
    element.addEventListener('cancel', onCancel);
    element.addEventListener('close', onClose);
    return () => {
      element.removeEventListener('cancel', onCancel);
      element.removeEventListener('close', onClose);
    };
  }, [element, kind, optics]);

  useEffect(() => {
    if (kind !== 'modal' || !shown) return;
    return lockScroll();
  }, [kind, shown]);

  useEffect(() => {
    if (!element || !shown || !open) return;
    const dismiss = latest.current.dismiss ?? {};
    const inside = (target: EventTarget | null) =>
      target instanceof Node && (element.contains(target) || (latest.current.inside?.() ?? []).some((el) => !!el && el.contains(target)));
    const onPointer = (e: Event) => {
      if (!inside(e.target)) latest.current.onRequestClose();
    };
    const onFocus = (e: FocusEvent) => {
      if (!inside(e.target)) latest.current.onRequestClose();
    };
    const popEscape = kind === 'popover' && dismiss.escape ? pushEscape(() => latest.current.onRequestClose()) : null;
    if (dismiss.outside) document.addEventListener('pointerdown', onPointer, true);
    if (dismiss.focusOut) document.addEventListener('focusin', onFocus, true);
    return () => {
      popEscape?.();
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('focusin', onFocus, true);
    };
  }, [element, shown, open, kind]);

  return { optics, shown, reducedMotion };
}
```

- [ ] **Step 6: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/overlay.test.tsx test/components.test.tsx && pnpm typecheck`
Expected: PASS, 9 overlay tests, and the field tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/meniscus/test/setup/top-layer.ts packages/meniscus/vitest.config.ts packages/meniscus/src/react/focus.ts packages/meniscus/src/react/overlay.ts packages/meniscus/src/react/GlassFields.tsx packages/meniscus/test/overlay.test.tsx
git commit -m "feat: top-layer overlays that spring in, fade out before hiding, and close on Escape"
```

### Task 9: `useAnchor`

**Files:**
- Create: `packages/meniscus/src/react/anchor.ts`
- Test: `packages/meniscus/test/anchor.test.tsx`

**Interfaces:**
- Consumes: `place`, `placementSide`, `POSITION_AREA` and `GlassPlacement` (Task 2); `supportsAnchorPositioning` and `overrideAnchorPositioning` (Task 1).
- Produces:
  - `interface AnchorOptions { placement: GlassPlacement; offset: number }`
  - `useAnchor(anchor: HTMLElement | null, box: HTMLElement | null, active: boolean, options: AnchorOptions): CSSProperties`. The JS path writes `left`, `top` and `data-placement` on `box` directly.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/anchor.test.tsx
// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { overrideAnchorPositioning } from '../src/core';
import { useAnchor } from '../src/react/anchor';

function rect(r: { left: number; top: number; width: number; height: number }) {
  return () => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r }) as DOMRect;
}

afterEach(() => {
  cleanup();
  overrideAnchorPositioning(false);
  vi.useRealTimers();
});

function Harness({ active }: { active: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<HTMLElement | null>(null);
  const style = useAnchor(anchor, box, active, { placement: 'bottom', offset: 8 });
  // Stable callback refs: an inline one that sets state would run, and re-render, on every render.
  const anchorRef = useCallback((el: HTMLButtonElement | null) => {
    if (el) el.getBoundingClientRect = rect({ left: 100, top: 50, width: 80, height: 30 });
    setAnchor(el);
  }, []);
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 120 });
      Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 60 });
    }
    setBox(el);
  }, []);
  return (
    <>
      <button ref={anchorRef}>Open</button>
      <div ref={boxRef} data-testid="box" style={style} />
    </>
  );
}

it('places the box with place() while active, and again on scroll', () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  const { getByTestId, getByText, rerender } = render(<Harness active={false} />);
  rerender(<Harness active />);
  const box = getByTestId('box');
  expect(box.style.position).toBe('fixed');
  expect(box.style.left).toBe('80px');
  expect(box.style.top).toBe('88px');
  expect(box.getAttribute('data-placement')).toBe('bottom');
  getByText('Open').getBoundingClientRect = rect({ left: 100, top: 20, width: 80, height: 30 });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(16);
  });
  expect(box.style.top).toBe('58px');
});

it('hands positioning to CSS where anchor positioning exists', () => {
  overrideAnchorPositioning(true);
  const anchor = document.createElement('button');
  const { result } = renderHook(() => useAnchor(anchor, null, true, { placement: 'bottom-start', offset: 6 }));
  const style = result.current as Record<string, unknown>;
  expect(style.positionArea).toBe('bottom span-right');
  expect(style.positionTryFallbacks).toBe('flip-block, flip-inline');
  expect(style.marginTop).toBe(6);
  expect(String(style.positionAnchor)).toMatch(/^--meniscus-anchor-/);
  expect(anchor.style.getPropertyValue('anchor-name')).toBe(style.positionAnchor);
});
```

With the anchor at x 100, width 80 and a box 120 wide, the centered x is `100 + (80 − 120)/2 = 80`, and y is `50 + 30 + 8 = 88`.

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/anchor.test.tsx`
Expected: FAIL with "Failed to resolve import ../src/react/anchor".

- [ ] **Step 3: Implement**

```ts
// packages/meniscus/src/react/anchor.ts
import { useId, useSyncExternalStore, type CSSProperties } from 'react';
import { place, placementSide, POSITION_AREA, type GlassPlacement } from '../core/place';
import { supportsAnchorPositioning } from '../core/support';
import { useIsomorphicLayoutEffect } from './hooks';

const noSubscribe = () => () => {};

/** The margin on the side facing the anchor: CSS flips it with the box. */
const FACING = { top: 'marginBottom', bottom: 'marginTop', left: 'marginRight', right: 'marginLeft' } as const;

export interface AnchorOptions {
  /** Which side of the anchor, and how aligned. */
  placement: GlassPlacement;
  /** Gap between the anchor and the box, px. */
  offset: number;
}

/**
 * Keeps `box` beside `anchor` while `active`. With CSS anchor positioning the
 * browser does it, and flips the box at the viewport's edge. Elsewhere
 * `place()` runs when it opens, then on scroll and resize, at most once a
 * frame, writing `left`, `top` and `data-placement` to the box. Returns the
 * box's style.
 */
export function useAnchor(anchor: HTMLElement | null, box: HTMLElement | null, active: boolean, { placement, offset }: AnchorOptions): CSSProperties {
  const css = useSyncExternalStore(noSubscribe, supportsAnchorPositioning, () => false);
  const name = `--meniscus-anchor-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useIsomorphicLayoutEffect(() => {
    if (!css || !anchor) return;
    anchor.style.setProperty('anchor-name', name);
    return () => anchor.style.removeProperty('anchor-name');
  }, [css, anchor, name]);

  useIsomorphicLayoutEffect(() => {
    if (css || !active || !anchor || !box) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const a = anchor.getBoundingClientRect();
      const p = place(
        { x: a.left, y: a.top, width: a.width, height: a.height },
        { width: box.offsetWidth, height: box.offsetHeight },
        placement,
        { offset, viewport: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight } },
      );
      box.style.left = `${p.x}px`;
      box.style.top = `${p.y}px`;
      box.setAttribute('data-placement', p.placement);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
    };
  }, [css, active, anchor, box, placement, offset]);

  const base: CSSProperties = { position: 'fixed', inset: 'auto', margin: 0 };
  if (!css) return base;
  return {
    ...base,
    positionAnchor: name,
    positionArea: POSITION_AREA[placement],
    positionTryFallbacks: 'flip-block, flip-inline',
    [FACING[placementSide(placement)]]: offset,
  } as CSSProperties;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/anchor.test.tsx && pnpm typecheck`
Expected: PASS, 2 tests. If `CSSProperties` from `@types/react` rejects `positionAnchor` or `positionTryFallbacks` even through the cast, keep the cast on the whole object as written. Don't add `@ts-expect-error`.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/anchor.ts packages/meniscus/test/anchor.test.tsx
git commit -m "feat: anchor overlays with CSS anchor positioning, or place() where it's missing"
```

### Task 10: `useTrigger`

**Files:**
- Create: `packages/meniscus/src/react/trigger.tsx`
- Test: `packages/meniscus/test/trigger.test.tsx`

**Interfaces:**
- Produces: `useTrigger(element: ReactElement | undefined, props: Record<string, unknown>, onNode: (node: HTMLElement | null) => void): ReactElement | null`.
  - The element's own `on*` handlers run first, then ours.
  - `aria-describedby` values join.
  - The element's own ref still receives the node.
  - It warns once in development when no node ever arrives.

- [ ] **Step 1: Write the failing test** (Review Focus 4)

```tsx
// packages/meniscus/test/trigger.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { useTrigger } from '../src/react/trigger';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Host({ element, onOpen }: { element: ReactElement; onOpen: () => void }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const trigger = useTrigger(element, { 'aria-expanded': false, 'aria-describedby': 'tip', onClick: onOpen }, setNode);
  return <>{trigger}<output>{node ? node.tagName : 'none'}</output></>;
}

it('keeps the trigger’s own handler, label, ref and description, and adds its own', () => {
  const theirs = vi.fn();
  const ours = vi.fn();
  const ref = { current: null as HTMLButtonElement | null };
  const { getByRole, getByText } = render(
    <Host element={<button type="button" ref={ref} aria-label="Share plate" aria-describedby="hint" onClick={theirs}>Share</button>} onOpen={ours} />,
  );
  const button = getByRole('button', { name: 'Share plate' });
  fireEvent.click(button);
  expect(theirs).toHaveBeenCalledOnce();
  expect(ours).toHaveBeenCalledOnce();
  expect(theirs.mock.invocationCallOrder[0]!).toBeLessThan(ours.mock.invocationCallOrder[0]!);
  expect(ref.current).toBe(button);
  expect(button.getAttribute('aria-expanded')).toBe('false');
  expect(button.getAttribute('aria-describedby')).toBe('hint tip');
  expect(getByText('BUTTON')).not.toBeNull();
});

it('warns once when the trigger never gets a node', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  function Opaque(props: { children?: string }) {
    return <span>{props.children}</span>;
  }
  render(<Host element={<Opaque>Share</Opaque>} onOpen={() => {}} />);
  expect(warn).toHaveBeenCalledOnce();
  expect(warn.mock.calls[0]![0]).toContain('trigger');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/trigger.test.tsx`
Expected: FAIL with "Failed to resolve import ../src/react/trigger".

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/trigger.tsx
import { cloneElement, isValidElement, useEffect, useRef, version, type ReactElement, type Ref, type SyntheticEvent } from 'react';
import { DEV } from './dev';

type Handler = (e: SyntheticEvent) => void;

/** React 19 passes a ref as a prop; React 18 keeps it on the element. */
const REF_ON_ELEMENT = version.startsWith('18');
let warned = false;

function ownRef(element: ReactElement): Ref<unknown> | undefined {
  return REF_ON_ELEMENT ? (element as unknown as { ref?: Ref<unknown> }).ref : (element.props as { ref?: Ref<unknown> }).ref;
}

function assign(ref: Ref<unknown> | undefined, value: unknown): void {
  if (typeof ref === 'function') ref(value);
  else if (ref && typeof ref === 'object') (ref as { current: unknown }).current = value;
}

/**
 * Clones the element that opens an overlay with `props` added. Its own
 * handlers run first, then ours. `aria-describedby` values join, and its own
 * ref still receives the node, which `onNode` gets too. Warns in development
 * when no node ever arrives: a component that doesn't pass its ref through
 * can't anchor an overlay or take focus back.
 */
export function useTrigger(element: ReactElement | undefined, props: Record<string, unknown>, onNode: (node: HTMLElement | null) => void): ReactElement | null {
  const valid = isValidElement(element);
  const node = useRef<HTMLElement | null>(null);
  const latest = useRef({ theirs: valid ? ownRef(element) : undefined, onNode });
  latest.current = { theirs: valid ? ownRef(element) : undefined, onNode };
  // One callback for the component's life, so React doesn't detach and reattach it every render.
  const setRef = useRef((value: unknown) => {
    node.current = value instanceof HTMLElement ? value : null;
    assign(latest.current.theirs, value);
    latest.current.onNode(node.current);
  }).current;

  useEffect(() => {
    if (!DEV || !valid || node.current || warned) return;
    warned = true;
    console.warn('meniscus: an overlay’s trigger never received a DOM node. Pass an element, or a component that passes its ref through.');
  }, [valid]);

  if (!valid) return null;
  const own = element.props as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...props, ref: setRef };
  for (const [key, value] of Object.entries(props)) {
    const theirs = own[key];
    if (/^on[A-Z]/.test(key) && typeof value === 'function' && typeof theirs === 'function') {
      merged[key] = (e: SyntheticEvent) => {
        (theirs as Handler)(e);
        (value as Handler)(e);
      };
    }
  }
  if (typeof own['aria-describedby'] === 'string' && typeof props['aria-describedby'] === 'string') {
    merged['aria-describedby'] = `${own['aria-describedby']} ${props['aria-describedby']}`;
  }
  return cloneElement(element, merged);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/trigger.test.tsx && pnpm typecheck`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/trigger.tsx packages/meniscus/test/trigger.test.tsx
git commit -m "feat: clone overlay triggers, keeping their own handlers, ref and description"
```

### Task 11: `useDragDismiss`

**Files:**
- Create: `packages/meniscus/src/react/drag.ts`
- Test: `packages/meniscus/test/drag.test.tsx`

**Interfaces:**
- Produces:
  - `THROW = 600` (px/s) and `dragDismisses(offset: number, velocity: number, size: number, fraction: number): boolean`
  - `interface DragDismissOptions { axis: 'x' | 'y'; direction: 1 | -1 | 0; fraction: number; enabled: boolean; reducedMotion: boolean; onDismiss: () => void }`
  - `interface DragHandlers { onPointerDown; onPointerMove; onPointerUp; onPointerCancel }`, each `(e: PointerEvent<HTMLElement>) => void`
  - `useDragDismiss(target: HTMLElement | null, options: DragDismissOptions): DragHandlers`: writes `--meniscus-drag` (px, signed along the axis) on `target`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/drag.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { dragDismisses, useDragDismiss, THROW } from '../src/react/drag';

afterEach(cleanup);

it('dismisses past the fraction of its size, or when thrown', () => {
  expect(dragDismisses(36, 0, 100, 0.35)).toBe(true);
  expect(dragDismisses(34, 0, 100, 0.35)).toBe(false);
  expect(dragDismisses(10, THROW + 1, 100, 0.35)).toBe(true);
  expect(dragDismisses(-50, -900, 100, 0.35)).toBe(false);
});

function Drawer({ onDismiss }: { onDismiss: () => void }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const drag = useDragDismiss(el, { axis: 'x', direction: -1, fraction: 0.35, enabled: true, reducedMotion: true, onDismiss });
  const ref = useCallback((n: HTMLDivElement | null) => {
    if (n) Object.defineProperty(n, 'offsetWidth', { configurable: true, value: 300 });
    setEl(n);
  }, []);
  return <div ref={ref} data-testid="drawer" {...drag} />;
}

it('follows the pointer toward its edge and dismisses past a third of its width', () => {
  const onDismiss = vi.fn();
  const { getByTestId } = render(<Drawer onDismiss={onDismiss} />);
  const drawer = getByTestId('drawer');
  fireEvent.pointerDown(drawer, { pointerId: 1, button: 0, clientX: 280 });
  fireEvent.pointerMove(drawer, { pointerId: 1, clientX: 200 });
  expect(drawer.style.getPropertyValue('--meniscus-drag')).toBe('-80px');
  fireEvent.pointerMove(drawer, { pointerId: 1, clientX: 160 });
  fireEvent.pointerUp(drawer, { pointerId: 1, clientX: 160 });
  expect(onDismiss).toHaveBeenCalledOnce();
});

it('resists the other way, ignores tiny moves, and settles back when released short', () => {
  const onDismiss = vi.fn();
  const { getByTestId } = render(<Drawer onDismiss={onDismiss} />);
  const drawer = getByTestId('drawer');
  fireEvent.pointerDown(drawer, { pointerId: 1, button: 0, clientX: 100 });
  fireEvent.pointerMove(drawer, { pointerId: 1, clientX: 103 });
  expect(drawer.style.getPropertyValue('--meniscus-drag')).toBe('');
  fireEvent.pointerMove(drawer, { pointerId: 1, clientX: 150 });
  expect(drawer.style.getPropertyValue('--meniscus-drag')).toBe('10px');
  fireEvent.pointerUp(drawer, { pointerId: 1, clientX: 150 });
  expect(onDismiss).not.toHaveBeenCalled();
  expect(drawer.style.getPropertyValue('--meniscus-drag')).toBe('0px');
});
```

In the second test the move is +50 px against a drawer that dismisses leftward (direction −1), so it resists at 20%: `50 × 0.2 = 10`. `reducedMotion: true` makes the release settle at once.

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/drag.test.tsx`
Expected: FAIL with "Failed to resolve import ../src/react/drag".

- [ ] **Step 3: Implement**

```ts
// packages/meniscus/src/react/drag.ts
import { useRef, type PointerEvent } from 'react';
import { Spring } from '../core/spring';

/** A release faster than this toward the edge dismisses, px/s. */
export const THROW = 600;
/** Movement before a press becomes a drag, px. Less stays a click. */
const SLOP = 6;
/** How much a drag the wrong way follows the pointer. */
const RESIST = 0.2;

/** Whether a drag released `offset` px toward the edge at `velocity` px/s dismisses an element `size` px long. */
export function dragDismisses(offset: number, velocity: number, size: number, fraction: number): boolean {
  return offset > size * fraction || velocity > THROW;
}

export interface DragDismissOptions {
  /** The axis it moves along. */
  axis: 'x' | 'y';
  /** The way that dismisses: 1 toward right or down, -1 toward left or up, 0 either way. */
  direction: 1 | -1 | 0;
  /** The share of its size a drag must pass to dismiss. */
  fraction: number;
  enabled: boolean;
  /** Settle a short release at once instead of springing back. */
  reducedMotion: boolean;
  onDismiss: () => void;
}

export interface DragHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
}

interface Press {
  id: number;
  start: number;
  last: number;
  time: number;
  velocity: number;
  dragging: boolean;
}

/**
 * Drag an element toward an edge to dismiss it. The offset goes to
 * `--meniscus-drag` (px) on `target`, for its transform to add. A release
 * short of the threshold springs back, and the click a drag would end with is
 * swallowed.
 */
export function useDragDismiss(target: HTMLElement | null, options: DragDismissOptions): DragHandlers {
  const press = useRef<Press | null>(null);
  const settle = useRef(0);
  const latest = useRef(options);
  latest.current = options;

  const write = (px: number) => target?.style.setProperty('--meniscus-drag', `${Math.round(px * 100) / 100}px`);
  const coord = (e: PointerEvent<HTMLElement>) => (latest.current.axis === 'x' ? e.clientX : e.clientY);
  const toward = (v: number) => (latest.current.direction === 0 ? Math.abs(v) : v * latest.current.direction);

  const end = (e: PointerEvent<HTMLElement>, cancelled: boolean) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.dragging) return;
    const swallow = (click: Event) => {
      click.stopPropagation();
      click.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    const delta = p.last - p.start;
    const size = target ? (latest.current.axis === 'x' ? target.offsetWidth : target.offsetHeight) : 0;
    if (!cancelled && dragDismisses(toward(delta), toward(p.velocity), size, latest.current.fraction)) {
      latest.current.onDismiss();
      return;
    }
    if (latest.current.reducedMotion || typeof requestAnimationFrame !== 'function') {
      write(0);
      return;
    }
    const spring = new Spring(delta, 'snappy');
    spring.target = 0;
    let then = performance.now();
    const tick = (now: number) => {
      spring.step((now - then) / 1000);
      then = now;
      if (spring.settled) {
        write(0);
        settle.current = 0;
        return;
      }
      write(spring.value);
      settle.current = requestAnimationFrame(tick);
    };
    settle.current = requestAnimationFrame(tick);
  };

  return {
    onPointerDown(e) {
      if (!latest.current.enabled || e.button !== 0 || press.current) return;
      cancelAnimationFrame(settle.current);
      const c = coord(e);
      press.current = { id: e.pointerId, start: c, last: c, time: performance.now(), velocity: 0, dragging: false };
    },
    onPointerMove(e) {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      const c = coord(e);
      const delta = c - p.start;
      if (!p.dragging) {
        if (Math.abs(delta) < SLOP) return;
        p.dragging = true;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // The pointer is already gone: the drag still works without capture.
        }
      }
      const now = performance.now();
      p.velocity = 0.6 * ((c - p.last) / (Math.max(1, now - p.time) / 1000)) + 0.4 * p.velocity;
      p.last = c;
      p.time = now;
      const d = latest.current.direction;
      write(d === 0 || delta * d > 0 ? delta : delta * RESIST);
    },
    onPointerUp(e) {
      end(e, false);
    },
    onPointerCancel(e) {
      end(e, true);
    },
  };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/drag.test.tsx && pnpm typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/drag.ts packages/meniscus/test/drag.test.tsx
git commit -m "feat: drag glass toward an edge to dismiss it"
```

---

## Phase 3: Overlays

All five overlay tests share this preamble. Repeat it at the top of each file, since tasks may be read out of order:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

/** Runs the springs for about 1.5 s: long enough for any entrance or exit to finish. */
const settle = () => act(() => { for (let i = 0; i < 90; i++) vi.advanceTimersByTime(16); });
```

### Task 12: `GlassDialog`: modal, sheet and drawer

**Files:**
- Create: `packages/meniscus/src/react/GlassDialog.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/dialog.test.tsx`

**Interfaces:**
- Consumes: `useOverlay` and `useOpenState` (Task 8), `firstFocusable` (Task 8), `useTrigger` (Task 10), `useDragDismiss` (Task 11), `Glass`, `presenceOpacity`.
- Produces:
  - `type GlassDialogPlacement = 'center' | 'bottom' | 'left' | 'right'`
  - `interface GlassDialogProps extends Omit<GlassProps<'div'>, 'as' | 'appear' | 'optics' | 'interactive'> { label?; placement?; trigger?; open?; defaultOpen?; onOpenChange?; physics? }`
  - `function GlassDialog(props: GlassDialogProps): JSX.Element`
  - DOM hooks the site and browser check use:
    - `dialog[data-meniscus-dialog]`
    - `[data-meniscus-scrim]`
    - `[data-meniscus-grabber]`
    - the panel, which is the dialog's `[data-meniscus]`

- [ ] **Step 1: Write the failing test** (includes Review Focus 1 and 2)

```tsx
// packages/meniscus/test/dialog.test.tsx
// (the Phase 3 preamble goes here)
import { GlassButton, GlassDialog, GlassProvider } from '../src';

const panelOf = (container: HTMLElement) => container.querySelector('dialog [data-meniscus]') as HTMLElement;

it('opens from its trigger, names itself, and moves focus to the first control', () => {
  const { getByRole, container } = render(
    <GlassDialog label="Order a print" trigger={<GlassButton>Order</GlassButton>}>
      <label>Email <input name="email" /></label>
      <button type="button">Cancel</button>
    </GlassDialog>,
  );
  const trigger = getByRole('button', { name: 'Order' });
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  const dialog = container.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  expect(dialog.getAttribute('aria-label')).toBe('Order a print');
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(container.querySelector('input'));
});

it('asks to close on Escape; a controlled dialog that ignores it stays open', () => {
  const onOpenChange = vi.fn();
  const { container } = render(<GlassDialog label="Filters" open onOpenChange={onOpenChange}>Body</GlassDialog>);
  const dialog = container.querySelector('dialog')!;
  const cancel = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  settle();
  expect(dialog.open).toBe(true);
});

it('closes when the dimmed page is clicked, and gives focus back to the trigger', () => {
  const { getByRole, container } = render(
    <GlassDialog label="Filters" trigger={<button type="button">Filters</button>}>
      <button type="button">Apply</button>
    </GlassDialog>,
  );
  fireEvent.click(getByRole('button', { name: 'Filters' }));
  settle();
  fireEvent.click(container.querySelector('[data-meniscus-scrim]')!);
  settle();
  expect(container.querySelector('dialog')!.open).toBe(false);
  expect(document.activeElement).toBe(getByRole('button', { name: 'Filters' }));
});

it('closes on a form method="dialog" submit, keeping the submitter’s value', () => {
  const onOpenChange = vi.fn();
  const { getByRole, container } = render(
    <GlassDialog label="Confirm" defaultOpen onOpenChange={onOpenChange}>
      <form method="dialog">
        <button value="ok">OK</button>
      </form>
    </GlassDialog>,
  );
  const dialog = container.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  fireEvent.click(getByRole('button', { name: 'OK' }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  settle();
  expect(dialog.open).toBe(false);
  expect(dialog.returnValue).toBe('ok');
});

it('focuses the panel when nothing inside can take focus', () => {
  const { container } = render(<GlassDialog label="Notice" defaultOpen>Saved.</GlassDialog>);
  const panel = panelOf(container);
  expect(document.activeElement).toBe(panel);
  expect(panel.tabIndex).toBe(-1);
});

it('reports a close the browser made by itself, and opens again normally', () => {
  const onOpenChange = vi.fn();
  const { getByRole, container } = render(
    <GlassDialog label="Filters" trigger={<button type="button">Filters</button>} onOpenChange={onOpenChange}>Body</GlassDialog>,
  );
  const trigger = getByRole('button', { name: 'Filters' });
  fireEvent.click(trigger);
  settle();
  const dialog = container.querySelector('dialog')!;
  act(() => dialog.close());
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(trigger);
  expect(dialog.open).toBe(true);
});

it('lets the page scroll again when unmounted mid-exit', () => {
  const root = document.documentElement;
  const { rerender, unmount } = render(<GlassDialog label="A" open>Body</GlassDialog>);
  expect(root.style.overflow).toBe('hidden');
  rerender(<GlassDialog label="A" open={false}>Body</GlassDialog>);
  act(() => vi.advanceTimersByTime(32));
  unmount();
  expect(root.style.overflow).toBe('');
});

it('slides a sheet up, with a grabber that drags it away', () => {
  const onOpenChange = vi.fn();
  const { container } = render(<GlassDialog label="Filters" placement="bottom" open onOpenChange={onOpenChange}>Body</GlassDialog>);
  const panel = panelOf(container);
  expect(panel.style.translate).toContain('var(--meniscus-presence');
  Object.defineProperty(panel, 'offsetHeight', { configurable: true, value: 400 });
  settle();
  const grabber = container.querySelector('[data-meniscus-grabber]') as HTMLElement;
  fireEvent.pointerDown(grabber, { pointerId: 1, button: 0, clientY: 300 });
  fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 360 });
  fireEvent.pointerMove(grabber, { pointerId: 1, clientY: 460 });
  fireEvent.pointerUp(grabber, { pointerId: 1, clientY: 460 });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it('slides a drawer in from its side, keeps vertical scrolling, and holds still under reduced motion', () => {
  const { container } = render(<GlassDialog label="Library" placement="left" open>Links</GlassDialog>);
  const panel = panelOf(container);
  expect(panel.style.translate).toContain('(var(--meniscus-presence, 1) - 1)');
  expect(panel.style.touchAction).toBe('pan-y');
  cleanup();
  const reduced = render(
    <GlassProvider reduceMotion>
      <GlassDialog label="Library" placement="left" open>Links</GlassDialog>
    </GlassProvider>,
  );
  expect(panelOf(reduced.container).style.translate).toBe('');
});

it('warns in development when it has no accessible name', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<GlassDialog>Body</GlassDialog>);
  expect(warn.mock.calls.some(([m]) => String(m).includes('accessible name'))).toBe(true);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/dialog.test.tsx`
Expected: FAIL, because `GlassDialog` is not exported from `../src`.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassDialog.tsx
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactElement } from 'react';
import { presenceOpacity } from '../core/physics';
import type { SpringInput } from '../core/spring';
import { DEV } from './dev';
import { useDragDismiss } from './drag';
import { firstFocusable } from './focus';
import { Glass, type GlassProps } from './Glass';
import { useIsomorphicLayoutEffect } from './hooks';
import { useOpenState, useOverlay } from './overlay';
import { useTrigger } from './trigger';

/** Where a dialog's panel sits: `center` is a modal card, `bottom` a sheet, `left` and `right` drawers. */
export type GlassDialogPlacement = 'center' | 'bottom' | 'left' | 'right';

export interface GlassDialogProps extends Omit<GlassProps<'div'>, 'as' | 'appear' | 'optics' | 'interactive'> {
  /** Accessible name. Or pass `aria-labelledby` naming your own heading. */
  label?: string;
  /** `center` (the default): a modal card. `bottom`: a sheet. `left` or `right`: a drawer. */
  placement?: GlassDialogPlacement;
  /** An element that opens the dialog, such as a `GlassButton`. Focus returns to it on close. */
  trigger?: ReactElement;
  /** Open, controlled. Pair it with `onOpenChange`: a controlled dialog stays open until you close it. */
  open?: boolean;
  /** Open at first, uncontrolled. It opens after hydration. */
  defaultOpen?: boolean;
  /** Called with `true` from the trigger, and with `false` from Escape, the dimmed page, a drag away or a `<form method="dialog">`. */
  onOpenChange?: (open: boolean) => void;
  /** The spring for the entrance and exit. Default `'snappy'`. */
  physics?: SpringInput;
}

const BACKDROP = '[data-meniscus-dialog]::backdrop{background:transparent}';
const PRESENCE = 'var(--meniscus-presence, 1)';

const DIALOG: CSSProperties = {
  position: 'fixed',
  inset: 0,
  width: '100%',
  height: '100%',
  maxWidth: 'none',
  maxHeight: 'none',
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  overflow: 'hidden',
  outline: 'none',
};
const FILL: CSSProperties = { position: 'absolute', inset: 0 };
const SCRIM: CSSProperties = {
  ...FILL,
  background: 'var(--meniscus-scrim, light-dark(rgb(8 10 14 / 0.16), rgb(0 0 0 / 0.42)))',
  opacity: 'var(--meniscus-scrim-opacity, 0)' as unknown as number,
};

const LAYOUT: Readonly<Record<GlassDialogPlacement, CSSProperties>> = {
  center: { display: 'grid', placeItems: 'center', padding: '1rem' },
  bottom: { display: 'grid', alignItems: 'end', justifyItems: 'center', padding: 8 },
  left: { display: 'grid', justifyItems: 'start', alignItems: 'stretch', padding: 8 },
  right: { display: 'grid', justifyItems: 'end', alignItems: 'stretch', padding: 8 },
};

const SIDE: CSSProperties = { width: 'min(22rem, 100% - 3rem)', height: '100%', overflow: 'auto', padding: '1.5rem', boxSizing: 'border-box', touchAction: 'pan-y' };
const PANEL: Readonly<Record<GlassDialogPlacement, CSSProperties>> = {
  center: { width: 'min(32rem, 100%)', maxHeight: '100%', overflow: 'auto', padding: '1.5rem', boxSizing: 'border-box' },
  bottom: { width: 'min(40rem, 100%)', maxHeight: 'calc(100% - 3rem)', overflow: 'auto', padding: '2rem 1.5rem 1.5rem', boxSizing: 'border-box' },
  left: SIDE,
  right: SIDE,
};

/** The card swells in; sheets and drawers slide in from their edge, plus any drag. */
const MOTION: Readonly<Record<GlassDialogPlacement, CSSProperties>> = {
  center: { scale: `calc(0.94 + 0.06 * ${PRESENCE})` },
  bottom: { translate: `0 calc((1 - ${PRESENCE}) * (100% + 8px) + var(--meniscus-drag, 0px))` },
  left: { translate: `calc((${PRESENCE} - 1) * (100% + 8px) + var(--meniscus-drag, 0px)) 0` },
  right: { translate: `calc((1 - ${PRESENCE}) * (100% + 8px) + var(--meniscus-drag, 0px)) 0` },
};

/** Which way each draggable placement leaves. */
const EDGE = { bottom: { axis: 'y', direction: 1 }, left: { axis: 'x', direction: -1 }, right: { axis: 'x', direction: 1 } } as const;

const GRABBER: CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, height: 28, display: 'grid', placeItems: 'center', touchAction: 'none', cursor: 'grab' };
const BAR: CSSProperties = { width: 36, height: 5, borderRadius: 3, background: 'currentColor', opacity: 0.35 };

let warnedUnnamed = false;

/**
 * A modal dialog of glass: a centered card, a sheet or a drawer. It renders
 * where you put it and opens in the browser's top layer, which keeps focus
 * inside and the page behind inert. Escape, a click on the dimmed page, and
 * dragging a sheet or drawer away all ask it to close. A
 * `<form method="dialog">` inside closes it, leaving the submitter's value
 * as the dialog's `returnValue`.
 */
export function GlassDialog({
  label,
  placement = 'center',
  trigger,
  open: openProp,
  defaultOpen,
  onOpenChange,
  physics = 'snappy',
  'aria-labelledby': labelledBy,
  style,
  children,
  ...glass
}: GlassDialogProps) {
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const overlay = useOverlay(dialog, { open, onRequestClose: () => setOpen(false), kind: 'modal', physics, trigger: anchor });
  const triggerNode = useTrigger(trigger, { 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: () => setOpen(true) }, setAnchor);

  // The scrim fades with the glass.
  useIsomorphicLayoutEffect(() => {
    if (!dialog) return;
    return overlay.optics.subscribe((s) => dialog.style.setProperty('--meniscus-scrim-opacity', String(presenceOpacity(Math.max(0, s.presence)))));
  }, [dialog, overlay.optics]);

  // Focus moves in: an autofocus or first focusable child, else the panel itself.
  useIsomorphicLayoutEffect(() => {
    if (!open || !overlay.shown || !panel || panel.contains(document.activeElement)) return;
    const target = firstFocusable(panel);
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
  }, [open, overlay.shown, panel]);

  const edge = placement === 'center' ? null : EDGE[placement];
  const drag = useDragDismiss(panel, {
    axis: edge?.axis ?? 'y',
    direction: edge?.direction ?? 1,
    fraction: 0.35,
    enabled: !!edge && open && overlay.shown,
    reducedMotion: overlay.reducedMotion,
    onDismiss: () => setOpen(false),
  });
  // Each opening starts undragged.
  useIsomorphicLayoutEffect(() => {
    if (!overlay.shown) panel?.style.removeProperty('--meniscus-drag');
  }, [overlay.shown, panel]);

  useEffect(() => {
    if (!DEV || warnedUnnamed || label || labelledBy) return;
    warnedUnnamed = true;
    console.warn('meniscus: a GlassDialog needs an accessible name. Pass `label`, or `aria-labelledby` naming its heading.');
  }, [label, labelledBy]);

  const onSubmit = (e: FormEvent<HTMLDialogElement>) => {
    const form = e.target as HTMLFormElement;
    if (!dialog || form.getAttribute('method')?.toLowerCase() !== 'dialog') return;
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | HTMLInputElement | null;
    dialog.returnValue = submitter?.value ?? '';
    setOpen(false);
  };

  const side = placement === 'left' || placement === 'right' ? drag : null;
  return (
    <>
      {triggerNode}
      <dialog ref={setDialog} data-meniscus-dialog="" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} onSubmit={onSubmit} style={DIALOG}>
        <style>{BACKDROP}</style>
        <div style={{ ...FILL, ...LAYOUT[placement] }}>
          <div aria-hidden="true" data-meniscus-scrim="" style={SCRIM} onClick={() => setOpen(false)} />
          <Glass {...glass} {...side} ref={setPanel} optics={overlay.optics} style={{ ...PANEL[placement], ...(overlay.reducedMotion ? null : MOTION[placement]), ...style }}>
            {placement === 'bottom' ? (
              <span aria-hidden="true" data-meniscus-grabber="" style={GRABBER} {...drag}>
                <span style={BAR} />
              </span>
            ) : null}
            {children}
          </Glass>
        </div>
      </dialog>
    </>
  );
}

GlassDialog.displayName = 'GlassDialog';
```

Add to `packages/meniscus/src/index.ts`, after the `GlassButton` export:

```ts
export { GlassDialog, type GlassDialogProps, type GlassDialogPlacement } from './react/GlassDialog';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/dialog.test.tsx && pnpm typecheck`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassDialog.tsx packages/meniscus/src/index.ts packages/meniscus/test/dialog.test.tsx
git commit -m "feat: GlassDialog, a modal card, sheet or drawer in the top layer"
```

### Task 13: `GlassPopover`

**Files:**
- Create: `packages/meniscus/src/react/GlassPopover.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/popover.test.tsx`

**Interfaces:**
- Consumes: `useOverlay`, `useOpenState` and `usePopoverSupport`, with `fallbackStyle` (Task 8), `useAnchor` (Task 9), `useTrigger` (Task 10), `firstFocusable` (Task 8).
- Produces:
  - `interface GlassPopoverProps extends Omit<GlassProps<'div'>, 'as' | 'appear' | 'optics' | 'interactive'> { label: string; trigger: ReactElement; placement?: GlassPlacement; offset?: number; open?; defaultOpen?; onOpenChange?; physics? }`
  - `GlassPopover`
  - `GlassPlacement`, re-exported from `meniscus`.

- [ ] **Step 1: Write the failing test** (includes Review Focus 3)

```tsx
// packages/meniscus/test/popover.test.tsx
// (the Phase 3 preamble goes here)
import { GlassDialog, GlassPopover } from '../src';

function Share(props: { onOpenChange?: (open: boolean) => void }) {
  return (
    <GlassPopover label="Share" trigger={<button type="button">Share</button>} {...props}>
      <button type="button">Copy link</button>
    </GlassPopover>
  );
}

it('wires its trigger to a named popover and toggles on click', () => {
  const { getByRole } = render(<Share />);
  const trigger = getByRole('button', { name: 'Share' });
  expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
  fireEvent.click(trigger);
  const surface = document.getElementById(trigger.getAttribute('aria-controls')!)!;
  expect(surface.getAttribute('role')).toBe('dialog');
  expect(surface.getAttribute('aria-label')).toBe('Share');
  expect(surface.getAttribute('popover')).toBe('manual');
  expect(surface.hasAttribute('data-test-popover-open')).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(trigger);
  settle();
  expect(surface.hasAttribute('data-test-popover-open')).toBe(false);
});

it('moves focus in, and Escape closes it and gives focus back', () => {
  const { getByRole } = render(<Share />);
  const trigger = getByRole('button', { name: 'Share' });
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(getByRole('button', { name: 'Copy link' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  settle();
  expect(document.activeElement).toBe(trigger);
});

it('closes on an outside press and when focus leaves', () => {
  const onOpenChange = vi.fn();
  const { getByRole } = render(
    <>
      <Share onOpenChange={onOpenChange} />
      <button type="button">Elsewhere</button>
    </>,
  );
  fireEvent.click(getByRole('button', { name: 'Share' }));
  fireEvent.pointerDown(document.body);
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  fireEvent.click(getByRole('button', { name: 'Share' }));
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  act(() => getByRole('button', { name: 'Elsewhere' }).focus());
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

it('takes Escape inside an open dialog without closing the dialog', () => {
  const dialogChange = vi.fn();
  const popoverChange = vi.fn();
  const { getByRole, container } = render(
    <GlassDialog label="Settings" open onOpenChange={dialogChange}>
      <Share onOpenChange={popoverChange} />
    </GlassDialog>,
  );
  fireEvent.click(getByRole('button', { name: 'Share' }));
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  getByRole('button', { name: 'Copy link' }).dispatchEvent(escape);
  expect(escape.defaultPrevented).toBe(true);
  expect(popoverChange).toHaveBeenLastCalledWith(false);
  expect(dialogChange).not.toHaveBeenCalled();
  expect(container.querySelector('dialog')!.open).toBe(true);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/popover.test.tsx`
Expected: FAIL, because `GlassPopover` is not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassPopover.tsx
import { useEffect, useId, useState, type CSSProperties, type ReactElement } from 'react';
import type { GlassPlacement } from '../core/place';
import type { SpringInput } from '../core/spring';
import { useAnchor } from './anchor';
import { firstFocusable } from './focus';
import { Glass, type GlassProps } from './Glass';
import { fallbackStyle, useOpenState, useOverlay, usePopoverSupport } from './overlay';
import { useTrigger } from './trigger';

export interface GlassPopoverProps extends Omit<GlassProps<'div'>, 'as' | 'appear' | 'optics' | 'interactive'> {
  /** Accessible name of the popover. */
  label: string;
  /** The element that opens and closes it, such as a `GlassButton`. It must pass its ref through. */
  trigger: ReactElement;
  /** The side of the trigger, and how it aligns. Default `'bottom'`. It flips where there's no room. */
  placement?: GlassPlacement;
  /** Gap from the trigger, px. Default 8. */
  offset?: number;
  /** Open, controlled. Pair it with `onOpenChange`. */
  open?: boolean;
  /** Open at first, uncontrolled. */
  defaultOpen?: boolean;
  /** Called with `true` or `false` from the trigger, and with `false` from Escape, an outside press or focus leaving. */
  onOpenChange?: (open: boolean) => void;
  /** The spring for its entrance and exit. Default `'snappy'`. */
  physics?: SpringInput;
}

const SURFACE: CSSProperties = { border: 0, padding: '0.75rem 1rem', color: 'inherit', overflow: 'visible', boxSizing: 'border-box', maxWidth: 'min(22rem, calc(100vw - 16px))' };
const SWELL: CSSProperties = { scale: 'calc(0.96 + 0.04 * var(--meniscus-presence, 1))' };

/**
 * Glass content anchored to a trigger: a non-modal dialog in the top layer.
 * Focus moves in when it opens and back to the trigger when it closes.
 * Escape, a press outside, or focus leaving closes it.
 */
export function GlassPopover({ label, trigger, placement = 'bottom', offset = 8, open: openProp, defaultOpen, onOpenChange, physics = 'snappy', radius = 20, style, children, ...glass }: GlassPopoverProps) {
  const id = `meniscus-popover-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const supported = usePopoverSupport();
  const overlay = useOverlay(surface, {
    open,
    onRequestClose: () => setOpen(false),
    kind: 'popover',
    physics,
    trigger: anchor,
    dismiss: { escape: true, outside: true, focusOut: true },
    inside: () => [anchor],
  });
  const position = useAnchor(anchor, surface, overlay.shown, { placement, offset });
  const triggerNode = useTrigger(trigger, { 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': id, onClick: () => setOpen(!open) }, setAnchor);

  useEffect(() => {
    if (!open || !overlay.shown || !surface || surface.contains(document.activeElement)) return;
    (firstFocusable(surface) ?? surface).focus({ preventScroll: true });
  }, [open, overlay.shown, surface]);

  return (
    <>
      {triggerNode}
      <Glass
        {...glass}
        ref={setSurface}
        id={id}
        role="dialog"
        aria-label={label}
        popover="manual"
        tabIndex={-1}
        radius={radius}
        optics={overlay.optics}
        style={{ ...SURFACE, ...position, ...(overlay.reducedMotion ? null : SWELL), ...fallbackStyle(supported, overlay.shown), ...style }}
      >
        {children}
      </Glass>
    </>
  );
}

GlassPopover.displayName = 'GlassPopover';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassPopover, type GlassPopoverProps } from './react/GlassPopover';
export type { GlassPlacement } from './core/place';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/popover.test.tsx && pnpm typecheck`
Expected: PASS, 4 tests. If `popover="manual"` fails the type check because React's types lack `popover`, the installed `@types/react` is older than 19. Check with `pnpm why @types/react --filter meniscus`. It should be 19.3.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassPopover.tsx packages/meniscus/src/index.ts packages/meniscus/test/popover.test.tsx
git commit -m "feat: GlassPopover, glass content anchored to a trigger"
```

### Task 14: `GlassTooltip`

**Files:**
- Create: `packages/meniscus/src/react/GlassTooltip.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/tooltip.test.tsx`

**Interfaces:**
- Consumes: `useOverlay` and `usePopoverSupport`, with `fallbackStyle` (Task 8), `useAnchor` (Task 9), `useTrigger` (Task 10), `focusVisible` (Task 8).
- Produces: `interface GlassTooltipProps extends Omit<GlassProps<'div'>, 'as' | 'children' | 'content' | 'appear' | 'optics' | 'interactive'> { content: ReactNode; children: ReactElement; placement?; offset?; delay? }`, and `GlassTooltip`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/tooltip.test.tsx
// (the Phase 3 preamble goes here)
import { GlassTooltip } from '../src';

// jsdom can't tell keyboard focus from other focus: treat every focus as keyboard focus.
vi.mock('../src/react/focus', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/react/focus')>()), focusVisible: () => true }));

function Save() {
  return (
    <GlassTooltip content="Save to collection">
      <button type="button">Save</button>
    </GlassTooltip>
  );
}

const tipOf = (button: HTMLElement) => document.getElementById(button.getAttribute('aria-describedby')!)!;
const isOpen = (tip: HTMLElement) => tip.hasAttribute('data-test-popover-open');

it('describes its element, and shows only after the hover delay', () => {
  const { getByRole } = render(<Save />);
  const button = getByRole('button', { name: 'Save' });
  const tip = tipOf(button);
  expect(tip.getAttribute('role')).toBe('tooltip');
  expect(tip.textContent).toBe('Save to collection');
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(400));
  expect(isOpen(tip)).toBe(false);
  act(() => vi.advanceTimersByTime(150));
  expect(isOpen(tip)).toBe(true);
});

it('lets the pointer cross onto it, then hides once the pointer leaves', () => {
  const { getByRole } = render(<Save />);
  const button = getByRole('button', { name: 'Save' });
  const tip = tipOf(button);
  fireEvent.pointerEnter(button, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(600));
  fireEvent.pointerLeave(button, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(50));
  fireEvent.pointerEnter(tip, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(300));
  expect(isOpen(tip)).toBe(true);
  fireEvent.pointerLeave(tip, { pointerType: 'mouse' });
  settle();
  expect(isOpen(tip)).toBe(false);
});

it('never shows for touch', () => {
  const { getByRole } = render(<Save />);
  const button = getByRole('button', { name: 'Save' });
  fireEvent.pointerEnter(button, { pointerType: 'touch' });
  act(() => vi.advanceTimersByTime(2000));
  expect(isOpen(tipOf(button))).toBe(false);
});

it('shows at once on keyboard focus, and hides on Escape and on blur', () => {
  const { getByRole } = render(<Save />);
  const button = getByRole('button', { name: 'Save' });
  const tip = tipOf(button);
  act(() => button.focus());
  expect(isOpen(tip)).toBe(true);
  fireEvent.keyDown(button, { key: 'Escape' });
  settle();
  expect(isOpen(tip)).toBe(false);
  act(() => button.blur());
  act(() => button.focus());
  expect(isOpen(tip)).toBe(true);
  act(() => button.blur());
  settle();
  expect(isOpen(tip)).toBe(false);
});

it('shows the next tooltip at once when moving between them', () => {
  const { getByRole } = render(
    <>
      <GlassTooltip content="First"><button type="button">One</button></GlassTooltip>
      <GlassTooltip content="Second"><button type="button">Two</button></GlassTooltip>
    </>,
  );
  const one = getByRole('button', { name: 'One' });
  const two = getByRole('button', { name: 'Two' });
  fireEvent.pointerEnter(one, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(600));
  fireEvent.pointerLeave(one, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(120));
  fireEvent.pointerEnter(two, { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(16));
  expect(isOpen(tipOf(two))).toBe(true);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/tooltip.test.tsx`
Expected: FAIL, because `GlassTooltip` is not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassTooltip.tsx
import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react';
import type { GlassPlacement } from '../core/place';
import { useAnchor } from './anchor';
import { focusVisible } from './focus';
import { Glass, type GlassProps } from './Glass';
import { fallbackStyle, useOverlay, usePopoverSupport } from './overlay';
import { useTrigger } from './trigger';

export interface GlassTooltipProps extends Omit<GlassProps<'div'>, 'as' | 'children' | 'content' | 'appear' | 'optics' | 'interactive'> {
  /** The hint. Keep it short, and don't make anything depend on it: touch screens never show it. */
  content: ReactNode;
  /** The element it describes. It must pass its ref through. */
  children: ReactElement;
  /** Default `'top'`. It flips where there's no room. */
  placement?: GlassPlacement;
  /** Gap from the element, px. Default 6. */
  offset?: number;
  /** Hover time before it shows, ms. Default 500. Keyboard focus shows it at once. */
  delay?: number;
}

/** Moving to another tooltip within this many ms shows it at once. */
const WARM = 300;
/** Time for the pointer to cross from the element to the tooltip, ms. */
const GRACE = 100;
let lastHidden = -Infinity;

const SURFACE: CSSProperties = {
  border: 0,
  padding: '0.35rem 0.65rem',
  fontSize: '0.85em',
  lineHeight: 1.35,
  color: 'inherit',
  boxSizing: 'border-box',
  maxWidth: 'min(18rem, calc(100vw - 16px))',
  overflow: 'visible',
};

/**
 * A short hint in glass for the element it wraps. It shows after a hover
 * delay, or at once on keyboard focus. The pointer can move onto it, and
 * Escape closes it. It never shows on touch.
 */
export function GlassTooltip({ content, children, placement = 'top', offset = 6, delay = 500, radius = 10, style, ...glass }: GlassTooltipProps) {
  const id = `meniscus-tooltip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const supported = usePopoverSupport();
  const timer = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;

  const clear = () => window.clearTimeout(timer.current);
  const hideNow = () => {
    clear();
    if (openRef.current) lastHidden = performance.now();
    setOpen(false);
  };
  const showAfter = (wait: number) => {
    clear();
    if (wait <= 0) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), wait);
  };
  const hideSoon = () => {
    clear();
    timer.current = window.setTimeout(hideNow, GRACE);
  };
  useEffect(() => clear, []);

  const overlay = useOverlay(surface, { open, onRequestClose: hideNow, kind: 'popover', physics: 'stiff', dismiss: { escape: true } });
  const position = useAnchor(anchor, surface, overlay.shown, { placement, offset });
  const triggerNode = useTrigger(
    children,
    {
      'aria-describedby': id,
      onPointerEnter: (e: PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'touch') return;
        showAfter(performance.now() - lastHidden < WARM ? 0 : delay);
      },
      onPointerLeave: hideSoon,
      onPointerDown: hideNow,
      onFocus: (e: FocusEvent<HTMLElement>) => {
        if (focusVisible(e.currentTarget)) showAfter(0);
      },
      onBlur: hideNow,
    },
    setAnchor,
  );

  return (
    <>
      {triggerNode}
      <Glass
        {...glass}
        ref={setSurface}
        id={id}
        role="tooltip"
        popover="manual"
        radius={radius}
        optics={overlay.optics}
        onPointerEnter={clear}
        onPointerLeave={hideSoon}
        style={{ ...SURFACE, ...position, ...fallbackStyle(supported, overlay.shown), ...style }}
      >
        {content}
      </Glass>
    </>
  );
}

GlassTooltip.displayName = 'GlassTooltip';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassTooltip, type GlassTooltipProps } from './react/GlassTooltip';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/tooltip.test.tsx && pnpm typecheck`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassTooltip.tsx packages/meniscus/src/index.ts packages/meniscus/test/tooltip.test.tsx
git commit -m "feat: GlassTooltip, a hover and focus hint that the pointer can reach"
```

### Task 15: `GlassMenu`

**Files:**
- Create: `packages/meniscus/src/react/GlassMenu.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/menu.test.tsx`

**Interfaces:**
- Consumes: `useOverlay`, `useOpenState` and `usePopoverSupport`, with `fallbackStyle` (Task 8), `useAnchor` (Task 9), `useTrigger` (Task 10), and the existing `GlassIndicator`.
- Produces:
  - `type GlassMenuItem = { label: ReactNode; onSelect: () => void; disabled?: boolean; icon?: ReactNode; shortcut?: string; textValue?: string } | 'separator'`
  - `interface GlassMenuProps extends Omit<GlassProps<'div'>, 'as' | 'children' | 'appear' | 'optics' | 'interactive'> { label; trigger; items: readonly GlassMenuItem[]; placement?; offset?; open?; defaultOpen?; onOpenChange?; physics? }`
  - `GlassMenu`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/menu.test.tsx
// (the Phase 3 preamble goes here)
import { GlassMenu, type GlassMenuItem } from '../src';

function setup() {
  const chosen: string[] = [];
  const items: GlassMenuItem[] = [
    { label: 'Open', onSelect: () => chosen.push('open') },
    { label: 'Duplicate', shortcut: '⌘D', onSelect: () => chosen.push('duplicate') },
    'separator',
    { label: 'Delete', onSelect: () => chosen.push('delete'), disabled: true },
    { label: 'Details', onSelect: () => chosen.push('details') },
  ];
  const view = render(<GlassMenu label="Plate actions" trigger={<button type="button">Plate</button>} items={items} />);
  const trigger = view.getByRole('button', { name: 'Plate' });
  const focused = () => document.activeElement?.textContent;
  const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k });
  return { ...view, trigger, chosen, focused, key };
}

it('is a menu button: ArrowDown opens on the first item, ArrowUp on the last', () => {
  const { trigger, getByRole, focused, key } = setup();
  expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  act(() => trigger.focus());
  key('ArrowDown');
  expect(getByRole('menu', { name: 'Plate actions' })).not.toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(focused()).toBe('Open');
  key('Escape');
  settle();
  expect(document.activeElement).toBe(trigger);
  key('ArrowUp');
  expect(focused()).toBe('Details');
});

it('moves with the arrows, skipping separators and disabled items, and wraps', () => {
  const { trigger, focused, key } = setup();
  fireEvent.click(trigger);
  expect(focused()).toBe('Open');
  key('ArrowDown');
  expect(focused()).toBe('Duplicate⌘D');
  key('ArrowDown');
  expect(focused()).toBe('Details');
  key('ArrowDown');
  expect(focused()).toBe('Open');
  key('ArrowUp');
  expect(focused()).toBe('Details');
  key('Home');
  expect(focused()).toBe('Open');
  key('End');
  expect(focused()).toBe('Details');
});

it('jumps to items by their first letter', () => {
  const { trigger, focused, key } = setup();
  fireEvent.click(trigger);
  key('d');
  expect(focused()).toBe('Duplicate⌘D');
  key('d');
  expect(focused()).toBe('Details');
  act(() => vi.advanceTimersByTime(600));
  key('o');
  expect(focused()).toBe('Open');
});

it('chooses an item, closes, and gives focus back', () => {
  const { trigger, getByRole, chosen } = setup();
  fireEvent.click(trigger);
  fireEvent.click(getByRole('menuitem', { name: /Duplicate/ }));
  expect(chosen).toEqual(['duplicate']);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  settle();
  expect(document.activeElement).toBe(trigger);
});

it('marks roles and disabled items, and never chooses a disabled one', () => {
  const { trigger, getAllByRole, getByRole, chosen } = setup();
  fireEvent.click(trigger);
  expect(getAllByRole('menuitem')).toHaveLength(4);
  expect(getAllByRole('separator')).toHaveLength(1);
  const remove = getByRole('menuitem', { name: 'Delete' });
  expect(remove.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(remove);
  expect(chosen).toEqual([]);
});

it('closes on Tab', () => {
  const { trigger, key } = setup();
  fireEvent.click(trigger);
  key('Tab');
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/menu.test.tsx`
Expected: FAIL, because `GlassMenu` is not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassMenu.tsx
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { GlassPlacement } from '../core/place';
import type { SpringInput } from '../core/spring';
import { useAnchor } from './anchor';
import { Glass, type GlassProps } from './Glass';
import { GlassIndicator } from './GlassIndicator';
import { fallbackStyle, useOpenState, useOverlay, usePopoverSupport } from './overlay';
import { useTrigger } from './trigger';

/** One entry of a `GlassMenu`: an action, or `'separator'`. */
export type GlassMenuItem =
  | {
      /** What the item says. */
      label: ReactNode;
      /** Runs when the item is chosen, as the menu starts to close. */
      onSelect: () => void;
      /** Shown, but can't be chosen, and the arrow keys skip it. */
      disabled?: boolean;
      /** Decorative, before the label. */
      icon?: ReactNode;
      /** Shown after the label. Bind the key yourself. */
      shortcut?: string;
      /** Text for type-to-jump, when `label` isn't plain text. */
      textValue?: string;
    }
  | 'separator';

export interface GlassMenuProps extends Omit<GlassProps<'div'>, 'as' | 'children' | 'appear' | 'optics' | 'interactive'> {
  /** Accessible name of the menu. */
  label: string;
  /** The button that opens it. It must pass its ref through. */
  trigger: ReactElement;
  /** The actions, top to bottom. */
  items: readonly GlassMenuItem[];
  /** Default `'bottom-start'`. It flips where there's no room. */
  placement?: GlassPlacement;
  /** Gap from the trigger, px. Default 6. */
  offset?: number;
  /** Open, controlled. Pair it with `onOpenChange`. */
  open?: boolean;
  /** Open at first, uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the requested state. */
  onOpenChange?: (open: boolean) => void;
  /** The spring for its entrance and exit. Default `'snappy'`. */
  physics?: SpringInput;
}

const SURFACE: CSSProperties = { border: 0, padding: 6, minWidth: '12rem', display: 'grid', gap: 2, color: 'inherit', boxSizing: 'border-box', overflow: 'visible' };
const ITEM: CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: '0.6em',
  width: '100%',
  minHeight: 32,
  padding: '0.5em 0.75em',
  border: 0,
  borderRadius: 10,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'start',
  cursor: 'default',
  outline: 'none',
};
const DISABLED: CSSProperties = { ...ITEM, opacity: 0.45 };
const SEPARATOR: CSSProperties = { height: 1, margin: '4px 8px', background: 'currentColor', opacity: 0.15 };
const SHORTCUT: CSSProperties = { marginInlineStart: 'auto', paddingInlineStart: '1.5em', opacity: 0.6, fontSize: '0.85em', fontFamily: 'inherit' };
const SWELL: CSSProperties = { scale: 'calc(0.96 + 0.04 * var(--meniscus-presence, 1))' };
const HIGHLIGHT = 'var(--meniscus-menu-highlight, light-dark(rgb(15 20 26 / 0.08), rgb(255 255 255 / 0.16)))';

type Action = Exclude<GlassMenuItem, 'separator'>;
const textOf = (item: Action) => (item.textValue ?? (typeof item.label === 'string' ? item.label : '')).toLowerCase();

/**
 * A menu of actions from a button, in glass. It follows the WAI-ARIA menu
 * button pattern: the arrow keys, Home, End and the first letter of an item
 * move through it; Enter chooses; Escape closes and gives focus back. A glass
 * highlight flows from item to item.
 */
export function GlassMenu({ label, trigger, items, placement = 'bottom-start', offset = 6, open: openProp, defaultOpen, onOpenChange, physics = 'snappy', radius = 16, style, ...glass }: GlassMenuProps) {
  const id = `meniscus-menu-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [open, setOpen] = useOpenState(openProp, defaultOpen, onOpenChange);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(-1);
  const supported = usePopoverSupport();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const start = useRef<'first' | 'last'>('first');
  const typed = useRef({ text: '', at: -Infinity });
  const overlay = useOverlay(surface, {
    open,
    onRequestClose: () => setOpen(false),
    kind: 'popover',
    physics,
    trigger: anchor,
    dismiss: { escape: true, outside: true, focusOut: true },
    inside: () => [anchor],
  });
  const position = useAnchor(anchor, surface, overlay.shown, { placement, offset });

  const enabled = items.flatMap((item, i) => (item !== 'separator' && !item.disabled ? [i] : []));
  const focusItem = (i: number | undefined) => {
    if (i === undefined) return;
    setActive(i);
    buttons.current[i]?.focus({ preventScroll: true });
  };
  const openAt = (where: 'first' | 'last') => {
    start.current = where;
    setOpen(true);
  };

  // Opening focuses the first or last item; after that the keys move focus.
  useEffect(() => {
    if (!open) {
      setActive(-1);
      return;
    }
    if (overlay.shown) focusItem(start.current === 'last' ? enabled[enabled.length - 1] : enabled[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, overlay.shown]);

  const move = (step: 1 | -1) => {
    if (!enabled.length) return;
    const at = enabled.indexOf(active);
    const next = at < 0 ? (step > 0 ? 0 : enabled.length - 1) : (at + step + enabled.length) % enabled.length;
    focusItem(enabled[next]);
  };

  const choose = (i: number) => {
    const item = items[i];
    if (!item || item === 'separator' || item.disabled) return;
    setOpen(false);
    item.onSelect();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown') move(1);
    else if (e.key === 'ArrowUp') move(-1);
    else if (e.key === 'Home') focusItem(enabled[0]);
    else if (e.key === 'End') focusItem(enabled[enabled.length - 1]);
    else if (e.key === 'Tab') {
      setOpen(false);
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = performance.now();
      const t = typed.current;
      t.text = now - t.at > 500 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      // The same letter again moves to the next item starting with it.
      const search = /^(.)\1+$/.test(t.text) ? t.text[0]! : t.text;
      const from = enabled.indexOf(active);
      const order = [...enabled.slice(from + 1), ...enabled.slice(0, from + 1)];
      focusItem(order.find((i) => textOf(items[i] as Action).startsWith(search)));
    } else return;
    e.preventDefault();
  };

  const triggerNode = useTrigger(
    trigger,
    {
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-controls': id,
      onClick: () => (open ? setOpen(false) : openAt('first')),
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        openAt(e.key === 'ArrowUp' ? 'last' : 'first');
      },
    },
    setAnchor,
  );

  return (
    <>
      {triggerNode}
      <Glass
        {...glass}
        ref={setSurface}
        id={id}
        role="menu"
        aria-label={label}
        popover="manual"
        radius={radius}
        optics={overlay.optics}
        onKeyDown={onMenuKey}
        style={{ ...SURFACE, ...position, ...(overlay.reducedMotion ? null : SWELL), ...fallbackStyle(supported, overlay.shown), ...style }}
      >
        <GlassIndicator target={active >= 0 ? (buttons.current[active] ?? null) : null} radius={10} shadow={false} tint={HIGHLIGHT} />
        {items.map((item, i) =>
          item === 'separator' ? (
            <div key={`separator-${i}`} role="separator" style={SEPARATOR} />
          ) : (
            <button
              key={i}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={i === active ? 0 : -1}
              aria-disabled={item.disabled || undefined}
              onClick={() => choose(i)}
              onPointerMove={() => {
                if (!item.disabled && active !== i) focusItem(i);
              }}
              style={item.disabled ? DISABLED : ITEM}
            >
              {item.icon ? (
                <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
              {item.shortcut ? <kbd style={SHORTCUT}>{item.shortcut}</kbd> : null}
            </button>
          ),
        )}
      </Glass>
    </>
  );
}

GlassMenu.displayName = 'GlassMenu';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassMenu, type GlassMenuProps, type GlassMenuItem } from './react/GlassMenu';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/menu.test.tsx && pnpm typecheck`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassMenu.tsx packages/meniscus/src/index.ts packages/meniscus/test/menu.test.tsx
git commit -m "feat: GlassMenu, a menu button with a flowing glass highlight"
```

### Task 16: `toast()` and `GlassToaster`

**Files:**
- Create: `packages/meniscus/src/react/GlassToast.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/toast.test.tsx`

**Interfaces:**
- Consumes: `FADE` and `usePopoverSupport`, with `fallbackStyle` (Task 8), `useDragDismiss` (Task 11), `useGlassPhysics`, `Glass`, `presenceOpacity`.
- Produces:
  - `interface ToastAction { label: string; onClick: () => void }`
  - `interface ToastOptions { description?: ReactNode; action?: ToastAction; duration?: number; id?: string }`
  - `const toast: ((message: ReactNode, options?: ToastOptions) => string) & { dismiss(id?: string): void }`
  - `interface GlassToasterProps extends GlassOptions { placement?: 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'; label?: string; max?: number; physics?: SpringInput; className?: string; style?: CSSProperties }`
  - `GlassToaster`

  The spec's §3.5 has `GlassToasterProps` extend `GlassProps<'div'>`. It takes `GlassOptions` plus `className` and `style` instead: those all go to each toast, and element props on the region itself would do nothing useful.

- [ ] **Step 1: Write the failing test** (includes Review Focus 5)

```tsx
// packages/meniscus/test/toast.test.tsx
// (the Phase 3 preamble goes here; also import `within` from '@testing-library/react')
import { within } from '@testing-library/react';
import { GlassToaster, toast } from '../src';

afterEach(() => {
  act(() => toast.dismiss());
});

const regionOf = (view: ReturnType<typeof render>) => view.getByRole('region', { name: 'Notifications' });
const texts = (region: HTMLElement) => within(region).queryAllByRole('listitem').map((li) => li.querySelector('strong')!.textContent);

it('shows a toast with its description and action, announces it, and shows the region', () => {
  const undo = vi.fn();
  const view = render(<GlassToaster />);
  act(() => {
    toast('Plate saved', { description: 'In your collection.', action: { label: 'Undo', onClick: undo } });
  });
  const region = regionOf(view);
  expect(texts(region)).toEqual(['Plate saved']);
  expect(region.hasAttribute('data-test-popover-open')).toBe(true);
  expect(view.getByRole('status').textContent).toBe('Plate saved In your collection.');
  fireEvent.click(within(region).getByRole('button', { name: 'Undo' }));
  expect(undo).toHaveBeenCalledOnce();
  settle();
  expect(texts(region)).toEqual([]);
  expect(region.hasAttribute('data-test-popover-open')).toBe(false);
});

it('leaves after its duration, pauses while hovered, and Infinity stays', () => {
  const view = render(<GlassToaster />);
  act(() => {
    toast('Short', { duration: 1000 });
    toast('Forever', { duration: Infinity });
  });
  const region = regionOf(view);
  fireEvent.pointerEnter(region);
  act(() => vi.advanceTimersByTime(3000));
  expect(texts(region)).toEqual(['Short', 'Forever']);
  fireEvent.pointerLeave(region);
  act(() => vi.advanceTimersByTime(1100));
  settle();
  expect(texts(region)).toEqual(['Forever']);
});

it('shows three at most, newest last; the rest wait their turn', () => {
  const view = render(<GlassToaster />);
  let ids: string[] = [];
  act(() => {
    ids = ['One', 'Two', 'Three', 'Four'].map((n) => toast(n, { duration: Infinity }));
  });
  const region = regionOf(view);
  expect(texts(region)).toEqual(['Two', 'Three', 'Four']);
  act(() => toast.dismiss(ids[3]));
  settle();
  expect(texts(region)).toEqual(['One', 'Two', 'Three']);
});

it('replaces a toast that reuses an id, in place', () => {
  const view = render(<GlassToaster />);
  act(() => {
    toast('Uploading…', { id: 'upload', duration: Infinity });
    toast('Uploaded', { id: 'upload', duration: Infinity });
  });
  expect(texts(regionOf(view))).toEqual(['Uploaded']);
});

it('can be dismissed from its own button', () => {
  const view = render(<GlassToaster />);
  act(() => {
    toast('Plate saved', { duration: Infinity });
  });
  fireEvent.click(view.getByRole('button', { name: 'Dismiss notification' }));
  settle();
  expect(texts(regionOf(view))).toEqual([]);
});

it('keeps toasts made before any toaster mounts, and starts their clocks on mount', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => {
    toast('Early', { duration: 1000 });
  });
  act(() => vi.advanceTimersByTime(5000));
  expect(warn.mock.calls.some(([m]) => String(m).includes('GlassToaster'))).toBe(true);
  const view = render(<GlassToaster />);
  const region = regionOf(view);
  expect(texts(region)).toEqual(['Early']);
  act(() => vi.advanceTimersByTime(1100));
  settle();
  expect(texts(region)).toEqual([]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/toast.test.tsx`
Expected: FAIL, because `GlassToaster` and `toast` are not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassToast.tsx
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { GlassOptions } from '../core/glass';
import { presenceOpacity } from '../core/physics';
import type { SpringInput } from '../core/spring';
import { DEV } from './dev';
import { useDragDismiss } from './drag';
import { Glass } from './Glass';
import { useGlassPreferences, useIsomorphicLayoutEffect } from './hooks';
import { FADE, fallbackStyle, usePopoverSupport } from './overlay';
import { useGlassPhysics } from './useGlassPhysics';

/** A button on a toast. Choosing it dismisses the toast. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** A second line under the message. */
  description?: ReactNode;
  /** One action, such as Undo. */
  action?: ToastAction;
  /** How long it stays, ms. Default 5000. `Infinity` keeps it until dismissed. Hovering or focusing the toasts pauses the clock. */
  duration?: number;
  /** Reuse an id to replace a toast in place, such as a progress message. */
  id?: string;
}

interface ToastRecord {
  id: string;
  message: ReactNode;
  description?: ReactNode;
  action?: ToastAction;
  duration: number;
}

const EMPTY: readonly ToastRecord[] = [];
let queue: readonly ToastRecord[] = EMPTY;
const listeners = new Set<() => void>();
let serial = 0;
let mounted = 0;
let warnedMissing = false;
let warnedMany = false;

function emit(): void {
  for (const listener of Array.from(listeners)) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function show(message: ReactNode, options: ToastOptions = {}): string {
  const id = options.id ?? `meniscus-toast-${++serial}`;
  // A server has no page to show it on, and must not keep state between requests.
  if (typeof window === 'undefined') return id;
  const record: ToastRecord = { id, message, description: options.description, action: options.action, duration: options.duration ?? 5000 };
  const at = queue.findIndex((t) => t.id === id);
  queue = at >= 0 ? queue.map((t, i) => (i === at ? record : t)) : [...queue, record];
  emit();
  if (DEV && mounted === 0 && !warnedMissing) {
    // Checked a moment later, so a toaster mounting in the same update still counts.
    setTimeout(() => {
      if (mounted > 0 || warnedMissing) return;
      warnedMissing = true;
      console.warn('meniscus: toast() was called with no <GlassToaster> on the page. Render one near the root; the toast shows once it mounts.');
    }, 0);
  }
  return id;
}

function dismiss(id?: string): void {
  if (id === undefined) {
    if (!queue.length) return;
    queue = EMPTY;
  } else {
    if (!queue.some((t) => t.id === id)) return;
    queue = queue.filter((t) => t.id !== id);
  }
  emit();
}

/**
 * Shows a toast in the page's `GlassToaster` and returns its id.
 * `toast.dismiss(id)` removes one toast; `toast.dismiss()` removes them all.
 * Toasts made before a toaster mounts wait for it.
 */
export const toast: ((message: ReactNode, options?: ToastOptions) => string) & { dismiss: (id?: string) => void } = Object.assign(show, { dismiss });

type Placement = 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';

export interface GlassToasterProps extends GlassOptions {
  /** Where toasts gather. Default `'bottom'`. */
  placement?: Placement;
  /** Accessible name of the region. Default `'Notifications'`. */
  label?: string;
  /** How many show at once. Older ones wait their turn. Default 3. */
  max?: number;
  /** The spring toasts arrive and leave on. Default `'bouncy'`. */
  physics?: SpringInput;
  /** Class for every toast. */
  className?: string;
  /** Style for every toast. */
  style?: CSSProperties;
}

const REGION_BASE: CSSProperties = {
  position: 'fixed',
  inset: 'auto',
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  overflow: 'visible',
  width: 'min(24rem, calc(100vw - 2rem))',
  maxHeight: 'none',
};
const REGION: Readonly<Record<Placement, CSSProperties>> = {
  bottom: { bottom: 16, left: '50%', translate: '-50% 0' },
  'bottom-start': { bottom: 16, left: 16 },
  'bottom-end': { bottom: 16, right: 16 },
  top: { top: 16, left: '50%', translate: '-50% 0' },
  'top-start': { top: 16, left: 16 },
  'top-end': { top: 16, right: 16 },
};
const LIST: CSSProperties = { display: 'flex', gap: 8, margin: 0, padding: 0, listStyle: 'none' };
const TOAST: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.75rem 0.75rem 1rem', boxSizing: 'border-box', touchAction: 'pan-y' };
const TEXT: CSSProperties = { display: 'grid', gap: 2, flex: 1, minWidth: 0 };
const DESCRIPTION: CSSProperties = { fontSize: '0.9em', opacity: 0.75 };
const BUTTON: CSSProperties = { border: 0, borderRadius: 9999, padding: '0.4em 0.8em', background: 'color-mix(in srgb, currentColor 12%, transparent)', color: 'inherit', font: 'inherit', cursor: 'pointer' };
const CLOSE: CSSProperties = { ...BUTTON, display: 'grid', placeItems: 'center', width: 28, height: 28, padding: 0 };
const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };

interface ToastItemProps {
  record: ToastRecord;
  leaving: boolean;
  paused: boolean;
  onLeft: (id: string) => void;
  physics: SpringInput;
  glass: GlassOptions;
  className?: string;
  style?: CSSProperties;
  top: boolean;
}

function ToastItem({ record, leaving, paused, onLeft, physics, glass, className, style, top }: ToastItemProps) {
  const { reducedMotion } = useGlassPreferences();
  const optics = useGlassPhysics({ physics: reducedMotion ? FADE : physics, initial: { presence: 0, shadow: 0 }, reducedMotion: false });
  const [el, setEl] = useState<HTMLElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!leaving) {
      optics.to({ presence: 1, shadow: 1 });
      return;
    }
    optics.to({ presence: 0, shadow: 0 });
    let done = false;
    const off = optics.subscribe((s) => {
      if (done || presenceOpacity(Math.max(0, s.presence)) > 0) return;
      done = true;
      onLeft(record.id);
    });
    return () => {
      done = true;
      off();
    };
  }, [leaving, optics, onLeft, record.id]);

  // The clock runs while the toast shows and nobody is reading the toasts.
  const remaining = useRef(record.duration);
  useEffect(() => {
    remaining.current = record.duration;
  }, [record]);
  useEffect(() => {
    if (leaving || paused || !Number.isFinite(remaining.current)) return;
    const started = Date.now();
    const timer = window.setTimeout(() => toast.dismiss(record.id), Math.max(0, remaining.current));
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [leaving, paused, record]);

  const drag = useDragDismiss(el, { axis: 'x', direction: 0, fraction: 0.4, enabled: !leaving, reducedMotion, onDismiss: () => toast.dismiss(record.id) });
  const motion: CSSProperties | null = reducedMotion
    ? null
    : { translate: `var(--meniscus-drag, 0px) calc((1 - var(--meniscus-presence, 1)) * ${top ? -16 : 16}px)`, scale: 'calc(0.92 + 0.08 * var(--meniscus-presence, 1))' };
  return (
    <Glass as="li" {...glass} {...drag} ref={setEl} optics={optics} className={className} style={{ ...TOAST, ...motion, ...style }}>
      <div style={TEXT}>
        <strong>{record.message}</strong>
        {record.description ? <span style={DESCRIPTION}>{record.description}</span> : null}
      </div>
      {record.action ? (
        <button
          type="button"
          style={BUTTON}
          onClick={() => {
            record.action!.onClick();
            toast.dismiss(record.id);
          }}
        >
          {record.action.label}
        </button>
      ) : null}
      <button type="button" aria-label="Dismiss notification" style={CLOSE} onClick={() => toast.dismiss(record.id)}>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </Glass>
  );
}

/**
 * Where `toast()` messages appear: render one near the root. Toasts arrive
 * on a spring, stack three at a time, pause while read, and swipe away.
 * Screen readers hear each new message without interruption. The region
 * shows in the top layer, lifted above any modal opened since.
 */
export function GlassToaster({ placement = 'bottom', label = 'Notifications', max = 3, physics = 'bouncy', className, style, ...glass }: GlassToasterProps) {
  const toasts = useSyncExternalStore(subscribe, () => queue, () => EMPTY);
  const supported = usePopoverSupport();
  const [region, setRegion] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [leaving, setLeaving] = useState<readonly ToastRecord[]>(EMPTY);
  const [announced, setAnnounced] = useState<ToastRecord | null>(null);
  const previous = useRef<readonly ToastRecord[]>(EMPTY);
  const seen = useRef(new Set<string>());
  const shown = useRef(false);
  const visible = toasts.slice(-Math.max(1, max));

  useEffect(() => {
    mounted++;
    if (DEV && mounted > 1 && !warnedMany) {
      warnedMany = true;
      console.warn('meniscus: more than one <GlassToaster> is mounted, and each shows every toast. Render one near the root.');
    }
    return () => {
      mounted--;
    };
  }, []);

  // A shown toast that was dismissed stays until its exit fades; new ones are announced.
  useIsomorphicLayoutEffect(() => {
    const ids = new Set(toasts.map((t) => t.id));
    const gone = previous.current.filter((t) => !ids.has(t.id));
    previous.current = visible;
    if (gone.length) setLeaving((l) => [...l, ...gone.filter((g) => !l.some((x) => x.id === g.id))]);
    const fresh = [...toasts].reverse().find((t) => !seen.current.has(t.id));
    seen.current = ids;
    if (fresh) setAnnounced(fresh);
  }, [toasts]);
  const onLeft = useCallback((id: string) => setLeaving((l) => l.filter((t) => t.id !== id)), []);

  const any = visible.length + leaving.length > 0;
  const newest = toasts[toasts.length - 1]?.id;
  // Shown while there are toasts. Each change shows it again, which lifts it above any modal opened since.
  useIsomorphicLayoutEffect(() => {
    if (!region || !supported) return;
    if (shown.current) {
      try {
        region.hidePopover();
      } catch {
        // Already hidden.
      }
      shown.current = false;
    }
    if (!any) return;
    region.showPopover();
    shown.current = true;
  }, [region, supported, any, newest]);

  const top = placement.startsWith('top');
  const rendered = [...leaving.filter((l) => !visible.some((v) => v.id === l.id)), ...visible];
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" style={HIDDEN}>
        {announced ? (
          <>
            {announced.message}
            {announced.description ? <> {announced.description}</> : null}
          </>
        ) : null}
      </div>
      <section
        ref={setRegion}
        aria-label={label}
        popover="manual"
        data-meniscus-toaster=""
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        style={{ ...REGION_BASE, ...REGION[placement], ...fallbackStyle(supported, any) }}
      >
        <ol style={{ ...LIST, flexDirection: top ? 'column-reverse' : 'column' }}>
          {rendered.map((t) => (
            <ToastItem
              key={t.id}
              record={t}
              leaving={leaving.some((l) => l.id === t.id)}
              paused={hovered || focused}
              onLeft={onLeft}
              physics={physics}
              glass={glass}
              className={className}
              style={style}
              top={top}
            />
          ))}
        </ol>
      </section>
    </>
  );
}

GlassToaster.displayName = 'GlassToaster';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassToaster, toast, type GlassToasterProps, type ToastOptions, type ToastAction } from './react/GlassToast';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/toast.test.tsx && pnpm typecheck`
Expected: PASS, 6 tests. The status text in the first test is `Plate saved In your collection.`: the fragment puts a space before the description.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassToast.tsx packages/meniscus/src/index.ts packages/meniscus/test/toast.test.tsx
git commit -m "feat: toast() and GlassToaster, glass messages that arrive on a spring and wait to be read"
```

---

## Phase 4: Layout

### Task 17: `GlassNavbar`

**Files:**
- Create: `packages/meniscus/src/react/GlassNavbar.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/navbar.test.tsx`

**Interfaces:**
- Consumes: `useGlassPhysics`, `useGlassDefaults` (from `./context`), `useMergedRef`, and the adaptive appearance (Task 6).
- Produces: `interface GlassNavbarProps extends Omit<GlassProps<'nav'>, 'as' | 'optics'> { label: string; inset?: number; scrollEdge?: boolean }`, and `GlassNavbar`, which forwards its ref to the `<nav>`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/navbar.test.tsx
// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { GlassNavbar, GlassProvider } from '../src';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.elementsFromPoint = (() => []) as unknown as typeof document.elementsFromPoint;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  document.body.innerHTML = '';
});

const settle = () => act(() => { for (let i = 0; i < 90; i++) vi.advanceTimersByTime(16); });
const tintOf = (el: HTMLElement) => Number(el.style.getPropertyValue('--meniscus-tint'));

it('is a named, sticky navigation capsule, and forwards its ref', () => {
  const ref = { current: null as HTMLElement | null };
  const { getByRole } = render(<GlassNavbar ref={ref} label="Main"><a href="#plates">Plates</a></GlassNavbar>);
  const nav = getByRole('navigation', { name: 'Main' });
  expect(ref.current).toBe(nav);
  expect(nav.style.position).toBe('sticky');
  expect(nav.style.top).toBe('12px');
  expect(nav.style.borderRadius).toBe('9999px');
});

it('stays clear at the top of the page and deepens once content scrolls under it', () => {
  const { getByRole } = render(<GlassNavbar label="Main">Links</GlassNavbar>);
  const nav = getByRole('navigation', { name: 'Main' });
  settle();
  expect(tintOf(nav)).toBeCloseTo(0.35, 2);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
  settle();
  expect(tintOf(nav)).toBeCloseTo(1, 2);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
  settle();
  expect(tintOf(nav)).toBeCloseTo(0.35, 2);
});

it('follows what is behind it by default; a provider or prop appearance wins', () => {
  const dark = document.createElement('section');
  dark.style.backgroundColor = 'rgb(0, 0, 0)';
  document.body.appendChild(dark);
  document.elementsFromPoint = (() => [dark]) as unknown as typeof document.elementsFromPoint;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 48, x: 0, y: 0, right: 300, bottom: 48, toJSON() {} } as DOMRect);
  const adaptive = render(<GlassNavbar label="Main">Links</GlassNavbar>);
  expect(adaptive.getByRole('navigation').getAttribute('data-meniscus-tone')).toBe('dark');
  adaptive.unmount();
  const provided = render(<GlassProvider appearance="light"><GlassNavbar label="Main">Links</GlassNavbar></GlassProvider>);
  expect(provided.getByRole('navigation').hasAttribute('data-meniscus-tone')).toBe(false);
  provided.unmount();
  const own = render(<GlassNavbar label="Main" appearance="dark">Links</GlassNavbar>);
  expect(own.getByRole('navigation').hasAttribute('data-meniscus-tone')).toBe(false);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/navbar.test.tsx`
Expected: FAIL, because `GlassNavbar` is not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassNavbar.tsx
import { forwardRef, useEffect, useState, type CSSProperties } from 'react';
import { useGlassDefaults } from './context';
import { Glass, type GlassProps } from './Glass';
import { useMergedRef } from './refs';
import { useGlassPhysics } from './useGlassPhysics';

export interface GlassNavbarProps extends Omit<GlassProps<'nav'>, 'as' | 'optics'> {
  /** Accessible name of the navigation landmark, such as "Main". */
  label: string;
  /** Gap from the top of its scroll container while stuck, and from each side, px. Default 12. */
  inset?: number;
  /** Clear at the top of the page, with deeper tint and shadow once content scrolls under it. Default true. */
  scrollEdge?: boolean;
}

const AT_TOP = { tint: 0.35, shadow: 0.4 };
const UNDER = { tint: 1, shadow: 1 };
/** Scrolled further than this, px, content is under the bar. */
const EDGE = 4;

function bar(inset: number): CSSProperties {
  return {
    position: 'sticky',
    top: inset,
    marginInline: inset,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.5rem 0.75rem 0.5rem 1.25rem',
    boxSizing: 'border-box',
  };
}

/** The nearest ancestor that scrolls, or null for the page itself. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/**
 * A sticky navigation bar of glass. It stays clear over the top of the page,
 * then its tint and shadow deepen on their springs once content scrolls
 * under it, with no re-render and no rebuilt maps. By default it follows
 * what's behind it (`appearance="adaptive"`) unless a provider or prop says
 * otherwise.
 */
export const GlassNavbar = forwardRef<HTMLElement, GlassNavbarProps>(function GlassNavbar(
  { label, inset = 12, scrollEdge = true, radius = 'capsule', appearance, style, ...props },
  ref,
) {
  const defaults = useGlassDefaults();
  const optics = useGlassPhysics({ initial: scrollEdge ? AT_TOP : undefined });
  const [node, setNode] = useState<HTMLElement | null>(null);
  const setRef = useMergedRef(ref, setNode);

  useEffect(() => {
    if (!scrollEdge || !node) return;
    const scroller = scrollParent(node);
    const read = () => (scroller ? scroller.scrollTop : window.scrollY);
    let under = read() > EDGE;
    optics.to(under ? UNDER : AT_TOP);
    const onScroll = () => {
      const next = read() > EDGE;
      if (next === under) return;
      under = next;
      optics.to(next ? UNDER : AT_TOP);
    };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [node, scrollEdge, optics]);

  return (
    <Glass
      {...props}
      as="nav"
      ref={setRef}
      aria-label={label}
      radius={radius}
      appearance={appearance ?? defaults.appearance ?? 'adaptive'}
      optics={scrollEdge ? optics : undefined}
      style={{ ...bar(inset), ...style }}
    />
  );
});

GlassNavbar.displayName = 'GlassNavbar';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassNavbar, type GlassNavbarProps } from './react/GlassNavbar';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/navbar.test.tsx && pnpm typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassNavbar.tsx packages/meniscus/src/index.ts packages/meniscus/test/navbar.test.tsx
git commit -m "feat: GlassNavbar, a sticky bar that deepens as content scrolls under it"
```

### Task 18: `GlassSidebar`

**Files:**
- Create: `packages/meniscus/src/react/GlassSidebar.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/sidebar.test.tsx`

**Interfaces:**
- Consumes: `GlassDialog` (Task 12), and the existing `useMediaQuery` from `./hooks`, whose server snapshot is false.
- Produces: `interface GlassSidebarProps extends Omit<GlassProps<'aside'>, 'as'> { label: string; as?: 'aside' | 'nav'; collapseBelow?: number; side?: 'left' | 'right'; inset?: number; open?; defaultOpen?; onOpenChange? }`, and `GlassSidebar`. On wide screens the column carries `data-meniscus-sidebar`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/sidebar.test.tsx
// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { GlassSidebar } from '../src';

function viewport(narrow: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('is a sticky glass column on wide screens, hidden by a media query below its breakpoint', () => {
  viewport(false);
  const { getByRole, container } = render(<GlassSidebar label="Library"><a href="#plates">Plates</a></GlassSidebar>);
  const aside = getByRole('complementary', { name: 'Library' });
  expect(aside.style.position).toBe('sticky');
  expect(container.querySelector('style')!.textContent).toContain('@media (max-width: 767.98px)');
  expect(container.querySelector('style')!.textContent).toContain(`[data-meniscus-sidebar="${aside.getAttribute('data-meniscus-sidebar')}"]`);
  expect(container.querySelector('dialog')).toBeNull();
});

it('becomes a drawer on narrow screens, keeping its landmark inside', () => {
  viewport(true);
  const { container, getByRole, rerender } = render(
    <GlassSidebar label="Library" as="nav" open={false}>
      <a href="#plates">Plates</a>
    </GlassSidebar>,
  );
  const dialog = container.querySelector('dialog')!;
  expect(dialog.getAttribute('aria-label')).toBe('Library');
  expect(dialog.open).toBe(false);
  rerender(
    <GlassSidebar label="Library" as="nav" open>
      <a href="#plates">Plates</a>
    </GlassSidebar>,
  );
  expect(dialog.open).toBe(true);
  expect(getByRole('navigation', { name: 'Library' }).closest('dialog')).toBe(dialog);
});

it('never collapses with collapseBelow 0', () => {
  viewport(true);
  const { container } = render(<GlassSidebar label="Library" collapseBelow={0}>Links</GlassSidebar>);
  expect(container.querySelector('dialog')).toBeNull();
  expect(container.querySelector('style')).toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/sidebar.test.tsx`
Expected: FAIL, because `GlassSidebar` is not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassSidebar.tsx
import { createElement, useId, type CSSProperties } from 'react';
import { Glass, type GlassProps } from './Glass';
import { GlassDialog } from './GlassDialog';
import { useMediaQuery } from './hooks';

export interface GlassSidebarProps extends Omit<GlassProps<'aside'>, 'as'> {
  /** Accessible name of the landmark, and of the drawer it becomes. */
  label: string;
  /** `aside` (the default), or `nav` for a sidebar of links. */
  as?: 'aside' | 'nav';
  /** Below this viewport width, px, it becomes a drawer. Default 768. 0 never collapses. */
  collapseBelow?: number;
  /** The side the drawer opens from. Default `'left'`. */
  side?: 'left' | 'right';
  /** Gap from the viewport's edges, px. Default 12. */
  inset?: number;
  /** The drawer's open state, controlled. Ignored while it is a column. */
  open?: boolean;
  /** The drawer starts open, uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the drawer's requested state. */
  onOpenChange?: (open: boolean) => void;
}

function column(inset: number): CSSProperties {
  return { position: 'sticky', top: inset, height: `calc(100dvh - ${2 * inset}px)`, width: '16rem', flex: 'none', overflow: 'auto', padding: '1rem', boxSizing: 'border-box' };
}

/**
 * A sidebar of glass. On wide screens it is a sticky column. Below
 * `collapseBelow` it is a `GlassDialog` drawer, opened through `open`, with
 * the same children inside the same landmark. The server and hydration
 * render the column, and a media query hides it on narrow screens before
 * any JavaScript runs, so phones never see it flash. The children remount
 * when the layout switches.
 */
export function GlassSidebar({ label, as = 'aside', collapseBelow = 768, side = 'left', inset = 12, open, defaultOpen, onOpenChange, style, className, children, ...glass }: GlassSidebarProps) {
  const key = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const query = collapseBelow > 0 ? `(max-width: ${collapseBelow - 0.02}px)` : 'not all';
  const narrow = useMediaQuery(query);

  if (narrow) {
    return (
      <GlassDialog {...glass} label={label} placement={side} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} className={className} style={style}>
        {createElement(as, { 'aria-label': label }, children)}
      </GlassDialog>
    );
  }
  return (
    <>
      {collapseBelow > 0 ? <style>{`@media ${query}{[data-meniscus-sidebar="${key}"]{display:none!important}}`}</style> : null}
      <Glass {...glass} as={as as 'aside'} aria-label={label} data-meniscus-sidebar={key} className={className} style={{ ...column(inset), ...style }}>
        {children}
      </Glass>
    </>
  );
}

GlassSidebar.displayName = 'GlassSidebar';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassSidebar, type GlassSidebarProps } from './react/GlassSidebar';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/sidebar.test.tsx && pnpm typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassSidebar.tsx packages/meniscus/src/index.ts packages/meniscus/test/sidebar.test.tsx
git commit -m "feat: GlassSidebar, a glass column that becomes a drawer on narrow screens"
```

---

## Phase 5: Controls

### Task 19: `GlassSwitch`

**Files:**
- Create: `packages/meniscus/src/react/options.ts`
- Create: `packages/meniscus/src/react/GlassSwitch.tsx`
- Modify: `packages/meniscus/src/react/appear.ts` (export `springEasing`)
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/switch.test.tsx`

**Interfaces:**
- Consumes: `useGlassPhysics`, `focusVisible` (Task 8), `useMergedRef`, `GLASS_OPTION_KEYS`.
- Produces:
  - `splitGlassOptions<P extends object>(props: P): [GlassOptions, Omit<P, keyof GlassOptions>]` (in `./options`)
  - `springEasing(): string`, now exported from `./appear`
  - `interface GlassSwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'children'>, GlassOptions { label: string }`
  - `GlassSwitch`, which forwards its ref to the input

The spec's §3.8 says a release past the middle toggles through `input.click()`, and the click that follows a drag is swallowed. The implementation does that. The native input also has `pointer-events: none`, so the drag's own click lands on the label, where it can be canceled. A checkbox's own click can't be canceled cleanly: React would report a change the browser then undoes.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/switch.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassProvider, GlassSwitch } from '../src';
import { splitGlassOptions } from '../src/react/options';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () => act(() => { for (let i = 0; i < 90; i++) vi.advanceTimersByTime(16); });
const trackOf = (input: HTMLElement) => input.parentElement as HTMLElement;
const knobOf = (input: HTMLElement) => trackOf(input).querySelector('[data-meniscus]') as HTMLElement;
function sized(track: HTMLElement) {
  track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 52, height: 32, x: 0, y: 0, right: 52, bottom: 32, toJSON() {} }) as DOMRect;
}
function drag(track: HTMLElement, id: number, from: number, via: number, to: number) {
  fireEvent.pointerDown(track, { pointerId: id, button: 0, clientX: from });
  fireEvent.pointerMove(track, { pointerId: id, clientX: via });
  fireEvent.pointerMove(track, { pointerId: id, clientX: to });
  fireEvent.pointerUp(track, { pointerId: id, clientX: to });
}

it('is a native switch, named by its label, that toggles and submits', () => {
  const ref = { current: null as HTMLInputElement | null };
  const onChange = vi.fn();
  const { getByRole, getByText } = render(
    <form>
      <GlassSwitch ref={ref} label="Sound" name="sound" value="on" onChange={onChange} />
    </form>,
  );
  const input = getByRole('switch', { name: 'Sound' }) as HTMLInputElement;
  expect(ref.current).toBe(input);
  expect(input.type).toBe('checkbox');
  fireEvent.click(getByText('Sound'));
  expect(input.checked).toBe(true);
  expect(onChange).toHaveBeenCalledOnce();
  expect(new FormData(input.form!).get('sound')).toBe('on');
});

it('follows a controlled checked value, and keeps glass options off the input', () => {
  const { getByRole, rerender } = render(<GlassSwitch label="Sound" checked={false} tint="red" onChange={() => {}} />);
  const input = getByRole('switch') as HTMLInputElement;
  expect(input.checked).toBe(false);
  expect(input.hasAttribute('tint')).toBe(false);
  rerender(<GlassSwitch label="Sound" checked onChange={() => {}} />);
  expect(input.checked).toBe(true);
});

it('splits glass options from native props', () => {
  expect(splitGlassOptions({ tint: 'red', blur: undefined, name: 'sound', disabled: true })).toEqual([{ tint: 'red' }, { name: 'sound', disabled: true }]);
});

it('turns its knob into a clear lens while pressed', () => {
  const { getByRole } = render(<GlassSwitch label="Sound" />);
  const input = getByRole('switch');
  fireEvent.pointerDown(trackOf(input), { pointerId: 1, button: 0, clientX: 10 });
  settle();
  expect(Number(knobOf(input).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(0.15, 2);
  expect(knobOf(input).style.scale).toBe('1.35');
  fireEvent.pointerUp(trackOf(input), { pointerId: 1, clientX: 10 });
  settle();
  expect(Number(knobOf(input).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(1, 2);
});

it('toggles once when its knob is dragged across, and not when dragged back where it was', () => {
  const onChange = vi.fn();
  const { getByRole } = render(<GlassSwitch label="Sound" onChange={onChange} />);
  const input = getByRole('switch') as HTMLInputElement;
  const track = trackOf(input);
  sized(track);
  drag(track, 1, 8, 30, 48);
  expect(input.checked).toBe(true);
  expect(onChange).toHaveBeenCalledOnce();
  // The click a real pointer sends after the drag lands on the track, and is swallowed.
  fireEvent.click(track);
  expect(input.checked).toBe(true);
  act(() => vi.advanceTimersByTime(1));
  drag(track, 2, 48, 20, 44);
  expect(input.checked).toBe(true);
  expect(onChange).toHaveBeenCalledOnce();
});

it('ignores presses and drags while disabled, and doesn’t swell under reduced motion', () => {
  const onChange = vi.fn();
  const disabled = render(<GlassSwitch label="Sound" disabled onChange={onChange} />);
  const input = disabled.getByRole('switch') as HTMLInputElement;
  sized(trackOf(input));
  drag(trackOf(input), 1, 8, 30, 48);
  expect(input.checked).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
  disabled.unmount();
  const reduced = render(<GlassProvider reduceMotion><GlassSwitch label="Sound" /></GlassProvider>);
  const calm = reduced.getByRole('switch');
  fireEvent.pointerDown(trackOf(calm), { pointerId: 1, button: 0, clientX: 10 });
  expect(knobOf(calm).style.scale).toBe('1');
});
```

With the track 52 × 32, the knob is 27.2 px wide and the gap is 2.4 px, so the knob's travel is 20 px. A release at x 48 is well past the middle.

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/switch.test.tsx`
Expected: FAIL, because `GlassSwitch` is not exported.

- [ ] **Step 3: Implement the option splitter and export the easing**

```ts
// packages/meniscus/src/react/options.ts
import { GLASS_OPTION_KEYS } from '../core/constants';
import type { GlassOptions } from '../core/glass';

/** Splits a control's props: glass options for its glass part, the rest for its native element. */
export function splitGlassOptions<P extends object>(props: P): [GlassOptions, Omit<P, keyof GlassOptions>] {
  const glass: Record<string, unknown> = {};
  const rest: Record<string, unknown> = { ...props };
  for (const key of GLASS_OPTION_KEYS) {
    if (!(key in rest)) continue;
    if (rest[key] !== undefined) glass[key] = rest[key];
    delete rest[key];
  }
  return [glass as GlassOptions, rest as Omit<P, keyof GlassOptions>];
}
```

In `packages/meniscus/src/react/appear.ts`, change `function springEasing(): string {` to `export function springEasing(): string {`.

- [ ] **Step 4: Implement the switch**

```tsx
// packages/meniscus/src/react/GlassSwitch.tsx
import { forwardRef, useCallback, useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type PointerEvent } from 'react';
import type { GlassOptions } from '../core/glass';
import { springEasing } from './appear';
import { focusVisible } from './focus';
import { Glass } from './Glass';
import { useGlassPreferences } from './hooks';
import { splitGlassOptions } from './options';
import { useMergedRef } from './refs';
import { useGlassPhysics } from './useGlassPhysics';

export interface GlassSwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'children'>, GlassOptions {
  /** Visible label. It also names the switch. */
  label: string;
}

const ROW: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.75em', minHeight: 24, color: 'inherit', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' };
const TRACK: CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  flex: 'none',
  width: '3.25em',
  height: '2em',
  borderRadius: 9999,
  boxSizing: 'border-box',
  transition: 'background-color 200ms ease',
  touchAction: 'none',
};
const OFF = 'light-dark(rgb(15 20 26 / 0.14), rgb(255 255 255 / 0.18))';
const ON = 'var(--meniscus-accent, #2563eb)';
/** The knob's travel: the track's width less the knob and both gaps. */
const TRAVEL = '1.25em';
const KNOB: CSSProperties = { position: 'absolute', top: '0.15em', left: '0.15em', width: '1.7em', height: '1.7em', pointerEvents: 'none' };
// Pointer input lands on the label, not the checkbox, so the click that ends a drag can be canceled.
const INPUT: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, pointerEvents: 'none' };
const RING: CSSProperties = { outline: 'var(--meniscus-focus-ring, auto)', outlineOffset: 2 };
const DISABLED: CSSProperties = { opacity: 0.5, cursor: 'not-allowed' };
const LENS = { tint: 0.15, refraction: 1.6, shadow: 1.4 };
const REST = { tint: 1, refraction: 1, shadow: 1 };
const KNOB_TINT = 'rgb(255 255 255 / 0.92)';

/**
 * An on/off switch: a native checkbox with `role="switch"`, drawn as a track
 * with a glass knob. While pressed or dragged, the knob swells into a clear
 * lens over the track. Dragging it across the middle toggles it, and it
 * settles on a spring. Forms, validation and assistive technology see the
 * native input.
 */
export const GlassSwitch = forwardRef<HTMLInputElement, GlassSwitchProps>(function GlassSwitch({ label, className, style, onChange, onFocus, onBlur, ...props }, ref) {
  const [glass, input] = splitGlassOptions(props);
  const controlled = input.checked !== undefined;
  const [own, setOwn] = useState(!!input.defaultChecked);
  const checked = controlled ? !!input.checked : own;
  const disabled = !!input.disabled;
  const { reducedMotion } = useGlassPreferences();
  const knob = useGlassPhysics();
  const [ring, setRing] = useState(false);
  const [held, setHeld] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const press = useRef<{ id: number; x: number; moved: boolean } | null>(null);
  const swallow = useRef(false);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const onNode = useCallback((el: HTMLInputElement | null) => {
    inputEl.current = el;
  }, []);
  const setRef = useMergedRef(ref, onNode);

  // A form reset changes an uncontrolled switch without a change event.
  useEffect(() => {
    const form = inputEl.current?.form;
    if (!form || controlled) return;
    const reset = () => setTimeout(() => setOwn(!!inputEl.current?.checked));
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, [controlled]);

  const lens = (on: boolean) => knob.to(on && !reducedMotion ? LENS : REST);
  const fractionAt = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const knobWidth = r.height * 0.85;
    const gap = r.height * 0.075;
    return Math.max(0, Math.min(1, (e.clientX - r.left - gap - knobWidth / 2) / (r.width - knobWidth - 2 * gap)));
  };
  const release = () => {
    press.current = null;
    setHeld(false);
    lens(false);
    setDrag(null);
  };

  const track = {
    onPointerDown(e: PointerEvent<HTMLSpanElement>) {
      if (disabled || e.button !== 0) return;
      press.current = { id: e.pointerId, x: e.clientX, moved: false };
      setHeld(true);
      lens(true);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Without capture the drag still works while the pointer stays on the track.
      }
    },
    onPointerMove(e: PointerEvent<HTMLSpanElement>) {
      const p = press.current;
      if (!p || p.id !== e.pointerId || reducedMotion) return;
      if (!p.moved && Math.abs(e.clientX - p.x) < 4) return;
      p.moved = true;
      setDrag(fractionAt(e));
    },
    onPointerUp(e: PointerEvent<HTMLSpanElement>) {
      const p = press.current;
      if (!p || p.id !== e.pointerId) return;
      if (p.moved) {
        // The label would toggle on the click that ends the drag: swallow it, and toggle here only if the knob crossed.
        swallow.current = true;
        setTimeout(() => {
          swallow.current = false;
        }, 0);
        if (fractionAt(e) > 0.5 !== checked) inputEl.current?.click();
      }
      release();
    },
    onPointerCancel: release,
  };

  return (
    <label
      className={className}
      style={{ ...ROW, ...(disabled ? DISABLED : null), ...style }}
      onClickCapture={(e) => {
        if (!swallow.current || e.target === inputEl.current) return;
        swallow.current = false;
        e.preventDefault();
      }}
    >
      <span>{label}</span>
      <span style={{ ...TRACK, background: checked ? ON : OFF, ...(ring ? RING : null) }} {...track}>
        <Glass
          {...glass}
          radius="capsule"
          optics={knob}
          aria-hidden="true"
          tint={glass.tint ?? KNOB_TINT}
          style={{
            ...KNOB,
            translate: `calc(${drag ?? (checked ? 1 : 0)} * ${TRAVEL}) 0`,
            scale: held && !reducedMotion ? '1.35' : '1',
            transition: reducedMotion ? 'none' : drag !== null ? `scale 420ms ${springEasing()}` : `translate 360ms ${springEasing()}, scale 420ms ${springEasing()}`,
          }}
        />
        <input
          {...input}
          ref={setRef}
          type="checkbox"
          role="switch"
          checked={controlled ? checked : undefined}
          defaultChecked={controlled ? undefined : input.defaultChecked}
          style={INPUT}
          onChange={(e) => {
            if (!controlled) setOwn(e.target.checked);
            onChange?.(e);
          }}
          onFocus={(e) => {
            setRing(focusVisible(e.target));
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setRing(false);
            onBlur?.(e);
          }}
        />
      </span>
    </label>
  );
});

GlassSwitch.displayName = 'GlassSwitch';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassSwitch, type GlassSwitchProps } from './react/GlassSwitch';
```

- [ ] **Step 5: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/switch.test.tsx test/motion.test.tsx && pnpm typecheck`
Expected: PASS, 6 switch tests, and the appear tests still pass after the export.

- [ ] **Step 6: Commit**

```bash
git add packages/meniscus/src/react/options.ts packages/meniscus/src/react/GlassSwitch.tsx packages/meniscus/src/react/appear.ts packages/meniscus/src/index.ts packages/meniscus/test/switch.test.tsx
git commit -m "feat: GlassSwitch, a native switch whose knob becomes a lens while held"
```

### Task 20: `GlassSlider`

**Files:**
- Create: `packages/meniscus/src/react/GlassSlider.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/slider.test.tsx`

**Interfaces:**
- Consumes: `splitGlassOptions` and `springEasing` (Task 19), `focusVisible` (Task 8), `useGlassPhysics`, `useMergedRef`.
- Produces: `interface GlassSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>, GlassOptions { label: string; format?: (value: number) => string }`, and `GlassSlider`, which forwards its ref to the range input.

The root is a `div` with a `<label htmlFor>`, not the `<label>` in the spec's §3.9. If the root were a label, the formatted value would become part of the slider's accessible name, and the name would change as you drag.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/slider.test.tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { GlassSlider } from '../src';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () => act(() => { for (let i = 0; i < 90; i++) vi.advanceTimersByTime(16); });
const thumbOf = (input: HTMLElement) => input.parentElement!.querySelector('[data-meniscus]') as HTMLElement;

it('is a native range named by its label, with its value shown and read out', () => {
  const ref = { current: null as HTMLInputElement | null };
  const { getByRole, getByText } = render(<GlassSlider ref={ref} label="Refractive index" min={1} max={2.42} step={0.01} defaultValue={1.5} format={(v) => v.toFixed(2)} />);
  const slider = getByRole('slider', { name: 'Refractive index' }) as HTMLInputElement;
  expect(ref.current).toBe(slider);
  expect(slider.getAttribute('aria-valuetext')).toBe('1.50');
  expect(getByText('1.50').tagName).toBe('OUTPUT');
  fireEvent.change(slider, { target: { value: '2' } });
  expect(slider.getAttribute('aria-valuetext')).toBe('2.00');
  expect(slider.parentElement!.style.getPropertyValue('--meniscus-value')).toBe(String((2 - 1) / 1.42));
});

it('follows a controlled value', () => {
  const { getByRole, rerender } = render(<GlassSlider label="Depth" min={0} max={100} value={20} onChange={() => {}} />);
  const slider = getByRole('slider') as HTMLInputElement;
  expect(slider.value).toBe('20');
  rerender(<GlassSlider label="Depth" min={0} max={100} value={80} onChange={() => {}} />);
  expect(slider.value).toBe('80');
  expect(slider.parentElement!.style.getPropertyValue('--meniscus-value')).toBe('0.8');
});

it('turns its thumb into a lens while dragged, but not while disabled', () => {
  const { getByRole, rerender } = render(<GlassSlider label="Depth" />);
  const slider = getByRole('slider');
  fireEvent.pointerDown(slider, { pointerId: 1, button: 0 });
  settle();
  expect(Number(thumbOf(slider).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(0.15, 2);
  fireEvent.pointerUp(slider, { pointerId: 1 });
  settle();
  expect(Number(thumbOf(slider).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(1, 2);
  rerender(<GlassSlider label="Depth" disabled />);
  fireEvent.pointerDown(slider, { pointerId: 2, button: 0 });
  settle();
  expect(Number(thumbOf(slider).style.getPropertyValue('--meniscus-tint'))).toBeCloseTo(1, 2);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/slider.test.tsx`
Expected: FAIL, because `GlassSlider` is not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassSlider.tsx
import { forwardRef, useCallback, useEffect, useId, useRef, useState, type CSSProperties, type InputHTMLAttributes } from 'react';
import type { GlassOptions } from '../core/glass';
import { springEasing } from './appear';
import { focusVisible } from './focus';
import { Glass } from './Glass';
import { useGlassPreferences } from './hooks';
import { splitGlassOptions } from './options';
import { useMergedRef } from './refs';
import { useGlassPhysics } from './useGlassPhysics';

export interface GlassSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>, GlassOptions {
  /** Visible label. It also names the slider. */
  label: string;
  /** Formats the value: shown beside the label, and read out as `aria-valuetext`. */
  format?: (value: number) => string;
}

const WRAP: CSSProperties = { display: 'grid', gap: '0.35em', color: 'inherit' };
const HEAD: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '1em' };
const VALUE: CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const TRACK: CSSProperties = { position: 'relative', height: '1.75em', minHeight: 24 };
const RULE: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  height: 4,
  marginTop: -2,
  borderRadius: 2,
  background: 'light-dark(rgb(15 20 26 / 0.14), rgb(255 255 255 / 0.18))',
};
const FILL: CSSProperties = { ...RULE, right: 'auto', width: 'calc(var(--meniscus-value, 0) * 100%)', background: 'var(--meniscus-accent, #2563eb)' };
const THUMB: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 'calc(var(--meniscus-value, 0) * (100% - 1.75em))',
  width: '1.75em',
  height: '1.25em',
  marginTop: '-0.625em',
  pointerEvents: 'none',
};
const RANGE: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer' };
const RING: CSSProperties = { outline: 'var(--meniscus-focus-ring, auto)', outlineOffset: 2 };
const DISABLED: CSSProperties = { opacity: 0.5 };
const LENS = { tint: 0.15, refraction: 1.6, shadow: 1.4 };
const REST = { tint: 1, refraction: 1, shadow: 1 };
const THUMB_TINT = 'rgb(255 255 255 / 0.92)';

/**
 * A value on a scale: a native range input over a glass track. While you
 * drag, the thumb swells into a lens and bends the fill line beneath it (live
 * in Chromium, frosted elsewhere). Keyboard, forms and assistive technology
 * are the native input's.
 */
export const GlassSlider = forwardRef<HTMLInputElement, GlassSliderProps>(function GlassSlider(
  { label, format, className, style, onChange, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel, ...props },
  ref,
) {
  const [glass, input] = splitGlassOptions(props);
  const generated = useId();
  const id = input.id ?? generated;
  const min = Number(input.min ?? 0);
  const max = Number(input.max ?? 100);
  const controlled = input.value !== undefined;
  const [own, setOwn] = useState(() => Number(input.defaultValue ?? min + (max - min) / 2));
  const value = controlled ? Number(input.value) : own;
  const fraction = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  const disabled = !!input.disabled;
  const { reducedMotion } = useGlassPreferences();
  const thumb = useGlassPhysics();
  const [held, setHeld] = useState(false);
  const [ring, setRing] = useState(false);
  const inputEl = useRef<HTMLInputElement | null>(null);
  const onNode = useCallback((el: HTMLInputElement | null) => {
    inputEl.current = el;
  }, []);
  const setRef = useMergedRef(ref, onNode);

  // The browser rounds an uncontrolled default to the step: read back what it chose.
  useEffect(() => {
    if (!controlled && inputEl.current) setOwn(Number(inputEl.current.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hold = (on: boolean) => {
    setHeld(on);
    thumb.to(on && !reducedMotion ? LENS : REST);
  };
  const text = format?.(value);

  return (
    <div className={className} style={{ ...WRAP, ...(disabled ? DISABLED : null), ...style }}>
      <div style={HEAD}>
        <label htmlFor={id}>{label}</label>
        {text !== undefined ? (
          <output htmlFor={id} style={VALUE}>
            {text}
          </output>
        ) : null}
      </div>
      <div style={{ ...TRACK, '--meniscus-value': fraction } as CSSProperties}>
        <span style={RULE} />
        <span style={FILL} />
        <Glass
          {...glass}
          radius="capsule"
          optics={thumb}
          aria-hidden="true"
          tint={glass.tint ?? THUMB_TINT}
          style={{ ...THUMB, ...(ring ? RING : null), scale: held && !reducedMotion ? '1.35' : '1', transition: reducedMotion ? 'none' : `scale 420ms ${springEasing()}` }}
        />
        <input
          {...input}
          ref={setRef}
          id={id}
          type="range"
          aria-valuetext={text ?? input['aria-valuetext']}
          value={controlled ? input.value : undefined}
          defaultValue={controlled ? undefined : input.defaultValue}
          style={RANGE}
          onChange={(e) => {
            if (!controlled) setOwn(Number(e.target.value));
            onChange?.(e);
          }}
          onPointerDown={(e) => {
            if (!disabled) hold(true);
            onPointerDown?.(e);
          }}
          onPointerUp={(e) => {
            hold(false);
            onPointerUp?.(e);
          }}
          onPointerCancel={(e) => {
            hold(false);
            onPointerCancel?.(e);
          }}
          onFocus={(e) => {
            setRing(focusVisible(e.target));
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setRing(false);
            hold(false);
            onBlur?.(e);
          }}
        />
      </div>
    </div>
  );
});

GlassSlider.displayName = 'GlassSlider';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassSlider, type GlassSliderProps } from './react/GlassSlider';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/slider.test.tsx && pnpm typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassSlider.tsx packages/meniscus/src/index.ts packages/meniscus/test/slider.test.tsx
git commit -m "feat: GlassSlider, a native range whose thumb becomes a lens while dragged"
```

### Task 21: `GlassSegmented`

**Files:**
- Create: `packages/meniscus/src/react/GlassSegmented.tsx`
- Modify: `packages/meniscus/src/index.ts`
- Test: `packages/meniscus/test/segmented.test.tsx`

**Interfaces:**
- Consumes: `GlassIndicator`, `focusVisible` (Task 8).
- Produces: `interface GlassSegmentedOption { value: string; label: ReactNode; disabled?: boolean }`, `interface GlassSegmentedProps extends GlassOptions { label; options; value?; defaultValue?; onValueChange?; name?; className?; style? }`, and `GlassSegmented`.

The spec's §9 has the site's own `Segmented` switch to `GlassSegmented`. That swap is dropped: the site's control is specified in DESIGN.md, and `GlassSegmented`'s inline styles would override the site's CSS. The catalog shows `GlassSegmented` on its own instead (Task 24).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/meniscus/test/segmented.test.tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { GlassSegmented } from '../src';

const MEDIA = [
  { value: 'water', label: 'Water' },
  { value: 'glass', label: 'Glass' },
  { value: 'diamond', label: 'Diamond', disabled: true },
];

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('is a radio group in a fieldset, starting on the first enabled option', () => {
  const { getByRole } = render(<GlassSegmented label="Medium" options={MEDIA} />);
  expect(getByRole('group', { name: 'Medium' }).tagName).toBe('FIELDSET');
  expect((getByRole('radio', { name: 'Water' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(getByRole('radio', { name: 'Glass' }));
  expect((getByRole('radio', { name: 'Glass' }) as HTMLInputElement).checked).toBe(true);
});

it('reports choices, follows a controlled value, and submits under its name', () => {
  const onValueChange = vi.fn();
  const { getByRole, rerender, container } = render(
    <form>
      <GlassSegmented label="Medium" name="medium" options={MEDIA} value="water" onValueChange={onValueChange} />
    </form>,
  );
  fireEvent.click(getByRole('radio', { name: 'Glass' }));
  expect(onValueChange).toHaveBeenCalledWith('glass');
  expect((getByRole('radio', { name: 'Water' }) as HTMLInputElement).checked).toBe(true);
  rerender(
    <form>
      <GlassSegmented label="Medium" name="medium" options={MEDIA} value="glass" onValueChange={onValueChange} />
    </form>,
  );
  expect(new FormData(container.querySelector('form')!).get('medium')).toBe('glass');
});

it('disables options, and draws the selection in glass', () => {
  const { getByRole, container } = render(<GlassSegmented label="Medium" options={MEDIA} tint="rgba(255, 255, 255, 0.3)" />);
  expect((getByRole('radio', { name: 'Diamond' }) as HTMLInputElement).disabled).toBe(true);
  expect(container.querySelector('fieldset [data-meniscus]')).not.toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/meniscus && pnpm exec vitest run test/segmented.test.tsx`
Expected: FAIL, because `GlassSegmented` is not exported.

- [ ] **Step 3: Implement**

```tsx
// packages/meniscus/src/react/GlassSegmented.tsx
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import type { GlassOptions } from '../core/glass';
import { focusVisible } from './focus';
import { GlassIndicator } from './GlassIndicator';

/** One option of a `GlassSegmented`. */
export interface GlassSegmentedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface GlassSegmentedProps extends GlassOptions {
  /** The group's name, shown as its legend. */
  label: string;
  /** The choices, in order. Values must be unique. */
  options: readonly GlassSegmentedOption[];
  /** The chosen option, controlled. Pair it with `onValueChange`. */
  value?: string;
  /** The chosen option at first, uncontrolled. Default: the first enabled option. */
  defaultValue?: string;
  /** Called with the option chosen. */
  onValueChange?: (value: string) => void;
  /** The radio group's name, for forms. Default: a generated name. */
  name?: string;
  className?: string;
  style?: CSSProperties;
}

const FIELDSET: CSSProperties = { margin: 0, padding: 0, border: 0, minWidth: 0, color: 'inherit' };
const LEGEND: CSSProperties = { padding: 0, marginBottom: '0.35em', fontSize: '0.9em' };
const ROW: CSSProperties = { position: 'relative', display: 'inline-flex', gap: 2, padding: 3, borderRadius: 14, background: 'light-dark(rgb(15 20 26 / 0.06), rgb(255 255 255 / 0.08))' };
const OPTION: CSSProperties = { display: 'inline-flex', cursor: 'pointer' };
const DISABLED: CSSProperties = { ...OPTION, opacity: 0.45, cursor: 'not-allowed' };
const TEXT: CSSProperties = { position: 'relative', display: 'inline-block', minHeight: 24, padding: '0.4em 0.9em', borderRadius: 11, lineHeight: 1.5, boxSizing: 'border-box' };
const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const RING: CSSProperties = { outline: 'var(--meniscus-focus-ring, auto)', outlineOffset: 2 };

/**
 * One of a few options: native radio buttons in a `fieldset`, with a glass
 * selection that flows to the chosen one. Arrow keys and forms work as they
 * do for any radio group.
 */
export function GlassSegmented({ label, options, value: valueProp, defaultValue, onValueChange, name, className, style, ...glass }: GlassSegmentedProps) {
  const generated = `meniscus-segmented-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [own, setOwn] = useState(defaultValue ?? options.find((o) => !o.disabled)?.value);
  const value = valueProp ?? own;
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <fieldset className={className} style={{ ...FIELDSET, ...style }}>
      <legend style={LEGEND}>{label}</legend>
      <div style={ROW}>
        <GlassIndicator target={selected} radius={11} {...glass} />
        {options.map((o) => (
          <label key={o.value} style={o.disabled ? DISABLED : OPTION}>
            <input
              type="radio"
              name={name ?? generated}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              style={HIDDEN}
              onChange={() => {
                if (valueProp === undefined) setOwn(o.value);
                onValueChange?.(o.value);
              }}
              onFocus={(e) => setFocused(focusVisible(e.target) ? o.value : null)}
              onBlur={() => setFocused(null)}
            />
            <span ref={value === o.value ? setSelected : undefined} style={focused === o.value ? { ...TEXT, ...RING } : TEXT}>
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

GlassSegmented.displayName = 'GlassSegmented';
```

Add to `packages/meniscus/src/index.ts`:

```ts
export { GlassSegmented, type GlassSegmentedProps, type GlassSegmentedOption } from './react/GlassSegmented';
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd packages/meniscus && pnpm exec vitest run test/segmented.test.tsx && pnpm typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/meniscus/src/react/GlassSegmented.tsx packages/meniscus/src/index.ts packages/meniscus/test/segmented.test.tsx
git commit -m "feat: GlassSegmented, a radio group with a flowing glass selection"
```

---

## Phase 6: The kit as a whole

### Task 22: Server rendering and hydration for the whole kit

**Files:**
- Create: `packages/meniscus/test/fixtures/kit.tsx` (not a test file, so Vitest doesn't collect it)
- Test: `packages/meniscus/test/kit-ssr.test.tsx` (node)
- Test: `packages/meniscus/test/kit-hydration.test.tsx` (jsdom)

**Interfaces:**
- Consumes: every component from Tasks 12–21, and `toast`.
- Produces: `Kit()`, one tree holding every kit component.

- [ ] **Step 1: Write the fixture and both tests**

```tsx
// packages/meniscus/test/fixtures/kit.tsx
import { GlassDialog, GlassMenu, GlassNavbar, GlassPopover, GlassProvider, GlassSegmented, GlassSidebar, GlassSlider, GlassSwitch, GlassToaster, GlassTooltip } from '../../src';

/** Every component of the kit in one tree, for the server-rendering and hydration tests. */
export function Kit() {
  return (
    <GlassProvider>
      <GlassNavbar label="Main">
        <a href="#plates">Plates</a>
      </GlassNavbar>
      <GlassSidebar label="Library">
        <a href="#figures">Figures</a>
      </GlassSidebar>
      <GlassDialog label="Order a print" trigger={<button type="button">Order</button>}>Body</GlassDialog>
      <GlassPopover label="Share" trigger={<button type="button">Share</button>}>Links</GlassPopover>
      <GlassTooltip content="Save to collection">
        <button type="button">Save</button>
      </GlassTooltip>
      <GlassMenu label="Plate" trigger={<button type="button">Plate</button>} items={[{ label: 'Open', onSelect: () => {} }]} />
      <GlassToaster />
      <GlassSwitch label="Sound" />
      <GlassSlider label="Index" min={1} max={2} step={0.01} defaultValue={1.5} />
      <GlassSegmented label="Medium" options={[{ value: 'water', label: 'Water' }, { value: 'glass', label: 'Glass' }]} />
    </GlassProvider>
  );
}
```

```tsx
// packages/meniscus/test/kit-ssr.test.tsx
import { renderToString } from 'react-dom/server';
import { GlassToaster, toast } from '../src';
import { Kit } from './fixtures/kit';

it('renders every kit component on the server, without a window', () => {
  expect(typeof window).toBe('undefined');
  const html = renderToString(<Kit />);
  expect(html).toContain('<dialog');
  expect(html).not.toMatch(/<dialog[^>]*\sopen/);
  expect(html).toContain('popover="manual"');
  expect(html).toContain('role="switch"');
  expect(html).toContain('type="range"');
  expect(html).toContain('type="radio"');
  expect(html).toContain('aria-label="Main"');
  expect(html).toContain('@media (max-width: 767.98px)');
});

it('keeps toast() out of server state', () => {
  expect(toast('Hello')).toMatch(/^meniscus-toast-/);
  expect(renderToString(<GlassToaster />)).not.toContain('Hello');
});
```

```tsx
// packages/meniscus/test/kit-hydration.test.tsx
// @vitest-environment jsdom
import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Kit } from './fixtures/kit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  document.elementsFromPoint = (() => []) as unknown as typeof document.elementsFromPoint;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

it('hydrates the whole kit from server HTML without a mismatch', async () => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(<Kit />);
  document.body.appendChild(container);
  const recoverable: unknown[] = [];
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  let root: Root | undefined;
  await act(async () => {
    root = hydrateRoot(container, <Kit />, { onRecoverableError: (error) => recoverable.push(error) });
  });
  expect(recoverable).toEqual([]);
  expect(errors.mock.calls.filter(([m]) => /hydrat/i.test(String(m)))).toEqual([]);
  act(() => root!.unmount());
});
```

- [ ] **Step 2: Run them**

Run: `cd packages/meniscus && pnpm exec vitest run test/kit-ssr.test.tsx test/kit-hydration.test.tsx`
Expected: PASS, 3 tests. If hydration reports a mismatch, the message names the component and attribute. The fix belongs in that component. A value read during render that differs between server and client must go through `useSyncExternalStore` with a server snapshot, or into an effect. Don't loosen the test.

- [ ] **Step 3: Run the whole suite and typecheck**

Run: `pnpm test && pnpm typecheck` (from the repository root)
Expected: PASS everywhere.

- [ ] **Step 4: Commit**

```bash
git add packages/meniscus/test/fixtures/kit.tsx packages/meniscus/test/kit-ssr.test.tsx packages/meniscus/test/kit-hydration.test.tsx
git commit -m "test: server-render and hydrate the whole component kit"
```

### Task 23: Size check in CI

**Files:**
- Create: `packages/meniscus/scripts/size.mjs`
- Create: `packages/meniscus/size.json` (written by the script)
- Modify: `packages/meniscus/package.json` (the `size` script, and `esbuild` as a dev dependency)
- Modify: `.github/workflows/ci.yml` (run the check after the build)

**Interfaces:**
- Produces: `packages/meniscus/size.json`, as `{ [exportName]: { kB: number, budget: number } }`, for `Glass` and the ten kit components. The manual reads it in Task 26.

The spec's §8 lists budgets in the script. They live in `size.json` beside it instead, so the manual can show measured sizes without copying numbers by hand.

- [ ] **Step 1: Add esbuild and the script entry**

Run: `pnpm --filter meniscus add -D esbuild@^0.27.7`
Expected: the package's devDependencies gain `"esbuild": "^0.27.7"`. It's the version tsup already installs, so nothing new is downloaded.

In `packages/meniscus/package.json` `scripts`, add `"size": "node scripts/size.mjs"`.

- [ ] **Step 2: Write the script**

```js
// packages/meniscus/scripts/size.mjs
/**
 * The gzipped size of each export, bundled alone from dist the way an app
 * imports it: minified, React external, production mode, code splitting, and
 * only the chunks loaded up front. Fails when an export is over its budget or
 * has none, or when one kit component brings in another's code.
 *
 *   pnpm --filter meniscus build && pnpm --filter meniscus size
 *   node scripts/size.mjs --update   measures again and writes size.json (budget: kB + 10%)
 */
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const store = join(root, 'size.json');
const KIT = ['GlassDialog', 'GlassPopover', 'GlassTooltip', 'GlassMenu', 'GlassToaster', 'GlassNavbar', 'GlassSidebar', 'GlassSwitch', 'GlassSlider', 'GlassSegmented'];
const EXPORTS = ['Glass', ...KIT];
/** Kit components another may contain: the sidebar collapses into a dialog. */
const ALLOWED = { GlassSidebar: ['GlassDialog'] };
const update = process.argv.includes('--update');

async function measure(name, dir) {
  const entry = join(dir, `${name}.mjs`);
  await writeFile(entry, `export { ${name} } from ${JSON.stringify(join(root, 'dist/index.js'))};\n`);
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    splitting: true,
    minify: true,
    outdir: join(dir, name),
    metafile: true,
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  // The entry chunk and what it imports statically; dynamic imports load later.
  const outputs = result.metafile.outputs;
  const main = Object.keys(outputs).find((file) => outputs[file].entryPoint);
  const upfront = new Set();
  const visit = (file) => {
    if (upfront.has(file)) return;
    upfront.add(file);
    for (const imp of outputs[file].imports) if (imp.kind === 'import-statement' && !imp.external) visit(imp.path);
  };
  visit(main);
  let bytes = 0;
  let code = '';
  for (const file of upfront) {
    const text = await readFile(resolve(file), 'utf8');
    code += text;
    bytes += gzipSync(text, { level: 9 }).length;
  }
  return { kb: bytes / 1024, code };
}

const stored = JSON.parse(await readFile(store, 'utf8').catch(() => '{}'));
const dir = await mkdtemp(join(tmpdir(), 'meniscus-size-'));
try {
  const rows = [];
  let over = false;
  let leaked = false;
  let base = 0;
  for (const name of EXPORTS) {
    const { kb, code } = await measure(name, dir);
    if (name === 'Glass') base = kb;
    // Every component sets its displayName, which survives minification.
    const leaks = KIT.filter((other) => other !== name && !(ALLOWED[name] ?? []).includes(other) && code.includes(`"${other}"`));
    const budget = stored[name]?.budget;
    if (budget === undefined || kb > budget) over = true;
    if (leaks.length) leaked = true;
    rows.push({ export: name, kB: Number(kb.toFixed(1)), 'over Glass': name === 'Glass' ? '' : `+${(kb - base).toFixed(1)}`, budget: budget ?? 'none', leaks: leaks.join(', ') });
  }
  console.table(rows);
  if (update) {
    const next = Object.fromEntries(rows.map((r) => [r.export, { kB: r.kB, budget: Math.ceil(r.kB * 1.1 * 10) / 10 }]));
    await writeFile(store, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Wrote ${store}.`);
  }
  if (leaked) {
    console.error('meniscus size: a component bundles another component’s code. Check its imports.');
    process.exitCode = 1;
  } else if (over && !update) {
    console.error('meniscus size: an export is over its budget, or has none. If the growth is intended, run `node scripts/size.mjs --update` and commit size.json.');
    process.exitCode = 1;
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
```

- [ ] **Step 3: Run it to see it fail without budgets**

Run: `pnpm --filter meniscus build && pnpm --filter meniscus size`
Expected: a table of 11 rows, every budget `none`, and exit code 1 with "an export is over its budget, or has none". No row may list leaks. If one does, a component imports another's module: fix the import and don't continue until the leaks column is empty.

- [ ] **Step 4: Write the budgets and check again**

Run: `cd packages/meniscus && node scripts/size.mjs --update && pnpm size`
Expected: `size.json` is written, then the second run exits 0. `Glass` should measure within about 1 kB of the 21.3 kB the site quotes. The tone sampler is new code in `Glass`. If `Glass` grows past 22.5 kB, stop and report it, since that changes the site's quick-start readout.

- [ ] **Step 5: Run it in CI**

In `.github/workflows/ci.yml`, in the `check` job, add after `- run: pnpm build`:

```yaml
      - run: pnpm --filter meniscus size
```

- [ ] **Step 6: Commit**

```bash
git add packages/meniscus/scripts/size.mjs packages/meniscus/size.json packages/meniscus/package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "ci: check each export's gzipped size, and that components don't bundle each other"
```

### Task 24: The kit on /components

**Files:**
- Modify: `apps/site/src/components/Components.tsx`
- Modify: `apps/site/src/components/components.css`
- Modify: `apps/site/src/home/PatternGallery.tsx`
- Modify: `apps/site/src/home/patterns.css` (remove the rules for the old hand-made dialog and toast)

**Interfaces:**
- Consumes: every kit component and `toast` from `meniscus`, `plateSrc` and `useTheme` from `../shared/theme`.
- Produces: the demos, and the accessible names that Task 25's browser check drives:
  - Buttons: "Order a print", "Filters sheet", "Library drawer", "Toast from the dialog", "Share", "Copy link", "Plate actions", "Save", "Print", "Save a plate".
  - Dialogs: "Order a print", "Filters", "Library".
  - Menu: "Plate actions".
  - Region: "Notifications".

- [ ] **Step 1: Import the kit**

Replace the first import in `Components.tsx` with:

```tsx
import {
  Glass,
  GlassButton,
  GlassCheckbox,
  GlassDialog,
  GlassGroup,
  GlassIndicator,
  GlassLoader,
  GlassMenu,
  GlassNavbar,
  GlassPanel,
  GlassPopover,
  GlassProvider,
  GlassSegmented,
  GlassSelect,
  GlassSidebar,
  GlassSlider,
  GlassSwitch,
  GlassTabs,
  GlassTextField,
  GlassToaster,
  GlassTooltip,
  toast,
} from 'meniscus';
```

- [ ] **Step 2: Add the index entries, props tables and examples**

In `ITEMS`, after the `checkbox` entry, add:

```ts
  { id: 'dialog', name: 'GlassDialog', role: 'Modal, sheet and drawer' },
  { id: 'popover', name: 'GlassPopover', role: 'Glass anchored to a button' },
  { id: 'menu', name: 'GlassMenu', role: 'Actions from a button' },
  { id: 'tooltip', name: 'GlassTooltip', role: 'A hint on hover or focus' },
  { id: 'toast', name: 'GlassToaster', role: 'Messages that come and go' },
  { id: 'navbar', name: 'GlassNavbar', role: 'A bar that deepens on scroll' },
  { id: 'sidebar', name: 'GlassSidebar', role: 'A column that becomes a drawer' },
  { id: 'switch', name: 'GlassSwitch', role: 'On or off, with a lens for a knob' },
  { id: 'slider', name: 'GlassSlider', role: 'A value on a scale' },
  { id: 'segmented', name: 'GlassSegmented', role: 'One of a few options' },
  { id: 'tone', name: 'Tinted & adaptive', role: 'Colored glass, and glass that reads its backdrop' },
```

In `PROPS`, add:

```ts
  dialog: [
    { name: 'label', type: 'string', body: 'Accessible name. Or pass aria-labelledby naming your heading.' },
    { name: 'placement', type: "'center' | 'bottom' | 'left' | 'right'", default: "'center'", body: 'A modal card, a sheet, or a drawer. Sheets and drawers can be dragged away.' },
    { name: 'trigger', type: 'ReactElement', body: 'The element that opens it. Focus returns there when it closes.' },
    { name: 'open, defaultOpen', type: 'boolean', body: 'Controlled or uncontrolled. A controlled dialog stays open until you close it.' },
    { name: 'onOpenChange', type: '(open) => void', body: 'true from the trigger; false from Escape, the dimmed page, a drag away, or a form with method="dialog".' },
    { name: 'physics', type: 'SpringInput', default: "'snappy'", body: 'The spring it arrives and leaves on.' },
    GLASS_OPTIONS,
  ],
  popover: [
    { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the popover.' },
    { name: 'trigger', type: 'ReactElement', default: 'required', body: 'Opens and closes it. It must pass its ref through.' },
    { name: 'placement', type: 'GlassPlacement', default: "'bottom'", body: 'top, bottom, left or right, each with -start or -end. It flips where there is no room.' },
    { name: 'offset', type: 'number', default: '8', body: 'Gap from the trigger, px.' },
    { name: 'open, defaultOpen, onOpenChange', type: 'boolean, (open) => void', body: 'As on GlassDialog. Escape, a press outside or focus leaving closes it.' },
    GLASS_OPTIONS,
  ],
  menu: [
    { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the menu.' },
    { name: 'trigger', type: 'ReactElement', default: 'required', body: 'The menu button.' },
    { name: 'items', type: 'GlassMenuItem[]', default: 'required', body: "{ label, onSelect, disabled?, icon?, shortcut?, textValue? }, or 'separator'." },
    { name: 'placement', type: 'GlassPlacement', default: "'bottom-start'", body: 'Where it opens.' },
    { name: 'open, defaultOpen, onOpenChange', type: 'boolean, (open) => void', body: 'As on GlassDialog.' },
    GLASS_OPTIONS,
  ],
  tooltip: [
    { name: 'content', type: 'ReactNode', default: 'required', body: 'The hint. Touch screens never show it, so nothing should depend on it.' },
    { name: 'children', type: 'ReactElement', default: 'required', body: 'The element it describes, through aria-describedby.' },
    { name: 'placement', type: 'GlassPlacement', default: "'top'", body: 'Where it shows.' },
    { name: 'delay', type: 'number', default: '500', body: 'Hover time before it shows, ms. Keyboard focus shows it at once.' },
    GLASS_OPTIONS,
  ],
  toast: [
    { name: 'toast(message, options?)', type: '=> id', body: 'Shows a toast. Options: description, action { label, onClick }, duration (ms; Infinity stays), and id to replace one.' },
    { name: 'toast.dismiss(id?)', type: '() => void', body: 'Removes one toast, or all of them.' },
    { name: 'placement', type: "'top' | 'bottom', with -start or -end", default: "'bottom'", body: 'Where toasts gather.' },
    { name: 'max', type: 'number', default: '3', body: 'How many show at once. Older ones wait.' },
    { name: 'className, style', type: 'string, CSSProperties', body: 'On every toast.' },
    GLASS_OPTIONS,
  ],
  navbar: [
    { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the nav landmark.' },
    { name: 'inset', type: 'number', default: '12', body: 'Gap from the top of its scroll container, and from each side, px.' },
    { name: 'scrollEdge', type: 'boolean', default: 'true', body: 'Clear at the top; deeper tint and shadow once content scrolls under it.' },
    { name: 'appearance', type: 'GlassAppearance', default: "'adaptive'", body: 'Follows what is behind it, unless a provider or this prop says otherwise.' },
    GLASS_OPTIONS,
  ],
  sidebar: [
    { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the landmark, and of the drawer.' },
    { name: 'as', type: "'aside' | 'nav'", default: "'aside'", body: 'The landmark it renders.' },
    { name: 'collapseBelow', type: 'number', default: '768', body: 'Below this viewport width, px, it becomes a drawer. 0 never collapses.' },
    { name: 'side', type: "'left' | 'right'", default: "'left'", body: 'The side the drawer opens from.' },
    { name: 'open, defaultOpen, onOpenChange', type: 'boolean, (open) => void', body: "The drawer's state. Ignored while it is a column." },
    GLASS_OPTIONS,
  ],
  switch: [
    { name: 'label', type: 'string', default: 'required', body: 'Visible label. It names the switch.' },
    { name: 'checked, defaultChecked', type: 'boolean', body: 'As on a native checkbox.' },
    { name: '…input props', type: 'InputHTMLAttributes', body: 'name, value, onChange, disabled and the rest reach the native input, which has role="switch". So does a ref.' },
    { name: '…glass options', type: 'GlassOptions', body: 'For the knob. The track fills with --meniscus-accent.' },
  ],
  slider: [
    { name: 'label', type: 'string', default: 'required', body: 'Visible label. It names the slider.' },
    { name: 'format', type: '(value) => string', body: 'Shows the value beside the label, and reads it out as aria-valuetext.' },
    { name: 'min, max, step, value, defaultValue', type: 'number', body: 'As on a native range input.' },
    { name: '…input props', type: 'InputHTMLAttributes', body: 'onChange, name, disabled and the rest reach the native range. So does a ref.' },
    { name: '…glass options', type: 'GlassOptions', body: 'For the thumb. The fill uses --meniscus-accent.' },
  ],
  segmented: [
    { name: 'label', type: 'string', default: 'required', body: 'The legend of the group.' },
    { name: 'options', type: '{ value, label, disabled? }[]', default: 'required', body: 'The choices, in order.' },
    { name: 'value, defaultValue, onValueChange', type: 'string', body: 'Controlled or uncontrolled, as on GlassTabs.' },
    { name: 'name', type: 'string', default: 'generated', body: 'The radio group’s name, for forms.' },
    { name: '…glass options', type: 'GlassOptions', body: 'For the selection.' },
  ],
  tone: [
    { name: "variant='tinted'", type: 'GlassVariant', body: 'Colored glass: tint, or --meniscus-accent, mixed in at 70%. The text turns light or dark to stay readable.' },
    { name: "appearance='adaptive'", type: 'GlassAppearance', body: 'Reads what is behind the glass and turns light or dark with it, setting data-meniscus-tone and the ink.' },
    { name: '--meniscus-ink-on-light, --meniscus-ink-on-dark', type: 'CSS color', body: 'The text colors toned glass sets. Your own style.color wins.' },
  ],
```

In `EXAMPLES`, add:

```ts
  dialog: `import { GlassButton, GlassDialog } from 'meniscus';

export function OrderPrint() {
  return (
    <GlassDialog label="Order a print" trigger={<GlassButton>Order a print</GlassButton>}>
      <form method="dialog">
        <GlassButton type="submit" value="order">Order</GlassButton>
        <GlassButton type="submit" value="cancel">Cancel</GlassButton>
      </form>
    </GlassDialog>
  );
}

// A sheet or a drawer: placement="bottom", "left" or "right".`,
  popover: `import { GlassButton, GlassPopover } from 'meniscus';

<GlassPopover label="Share" trigger={<GlassButton>Share</GlassButton>} placement="bottom-start">
  <GlassButton onClick={copyLink}>Copy link</GlassButton>
</GlassPopover>`,
  menu: `import { GlassButton, GlassMenu } from 'meniscus';

<GlassMenu label="Plate actions" trigger={<GlassButton>Plate actions</GlassButton>} items={[
  { label: 'Open', onSelect: open },
  { label: 'Duplicate', shortcut: '⌘D', onSelect: duplicate },
  'separator',
  { label: 'Delete', onSelect: remove, disabled: locked },
]} />`,
  tooltip: `import { GlassButton, GlassTooltip } from 'meniscus';

<GlassTooltip content="Save to collection">
  <GlassButton aria-label="Save"><SaveIcon /></GlassButton>
</GlassTooltip>`,
  toast: `import { GlassButton, GlassToaster, toast } from 'meniscus';

// Once, near the root:
<GlassToaster />

<GlassButton onClick={() => toast('Plate saved', { action: { label: 'Undo', onClick: undo } })}>
  Save a plate
</GlassButton>`,
  navbar: `import { GlassNavbar } from 'meniscus';

<GlassNavbar label="Main">
  <strong>Opticks</strong>
  <a href="/plates">Plates</a>
  <a href="/notes">Notes</a>
</GlassNavbar>`,
  sidebar: `import { useState } from 'react';
import { GlassButton, GlassSidebar } from 'meniscus';

export function Layout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="layout">
      <GlassSidebar label="Plates" as="nav" open={open} onOpenChange={setOpen}>{/* links */}</GlassSidebar>
      <main>
        <GlassButton className="menu-button" onClick={() => setOpen(true)}>Plates</GlassButton>
        {children}
      </main>
    </div>
  );
}`,
  switch: `import { GlassSwitch } from 'meniscus';

<GlassSwitch label="Glass sound" checked={on} onChange={(e) => setOn(e.target.checked)} />`,
  slider: `import { GlassSlider } from 'meniscus';

<GlassSlider label="Refractive index" min={1} max={2.42} step={0.01}
  value={n} onChange={(e) => setN(Number(e.target.value))} format={(v) => v.toFixed(2)} />`,
  segmented: `import { GlassSegmented } from 'meniscus';

<GlassSegmented label="Medium" value={medium} onValueChange={setMedium} options={[
  { value: 'water', label: 'Water' },
  { value: 'crown', label: 'Crown' },
  { value: 'flint', label: 'Flint' },
]} />`,
  tone: `import { Glass, GlassButton } from 'meniscus';

<GlassButton variant="tinted" tint="#1269d3">Order a print</GlassButton>
<Glass appearance="adaptive" radius={24}>Reads what is behind it</Glass>`,
```

In `Entry`, send the new ids to the manual's new section. Replace the `href` expression with:

```tsx
        <a href={sitePath(`/docs/#${['button', 'tabs', 'panel', 'text-field', 'select', 'checkbox', 'loader'].includes(id) ? 'components' : id === 'tone' ? 'tone' : KIT_IDS.includes(id) ? 'kit' : id}`)}>
```

Add above `Entry`:

```ts
const KIT_IDS: readonly string[] = ['dialog', 'popover', 'menu', 'tooltip', 'toast', 'navbar', 'sidebar', 'switch', 'slider', 'segmented'];
```

- [ ] **Step 3: Add the demos**

Add after `GroupDemo`:

```tsx
const MEDIA = [
  { value: 'water', label: 'Water' },
  { value: 'crown', label: 'Crown' },
  { value: 'flint', label: 'Flint' },
];

const LINKS = (
  <ul className="catalog__links">
    <li><a href="#sidebar">Book I</a></li>
    <li><a href="#sidebar">Book II</a></li>
    <li><a href="#sidebar">Book III</a></li>
  </ul>
);

function DialogDemo() {
  return (
    <>
      <GlassDialog label="Order a print" trigger={<GlassButton>Order a print</GlassButton>}>
        <h3 className="catalog__dialog-title">Order a print</h3>
        <form method="dialog" className="catalog__dialog-form">
          <GlassTextField label="Email" name="email" type="email" />
          <div className="catalog__row">
            <GlassButton type="submit" value="order">Order</GlassButton>
            <GlassButton type="submit" value="cancel">Cancel</GlassButton>
          </div>
          <GlassButton onClick={() => toast('Proof requested', { description: 'This toast shows above the open dialog.' })}>Toast from the dialog</GlassButton>
        </form>
      </GlassDialog>
      <GlassDialog label="Filters" placement="bottom" trigger={<GlassButton>Filters sheet</GlassButton>}>
        <h3 className="catalog__dialog-title">Filters</h3>
        <GlassSegmented label="Medium" options={MEDIA} tint="var(--glass-select)" />
      </GlassDialog>
      <GlassDialog label="Library" placement="left" trigger={<GlassButton>Library drawer</GlassButton>}>
        <h3 className="catalog__dialog-title">Library</h3>
        {LINKS}
      </GlassDialog>
    </>
  );
}

function PopoverDemo() {
  const [copied, setCopied] = useState(false);
  return (
    <GlassPopover label="Share" trigger={<GlassButton>Share</GlassButton>} placement="bottom-start">
      <p className="catalog__popover-text">Share this plate with a link.</p>
      <GlassButton onClick={() => setCopied(true)}>{copied ? 'Copied' : 'Copy link'}</GlassButton>
    </GlassPopover>
  );
}

function MenuDemo() {
  const [last, setLast] = useState('Nothing chosen yet.');
  return (
    <>
      <GlassMenu
        label="Plate actions"
        trigger={<GlassButton>Plate actions</GlassButton>}
        items={[
          { label: 'Open', onSelect: () => setLast('Opened.') },
          { label: 'Duplicate', shortcut: '⌘D', onSelect: () => setLast('Duplicated.') },
          'separator',
          { label: 'Delete', disabled: true, onSelect: () => setLast('Deleted.') },
          { label: 'Details', onSelect: () => setLast('Details shown.') },
        ]}
      />
      <p role="status" className="catalog__status">{last}</p>
    </>
  );
}

function TooltipDemo() {
  return (
    <>
      <GlassTooltip content="Save to collection">
        <GlassButton>Save</GlassButton>
      </GlassTooltip>
      <GlassTooltip content="Print a proof" placement="bottom">
        <GlassButton>Print</GlassButton>
      </GlassTooltip>
    </>
  );
}

function ToastDemo() {
  return (
    <GlassButton onClick={() => toast('Plate saved', { description: 'In your collection.', action: { label: 'Undo', onClick: () => toast('Plate removed') } })}>
      Save a plate
    </GlassButton>
  );
}

function NavbarDemo() {
  const theme = useTheme();
  return (
    <div className="catalog__scrollbox" tabIndex={0} role="region" aria-label="A page to scroll under the navbar">
      <GlassNavbar label="Example">
        <strong>Opticks</strong>
        <a href="#navbar">Plates</a>
        <a href="#navbar">Notes</a>
      </GlassNavbar>
      <img className="catalog__scrollbox-plate" src={plateSrc('opticks-plate-2', theme)} alt="Newton’s Opticks, Plate II, to scroll under the bar." width="1200" height="2191" />
    </div>
  );
}

function SidebarDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="catalog__sidebar-frame">
      <GlassSidebar label="Plates" as="nav" collapseBelow={900} open={open} onOpenChange={setOpen}>
        {LINKS}
      </GlassSidebar>
      <div className="catalog__sidebar-body">
        <GlassButton className="catalog__sidebar-toggle" onClick={() => setOpen(true)}>Show plates</GlassButton>
        <p>A column on wide screens. Below 900 px it becomes a drawer, opened with the button.</p>
      </div>
    </div>
  );
}

function SwitchDemo() {
  const [on, setOn] = useState(true);
  return (
    <div className="catalog__stack">
      <GlassSwitch label="Glass sound" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <GlassSwitch label="Weekly digest" disabled />
    </div>
  );
}

function SliderDemo() {
  const [n, setN] = useState(1.5);
  return (
    <div className="catalog__form-sample">
      <GlassSlider label="Refractive index" min={1} max={2.42} step={0.01} value={n} onChange={(e) => setN(Number(e.target.value))} format={(v) => v.toFixed(2)} />
    </div>
  );
}

function SegmentedDemo() {
  const [medium, setMedium] = useState('crown');
  return <GlassSegmented label="Medium" options={MEDIA} value={medium} onValueChange={setMedium} tint="var(--glass-select)" />;
}

function ToneDemo() {
  return (
    <div className="catalog__tone">
      <div className="catalog__tone-half catalog__tone-half--light">
        <Glass appearance="adaptive" radius={24} className="catalog__tone-sample">Adaptive over stock</Glass>
      </div>
      <div className="catalog__tone-half catalog__tone-half--dark">
        <Glass appearance="adaptive" radius={24} className="catalog__tone-sample">Adaptive over ink</Glass>
      </div>
      <GlassButton variant="tinted" tint="var(--glass-fill)" className="catalog__tone-button">Tinted glass</GlassButton>
    </div>
  );
}
```

- [ ] **Step 4: Add the entries and the toaster**

In `Components()`, after the `checkbox` `<Entry>`, add:

```tsx
            <Entry id="dialog" title="GlassDialog" description="A modal dialog of glass: a centered card, a sheet from the bottom, or a drawer from a side. It opens in the browser’s top layer, keeps focus inside, and gives focus back when it closes." note="Escape, the dimmed page and a drag away ask it to close. A form with method=&quot;dialog&quot; inside closes it with the submitter’s value.">
              <DialogDemo />
            </Entry>

            <Entry id="popover" title="GlassPopover" description="Glass content anchored to a trigger. It flips at the edge of the screen, takes focus when it opens, and closes on Escape, a press outside, or focus leaving." note="It is a non-modal dialog: give it a label that says what it holds.">
              <PopoverDemo />
            </Entry>

            <Entry id="menu" title="GlassMenu" description="Actions from a button. Arrow keys, Home, End and the first letter of an item move through it; a glass highlight flows between the items." note="Shortcuts are shown only. Bind the keys yourself.">
              <MenuDemo />
            </Entry>

            <Entry id="tooltip" title="GlassTooltip" description="A short hint for the element it wraps. It shows after a hover delay, or at once on keyboard focus, and the pointer can move onto it." note="Touch screens never show tooltips. Nothing should depend on one.">
              <TooltipDemo />
            </Entry>

            <Entry id="toast" title="GlassToaster & toast()" description="Messages that arrive on a spring and leave on their own. Hovering or focusing them pauses the clock, and a swipe dismisses one." note="Render one GlassToaster near the root. While a modal dialog is open, a toast still shows and is announced, but its buttons work only after the dialog closes.">
              <ToastDemo />
            </Entry>

            <Entry id="navbar" title="GlassNavbar" description="A sticky bar of glass. It stays clear over the top of the page and deepens as content scrolls under it, following the tone of what passes behind." note="Scroll the frame to see the edge. The bar follows its nearest scrolling ancestor, or the page.">
              <NavbarDemo />
            </Entry>

            <Entry id="sidebar" title="GlassSidebar" description="A glass column on wide screens that becomes a drawer on narrow ones. A media query hides the column before JavaScript runs, so phones never see it flash." note="Give the drawer an open control of your own, shown only below the breakpoint.">
              <SidebarDemo />
            </Entry>

            <Entry id="switch" title="GlassSwitch" description="A native switch whose knob swells into a clear lens while you press or drag it." note="It is a checkbox with role=switch, so forms and assistive technology treat it as one.">
              <SwitchDemo />
            </Entry>

            <Entry id="slider" title="GlassSlider" description="A native range on a glass track. While you drag, the thumb becomes a lens and bends the fill beneath it." note="format sets both the visible value and aria-valuetext.">
              <SliderDemo />
            </Entry>

            <Entry id="segmented" title="GlassSegmented" description="One of a few options: native radios in a fieldset, with a glass selection that flows to the chosen one." note="Arrow keys move the choice, as in any radio group.">
              <SegmentedDemo />
            </Entry>

            <Entry id="tone" title="Tinted & adaptive glass" description="Tinted glass is colored glass for primary actions. Adaptive glass reads what is behind it and turns light or dark, with text to match." note="Adaptive glass reads solid backgrounds and media. Over a gradient or a cross-origin image it keeps the page’s color scheme.">
              <ToneDemo />
            </Entry>
```

After `<Colophon />`, still inside `<GlassProvider>`, add `<GlassToaster />`.

- [ ] **Step 5: Style the demos**

Append to `apps/site/src/components/components.css`:

```css
/* The kit's switch and slider fill with the page's spot ink: active state, per DESIGN.md. */
.catalog {
  --meniscus-accent: var(--spot);
}
.catalog__demo--dialog,
.catalog__demo--popover,
.catalog__demo--menu,
.catalog__demo--tooltip,
.catalog__demo--toast,
.catalog__demo--switch,
.catalog__demo--slider,
.catalog__demo--segmented {
  background-image: url('/plates/opticks-plate-2.webp');
  background-position: center 36%;
  background-size: cover;
}
:root[data-theme='lantern'] .catalog__demo--dialog,
:root[data-theme='lantern'] .catalog__demo--popover,
:root[data-theme='lantern'] .catalog__demo--menu,
:root[data-theme='lantern'] .catalog__demo--tooltip,
:root[data-theme='lantern'] .catalog__demo--toast,
:root[data-theme='lantern'] .catalog__demo--switch,
:root[data-theme='lantern'] .catalog__demo--slider,
:root[data-theme='lantern'] .catalog__demo--segmented {
  background-image: url('/plates/opticks-plate-2-lantern.webp');
}
.catalog__demo--dialog,
.catalog__demo--tooltip {
  flex-wrap: wrap;
}
.catalog__demo--navbar,
.catalog__demo--sidebar,
.catalog__demo--tone {
  align-items: stretch;
  padding: 0;
}
.catalog__scrollbox {
  width: 100%;
  height: 320px;
  overflow: auto;
  padding-top: 12px;
}
.catalog__scrollbox-plate {
  display: block;
  width: 100%;
  height: auto;
  margin-top: 12px;
}
.catalog__sidebar-frame {
  display: flex;
  gap: 16px;
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
}
/* In the demo frame, the column sits in place instead of sticking to the viewport. */
.catalog__sidebar-frame [data-meniscus-sidebar] {
  position: relative !important;
  top: 0 !important;
  height: auto !important;
}
.catalog__sidebar-toggle {
  display: none;
}
@media (max-width: 899.98px) {
  .catalog__sidebar-toggle {
    display: inline-flex;
  }
}
.catalog__links {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.catalog__stack {
  display: grid;
  gap: 16px;
}
.catalog__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.catalog__dialog-title {
  margin: 0 0 1rem;
}
.catalog__dialog-form {
  display: grid;
  gap: 16px;
}
.catalog__popover-text {
  margin: 0 0 0.75rem;
}
.catalog__tone {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
}
.catalog__tone-half {
  display: grid;
  place-items: center;
  min-height: 250px;
}
.catalog__tone-half--light {
  background: var(--stock);
}
.catalog__tone-half--dark {
  background: var(--ink);
}
.catalog__tone-sample {
  padding: 1.25rem 1.5rem;
}
.catalog__tone-button {
  position: absolute;
  left: 50%;
  bottom: 20px;
  translate: -50% 0;
}
```

- [ ] **Step 6: Rebuild the pattern gallery's live modal and toast on the kit**

Replace `apps/site/src/home/PatternGallery.tsx` with:

```tsx
import { Glass, GlassButton, GlassDialog, GlassPanel, toast } from 'meniscus';
import { GlassComparison } from './GlassComparison';
import { plateSrc, useTheme } from '../shared/theme';
import './patterns.css';

function PrintPreview() {
  return <GlassPanel radius={24} className="pattern-panel"><h3>Keep a little light.</h3><p>Save this plate to your collection of optical experiments.</p><GlassButton className="ui-button">Save plate</GlassButton></GlassPanel>;
}

export function PatternGallery() {
  const theme = useTheme();
  const saved = () => toast('Plate saved for this demo.');
  return (
    <section className="pattern-gallery" aria-label="Compare interface patterns" style={{ ['--sheet' as string]: `url(${plateSrc('opticks-plate-4', theme)})` }}>
      <p className="caption">Drag each divider to compare the same pattern in flat and glass. Arrow keys move the focused divider; Home and End reveal either surface.</p>
      <div className="pattern-gallery__grid">
        <GlassComparison label="Navigation"><Glass as="nav" radius="capsule" className="pattern-nav"><b>Opticks</b><span>Plates</span><span>Notes</span><GlassButton className="ui-button">Collect</GlassButton></Glass></GlassComparison>
        <GlassComparison label="Card"><GlassPanel radius={24} className="pattern-panel"><p className="num">Book I · Plate II</p><h3>The nature of light</h3><p>Rays, prisms and the curved surfaces that bend them.</p><GlassButton className="ui-button">View plate</GlassButton></GlassPanel></GlassComparison>
        <GlassComparison label="Modal"><PrintPreview /></GlassComparison>
        <GlassComparison label="Toast"><Glass radius={20} className="pattern-toast"><b>Plate saved</b><p>Your collection has a new experiment.</p></Glass></GlassComparison>
      </div>
      <div className="actions-row">
        <GlassDialog label="Keep a little light." radius={24} className="pattern-panel" trigger={<button type="button" className="action action--primary">Try the modal</button>}>
          <h3>Keep a little light.</h3>
          <p>This is a local demo. Save the plate to see its confirmation.</p>
          <form method="dialog" className="actions-row">
            <GlassButton type="submit" className="ui-button" onClick={saved}>Save plate</GlassButton>
            <button type="submit" className="action action--quiet">Cancel</button>
          </form>
        </GlassDialog>
        <button type="button" className="action action--quiet" onClick={saved}>Show a toast</button>
      </div>
    </section>
  );
}
```

In `apps/site/src/home/patterns.css`, delete the five rules that start with `.pattern-dialog`, `.pattern-dialog .pattern-panel`, `.pattern-dialog::backdrop`, `.pattern-feedback` and `.pattern-feedback .pattern-toast` (lines 22–26). Their elements are gone.

- [ ] **Step 7: Build and look**

Run: `pnpm --filter site build && pnpm --filter site dev --host 127.0.0.1`, then open `http://127.0.0.1:5173/components/`.
Expected: the build passes. Check each new entry in Chromium at 1440 px and 390 px wide, in light and in lantern theme:
- The dialog, sheet and drawer open and close.
- The toast from the dialog shows above it.
- Popovers and menus stay on screen.
- The navbar deepens as you scroll the frame.
- The sidebar becomes a drawer below 900 px.
- The tone demo shows one light and one dark adaptive glass.

Save full-viewport screenshots of anything that looks wrong, and fix it before committing. The memory note applies: judge glass only from full-viewport captures in Chromium.

- [ ] **Step 8: Commit**

```bash
git add apps/site/src/components/Components.tsx apps/site/src/components/components.css apps/site/src/home/PatternGallery.tsx apps/site/src/home/patterns.css
git commit -m "feat(site): show the component kit on /components, and build the pattern gallery's modal and toast on it"
```

### Task 25: Browser check for the top layer

**Files:**
- Create: `apps/site/scripts/check-components.mjs`
- Modify: `apps/site/package.json` (add `"test:components": "node scripts/check-components.mjs"`)

**Interfaces:**
- Consumes: the demos and accessible names from Task 24.

Hit-testing can't show that a toast sits above an open modal, because everything outside a modal is inert and hit-testing skips inert elements. So the check asserts that the toast is visible and that its region is `:popover-open`, and saves a screenshot for review.

- [ ] **Step 1: Write the check**

```js
// apps/site/scripts/check-components.mjs
/**
 * The kit's top-layer behavior in real engines: focus, dismissal, stacking
 * and placement. Run the dev server first (`pnpm dev --host 127.0.0.1`).
 * WebKit and Firefox need `pnpm exec playwright install webkit firefox` once.
 * MENISCUS_ENGINES narrows the engines, e.g. "chromium".
 */
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const url = process.env.MENISCUS_TEST_URL ?? 'http://127.0.0.1:5173/components/';
const ENGINES = { chromium, webkit, firefox };
const names = (process.env.MENISCUS_ENGINES ?? 'chromium,webkit,firefox').split(',').map((s) => s.trim()).filter(Boolean);
const HEIGHT = 860;

for (const name of names) {
  const type = ENGINES[name];
  assert.ok(type, `unknown engine "${name}"`);
  let browser;
  try {
    browser = await type.launch();
  } catch (error) {
    throw new Error(`${name} isn't installed. Run \`pnpm exec playwright install ${name}\`.\n${error.message}`);
  }
  try {
    for (const width of [1280, 390]) {
      const where = `${name} at ${width}px`;
      const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(url);
      await page.locator('.splash').waitFor({ state: 'detached' }).catch(() => {});

      const onScreen = async (locator, label) => {
        const box = await locator.boundingBox();
        assert.ok(box, `${label} has a box (${where})`);
        assert.ok(box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= width + 0.5 && box.y + box.height <= HEIGHT + 0.5, `${label} stays on screen (${where}): ${JSON.stringify(box)}`);
      };
      const focusIn = (selector) => page.evaluate((s) => !!document.activeElement?.closest(s), selector);
      const focusedText = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
      const closed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'));

      // Dialog: focus moves in and stays in; a toast shows above it; Escape closes it and focus returns.
      const order = page.getByRole('button', { name: 'Order a print', exact: true });
      await order.scrollIntoViewIfNeeded();
      await order.click();
      const dialog = page.getByRole('dialog', { name: 'Order a print' });
      await dialog.waitFor();
      assert.ok(await focusIn('dialog[open]'), `focus moves into the dialog (${where})`);
      for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
      assert.ok(await focusIn('dialog[open]'), `Tab stays inside the open dialog (${where})`);
      await dialog.getByRole('button', { name: 'Toast from the dialog' }).click();
      const region = page.getByRole('region', { name: 'Notifications' });
      await region.getByText('Proof requested').waitFor();
      assert.ok(await region.evaluate((el) => el.matches(':popover-open')), `the toaster is in the top layer (${where})`);
      await page.screenshot({ path: join(tmpdir(), `meniscus-toast-over-modal-${name}-${width}.png`) });
      await page.keyboard.press('Escape');
      await closed();
      assert.equal(await focusedText(), 'Order a print', `focus returns to the dialog's trigger (${where})`);
      // Clear the toast, so it can't cover the controls the next steps press.
      await region.getByRole('button', { name: 'Dismiss notification' }).click();
      await region.getByText('Proof requested').waitFor({ state: 'detached' });

      // The dimmed page closes it too.
      await order.click();
      await dialog.waitFor();
      await page.mouse.click(4, 4);
      await closed();

      // Sheet and drawer.
      for (const [trigger, label] of [['Filters sheet', 'Filters'], ['Library drawer', 'Library']]) {
        await page.getByRole('button', { name: trigger }).click();
        const panel = page.getByRole('dialog', { name: label });
        await panel.waitFor();
        await onScreen(panel.locator('[data-meniscus]').first(), `the ${label} panel`);
        await page.keyboard.press('Escape');
        await closed();
      }

      // Popover: on screen, takes focus, Escape and an outside press close it.
      const share = page.getByRole('button', { name: 'Share', exact: true });
      await share.scrollIntoViewIfNeeded();
      await share.click();
      const popover = page.getByRole('dialog', { name: 'Share' });
      await popover.waitFor();
      await onScreen(popover, 'the Share popover');
      assert.ok(await focusIn('[role="dialog"][aria-label="Share"]'), `focus moves into the popover (${where})`);
      await page.keyboard.press('Escape');
      await popover.waitFor({ state: 'hidden' });
      assert.equal(await focusedText(), 'Share', `focus returns to the popover's trigger (${where})`);
      await share.click();
      await popover.waitFor();
      await page.getByRole('heading', { name: 'GlassPopover' }).click();
      await popover.waitFor({ state: 'hidden' });

      // Menu: the keyboard pattern, on screen, and a choice.
      const actions = page.getByRole('button', { name: 'Plate actions' });
      await actions.scrollIntoViewIfNeeded();
      await actions.focus();
      await page.keyboard.press('ArrowDown');
      const menu = page.getByRole('menu', { name: 'Plate actions' });
      await menu.waitFor();
      await onScreen(menu, 'the Plate actions menu');
      assert.equal(await focusedText(), 'Open', `ArrowDown opens on the first item (${where})`);
      await page.keyboard.press('ArrowDown');
      assert.ok((await focusedText()).startsWith('Duplicate'), `ArrowDown moves (${where})`);
      await page.keyboard.press('End');
      assert.equal(await focusedText(), 'Details', `End skips the disabled item (${where})`);
      await page.keyboard.press('o');
      assert.equal(await focusedText(), 'Open', `a letter jumps (${where})`);
      await page.keyboard.press('Enter');
      await menu.waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('status').filter({ hasText: 'Opened.' }).count(), 1, `Enter chooses (${where})`);

      // Tooltip: hover shows it; Escape hides it.
      const save = page.getByRole('button', { name: 'Save', exact: true });
      await save.scrollIntoViewIfNeeded();
      await save.hover();
      const tip = page.getByRole('tooltip', { name: 'Save to collection' });
      await tip.waitFor({ timeout: 2000 });
      await onScreen(tip, 'the Save tooltip');
      await page.keyboard.press('Escape');
      await tip.waitFor({ state: 'hidden' });

      // Reduced motion: closing is a short fade.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await order.scrollIntoViewIfNeeded();
      await order.click();
      await dialog.waitFor();
      const started = Date.now();
      await page.keyboard.press('Escape');
      await closed();
      assert.ok(Date.now() - started < 600, `a reduced-motion close is quick (${where}): ${Date.now() - started} ms`);
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      assert.deepEqual(errors, [], `no errors (${where})`);
      await page.close();
      console.log(`ok ${where}`);
    }
  } finally {
    await browser.close();
  }
}
```

In `apps/site/package.json` `scripts`, add `"test:components": "node scripts/check-components.mjs"`.

- [ ] **Step 2: Run it in Chromium**

Run: `pnpm --filter site dev --host 127.0.0.1` in one terminal. In another: `MENISCUS_ENGINES=chromium pnpm --filter site test:components`
Expected: `ok chromium at 1280px` and `ok chromium at 390px`. Look at the saved `meniscus-toast-over-modal-chromium-*.png` in the system temp directory: the toast must sit above the dimmed dialog.

- [ ] **Step 3: Run it in WebKit and Firefox**

Run: `pnpm exec playwright install webkit firefox`, then `pnpm --filter site test:components`
Expected: `ok` for all six engine and width pairs. A failure here is a real cross-browser bug in the kit, since the site only relays the library's behavior. Fix it in the library, with a unit test where jsdom can express it. Don't weaken the check.

- [ ] **Step 4: Run the existing site checks**

Run: `pnpm --filter site test:browser && pnpm --filter site test:stack && node apps/site/scripts/check-home-structure.mjs && node apps/site/scripts/check-media-players.mjs` against the dev server, and against the preview server where each script expects it (see each script's header).
Expected: every check passes as before.

- [ ] **Step 5: Commit**

```bash
git add apps/site/scripts/check-components.mjs apps/site/package.json
git commit -m "test(site): check the kit's top layer in Chromium, WebKit and Firefox"
```

### Task 26: The manual, README and changelog

**Files:**
- Modify: `apps/site/src/docs/content.ts`
- Modify: `apps/site/src/docs/Docs.tsx`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `packages/meniscus/size.json` (Task 23), and the prop names from Tasks 12–21.

- [ ] **Step 1: Add the props tables and code**

In `apps/site/src/docs/content.ts`, add `appearance` and `variant` to the new values in `GLASS_PROPS`. Replace those two rows with:

```ts
  { name: 'variant', type: "'regular' | 'clear' | 'tinted'", default: "'regular'", body: 'Regular frosts and tints for legibility over busy content. Clear stays nearly transparent, for glass over media. Tinted is colored glass: tint, or --meniscus-accent, mixed in at 70%, with text that stays readable on it.' },
  { name: 'appearance', type: "'auto' | 'light' | 'dark' | 'adaptive'", default: "'auto'", body: 'Light glass (a pale wash) or dark glass (a smoky one). Auto follows the page’s color scheme through CSS light-dark(). Adaptive reads what is behind the glass and turns light or dark with it, setting data-meniscus-tone and a readable text color. An explicit tint wins.' },
```

Append:

```ts
export const DIALOG_PROPS: PropRow[] = [
  { name: 'label', type: 'string', default: '—', body: 'Accessible name. Or pass aria-labelledby naming the dialog’s heading. Development builds warn when neither is given.' },
  { name: 'placement', type: "'center' | 'bottom' | 'left' | 'right'", default: "'center'", body: 'A modal card, a sheet along the bottom, or a drawer down one side. Sheets drag down from their grabber and drawers drag toward their edge to close.' },
  { name: 'trigger', type: 'ReactElement', default: '—', body: 'The element that opens the dialog. Its own handlers, ref and attributes stay; focus returns to it on close.' },
  { name: 'open', type: 'boolean', default: '—', body: 'Open, controlled. A controlled dialog stays open until you set it false, which covers dialogs that must be answered.' },
  { name: 'defaultOpen', type: 'boolean', default: 'false', body: 'Open at first, uncontrolled. It opens after hydration.' },
  { name: 'onOpenChange', type: '(open: boolean) => void', default: '—', body: 'true from the trigger; false from Escape, the dimmed page, a drag away, or a form with method="dialog", whose submitter’s value becomes the dialog’s returnValue.' },
  { name: 'physics', type: 'SpringInput', default: "'snappy'", body: 'The spring it arrives and leaves on. Under reduced motion it fades instead.' },
  { name: '…glass', type: 'GlassOptions', default: 'provider', body: 'Tint, radius, intensity and the rest apply to the panel, as do className and style.' },
];

export const POPOVER_PROPS: PropRow[] = [
  { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the popover, a non-modal dialog.' },
  { name: 'trigger', type: 'ReactElement', default: 'required', body: 'Opens and closes it, with aria-expanded and aria-controls added. It must pass its ref through.' },
  { name: 'placement', type: 'GlassPlacement', default: "'bottom'", body: 'top, bottom, left or right, each optionally -start or -end. It flips to the other side where there is no room.' },
  { name: 'offset', type: 'number', default: '8', body: 'Gap from the trigger, px.' },
  { name: 'open, defaultOpen, onOpenChange', type: 'boolean, (open) => void', default: '—', body: 'As on GlassDialog. Escape, a press outside, or focus leaving it closes it.' },
  { name: '…glass', type: 'GlassOptions', default: 'provider', body: 'On the popover’s glass.' },
];

export const MENU_PROPS: PropRow[] = [
  { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the menu.' },
  { name: 'trigger', type: 'ReactElement', default: 'required', body: 'The menu button. Enter, Space or ArrowDown opens on the first item; ArrowUp on the last.' },
  { name: 'items', type: 'GlassMenuItem[]', default: 'required', body: "{ label, onSelect, disabled?, icon?, shortcut?, textValue? }, or 'separator'. Disabled items are skipped. Shortcuts are shown only." },
  { name: 'placement', type: 'GlassPlacement', default: "'bottom-start'", body: 'Where it opens.' },
  { name: 'open, defaultOpen, onOpenChange', type: 'boolean, (open) => void', default: '—', body: 'As on GlassDialog.' },
  { name: '…glass', type: 'GlassOptions', default: 'provider', body: 'On the menu’s glass. --meniscus-menu-highlight tints the highlight.' },
];

export const TOOLTIP_PROPS: PropRow[] = [
  { name: 'content', type: 'ReactNode', default: 'required', body: 'The hint, linked with aria-describedby. Touch screens never show it.' },
  { name: 'children', type: 'ReactElement', default: 'required', body: 'The element it describes. It must pass its ref through.' },
  { name: 'placement', type: 'GlassPlacement', default: "'top'", body: 'Where it shows.' },
  { name: 'offset', type: 'number', default: '6', body: 'Gap from the element, px.' },
  { name: 'delay', type: 'number', default: '500', body: 'Hover time before it shows, ms. Keyboard focus shows it at once, as does moving from another tooltip.' },
];

export const TOASTER_PROPS: PropRow[] = [
  { name: 'toast(message, options?)', type: '(ReactNode, ToastOptions) => string', default: '—', body: 'Shows a toast and returns its id. Options: description, action { label, onClick }, duration in ms (default 5000; Infinity stays), and an id to replace a toast in place.' },
  { name: 'toast.dismiss(id?)', type: '(id?: string) => void', default: '—', body: 'Removes one toast, or all of them.' },
  { name: 'placement', type: "'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'", default: "'bottom'", body: 'Where toasts gather. The newest sits nearest the edge.' },
  { name: 'max', type: 'number', default: '3', body: 'How many show at once. Older ones wait their turn.' },
  { name: 'label', type: 'string', default: "'Notifications'", body: 'Accessible name of the region.' },
  { name: 'physics', type: 'SpringInput', default: "'bouncy'", body: 'The spring toasts arrive and leave on.' },
  { name: '…glass, className, style', type: 'GlassOptions', default: 'provider', body: 'On every toast.' },
];

export const NAVBAR_PROPS: PropRow[] = [
  { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the nav landmark.' },
  { name: 'inset', type: 'number', default: '12', body: 'Gap from the top of its scroll container while stuck, and from each side, px.' },
  { name: 'scrollEdge', type: 'boolean', default: 'true', body: 'Clear at the top of the page; its tint and shadow deepen once content scrolls under it. No re-render, no rebuilt maps.' },
  { name: 'appearance', type: 'GlassAppearance', default: "'adaptive'", body: 'Follows what is behind it, unless a provider or this prop says otherwise.' },
  { name: '…glass', type: 'GlassOptions', default: 'provider', body: 'Radius defaults to capsule.' },
];

export const SIDEBAR_PROPS: PropRow[] = [
  { name: 'label', type: 'string', default: 'required', body: 'Accessible name of the landmark, and of the drawer it becomes.' },
  { name: 'as', type: "'aside' | 'nav'", default: "'aside'", body: 'The landmark it renders, as a column or inside the drawer.' },
  { name: 'collapseBelow', type: 'number', default: '768', body: 'Below this viewport width, px, it is a drawer. A media query hides the column before JavaScript runs. 0 never collapses.' },
  { name: 'side', type: "'left' | 'right'", default: "'left'", body: 'The side the drawer opens from.' },
  { name: 'inset', type: 'number', default: '12', body: 'Gap from the viewport’s edges, px.' },
  { name: 'open, defaultOpen, onOpenChange', type: 'boolean, (open) => void', default: '—', body: 'The drawer’s state: pair them with a button of your own shown below the breakpoint. Ignored while it is a column.' },
];

export const CONTROL_PROPS: PropRow[] = [
  { name: 'GlassSwitch label', type: 'string', default: 'required', body: 'Visible label. The switch is a native checkbox with role="switch"; its props, form value and ref are the input’s.' },
  { name: 'GlassSlider label, format', type: 'string, (value) => string', default: 'required, —', body: 'Visible label, and the value shown beside it and read out as aria-valuetext. The slider is a native range input.' },
  { name: 'GlassSegmented label, options', type: 'string, { value, label, disabled? }[]', default: 'required', body: 'The legend and the choices: native radios in a fieldset. value, defaultValue and onValueChange as on GlassTabs; name for forms.' },
  { name: '…glass', type: 'GlassOptions', default: 'provider', body: 'On the knob, the thumb or the selection. The switch track and slider fill use --meniscus-accent.' },
];
```

In `CODE`, add:

```ts
  kit: `import { GlassButton, GlassDialog, GlassMenu, GlassNavbar, GlassToaster, toast } from 'meniscus';

<GlassNavbar label="Main">
  <strong>Opticks</strong>
  <GlassMenu label="Plate actions" trigger={<GlassButton>Plate</GlassButton>} items={[
    { label: 'Duplicate', onSelect: duplicate },
    { label: 'Share', onSelect: () => toast('Link copied') },
  ]} />
  <GlassDialog label="Order a print" trigger={<GlassButton>Order</GlassButton>}>
    <form method="dialog">
      <GlassButton type="submit">Done</GlassButton>
    </form>
  </GlassDialog>
</GlassNavbar>
<GlassToaster />`,
  tone: `import { Glass, GlassButton, GlassProvider, type GlassDefaults } from 'meniscus';

// A theme is a provider's props.
const theme = { variant: 'tinted', tint: '#1269d3', intensity: 'strong' } satisfies GlassDefaults;

<GlassProvider {...theme}>
  <GlassButton>Order a print</GlassButton>
</GlassProvider>

// Glass that reads what's behind it and sets its own text color.
<Glass appearance="adaptive" className="caption-bar">Plate II</Glass>

/* Style what adaptive and tinted glass set: */
[data-meniscus-tone='dark'] svg { fill: currentColor; }
:root { --meniscus-ink-on-dark: #f5f1ea; --meniscus-ink-on-light: #1b1a17; }`,
```

- [ ] **Step 2: Add the two sections and renumber**

In `apps/site/src/docs/Docs.tsx`:

1. Import the new tables and the sizes:

```tsx
import sizes from '../../../../packages/meniscus/size.json';
import { CODE, CONTROL_PROPS, DIALOG_PROPS, GLASS_PROPS, GROUP_PROPS, INDICATOR_PROPS, LAYER_PROPS, MENU_PROPS, NAVBAR_PROPS, POPOVER_PROPS, SIDEBAR_PROPS, STACK_PROPS, STAGE_PROPS, TOASTER_PROPS, TOOLTIP_PROPS, type PropRow } from './content';
```

2. In `SECTIONS`, after `['group', 'Surface tension'],` add:

```ts
  ['kit', 'Overlays, bars and controls'],
  ['tone', 'Tinted and adaptive glass'],
```

3. Renumber the sections after `group`: `a11y` becomes `n={14}`, `performance` `n={15}`, `core` `n={16}`, `support` `n={17}`, `limits` `n={18}`, `releases` `n={19}`.

4. In the "Ready-to-use components" paragraph of `glass` (§2), append before "See their live examples":

```tsx
              {' '}The kit adds overlays, bars and controls: <code>GlassDialog</code>, <code>GlassPopover</code>, <code>GlassMenu</code>,
              <code>GlassTooltip</code>, <code>GlassToaster</code>, <code>GlassNavbar</code>, <code>GlassSidebar</code>, <code>GlassSwitch</code>,
              <code>GlassSlider</code> and <code>GlassSegmented</code> (<a href="#kit">§12</a>).
```

5. After the `group` section, add:

```tsx
          <Section id="kit" n={12} title="Overlays, bars and controls">
            <p>
              <code>GlassDialog</code>, <code>GlassPopover</code>, <code>GlassMenu</code>, <code>GlassTooltip</code> and <code>GlassToaster</code> render
              where you put them and open in the browser’s top layer: <code>&lt;dialog&gt;</code> for dialogs, the Popover API for the rest. They sit
              above everything with no portal and no z-index, keep your providers and context, and server-render as hidden markup. Each arrives and
              leaves on the library’s springs, and hides as soon as its glass has faded. Under reduced motion they fade instead.
            </p>
            <CodeBlock code={CODE.kit} label="Overlays, bars and controls" />
            <h3 id="dialog">Dialogs, sheets and drawers</h3>
            <p>
              A modal <code>GlassDialog</code> keeps focus inside, makes the page behind inert and stops it scrolling. Escape, a click on the
              dimmed page, and dragging a sheet or drawer toward its edge call <code>onOpenChange(false)</code>. A controlled dialog stays open until
              you close it. A <code>&lt;form method="dialog"&gt;</code> inside closes it and leaves the submitter’s value as its{' '}
              <code>returnValue</code>. Focus returns to the trigger.
            </p>
            <PropsTable rows={DIALOG_PROPS} caption="GlassDialog props" />
            <h3 id="popover">Popovers, menus and tooltips</h3>
            <p>
              These three anchor to their trigger with CSS anchor positioning where the browser has it, and otherwise with a small script that
              places them on scroll and resize while they are open. Both flip to the other side at the edge of the screen. The trigger keeps its
              own handlers, ref and attributes. A menu follows the WAI-ARIA menu button pattern. A tooltip shows after a hover delay or at once on
              keyboard focus, and the pointer can move onto it.
            </p>
            <PropsTable rows={POPOVER_PROPS} caption="GlassPopover props" />
            <PropsTable rows={MENU_PROPS} caption="GlassMenu props" />
            <PropsTable rows={TOOLTIP_PROPS} caption="GlassTooltip props" />
            <h3 id="toasts">Toasts</h3>
            <p>
              Render one <code>GlassToaster</code> near the root and call <code>toast()</code> anywhere; calls before the toaster mounts wait for it.
              Screen readers hear each new message politely. Hovering or focusing the toasts pauses their clocks, and a swipe dismisses one. While
              a modal dialog is open, everything outside it is inert, a toast included: it still shows and is announced, but its buttons work only
              after the dialog closes.
            </p>
            <PropsTable rows={TOASTER_PROPS} caption="toast and GlassToaster" />
            <h3 id="bars">Navbar and sidebar</h3>
            <p>
              <code>GlassNavbar</code> sticks to the top of its scroll container and deepens as content passes under it; by default it follows the tone
              of what is behind it. <code>GlassSidebar</code> is a sticky column on wide screens and a drawer below <code>collapseBelow</code>, with
              the same children in the same landmark. The children remount when the layout switches.
            </p>
            <PropsTable rows={NAVBAR_PROPS} caption="GlassNavbar props" />
            <PropsTable rows={SIDEBAR_PROPS} caption="GlassSidebar props" />
            <h3 id="controls">Switch, slider and segmented control</h3>
            <p>
              Each wraps native inputs, so forms, validation, the keyboard and assistive technology work unchanged, and a ref reaches the input. The
              switch’s knob and the slider’s thumb swell into clear lenses while held.
            </p>
            <PropsTable rows={CONTROL_PROPS} caption="GlassSwitch, GlassSlider and GlassSegmented props" />
          </Section>

          <Section id="tone" n={13} title="Tinted and adaptive glass">
            <p>
              A theme is a provider’s props: <code>variant</code> sets how frosted the glass is, <code>intensity</code> how strongly it bends,
              <code>refraction</code> how thick it is. <code>variant="tinted"</code> is colored glass for primary actions: <code>tint</code>, or{' '}
              <code>--meniscus-accent</code>, mixed in at 70%.
            </p>
            <p>
              <code>appearance="adaptive"</code> reads what is behind the glass and turns it light or dark. Tinted glass reads the same way to keep its
              text readable. It reads media under the glass on an 8×8 canvas, and otherwise the first solid background color behind five points of
              it. Toned glass carries <code>data-meniscus-tone</code> and sets its text to <code>--meniscus-ink-on-light</code> or{' '}
              <code>--meniscus-ink-on-dark</code>; your own <code>style.color</code> wins. It can’t read a gradient, a background image, a
              cross-origin image without CORS, or anything with <code>pointer-events: none</code>, and there it keeps the page’s color scheme. It
              samples at most ten times a second while the page scrolls, never during render, and changing tone swaps a color, never a map.
            </p>
            <CodeBlock code={CODE.tone} label="Tinted and adaptive glass" />
          </Section>
```

6. In the `performance` section, after its `<ul>`, add the per-component cost table:

```tsx
            <div className="manual__table-wrap">
              <table className="manual__table">
                <caption className="visually-hidden">What each component adds to Glass</caption>
                <thead>
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col">Gzipped</th>
                    <th scope="col">Over Glass</th>
                    <th scope="col">What runs</th>
                  </tr>
                </thead>
                <tbody>
                  {KIT_COSTS.map(([name, runs]) => (
                    <tr key={name}>
                      <th scope="row">
                        <code>{name}</code>
                      </th>
                      <td className="num">{sizes[name].kB.toFixed(1)} kB</td>
                      <td className="num">{name === 'Glass' ? '—' : `+${(sizes[name].kB - sizes.Glass.kB).toFixed(1)} kB`}</td>
                      <td>{runs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="caption">Measured by <code>packages/meniscus/scripts/size.mjs</code>: each export bundled alone, minified, React external, gzip level 9. CI fails when one grows past its budget.</p>
```

And above `Docs()`:

```tsx
/** What each component runs, besides Glass itself. */
const KIT_COSTS: ReadonlyArray<readonly [keyof typeof sizes, string]> = [
  ['Glass', 'One filter per glass; maps built once per shape.'],
  ['GlassDialog', 'Springs while opening and closing; nothing while open.'],
  ['GlassPopover', 'Springs while opening and closing; a scroll listener while open where CSS anchor positioning is missing.'],
  ['GlassMenu', 'As a popover; the highlight springs as it moves.'],
  ['GlassTooltip', 'A timer while hovered.'],
  ['GlassToaster', 'A timer per shown toast.'],
  ['GlassNavbar', 'One passive scroll listener; springs as the edge is crossed; adaptive sampling at most ten times a second while scrolling.'],
  ['GlassSidebar', 'Nothing as a column; a dialog as a drawer.'],
  ['GlassSwitch', 'Springs while pressed.'],
  ['GlassSlider', 'Springs while dragged; the thumb refracts as it moves.'],
  ['GlassSegmented', 'The selection springs when the choice changes.'],
];
```

7. In the `support` section's caption, append: " Overlays use the Popover API (Chrome 114, Safari 17, Firefox 125); older browsers show them in place with fixed positioning, where a parent’s overflow can clip them."

8. In `limits`, add:

```tsx
              <li>
                A toast shown while a modal dialog is open is inert until the dialog closes: the browser makes everything outside a modal inert.
              </li>
              <li>
                Adaptive tint can’t read gradients, background images, cross-origin images without CORS, or elements with{' '}
                <code>pointer-events: none</code>. There it follows the page’s color scheme.
              </li>
```

- [ ] **Step 3: Update the README and the changelog**

In `README.md`, after the "Watch the full 30-second demo" paragraph, add:

```md
Components: `Glass` and its layers; `GlassButton`, `GlassPanel`, `GlassTabs`, the form fields and `GlassLoader`; and the kit of overlays, bars and controls: `GlassDialog` (modal, sheet or drawer), `GlassPopover`, `GlassMenu`, `GlassTooltip`, `GlassToaster` with `toast()`, `GlassNavbar`, `GlassSidebar`, `GlassSwitch`, `GlassSlider` and `GlassSegmented`. [See them all](https://thanhphuchuynh.github.io/meniscus/components/).
```

In `CHANGELOG.md`, under `## [Unreleased]`, add:

```md
### Added

- `GlassDialog`: a modal card, a bottom sheet, or a side drawer, in the browser's top layer. It keeps focus inside, closes on Escape, on the dimmed page or on a drag away, and returns focus to its trigger. `<form method="dialog">` works inside.
- `GlassPopover`, `GlassMenu` and `GlassTooltip`, anchored to their trigger with CSS anchor positioning or, where that's missing, a small positioning script. The menu follows the WAI-ARIA menu button pattern, with a glass highlight that flows between items.
- `GlassToaster` and `toast()`: messages that arrive on a spring, stack three at a time, pause while read, swipe away and are announced politely.
- `GlassNavbar`, a sticky bar that deepens as content scrolls under it, and `GlassSidebar`, a glass column that becomes a drawer on narrow screens.
- `GlassSwitch`, `GlassSlider` and `GlassSegmented`, on native inputs. The switch knob and slider thumb become clear lenses while held.
- `variant="tinted"`: colored glass from `tint` or `--meniscus-accent`, with text that stays readable.
- `appearance="adaptive"`: glass that reads what is behind it and turns light or dark with it, carrying `data-meniscus-tone` and setting `--meniscus-ink-on-light` or `--meniscus-ink-on-dark`.
- `supportsPopover`, `supportsAnchorPositioning` and their overrides in `meniscus/core`.

### Fixed

- Glass in the top layer no longer warns that a faded parent confines it.
```

- [ ] **Step 4: Build and check the manual**

Run: `pnpm --filter site build`, then look at `/docs/` in the dev server.
Expected: the build passes. §12 and §13 are listed in the manual's index, the section numbers run 1 to 19 in order, the cost table shows eleven rows with measured sizes, and every internal link (`#kit`, `#tone`, `#dialog` and so on) lands on its heading.

- [ ] **Step 5: Commit**

```bash
git add apps/site/src/docs/content.ts apps/site/src/docs/Docs.tsx README.md CHANGELOG.md
git commit -m "docs: the component kit, tinted and adaptive glass, and what each component costs"
```

### Task 27: The Next.js example uses the kit

**Files:**
- Create: `examples/next-app/app/toast-button.tsx`
- Modify: `examples/next-app/app/page.tsx`

**Interfaces:**
- Consumes: `GlassDialog`, `GlassButton`, `GlassToaster` and `toast` from `meniscus`. CI installs the library packed from this branch, so these exist there before 0.6.0 is published.

- [ ] **Step 1: Add a client button that calls `toast()`**

```tsx
// examples/next-app/app/toast-button.tsx
'use client';

import { GlassButton, toast } from 'meniscus';

// toast() runs in the browser: a Server Component can render this button, not call it.
export function ToastButton() {
  return <GlassButton onClick={() => toast('Plate saved', { description: 'From a client component.' })}>Save plate</GlassButton>;
}
```

- [ ] **Step 2: Render the kit from the Server Component**

Replace `examples/next-app/app/page.tsx` with:

```tsx
import { Glass, GlassButton, GlassDialog, GlassLayer, GlassProvider, GlassStack, GlassToaster } from 'meniscus';
import { PathReport } from './path-report';
import { ToastButton } from './toast-button';

// A Server Component. meniscus's React entries carry "use client", so they
// render here as client components; every prop crosses as plain data, and
// elements such as a dialog's trigger cross as elements.
export default function Page() {
  return (
    <GlassProvider lightAngle={300}>
      <main className="page">
        <Glass as="header" radius="capsule" className="bar">
          <strong>meniscus</strong>
          <GlassButton>Plates</GlassButton>
          <GlassDialog label="Search the plates" trigger={<GlassButton>Search</GlassButton>}>
            <p>A dialog rendered from a Server Component.</p>
            <form method="dialog">
              <GlassButton type="submit">Done</GlassButton>
            </form>
          </GlassDialog>
          <ToastButton />
        </Glass>
        {/* Named exports on the server: <Glass.Stack> reads a property off a client component, which is undefined here. */}
        <GlassStack className="stack">
          <GlassLayer kind="context" className="scene" />
          <GlassLayer depth={1} className="card" radius={26}>
            <h1>Glass from a Server Component</h1>
            <PathReport />
          </GlassLayer>
        </GlassStack>
      </main>
      <GlassToaster />
    </GlassProvider>
  );
}
```

- [ ] **Step 3: Build it against the packed library, as CI does**

Run from the repository root:

```bash
pnpm --filter meniscus build
(cd packages/meniscus && npm pack --pack-destination /tmp/meniscus-pack)
(cd examples/next-app && npm ci --no-audit --no-fund && npm install --no-save --no-audit --no-fund /tmp/meniscus-pack/meniscus-*.tgz && NEXT_TELEMETRY_DISABLED=1 npm run build)
```

Expected: `next build` succeeds, and the route `/` builds as a static page. If it fails with "Functions cannot be passed directly to Client Components", a function prop crossed the server boundary. Only `ToastButton` may hold a callback.

Afterwards, run `git checkout examples/next-app/package-lock.json examples/next-app/package.json` in case npm touched them. The example must keep depending on the published range.

- [ ] **Step 4: Commit**

```bash
git add examples/next-app/app/toast-button.tsx examples/next-app/app/page.tsx
git commit -m "chore: render a GlassDialog and GlassToaster from the Next.js example's Server Component"
```

### Task 28: Release 0.6.0

**Only on the user's explicit go-ahead.** Everything before this task can be reviewed on the branch first. Publishing to npm, pushing a tag and moving the examples are outward-facing, so ask before starting.

**Files:**
- Modify: `packages/meniscus/package.json` (version)
- Modify: `CHANGELOG.md` (the heading)
- Modify: `apps/site/src/home/Home.tsx` (the "Glass, gzipped" readout, only if it changed)
- Modify, after publishing: `examples/optics/package.json`, `examples/next-app/package.json` and their lockfiles

- [ ] **Step 1: Bring the branch onto main**

```bash
git switch main && git pull --ff-only && git merge --ff-only feat/component-kit
```

Expected: a fast-forward. If main moved, rebase the branch onto main first (`git switch feat/component-kit && git rebase main`), rerun `pnpm test`, then fast-forward.

- [ ] **Step 2: Version and changelog**

Set `"version": "0.6.0"` in `packages/meniscus/package.json`. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [0.6.0] - <today's date, YYYY-MM-DD>` and put a new empty `## [Unreleased]` above it.

- [ ] **Step 3: Verify as RELEASING.md says**

Run: `pnpm install --frozen-lockfile && pnpm test && pnpm typecheck && pnpm build && pnpm --filter meniscus size && (cd packages/meniscus && npm pack --dry-run)`
Expected: everything passes, and the tarball lists `dist/` files, `README.md` and `LICENSE` only (no `scripts/`, no `size.json`). If `size.json` shows `Glass` at a size that rounds differently from the site's "21 kB", update the readout in `apps/site/src/home/Home.tsx`.

- [ ] **Step 4: Commit, push, tag**

```bash
git add packages/meniscus/package.json CHANGELOG.md apps/site/src/home/Home.tsx
git commit -m "chore: release v0.6.0"
git push origin main
```

Wait for CI (check, next-example) and Pages on this commit to pass: `gh run list --branch main --limit 4`. Then:

```bash
git tag -a v0.6.0 -m "meniscus v0.6.0"
git push origin v0.6.0
```

Watch the Release workflow: `gh run watch $(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')`.
Expected: success. `npm view meniscus version` prints `0.6.0` (allow a minute for the registry), and the GitHub release has `meniscus-0.6.0.tgz`.

- [ ] **Step 5: Move the examples to 0.6**

In `examples/optics/package.json` and `examples/next-app/package.json`, change only the version range to `"meniscus": "^0.6.0"`, keeping each file's compact formatting. For example: `sed -i '' 's/"meniscus": "\^0.5.0"/"meniscus": "^0.6.0"/' examples/*/package.json`. Then refresh each lockfile with `npm install --package-lock-only --no-audit --no-fund` in each example directory. Check `git diff examples` shows only the range and lockfile changes.

```bash
git add examples/optics/package.json examples/optics/package-lock.json examples/next-app/package.json examples/next-app/package-lock.json
git commit -m "chore: move the examples to meniscus 0.6"
git push origin main
```

Expected: CI and Pages pass on this commit too.

