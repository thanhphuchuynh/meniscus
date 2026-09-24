# Glass stack and layer physics design

**Goal:** Stacked glass that behaves like physical layers. `<Glass.Stack>` holds depth-ordered `<Glass.Layer>`s. Control layers refract everything rendered beneath them, including lower glass, and every layer's optics move on springs, driven by interaction and staggered by depth.

**Builds on:** the liquid-physics branch (ripple field, motion tracker, squash). Approved engine decision: **hybrid**, chosen per glass, because no browser exposes rendered page pixels to WebGL, WebGPU or Three.js.

**Constraints:**
- No new runtime dependencies.
- Every browser keeps a working path.
- Reduced motion snaps springs to their targets.
- No per-frame React renders: springs write to the DOM or GL directly.
- SSR-safe.
- Semantic props first, raw numbers as overrides.
- Every public prop and type carries JSDoc.
- Commits carry no `Co-Authored-By` trailer.

## 1. Capability matrix

| Context behind the stack | Chromium | Safari, Firefox |
|---|---|---|
| Any page content (DOM, gradients, text, video elements) | Live refraction. Each control layer's `backdrop-filter` samples everything painted beneath it, lower glass and its text included. | Frost. Blur and tint compound; no displacement. Platform limit. |
| An image, video or canvas registered as the context layer's `source` | Live refraction, as on the left. | WebGL: each control layer draws the media plus every lower control layer's glass, layered back to front, clipped to its own shape. Lower layers' DOM children beneath it are covered, not refracted. |

- `renderer="css"` never uses WebGL.
- `renderer="webgl"` uses WebGL wherever a source exists, Chromium included. This gives one look everywhere, and it is how rippling layers compound.

## 2. Spring solver: `core/spring.ts` (portable: no React, no DOM)

```ts
export interface SpringConfig { mass?: number; stiffness?: number; damping?: number } // defaults 1 / 300 / 30
export const SPRINGS: {
  gentle: { mass: 1, stiffness: 120, damping: 20 },  // ζ ≈ 0.91
  snappy: { mass: 1, stiffness: 300, damping: 30 },  // ζ ≈ 0.87, the default
  bouncy: { mass: 1, stiffness: 260, damping: 14 },  // ζ ≈ 0.43
  stiff:  { mass: 1, stiffness: 520, damping: 44 },  // ζ ≈ 0.96
};
export type SpringInput = SpringConfig | keyof typeof SPRINGS;
export function resolveSpring(input?: SpringInput): Required<SpringConfig>;
export function springPeriod(input?: SpringInput): number;  // 2π·√(m/k), seconds
export function dampingRatio(input?: SpringInput): number;  // d / (2·√(k·m))
export class Spring {
  value: number; velocity: number; target: number; config: Required<SpringConfig>;
  constructor(value?: number, config?: SpringInput);
  step(dt: number): void;   // semi-implicit Euler in ≤ 1/240 s substeps; dt capped at 1/15 s
  get settled(): boolean;   // |value − target| < 1e-4 and |velocity| < 1e-3
  snap(): void;             // value = target, velocity = 0
}
```

`react/interaction.ts` (press swell) and `react/liquid.ts` (squash) switch to this `Spring`, keeping their stiffness and damping, so there is one solver. Their existing tests guard the switch.

## 3. Optical physics: `core/physics.ts` (portable)

Channels, each a `Spring` normalized so 1 means "as the glass's options say":

| Channel | Meaning | Rest | Response (stiffness ×; damping keeps the base ζ) |
|---|---|---|---|
| `presence` | shown (1) or hidden (0) | 1 | ×1 |
| `refraction` | multiplier on the glass's bend | 1 | ×1 |
| `highlightX`, `highlightY` | light offset, −1 to 1, rotating the light toward that side | 0 | ×2.5 (settles fastest: light reflects instantly, only the surface moves) |
| `tint` | multiplier on tint opacity | 1 | ×0.8 |
| `shadow` | lift: 0 flat, 1 resting, more is raised | 1 | ×0.55 and ζ × 1.1 (lags: a shadow follows height) |

```ts
export type OpticalChannel = 'presence' | 'refraction' | 'highlight' | 'tint' | 'shadow';
export interface OpticalState { presence: number; refraction: number; highlightX: number; highlightY: number; tint: number; shadow: number }
export interface GlassPhysicsOptions {
  physics?: SpringInput;                                   // base spring, default 'snappy'
  response?: Partial<Record<OpticalChannel, number>>;      // stiffness multipliers overriding the table
  initial?: Partial<OpticalState>;
  scheduler?: 'frame' | 'manual';                          // manual: call step(dt) yourself (tests, workers, servers)
  reducedMotion?: boolean;                                 // targets apply instantly
}
export class GlassPhysics {
  constructor(options?: GlassPhysicsOptions);
  readonly state: OpticalState;
  get settled(): boolean;
  configure(options: Pick<GlassPhysicsOptions, 'physics' | 'response' | 'reducedMotion'>): void;
  to(target: Partial<OpticalState>, options?: { delay?: number /* ms */ }): void;
  impulse(vx: number, vy: number): void;                   // px/s of the glass: drag or release momentum
  step(dt: number): void;
  subscribe(listener: (state: OpticalState) => void): () => void;
  dispose(): void;
}
export function staggerDelay(rank: number, physics?: SpringInput, stagger?: number): number; // ms = rank × stagger × period
```

- **Frame loop:** one shared `requestAnimationFrame` loop steps every active instance and stops when all have settled. With `scheduler: 'manual'`, or where `requestAnimationFrame` doesn't exist, nothing runs by itself.
- **Delays:** `to(…, { delay })` holds the new targets until the physics clock passes the delay. A newer `to` for the same channel replaces a pending one.
- **Impulse:** `impulse` adds starting velocities, never durations. With `speed = |v| / 1000`:
  - `refraction.velocity += 1.2·speed` (the glass swells)
  - `highlight.velocity −= 1.5·v̂·speed` (the light lags behind the motion)
  - `shadow.velocity += 0.8·speed` (it lifts)
  - A fast release therefore rings, and a slow one barely moves.

## 4. React hook: `react/useGlassPhysics.ts`

```ts
export function useGlassPhysics(options?: GlassPhysicsOptions): GlassPhysics;
```

- It returns one stable instance for the component's life, disposed on unmount.
- Option changes go through `configure`, never a new instance.
- Reduced motion comes from the media query unless it is passed in.

`Glass` gains `optics?: GlassPhysics`, which is how the hook drives any glass, inside a stack or not. When `optics` is set, `Glass` subscribes and writes each frame:

| Channel | Live SVG path | Frost path | WebGL path |
|---|---|---|---|
| presence | `opacity`; `--meniscus-presence` | same | pane coverage × presence |
| refraction | every `feDisplacementMap` `scale` = its `data-scale` × refraction × presence | none | displacement × refraction × presence |
| highlight | `--meniscus-hx` / `--meniscus-hy` move a specular spot in the light layer; the rim image stays at its angle | same | the light vector rotates toward the offset |
| tint | `background-color: color-mix(in srgb, tint calc(var(--meniscus-tint) * 100%), transparent)` | same | tint alpha × tint |
| shadow | the default shadow is rebuilt from `--meniscus-shadow` (offsets, blur and alpha scaled); a custom `shadow` string stays static | same | shadow strength × shadow |

Presence moves nothing by itself. Entrance motion stays with the app's CSS, through `--meniscus-presence`. For example, `.sidebar { translate: calc((1 - var(--meniscus-presence, 1)) * -28px) 0 }`, which is how the example slides its sidebar and lifts its modal. Glass never writes `translate` for presence, because press interaction already composes and restores that property.

With `interactive`:
- a press calls `to({ shadow: 1.25 })`
- a release calls `to({ shadow: 1 })` and `impulse(v)` with the velocity from the liquid motion tracker

## 5. `GlassStack` and `GlassLayer`: `react/GlassStack.tsx`

```ts
export interface GlassStackProps extends HTMLAttributes<HTMLElement> {
  physics?: SpringInput;              // default spring for layers; default 'snappy'
  stagger?: number;                   // fraction of a layer's spring period between depth ranks; negative reverses; default 0.12
  renderer?: 'auto' | 'css' | 'webgl';
  appear?: boolean;                   // layers present on mount enter from 0, staggered
  as?: ElementType;
}
export interface GlassLayerProps extends GlassOptions, HTMLAttributes<HTMLElement> {
  depth?: number;                     // z-order; higher is nearer; default: order of appearance
  kind?: 'context' | 'control';       // default 'control'
  source?: TexImageSource | RefObject<TexImageSource | null>; // context layers: the media the WebGL path draws; default: the first img/video/canvas inside
  present?: boolean;                  // default true; changes animate
  physics?: SpringInput;              // overrides the stack's
  intensity?: Intensity;              // semantic strength; raw options override
  interactive?: boolean; ripple?: boolean; as?: ElementType;
}
export const Glass: typeof GlassBase & { Stack: typeof GlassStack; Layer: typeof GlassLayer };
```

**Stack:**
- It renders one container with `position: relative` and `isolation: isolate`. That scopes the layers' `z-index` without creating a backdrop root, so layers still refract page content behind the stack.
- Layers register depth, physics, element, optics and kind.
- `z-index` = `depth`, or the layer's registration index when `depth` is unset.

**Context layer:** plain content, no glass, positioned at its depth. It publishes its `source` (explicit, or the first `img`, `video` or `canvas` descendant) to the stack.

**Control layer:**
- It renders a `Glass` with its own `useGlassPhysics` (the layer's `physics`, else the stack's) as `optics`.
- It passes the stack's context source as its `backdrop`.
- `renderer` decides what the layer passes on:
  - `'css'`: no `backdrop`, so there is no WebGL fallback.
  - `'auto'`: the `backdrop`, so the WebGL fallback applies only where live refraction is missing.
  - `'webgl'`: the `backdrop`, plus the same WebGL preference `ripple` uses (`useFallback`'s `preferWebGL`), so it takes WebGL even in Chromium.

**Shared transitions:**
- Layers whose `present` changes in the same commit form one transition; so do all layers on mount with `appear`.
- A layout effect in the stack ranks them from nearest to deepest. Each gets `to({ presence }, { delay: staggerDelay(rank, its physics, stagger) })`, so deeper layers lag.
- A negative `stagger` reverses the order.

**Development warnings, once each:**
- a `Glass.Layer` outside a `Glass.Stack`
- a `Glass.Stack` nested inside a control layer (nested glass cannot see its surroundings)

## 6. WebGL compounding

- On the WebGL path, a control layer's `MediaLayer` frame includes every lower control layer: its rect relative to this host, its resolved glass and its current optics, followed by itself.
- `GlassRenderer.render` gains `clip?: number`, meaning layered passes over panes `0…clip`. The last pass writes only inside pane `clip`'s coverage and is transparent elsewhere, so lower layers' DOM beside the glass is never covered.
- Each layer draws its own canvas inside its own element, so DOM order, and with it `z-index`, stays correct. The cost is 1 + 2 + … + n passes for n layers; stacks are small.
- `PaneFrame` gains `optics?: OpticalState` (and `GlassStage` panes may pass it too). It scales displacement, light direction, tint alpha, shadow strength and coverage.

## 7. Semantic intensity

`intensity` joins `GlassOptions`, so `Glass`, `GlassButton`, `GlassPanel` and layers share it. `resolveGlass` applies it first, and explicit options win.

| intensity | refraction | specular | aberration |
|---|---|---|---|
| `'subtle'` | 0.6 | 0.6 | 0 |
| `'regular'` (default) | 1 | variant default | 0 |
| `'strong'` | 1.5 | 1 | 0.15 |

A number from 0 to 1 interpolates subtle (0) → regular (0.5) → strong (1).

## 8. Example

Home plate "Stacked glass":
- **Context layer:** the engraving plus a paragraph of text.
- **Sidebar control layer (depth 1):** navigation.
- **Modal control layer (depth 2):** a small dialog-styled card, overlapping the sidebar.
- **Behaviour:** "Open" and "Close" toggle both layers' `present` in one commit, staggered by depth. The modal is draggable, and its release drives the springs.
- **Controls:** a physics preset select and a stagger range, with keyboard access.
- **Accessibility:** the modal card is a region, not a `role="dialog"`, since it's a demo layer.

The docs get the same code sample.

## 9. Tests

**Unit tests (Vitest):**
- **spring:**
  - The measured period matches `springPeriod` within 3%.
  - Doubling the mass lengthens the period by √2.
  - An underdamped preset overshoots and a near-critical one doesn't.
  - No NaN or blow-up at dt = 1 s.
  - Settled detection works.
- **physics:**
  - For the same step, highlight settles before refraction, and refraction before shadow.
  - A faster impulse gives a larger refraction peak.
  - A delay holds targets until the clock passes it.
  - Manual scheduler, subscribe/unsubscribe, and dispose stops the loop.
  - `staggerDelay` scales with rank and period.
- **hook and Glass:**
  - A stable instance.
  - `optics` writes the filter `scale`, `--meniscus-tint`, `--meniscus-shadow`, `--meniscus-presence` and opacity.
  - Reduced motion snaps.
- **stack:**
  - `z-index` follows depth.
  - Context layers publish their source.
  - A shared `present` change delays the deeper layer by `staggerDelay`, and a negative stagger reverses it.
  - `renderer` modes pick paths.
  - Both warnings fire once.
- **intensity:** `resolveGlass` mapping, interpolation, and explicit options override it.

**Browser (Playwright):**
- **Chromium:**
  - After "Open", the modal's presence starts before the sidebar's by `staggerDelay` ± one frame.
  - Pixels inside the modal change when the sidebar moves beneath it (CSS compounding).
- **WebKit:** the same compounding check on the WebGL path.
- **GPU:** `clip` output has alpha 0 outside the clipped pane, and a calm `optics` at rest renders identical to no `optics`.

## Non-goals

- Refracting page DOM in Safari or Firefox (platform limit).
- Three.js or WebGPU.
- Nested glass inside glass.
- Rotating the CSS rim image continuously (the WebGL light rotates; CSS moves a specular spot).
- Merged (`GlassGroup`) surfaces inside stacks.
- A standalone published example package (the site plate and docs carry the example).
