# Liquid physics design

**Goal:** Make meniscus glass behave like a liquid object instead of a rigid filter: glass that moves squashes and wobbles, and a rippling surface bends light as waves spread across it, bounce off the rim and die out.

**Context:** Sub-project 1 of three split out of the "true 3D / 4D / real physics" brief. Sub-project 2, solid 3D glass, and sub-project 3, fluid simulation, are out of scope. v0.2.0 already has spring motion (press swell, stretch toward the pointer, and release wobble on `interactive` glass, plus flick inertia on the demo lens), per-pixel Snell's-law refraction with 3D lighting normals in WebGL, and pointer parallax.

**Constraints:** No new runtime dependencies. Every browser keeps a working path. Reduced motion turns every new effect off. Keyboard access matches pointer access. No cost at rest. The Opticks visual identity is unchanged.

## 1. Behavior and API

### Wobble (default for `interactive`)

An `interactive` glass that moves on screen, dragged or flung by the app, squashes along its direction of travel. Motion is tracked from a press until the glass comes to rest, so glass moved without a press (keyboard, layout changes, scrolling) never squashes. When it slows or stops, the squash overshoots into a short jiggle. Glass that does not move is unaffected, so buttons behave exactly as in 0.2.0.

### Ripples (`ripple` prop)

`ripple?: boolean` on `Glass` and `GlassPane`. When set, the glass surface is liquid:

- **Tap:** pressing the glass drops a bead at the contact point, and a ring spreads out.
- **Drag:** a pointer that moves across the glass while pressed leaves a trail, with strength set by the pointer's speed relative to the glass. A glass dragged along with the pointer gets no trail, because there is no relative motion.
- **Slosh:** the glass's own acceleration (starting, stopping, a fling landing) tilts the liquid against the rim.
- **Keyboard:** Space or Enter (not repeats) on a focused rippling glass drops a bead at the center.

Waves bend what is behind the glass, catch the light on their crests, bounce off the rim and fade out in about 2 s.

**Where ripples render:** wherever WebGL draws the glass.

- `GlassPane` inside a `GlassStage` whose status is `ready`, in any browser.
- `Glass` with an image, video or canvas `backdrop`, in any browser with WebGL2. In Chromium, such a glass switches from live SVG refraction to the WebGL path while `ripple` is on, and back when it is off.
- Anywhere else (no media backdrop, no WebGL2, reduced transparency, an explicit `mode`), nothing changes. In development, a one-time `console.warn` explains why: `ripple` needs WebGL, so give the glass an image, video or canvas `backdrop`, or place it in a `GlassStage`.

**Reduced motion:** no wobble and no ripple simulation. The existing light bloom and glow behave as in 0.2.0.

**Version:** ships in 0.3.0 (minor: a new prop plus a behavior change to `interactive`). Publishing is not part of this work.

## 2. Wave simulation: `packages/meniscus/src/core/ripple.ts`

Plain TypeScript with no DOM access, unit-testable in isolation.

`class RippleField`:

- **Grid:** `resize(width, height, radius)` lays a grid over the glass box, in layout px. `cols = clamp(floor(width / 2.5), 8, 128)`, and the same for `rows`. Cell sizes are `dx = width / cols` and `dy = height / rows`. A resize resets the field to calm.
- **Rim:** a mask marks cells whose centers lie inside the rounded outline (`roundedRectSdf` from `core/shape`, distance < 0). Cells outside are pinned at zero height, so waves reflect off the glass's actual shape and fade to nothing at the edge, which avoids a seam at the outline.
- **Physics:** `heights` (px) and `velocities` (px/s) are `Float32Array(cols × rows)`. Symplectic Euler on the damped wave equation:
  `v += dt · (c² · laplacian(h) + force)`, then `v *= exp(-γ · dt)`, then `h += dt · v`.
  Wave speed `c = 300 px/s`. Damping `γ = 4 s⁻¹`, so amplitude halves about every 0.35 s. The five-point Laplacian uses separate `dx` and `dy`.
- **Stability:** step length `dt = min(1/240 s, 0.5 · min(dx, dy) / c)`, which keeps the Courant number ≤ 0.5 for any glass size. `advance(now)` takes a timestamp in ms. It integrates the elapsed time since the last call with an accumulator, capped at 50 ms per call, so a long frame or a background tab slows time instead of blowing up. Calls with the same timestamp are idempotent.
- **Inputs** (all in glass-local layout px):
  - `drop(x, y, strength = 1)`: a Gaussian impulse added to `v`, σ = 5 px. Strength 1 is tuned so a tap's first ring peaks near slope 0.35.
  - `stroke(x0, y0, x1, y1, speed)`: drops along the segment, about one per cell. Strength is `min(1, speed / 1500 px/s) · 0.5`.
  - `accelerate(ax, ay)`: sets the body force `force(p) = -κ · a · (p - center)` over interior cells until the next call. `a` is clamped to ±30,000 px/s². κ is tuned so a 1000 px/s stop sloshes to about slope 0.2.
- **Sleep:** when max |h| < 0.02 px and max |v| < 1 px/s, the field zeroes itself, sets `active = false` and stops stepping. Any input wakes it.
- **Output:** `cols`, `rows`, `heights`, `active`, and `version`, which increments on every `advance` that changed heights, including the final zeroing when the field falls asleep.

## 3. Rendering

### Field ownership and stepping

- `react/liquid.ts` keeps a registry, `WeakMap<HTMLElement, RippleField>`, and exports `rippleOf(el)`. A rippling `Glass` registers its field against its element and removes it when ripples turn off or the glass unmounts.
- `Glass` creates the field only when `ripple && !reducedMotion` and WebGL draws it: either its own path is `webgl`, or its mode is `none` because a stage draws it. `GlassPane` forwards `ripple` to `Glass` only when its stage is `ready` and has given the pane a slot. The development warning fires only when neither holds. It is computed from the resolved fallback path, not from the first render, so it does not fire spuriously before refs attach.
- `GlassStage` and `MediaLayer` already run a frame loop while visible. Each frame, for each pane, they call `rippleOf(el)?.advance(now)`, add `field.version` to the redraw signature/key while the field is active or has just gone to sleep, and pass the field as `PaneFrame.ripple`. There is no new animation loop. Glass outside the viewport does not simulate, because the existing IntersectionObserver pauses the loop.

### Renderer (`webgl/renderer.ts`)

- `PaneFrame` gains `ripple?: RippleField | null`.
- One `R16F` `TEXTURE_2D_ARRAY`, 128 × 128 × `MAX_PANES` layers, is allocated the first time a frame carries an active field (512 KB) and freed in `dispose()`. Layer `i` belongs to pane slot `i`. A layer is uploaded (`texSubImage3D`, `RED`/`FLOAT`, `cols × rows` region) only when the field's `version` differs from the last version uploaded to it.
- A new uniform, `u_wave[MAX_PANES]` (vec4): displacement per unit slope in canvas px (`thickness · (1 - 1/ior) · pixelRatio`), `cols`, `rows`, and 1 when the pane's field is active, 0 otherwise. Inactive or absent fields cost nothing: the shader skips the lookup, and calm glass renders exactly as it does today.

### Shader (`webgl/shaders.ts`)

- `Material` gains `vec2 wave`, the surface slope, and `float waveDepth`.
- `paneMaterial(i, d)` samples the pane's layer at the fragment's pane-local position. The slope comes from central differences, converted from cells to layout px with the pane size and `cols`/`rows`.
- `glassColor`:
  - The refraction offset becomes `-n · shift + wave · waveDepth`. Sampling moves toward wave crests, the same convention as the dome.
  - The lighting normal becomes `normalize(vec3(n · slope - wave, 1))`, so crests catch the specular lobe.
- **Modes:** independent and layered modes get this automatically. Merged mode blends `wave` and `waveDepth` with the existing per-pane weights.
- **Thickness:** because `thickness = bezel × refraction`, glass with `refraction={0}` ripples in light only, without bending.

### Media layer registration (`react/MediaLayer.tsx`)

Placement measures the host with its own `transform` (the squash) divided out, and anchors at the glass center. The refracted media stays registered at the center at all times and exactly everywhere at rest. During fast motion, the drawn view deforms with the glass, as a deforming liquid lens would.

## 4. Wobble: `react/liquid.ts`

`useLiquidMotion(ref, { squash, ripple, reducedMotion })` is called by `Glass`, with `squash = interactive && !disabled`. It attaches native pointer and key listeners to the element, separate from `useLiquidInteraction`, which keeps the swell, stretch, glow and bloom unchanged.

- **Tracker:**
  - **When it runs:** from `pointerdown` (primary button) until rest, at most one `getBoundingClientRect()` per animation frame.
  - **Motion:** velocity comes from the rect center's movement with page scroll (`window.scrollX/Y`) subtracted, smoothed with an exponential moving average (α = 0.5). Acceleration is the smoothed change in velocity per second, clamped to ±30,000 px/s².
  - **Stopping:** after release, tracking continues until the element has moved less than 0.1 px for 6 consecutive frames and the springs have settled, or 2 s have passed.
  - **Edge case:** scrolling a nested container during a gesture is not compensated. This is rare and harmless: a brief squash.
- **Squash:**
  - **Target:** a stretch along the velocity direction, stored as two numbers `(s·cos 2θ, s·sin 2θ)` with `s = 0.15 · tanh(|v| / 1800 px/s)`. Storing the doubled angle avoids a jump when the direction wraps around.
  - **Springs:** two springs chase the target, reusing `Spring` from `interaction.ts` with stiffness 260 and damping 14 (damping ratio about 0.43, one or two jiggles).
  - **Matrix:** `M = [[1+a, b], [b, 1−a]] / sqrt(1 − a² − b²)`. The determinant is 1, so area is preserved and the maximum stretch is about 16%. Applied as `transform: matrix(...)` around the element's center.
- **Style ownership:**
  - The squash runs only if the element's computed `transform` is `none` when the gesture starts. An app that transforms its glass keeps full control.
  - The inline `transform` is restored exactly when the gesture ends, on disable, on reduced motion and on unmount.
  - `useLiquidInteraction` keeps using the separate `scale` and `translate` properties, so the two compose.
- **Ripple input:** while tracking, acceleration goes to `ripple.accelerate`. `pointerdown` drops a bead, pressed `pointermove` strokes, and Space/Enter drops a bead at the center. Local coordinates divide out the element's scale, as the bloom does.
- **Known limitation:** inside a `GlassStage` or `GlassGroup`, the drawn glass follows the element's bounding box, so a diagonal squash is only approximated there. Horizontal and vertical squashes are exact.

## 5. Failure handling

- WebGL context loss, compile failure or unreadable media fall back exactly as in 0.2.0: stage `fallback`, frosted glass, or SVG refraction. Ripples turn off silently.
- If the texture array cannot be allocated, the renderer drops ripples for its lifetime and keeps rendering glass.
- Before running in the browser, verify that Chromium's SVG backdrop refraction follows a non-axis-aligned `transform` correctly. If it does not, the squash on the `refract` path is limited to horizontal and vertical stretches, using the individual `scale` property.

## 6. Tests

**Unit tests (Vitest):**

- `ripple.test.ts`:
  - A drop's ring radius after 0.3 s is c · t ± 2 cells.
  - Masked cells stay exactly 0.
  - A tap falls asleep within 3 s.
  - 10,000 random frame times produce no NaN and bounded height.
  - Acceleration produces an antisymmetric slosh: opposite heights on opposite sides.
  - Resize resets the field.
- `liquid.test.tsx`:
  - The squash matrix has determinant 1, a stretch axis parallel to the velocity, and is the identity at zero velocity.
  - An element moved while pressed gets a `transform`, and it is restored at rest.
  - An element with its own transform is untouched.
  - Reduced motion leaves no transform and no field.
  - `ripple` with a media backdrop takes the WebGL path while refraction is supported.
  - `ripple` without a backdrop warns once in development.
  - Space drops a bead.

**Browser checks** (extend `apps/site/scripts/check-living-optics.mjs`, Chromium):

- A calm field renders pixel-identical to no ripple.
- An excited field changes pixels, then stops changing within 3 s.
- A flung hero lens carries a `transform` in flight and none at rest.
- No page errors.
- Sim cost for a 128 × 128 field is logged, with a budget under 0.5 ms per frame.

**Visual check:** WebKit screenshots of the hero after a tap, which is the WebGL path by default there.

## 7. Demo and docs

- **Hero lens (`PlateSpecimen`):** add `ripple`. The caption invites tapping and flinging.
- **Depth plate (`PlateDepth`):** panes get `ripple`, so tapping a pane rings it.
- **Docs:**
  - Manual (`docs/content.ts`): document the `ripple` prop and the wobble on `interactive`.
  - Package README: Motion section.
  - Component catalog: Glass props table and a demo toggle.
  - `CHANGELOG.md`: add the changes under "Unreleased".

## Non-goals

- Ripples over plain page content in Chromium (animated SVG displacement maps).
- A GPU simulation, Navier–Stokes flow, or true 3D glass (later sub-projects).
- Ripples on hover.
- A public simulation API: `RippleField` is exported only as a type, through `PaneFrame`.
- Resampling a field on resize (it resets).
