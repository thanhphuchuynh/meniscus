# Component kit design

**Goal:** Ready-to-use liquid-glass components, so developers can drop in a dialog, navbar, tooltip, sidebar, toast, popover, menu, switch, slider or segmented control instead of building one on `Glass`. Add a tinted preset and adaptive tint, so the glass stays readable over whatever is behind it. It ships as meniscus 0.6.0.

**Sub-project 1 of 6.** The later sub-projects are hardening, the 3D lens, liquid motion (which also covers the animation presets asked for in §1), the site story and the shareables. Each gets its own spec.

**Decisions made while brainstorming:**
- The full kit: the four components asked for, plus Toast, Popover and Menu, plus Switch, Slider and Segmented.
- Overlays use the browser's top layer (`<dialog>` and the Popover API): no portals, no dependencies.
- Card stays `GlassPanel`.

**Constraints:**
- No new runtime dependencies.
- Every browser keeps a working path.
- Server rendering stays safe: no `window` access during render, and no hydration mismatches.
- The library ships no stylesheet to import. Styles are inline, and the only `<style>` elements are the ones a component renders for rules inline styles can't express.
- Reduced motion, reduced transparency, increased contrast and forced colors apply to everything new.
- Every public prop and type has JSDoc.
- Commits carry no `Co-Authored-By` trailer.

## 1. Conventions shared by all ten

| Rule | Detail |
|---|---|
| Names | Each component is `Glass…`. Where an accessible name is needed, it comes from `label`. |
| Open state | Overlays take `open`, `defaultOpen` and `onOpenChange(open)`. Controlled overlays stay as they are until the parent changes `open`. |
| Selection | Pickers take `value`, `defaultValue` and `onValueChange`, as `GlassTabs` does. |
| Form controls | Wrap a native input, as `GlassCheckbox` does. They take native input props plus `label`, their `ref` reaches the input, and forms, validation and assistive technology work unchanged. |
| Glass props | Every `GlassOptions` key (`tint`, `radius`, `intensity`, `variant`, …) applies to the component's glass surface. Form controls pick them out of their props with `GLASS_OPTION_KEYS`: Switch gives them to its knob, Slider to its thumb, Segmented to its indicator. |
| `className`, `style` | Overlays and layout components pass them to their glass surface. Form controls pass them to their root `label` or `fieldset`. |
| Springs | Overlays take `physics?: SpringInput` (a preset name or `{ mass, stiffness, damping }`) for their entrance and exit. |
| Theming hooks | `--meniscus-accent` (tinted glass and the Switch and Slider fills), `--meniscus-focus-ring` (as today), `--meniscus-scrim`, `--meniscus-ink-on-light`, `--meniscus-ink-on-dark`. |

## 2. Shared foundations

### 2.1 Files

```
packages/meniscus/src/
  core/place.ts        place(): anchored positioning, portable and pure
  core/tone.ts         luminance, composite and pickTone(): portable and pure
  core/support.ts      + supportsPopover(), supportsAnchorPositioning(), and their overrides
  core/glass.ts        + the 'tinted' variant and the 'adaptive' appearance
  react/overlay.ts     useOverlay(): presence springs, show and hide, dismissal, focus return, scroll lock
  react/anchor.ts      useAnchor(): CSS anchor positioning, or place() on scroll and resize
  react/tone.ts        useBackdropTone(): samples what is behind a glass
  react/focus.ts       focusVisible(), firstFocusable()
  react/trigger.tsx    useTrigger(): clones an overlay's trigger, keeping its handlers and ref
  react/drag.ts        useDragDismiss(): drag toward an edge to dismiss
  react/options.ts     splitGlassOptions(): a control's glass options from its native props
  react/GlassDialog.tsx  GlassPopover.tsx  GlassTooltip.tsx  GlassMenu.tsx  GlassToast.tsx
  react/GlassNavbar.tsx  GlassSidebar.tsx  GlassSwitch.tsx  GlassSlider.tsx  GlassSegmented.tsx
```

Every component is a named export of `meniscus`, in its own module, and the package is `sideEffects: false`, so importing one component doesn't bring in the others (§7 checks this). `place` and the tone functions stay internal; tests import them directly. The support overrides are exported from `meniscus/core`, like the existing `override*` functions.

### 2.2 `useOverlay`: presence, show and hide, dismissal

```ts
interface OverlayOptions {
  open: boolean;                    // resolved controlled or uncontrolled state
  requestClose: () => void;         // calls onOpenChange(false); closes an uncontrolled overlay
  kind: 'modal' | 'popover';
  physics?: SpringInput;
  dismiss: { escape: boolean; outside: boolean; focusOut: boolean };
  trigger: HTMLElement | null;      // focus returns here
}
function useOverlay(element: HTMLElement | null, options: OverlayOptions): { optics: GlassPhysics; shown: boolean };
```

- **Entrance.** When `open` turns true, show the element: `showModal()` for `modal`, `showPopover()` for `popover`. Then spring presence and shadow from 0 to 1 on the overlay's own `GlassPhysics`, which the glass surface takes as `optics`. `Glass` already fades opacity with presence, scales the refraction with it, and writes `--meniscus-presence` to its element.
- **Exit.** When `open` turns false, spring presence to 0. Hide the element (`close()` or `hidePopover()`) as soon as `presenceOpacity(presence)` reaches 0, which happens at presence 0.15, without waiting for the spring's tail. Then return focus to `trigger` if focus was inside the overlay.
- **Reopening mid-exit** turns the same spring around, with no restart.
- **Reduced motion.** Presence runs on a short, critically damped spring that settles in about 150 ms. That gives a fade with no slide or swell.
- **Escape.**
  - Modal: intercept the dialog's `cancel` event with `preventDefault()`, then call `requestClose()`.
  - Popover: a `keydown` listener on the document while open.
- **Outside click.** A capturing `pointerdown` on the document while open. It ignores the trigger and the overlay itself.
- **Focus out** (Popover only). When focus moves outside both the trigger and the overlay, close it.
- **Scroll lock** (modals only). While at least one modal is open, the root element gets `overflow: hidden` and `scrollbar-gutter: stable`. A reference count handles nested modals, and the previous inline values come back afterwards.
- **Fading.** Opacity never goes on the `<dialog>`: a parent below full opacity stops the glass refracting the page. Only the glass surface and the scrim fade.
- **Popover mode.** Always `popover="manual"`. With `auto`, the browser hides the element instantly and cuts the exit animation.

### 2.3 Anchored positioning

```ts
type GlassPlacement = 'top' | 'bottom' | 'left' | 'right'
  | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
  | 'left-start' | 'left-end' | 'right-start' | 'right-end';
interface Rect { x: number; y: number; width: number; height: number }
function place(anchor: Rect, box: { width: number; height: number }, placement: GlassPlacement,
  options: { offset: number; viewport: Rect; padding?: number /* 8 */ }): { x: number; y: number; placement: GlassPlacement };
```

- **`place()`** puts the box on the requested side, `offset` px away, aligned to the center, start or end. If it overflows that side of the viewport and the opposite side has more room, it flips. It then shifts along the other axis to stay `padding` px inside the viewport. It returns the side it actually used.
- **With CSS anchor positioning** (`supportsAnchorPositioning()`), the trigger gets a unique `anchor-name`, set through its ref so the trigger's own styles are untouched. The overlay gets:
  - `position-anchor` naming that anchor.
  - A `position-area` mapped from the placement. For example, `bottom-start` becomes `bottom span-right` and `left-end` becomes `left span-top`.
  - A margin of `offset` on the side facing the trigger.
  - `position-try-fallbacks: flip-block, flip-inline`.
- **Without it**, `useAnchor` runs `place()` while the overlay is open: once on open, then on `scroll` (capturing, passive) and `resize`, at most once per animation frame. It stops when the overlay closes.

### 2.4 Support detection

- `supportsPopover()`: `HTMLElement.prototype` has `showPopover`.
- `supportsAnchorPositioning()`: `CSS.supports('position-area', 'bottom')` and `CSS.supports('anchor-name', '--a')`.
- Each is cached, has an override for tests and hosts, and returns false on the server.
- Without the Popover API, a popover renders in place with `position: fixed` and `z-index: 2147483000`, and `place()` positions it. It can be clipped by a parent's `overflow` or `transform`, and the manual says so.

## 3. The components

### 3.1 GlassDialog: modal, sheet, drawer

```ts
interface GlassDialogProps extends Omit<GlassProps<'div'>, 'as' | 'appear' | 'optics' | 'interactive'> {
  label?: string;                                       // or aria-labelledby, naming your heading
  placement?: 'center' | 'bottom' | 'left' | 'right';   // default 'center'
  trigger?: ReactElement;                               // opens the dialog; focus returns to it
  open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void;
  physics?: SpringInput;                                // default 'snappy'
}
```

- **Structure.** A `<dialog>` stretched over the whole viewport, with `aria-label` or `aria-labelledby`. Inside it are two things:
  - A scrim filling the dialog. Its opacity follows presence, and its color is `var(--meniscus-scrim, light-dark(rgb(8 10 14 / 0.16), rgb(0 0 0 / 0.42)))`.
  - The glass panel, which holds the children.
- **Stylesheet.** Each dialog renders `<style>[data-meniscus-dialog]::backdrop{background:transparent}</style>`, and the `<dialog>` has `outline: none`.
- **Focus.** `showModal()` moves focus to the first focusable child, or to an `autofocus` one. If there is none, the panel takes `tabIndex={-1}` and receives focus.
- **Closing.**
  - Escape and a click on the scrim call `onOpenChange(false)`. A controlled dialog stays open if the parent ignores that.
  - A `<form method="dialog">` submit is intercepted. The dialog records the submitter's `value` as its `returnValue`, runs the exit and then closes.
- **Placements.**

  | placement | Panel | Entrance |
  |---|---|---|
  | `center` | `min(32rem, 100% − 2rem)` wide, at most `100% − 2rem` tall, centered | presence fade and swell |
  | `bottom` (sheet) | `min(40rem, 100% − 16px)` wide, 8 px above the bottom edge, all corners rounded, with a grabber at the top | slides up by `(1 − presence) × (100% + 8px)` |
  | `left` / `right` (drawer) | `min(22rem, 100% − 3rem)` wide, full height less 8 px on each side, 8 px from its edge | slides in from its edge the same way |

  The panel scrolls its own overflow, and its padding defaults to `1.5rem`.
- **Drag to dismiss.** Sheets drag down from their top strip (the grabber, `touch-action: none`). Drawers drag toward their edge from anywhere on the panel, and `touch-action: pan-y` keeps vertical scrolling inside them. On release:
  - Past 35% of the panel's size, or faster than 600 px/s toward the edge, it calls `requestClose()`.
  - Otherwise it springs back.
  - Under reduced motion the drag still works, but the release doesn't animate.

### 3.2 GlassPopover

```ts
interface GlassPopoverProps extends Omit<GlassProps<'div'>, 'as' | 'appear' | 'optics' | 'interactive'> {
  label: string;
  trigger: ReactElement;
  placement?: GlassPlacement;   // default 'bottom'
  offset?: number;              // default 8
  open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void;
  physics?: SpringInput;        // default 'snappy'
}
```

- **Trigger.** Cloned with `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` and a click toggle, chained with its own `onClick`.
- **Surface.** A glass `role="dialog"` with `aria-label`, using `popover="manual"`. When it opens, focus moves to its first focusable child, or to the surface.
- **Closing.** An outside click, Escape, or focus leaving both the trigger and the surface closes it. Focus then returns to the trigger if it was inside.

### 3.3 GlassTooltip

```ts
interface GlassTooltipProps extends Omit<GlassProps<'div'>, 'as' | 'children' | 'content' | 'appear' | 'optics' | 'interactive'> {
  content: ReactNode;
  children: ReactElement;       // the trigger, which must pass its ref through
  placement?: GlassPlacement;   // default 'top'
  offset?: number;              // default 6
  delay?: number;               // ms before showing on hover; default 500
}
```

- **Surface.** `role="tooltip"`, `popover="manual"`. The trigger gets `aria-describedby`.
- **Showing.**
  - After `delay` on pointer hover.
  - At once on keyboard focus (`:focus-visible`).
  - At once when another tooltip closed less than 300 ms ago.
  - Never for touch pointers.
- **Hiding.**
  - When the pointer leaves, after a 100 ms grace period, so the pointer can reach the tooltip.
  - On blur.
  - On Escape.

  This satisfies WCAG 1.4.13: the tooltip can be dismissed, hovered, and it stays put.
- **Motion.** Springs are `'stiff'`, and the tooltip isn't interactive.

### 3.4 GlassMenu

```ts
type GlassMenuItem =
  | { label: ReactNode; onSelect: () => void; disabled?: boolean; icon?: ReactNode; shortcut?: string; textValue?: string }
  | 'separator';
interface GlassMenuProps extends Omit<GlassProps<'div'>, 'as' | 'children' | 'appear' | 'optics' | 'interactive'> {
  label: string;
  trigger: ReactElement;
  items: readonly GlassMenuItem[];
  placement?: GlassPlacement;   // default 'bottom-start'
  offset?: number;              // default 6
  open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void;
  physics?: SpringInput;        // default 'snappy'
}
```

- **Semantics.**
  - The trigger follows the WAI-ARIA menu button pattern: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`.
  - The surface is `role="menu"` with `aria-label`.
  - Each item is a `role="menuitem"` button with a roving `tabIndex`. Separators are `role="separator"`, and disabled items carry `aria-disabled`.
- **Highlight.** A `GlassIndicator` follows the highlighted item.
- **Shortcuts.** `shortcut` is shown only; the app binds the key itself.
- **Typeahead.** It matches `textValue`, or `label` when the label is a string.

### 3.5 GlassToaster and toast()

```ts
interface ToastOptions {
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  duration?: number;   // ms, default 5000; Infinity stays until dismissed
  id?: string;         // reuse to replace a toast in place
}
declare const toast: ((message: ReactNode, options?: ToastOptions) => string) & { dismiss(id?: string): void };
interface GlassToasterProps extends GlassOptions {
  placement?: 'top' | 'bottom' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';   // default 'bottom'
  label?: string;      // region name, default 'Notifications'
  max?: number;        // visible at once, default 3
  physics?: SpringInput;   // default 'bouncy'
  className?: string;  // on every toast
  style?: CSSProperties;   // on every toast
}
```

- **The store.** A module-level store (read with `useSyncExternalStore`) holds the queue. `toast()` works anywhere, and a server-side call is a no-op. `toast.dismiss()` without an id clears them all.
- **The Toaster** is a `<section aria-label>` with `popover="manual"`, shown while toasts exist.
  - Each toast is its own glass. The Toaster's glass props, `className` and `style` go to every toast. `placement` positions the section.
  - A new toast re-shows the section, which lifts it to the top of the top layer, above any open modal.
  - The newest toast sits nearest the edge. Beyond `max`, the oldest waits.
- **Announcements.** A visually hidden `role="status"` live region, always rendered outside the popover, announces each new message. Live regions inside a hidden element are missed.
- **Timers** pause while the pointer is over the Toaster or focus is inside it.
- **Swipe.** Dragging a toast sideways dismisses it past 40% of its width or faster than 600 px/s. `touch-action: pan-y` keeps vertical scrolling.
- **Platform limit.** While a modal dialog is open, everything outside it is inert, a toast's buttons included. A toast still appears and is announced, but its action works only after the modal closes. The manual says so.

### 3.6 GlassNavbar

```ts
interface GlassNavbarProps extends Omit<GlassProps<'nav'>, 'as'> {
  label: string;          // aria-label of the <nav>
  inset?: number;         // px from the top of its scroll container while stuck; default 12
  scrollEdge?: boolean;   // deepen tint and shadow once content scrolls under it; default true
}
```

- **Defaults.**
  - Renders a `<nav>` with `radius="capsule"` and `appearance="adaptive"`.
  - Layout: `position: sticky`, `top: inset`, `margin-inline: inset`, `z-index: 50`, `display: flex`, `align-items: center`, `gap: 1rem`.
  - Every default can be overridden.
- **Scroll edge.** It watches the nearest scrolling ancestor (the window by default) with a passive listener. At a scroll offset of 4 px or less, the navbar's `optics` rest at tint 0.35 and shadow 0.4. Beyond that they spring to 1 and 1. Nothing re-renders and no maps are rebuilt.

### 3.7 GlassSidebar

```ts
interface GlassSidebarProps extends Omit<GlassProps<'aside'>, 'as'> {
  label: string;
  as?: 'aside' | 'nav';     // default 'aside'
  collapseBelow?: number;   // viewport px; below it, a drawer. Default 768; 0 never collapses
  side?: 'left' | 'right';  // drawer side, default 'left'
  inset?: number;           // px from the viewport edges, default 12
  open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void;   // the drawer's state
}
```

- **Wide screens.** A sticky glass column: an `<aside>` or `<nav>` with `aria-label`, `top: inset`, `height: calc(100dvh − 2 × inset)`, `width: 16rem`, scrolling its own overflow. `open` is ignored.
- **Below `collapseBelow`**, the same children render inside a `GlassDialog` with `placement={side}` and `label`, driven by `open`. They keep their landmark: the dialog panel wraps them in the same `aside` or `nav`.
- **Choosing the mode.**
  - `useSyncExternalStore` watches `matchMedia`, with a server snapshot of "wide", so hydration matches the server.
  - A rendered `<style>` with `@media (max-width: …)` hides the column before JavaScript runs, so phones never see it flash.
  - The children remount when the mode changes: once at load on a phone, and whenever a window crosses the breakpoint.
- **Change from the chat design.** This replaces the "one `<dialog>` for both modes" idea. A `<dialog>` always carries the dialog role, which is wrong for a sidebar that stays on the page.

### 3.8 GlassSwitch

```ts
interface GlassSwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role' | 'children'>, GlassOptions {
  label: string;
}
```

- **Structure.** A root `<label>`, then the visible label, then the track, which holds the glass knob and an invisible native `<input type="checkbox" role="switch">` covering the track. The ref reaches the input.
- **Look.** The track is a capsule, filled with `--meniscus-accent` when checked.
- **Press and drag.** While pressed or dragged, the knob swells to 1.35× and turns into a clear lens (its tint springs toward 0.15 and its refraction toward 1.6), so it bends the track beneath it. Dragging moves the knob. The native input has `pointer-events: none`, so pointer input lands on the label and a plain tap toggles through it. Releasing a drag past the middle toggles through `input.click()`. The label's click that ends the drag is canceled, so the switch never toggles twice. A checkbox's own click can't be canceled without React reporting a change the browser then undoes.
- **Focus ring.** `--meniscus-focus-ring` on the track while the input is `:focus-visible`.
- **Reduced motion.** No swell and no drag animation; the knob snaps.

### 3.9 GlassSlider

```ts
interface GlassSliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>, GlassOptions {
  label: string;
  format?: (value: number) => string;   // shows the value by the label and sets aria-valuetext
}
```

- **Structure.**
  - A root `<div>`.
  - Its first row holds a `<label htmlFor>` and the formatted value in an `<output>`. A root `<label>` would pull the changing value into the slider's accessible name.
  - Below that is the track, a rule with a fill. It holds the glass thumb and an invisible native `<input type="range">` covering it, at least 24 px tall.
  - The thumb's position is `--meniscus-value` (0 to 1), updated on input.
- **Dragging.** While dragging, the thumb swells into a lens as the Switch knob does. Since it's glass, it refracts the fill line beneath it: live in Chromium, frosted elsewhere.
- **Keyboard, forms and assistive technology** are the native input's. The focus ring goes on the thumb.

### 3.10 GlassSegmented

```ts
interface GlassSegmentedOption { value: string; label: ReactNode; disabled?: boolean }
interface GlassSegmentedProps extends GlassOptions {
  label: string;           // the legend
  options: readonly GlassSegmentedOption[];
  value?: string; defaultValue?: string; onValueChange?: (value: string) => void;
  name?: string;           // radio name for forms; defaults to a generated id
  className?: string; style?: CSSProperties;
}
```

- **Structure.** A `<fieldset>` with a `<legend>`, holding one native radio per option, each visually hidden inside its `<label>`. Arrow keys and forms are native.
- **Selection.** A `GlassIndicator` (taking the glass props) follows the checked option, moved over from the site's `Segmented`.

## 4. Presets and tone

### 4.1 Tinted

- `GlassVariant` gains `'tinted'`: blur 4, saturation 1.8, specular 0.9, rim 0.8, shade 0.25.
- `tint` is the glass's color, mixed at 70% as `color-mix(in srgb, <tint> 70%, transparent)`. With no `tint`, the color is `var(--meniscus-accent, #2563eb)`. Under every other variant, `tint` is still laid over as given.
- Text on tinted glass takes its tone from the mix composited over what is behind the glass (§4.3), so tinted glass samples its backdrop the way adaptive glass does. Like adaptive glass, it sets `data-meniscus-tone` and `color` (§4.2). Until the first sample (on the server, and until hydration), it inherits the text color. The first sample runs in a layout effect, before the first client paint.

### 4.2 Adaptive

- `GlassAppearance` gains `'adaptive'`. It's opt-in everywhere except `GlassNavbar`, where it's the default.
- Before sampling (on the server, and in the first client render), adaptive glass draws exactly as `auto` does.
- Once the tone is known, the tint is the variant's light or dark tint, the element gets `data-meniscus-tone`, and `color` is set to `var(--meniscus-ink-on-light, #15181d)` or `var(--meniscus-ink-on-dark, #f7f8fa)`. The app's own `style.color` wins.
- Tone changes fade `background-color` and `color` over 240 ms; under reduced motion they switch at once.
- Under reduced transparency or increased contrast the glass is opaque (as today), so sampling stops and the tone follows the color scheme.

### 4.3 Tone math (`core/tone.ts`, pure)

- `luminance([r, g, b])` is WCAG relative luminance.
- `composite(tint rgba, backdrop luminance)` is `a·L(tint) + (1 − a)·L(backdrop)`.
- `pickTone(L, previous)` picks `'dark'` below 0.16 and `'light'` above 0.20. In between it keeps `previous`, or picks `'light'` when there is none. The margin sits around 0.18, where black and white text have equal contrast.

### 4.4 Sampling (`react/tone.ts`)

`useBackdropTone(node, enabled)` returns `'light' | 'dark' | null` and never runs during render.

1. **Media.** If the glass has an image, video or canvas `backdrop`, or sits in a stage, draw the region under the glass (using `fitRect`'s mapping) onto an 8×8 canvas with `willReadFrequently: true`, then average it. A tainted canvas (cross-origin without CORS) throws, which counts as unreadable.
2. **The page.** Otherwise, `document.elementsFromPoint` at the center and at the four points 25% and 75% across and down, skipping the glass, its descendants and other `[data-meniscus]` glass. Take the first element that is an `img`, `video` or `canvas` (sampled at that point as in step 1) or has a `background-color` with alpha of at least 0.5. Average the luminance over the points that found one.
3. **Nothing readable** (a gradient or a background image, say) returns null, and the glass stays `auto`.

It samples on mount, on resize (`ResizeObserver`), and on scroll or resize of the window and the nearest scrolling ancestor. Those samples are throttled to one per 100 ms, and only happen while an `IntersectionObserver` reports the glass on screen. A video is sampled every 500 ms while it plays.

## 5. Fallbacks and development warnings

| Situation | Behavior |
|---|---|
| Safari, Firefox | Glass surfaces frost, as today; media backdrops refract in WebGL. Overlays behave the same. |
| No Popover API (Chrome < 114, Safari < 17, Firefox < 125) | Popovers render in place with `position: fixed`, positioned by `place()`. |
| No CSS anchor positioning | `place()` positions them on scroll and resize. |
| Before hydration, or without JavaScript | Closed overlays are hidden markup, the navbar and sidebar are frosted, and Switch, Slider and Segmented are working native inputs inside forms. |
| Reduced transparency, increased contrast, forced colors | Opaque glass with a hairline edge, as today. Tinted glass under forced colors takes system colors. |

Development-only warnings, each once per page:
- A dialog without `label` or `aria-labelledby`.
- A `trigger` or Tooltip child whose ref never attaches (a component that doesn't pass its ref through).
- `toast()` called while no `GlassToaster` is mounted.
- More than one `GlassToaster` mounted.

One fix to existing code: the confining-ancestor warning in `Glass.tsx` returns early for glass in the top layer. It checks `:popover-open` on the glass and `:modal` on its ancestors, inside a `try`, because older engines throw on unknown pseudo-classes.

## 6. Accessibility

| Component | Keys and semantics |
|---|---|
| Dialog | Native modal: focus trapped and the page behind inert. Escape closes. Focus returns to the trigger. |
| Popover | Enter or Space on the trigger toggles it. Escape closes and returns focus. Tab out closes. |
| Tooltip | Shows on focus-visible and hides on Escape or blur. `aria-describedby` on the trigger. |
| Menu | On the trigger: Enter, Space or ArrowDown opens on the first item, ArrowUp on the last. In the menu: arrows move and wrap, Home and End jump, a letter jumps to the next match, Enter or Space selects and closes, Escape closes and returns focus, Tab closes. |
| Toast | Announced politely. Timers pause on hover and focus. Action buttons are in the tab order within the region. |
| Navbar, Sidebar | `nav` and `aside` landmarks named by `label`. The collapsed sidebar is a modal drawer. |
| Switch | Native checkbox with `role="switch"`. Space toggles it. |
| Slider | Native range input with its full keyboard support. `aria-valuetext` comes from `format`. |
| Segmented | Native radios in a `fieldset` with a `legend`, moved with the arrow keys. |

- Hit targets are at least 24 px (WCAG 2.5.8, AA).
- Focus rings use `--meniscus-focus-ring`.
- Reduced motion replaces every spring, drag release and swell with a short fade or a snap.

## 7. Testing

**Unit tests** (`pnpm test`, Vitest in jsdom):
- **Setup.** `test/setup/top-layer.ts` adds `showModal`, `show`, `close`, `showPopover` and `hidePopover`, which toggle the `open` attribute or a flag and fire `close` or `toggle`. jsdom 30 has none of these. It's registered in `vitest.config.ts` as a setup file.
- **Per component:**
  - `renderToString` works without `window` and gives the expected markup (closed overlays hidden, native inputs present).
  - ARIA wiring: `aria-expanded`, `aria-controls`, `aria-describedby`, roles and names.
  - Controlled and uncontrolled state.
  - Keyboard behavior from §6. Native behavior (radio arrows, range keys) isn't retested.
- **Hydration.** One test server-renders all ten, hydrates with `hydrateRoot`, and fails on any `onRecoverableError`.
- **Overlay lifecycle**, on `GlassPhysics` with `scheduler: 'manual'`:
  - Opening calls show.
  - A close request calls `onOpenChange(false)`.
  - A controlled dialog that ignores it stays open.
  - Hide is called at the step where presence opacity reaches 0, and not before.
  - Focus returns to the trigger.
  - Reopening mid-exit reverses without hiding.
- **Pure functions, table-driven:**
  - `place()`: each placement, flipping, shifting and the returned side.
  - The toast queue: order, `max`, replacing by `id`, dismissing, timers and pausing.
  - `pickTone`: both thresholds and the margin.
  - `composite`.
- **Sampling.** A mocked `elementsFromPoint` and computed styles cover: skipping glass, alpha of at least 0.5, averaging, null when nothing readable, and throttling.

**Browser check.** `apps/site/scripts/check-components.mjs` runs Playwright against /components in Chromium, WebKit and Firefox. It checks:
- Tab stays inside an open modal.
- Escape and outside clicks close the dialog, popover and menu, and focus returns to the trigger.
- A toast appears above an open modal.
- Menu keyboard navigation works.
- Overlays stay inside the viewport near every edge.
- The console stays free of errors.

Like the other checks, it runs by hand against the dev server. WebKit and Firefox need `pnpm exec playwright install webkit firefox` once. Headless WebKit doesn't draw `backdrop-filter`, so glass visuals are judged from Chromium captures only.

## 8. Size check

- `packages/meniscus/scripts/size.mjs` bundles `import { X } from 'meniscus'` for every export, from the built `dist`. It uses esbuild with minification, React external, `NODE_ENV=production` and splitting, and sums the gzip -9 sizes of the statically imported chunks, as the site's "Glass, gzipped" readout does.
- It prints each export's size and what it adds on top of `Glass`.
- It fails when an export exceeds its budget, or has none. Budgets live in `packages/meniscus/size.json` with the measured sizes: the measurement plus 10%, rounded up to 0.1 kB, and rewritten by `size.mjs --update`. The manual reads the same file, so its cost table never goes stale.
- It also fails when one component's bundle contains another component's module. Each module leaves a marker in its output that the script looks for.
- The CI `check` job runs `pnpm --filter meniscus size` after the build.
- esbuild becomes a direct dev dependency of `meniscus`. It's already installed through tsup.

## 9. Docs, site and examples

- **/components**
  - An `Entry` per new component, with a live demo, a `PropsTable` and notes.
  - The navigation, modal and toast examples in "Interface patterns" are rebuilt on `GlassNavbar`, `GlassDialog` and `GlassToaster`.
  - The site keeps its own `Segmented`, `Switch` and `Scale`, as DESIGN.md specifies them. `GlassSegmented`'s inline styles would override the site's classes, so the catalog shows the library's controls on their own.
- **The manual** gets:
  - A section per component, with the props tables in `content.ts`.
  - The theme-object example.
  - Tinted and adaptive, including what adaptive can't read.
  - The fallback table from §5.
  - The toast limit under modals.
  - A per-component cost table: what it adds to `Glass` in kB (from §8), and what runs per frame or per event (for example, the navbar has one passive scroll listener, adaptive samples at most 10 per second while scrolling, and the slider refracts only while dragging).
- **README.** The component list.
- **`examples/next-app`** adds a `GlassDialog` and a `GlassToaster` to the page, so CI builds them in a Server Components app.
- **CHANGELOG.** 0.6.0 under Added and Changed.

## 10. Definition of done

- All ten components, tinted and adaptive, with JSDoc on every public prop and type.
- `pnpm test`, `pnpm typecheck` and `pnpm build` are green, and the CI size check passes.
- `check-components.mjs` passes in Chromium, WebKit and Firefox, and the existing site checks still pass.
- Desktop and mobile captures of /components and the home page look right in Chromium, in light and dark.
- The Next example builds in CI.
- Released as 0.6.0 on npm with provenance. Then the examples move to `^0.6.0`.

## Out of scope

- Submenus.
- Checkable menu items.
- Top sheets.
- An icon-only sidebar rail.
- A built-in navbar hamburger (the docs show one built from `GlassNavbar` and `GlassMenu`).
- Right-to-left placement names.
- Adaptive tint on `GlassGroup`'s merged surface.
- Long-press tooltips on touch.
