# meniscus

Liquid glass for React, refracted by optics.

meniscus renders glass surfaces whose edges bend what lies behind them the way real glass does. Each rim has a height profile; the library traces a ray through it with Snell's law and shifts the page by exactly where that ray lands. Highlights come from the same surface normals, lit by a single light source you can move.

- **Live refraction** of real page content in Chromium browsers, through SVG displacement inside `backdrop-filter`.
- **Frosted glass everywhere else**, with the same props and the same rim light.
- **True refraction in every browser** over images, video or canvas, with the WebGL stage.
- **Liquid motion**: selections that flow like a drop, glass that merges and splits by surface tension, press and hover response, and entrances that materialize.
- Server-rendering safe, no stylesheet to import, React 18 and 19.

```sh
npm i meniscus
```

## Quick start

```tsx
import { Glass } from 'meniscus';

export function Toolbar() {
  return (
    <Glass radius="capsule" interactive>
      <button>Plates</button>
      <button>Search</button>
    </Glass>
  );
}
```

`Glass` renders one element (a `div` unless you pass `as`) with the glass behind its children. Every prop that element accepts passes through, and refs reach the DOM node.

## Ready-to-use components

`GlassButton` is a native button with interactive glass and a `type="button"` default. `GlassPanel` is a padded container. `GlassTabs` combines a tab list, keyboard navigation, panels, and a moving glass indicator. They use the same `Glass` options and need no stylesheet.

```tsx
import { GlassButton, GlassPanel, GlassTabs } from 'meniscus';

<GlassButton onClick={save}>Save</GlassButton>
<GlassPanel role="region" aria-label="Summary">Ready</GlassPanel>
<GlassTabs label="Views" items={[
  { value: 'all', label: 'All', content: <AllItems /> },
  { value: 'saved', label: 'Saved', content: <SavedItems /> },
]} />
```

`GlassTabs` accepts `value` and `onValueChange` for controlled selection, or `defaultValue` for local selection. Each item needs a unique `value`, a `label`, and panel `content`; optional `disabled` items are skipped by arrow keys. Give the tab list a descriptive `label`.

`GlassTextField`, `GlassSelect`, and `GlassCheckbox` place native form controls on glass. Each needs a visible `label`, passes through the underlying input or select props, and forwards its ref to that native control. Form names, values, validation, disabled states, and keyboard behavior work as they do in HTML.

```tsx
import { GlassCheckbox, GlassSelect, GlassTextField } from 'meniscus';

<GlassTextField label="Project name" name="project" required />
<GlassSelect label="Material" name="material" defaultValue="glass">
  <option value="glass">Glass</option>
  <option value="water">Water</option>
</GlassSelect>
<GlassCheckbox label="Send alerts" name="alerts" value="yes" />
```

```tsx
<Glass as="nav" radius="capsule" aria-label="Sections">…</Glass>
<Glass as="button" type="button" radius="capsule" interactive onClick={play}>Play</Glass>
```

## Rendering paths

Every glass picks the best path its browser can draw and reports it as `data-meniscus` on the element.

| Path | Where | What refracts |
| --- | --- | --- |
| `refract` | Chrome, Edge, Opera, Brave, Arc (Chromium on desktop and Android) | Live page content |
| `frost` | Safari, Firefox, every browser on iOS | Nothing: blur, saturation, tint and rim light |
| `webgl` | Safari, Firefox, iOS, with a media `backdrop` | The image, video or canvas named as the backdrop |
| `element` | Firefox, with any other `backdrop` (experimental) | A live copy of the backdrop element |
| `none` | Wherever you ask for it | Shape, shadow and interaction only, for glass another renderer draws |

Name what lies behind a glass with `backdrop` (an element or a ref) and browsers that can't refract the live page still bend it: over an image, video or canvas the glass draws itself in WebGL; in Firefox, any other element is refracted as a live `-moz-element()` copy. Chromium ignores the prop. The backdrop must not contain the glass.

```tsx
const photo = useRef<HTMLImageElement>(null);

<img ref={photo} src="/harbor.jpg" alt="" />
<Glass radius="capsule" backdrop={photo}>…</Glass>
```

The server and the first client render are frosted, so markup hydrates cleanly. Refraction switches on right after hydration where supported. Read the path in code with `useGlassMode()`, or force one for a subtree with `<GlassProvider mode="frost">`.

## Props

Where the `regular` and `clear` variants differ, defaults read regular / clear.

| Prop | Type | Default | |
| --- | --- | --- | --- |
| `as` | `ElementType` | `'div'` | Element or component to render |
| `variant` | `'regular' \| 'clear'` | `'regular'` | Regular frosts for legibility; clear stays transparent over media |
| `appearance` | `'auto' \| 'light' \| 'dark'` | `'auto'` | Light or dark glass; auto follows the page's color scheme via `light-dark()` |
| `radius` | `number \| 'capsule'` | `28` | Corner radius in px, capped at half the short side |
| `bezel` | `number` | `min(radius, 32)` | Width of the curved rim in px, capped at the radius |
| `refraction` | `number` | `1` | Thickness as a multiple of the bezel width. `0` turns refraction off |
| `ior` | `number` | `1.5` | Index of refraction: 1.33 water, 1.5 glass, 2.42 diamond |
| `profile` | `'squircle' \| 'circle' \| 'parabolic' \| 'lip' \| (t) => number` | `'squircle'` | Cross-section of the rim |
| `caustics` | `boolean` | `false` | Let a steep rim fold the image into doubled lines, as thick glass does |
| `blur` | `number` | `5` / `0.5` | Backdrop blur, px |
| `saturation` | `number` | `1.6` / `1.15` | Backdrop saturation |
| `tint` | `string` | from `appearance` | Any CSS color over the refracted backdrop |
| `aberration` | `number` | `0` | Chromatic aberration, 0 to 1. Costs two extra filter passes |
| `specular` | `number` | `0.8` / `0.9` | Reflected highlight strength |
| `rim` | `number` | `0.7` / `0.8` | Bright grazing-angle line along the outline |
| `shade` | `number` | `0.35` / `0.3` | Darkening where the rim turns edge-on; keeps glass legible on light pages |
| `lightAngle` | `number` | `-45` | Where the light comes from, degrees clockwise from the top |
| `lightElevation` | `number` | `18` | Light height above the surface, degrees |
| `mode` | `'auto' \| 'refract' \| 'frost' \| 'none'` | `'auto'` | Rendering path |
| `interactive` | `boolean` | `false` | Lift on hover; swell on press with light blooming from the touch point; stretch toward the pointer |
| `appear` | `boolean` | `false` | Materialize on mount: fade in, swell into place, and let the lens gather its bend |
| `backdrop` | `HTMLElement \| RefObject` | none | What lies behind the glass, for browsers without live refraction (see Rendering paths) |
| `shadow` | `string \| false` | soft two-layer shadow | Box shadow under the glass |

## One light source

`GlassProvider` sets defaults for everything below it. Nested providers merge.

```tsx
import { GlassProvider } from 'meniscus';

<GlassProvider lightAngle={300} tint="rgba(255, 255, 255, 0.18)">
  <App />
</GlassProvider>
```

## Loading

`GlassLoader` is three glass drops in one surface that orbit and breathe, fusing into a single drop and parting again. It is a polite `status` that announces its `label`; `animate={false}` rests the drops apart, and under reduced motion they fade instead of moving. `page` makes it a whole loading page: frosted glass over the viewport with the loader and its label.

```tsx
import { GlassLoader } from 'meniscus';

<GlassLoader label="Loading plates" />
{loading && <GlassLoader page label="Preparing your plates" />}
```

## Motion

**Press and hover.** With `interactive`, glass lifts a little under the pointer and its rim brightens. Pressed, it swells, light blooms from the point of contact, and it stretches toward the pointer; released, it wobbles back on a spring. Space and Enter press it too. Motion goes through the `scale` and `translate` properties and gives your own values back once it settles.

**Materialize.** With `appear`, glass fades in and swells into place as it mounts, and the lens gathers its bend a beat later, so the backdrop visibly curves into place.

```tsx
{open && <Glass as="aside" radius={24} appear role="status">Saved.</Glass>}
```

**Selections that flow.** `GlassIndicator` is a lens that moves to whichever element you point it at. Its edges are springs: the leading edge runs ahead, the trailing edge catches up, and the glass thins to keep its volume.

```tsx
import { Glass, GlassIndicator } from 'meniscus';

const [selected, setSelected] = useState<HTMLElement | null>(null);

<Glass as="nav" radius="capsule" aria-label="Sections">
  <GlassIndicator target={selected} tint="rgb(255 74 28 / 0.12)" />
  {tabs.map((tab, i) => (
    <button key={tab} ref={i === current ? setSelected : undefined} aria-current={i === current ? 'page' : undefined} onClick={() => setCurrent(i)} style={{ position: 'relative' }}>
      {tab}
    </button>
  ))}
</Glass>
```

Place the indicator first inside the positioned container that holds the targets, and give the targets `position: relative` so their content paints above it. Props: `target`, `inset` (px between target and glass), `stretch` (0 rigid, 1 liquid), and any `Glass` prop except `as` and `interactive`.

**Surface tension.** Every `Glass` inside a `GlassGroup` is drawn as one surface. Outlines closer than `spacing` px grow a neck between them, the way two drops bridge; within twice that they lean toward each other; pulled apart, the neck thins and lets go. Move members however you like: the group follows them every frame.

```tsx
import { Glass, GlassGroup } from 'meniscus';

<GlassGroup spacing={36}>
  <Glass radius="capsule" className="toolbar">…</Glass>
  <Glass radius="capsule" className="drop" interactive style={{ left: x, top: y }}>…</Glass>
</GlassGroup>
```

The group's own glass props (`refraction`, `tint`, `blur`, light…) apply to the whole surface; members contribute their outline and radius, and keep their content, events and springs. The maps are rebuilt in a worker where the browser allows one. Browsers that frost still draw the merged outline; give the group a `backdrop` and they refract it too. On the WebGL stage, `merge` does the same for panes in every browser.

Under `prefers-reduced-motion` the springs turn off: presses only glow, indicators move straight to their target with a short fade, and `appear` fades.

## How the refraction works

1. The profile's slope at each point of the rim is the surface tilt, the angle of incidence θ₁ for a ray from the eye.
2. Snell's law gives the angle inside the glass: sin θ₁ = n sin θ₂.
3. The ray leans θ₁ − θ₂ off vertical and crosses the local glass height z before reaching the page, so it lands z · tan(θ₁ − θ₂) inward.

A steep rim would shift neighboring points past each other and show one line twice. By default the shift is limited so the page compresses into the rim instead; `caustics` allows the fold.

Refraction only varies inside the bezel, so the displacement map is nine small tiles (four corners, four one-pixel edges, a neutral plateau) that the SVG filter places and stretches. Resizing a glass never rebuilds a map.

## The WebGL stage

Safari and Firefox can't refract live page content, but WebGL can refract media in every browser.

```tsx
import { GlassPane, GlassStage } from 'meniscus/webgl';

<GlassStage source="/photos/harbor.jpg" alt="The harbor at dusk" style={{ height: 480 }}>
  <GlassPane radius="capsule" style={{ position: 'absolute', left: 32, top: 32, width: 280, height: 64 }}>
    Now playing
  </GlassPane>
</GlassStage>
```

For video or canvas, render the element yourself inside the stage and pass a ref as `source`. Cross-origin images need CORS headers. Where WebGL2 is missing, panes frost over the media. A stage draws up to 16 panes in one pass, and it refracts only its source, never the DOM above it.

Give the stage `merge={28}` and panes closer than 28 px flow into one body, with the neck blending each pane's glass into the other's.

## meniscus/core

The optics without React, safe on the server and in workers:

```ts
import { filterMarkup, glassTiles, resolveGlass, traceRay } from 'meniscus/core';

const glass = resolveGlass({ radius: 'capsule', refraction: 1.2 }, 320, 80);
const tiles = glassTiles(glass);
if (tiles) svg.innerHTML = filterMarkup('lens', { width: 320, height: 80, tiles });

traceRay({ bezel: 32, thickness: 32, ior: 1.5 }, 6); // one ray, 6 px in from the outline
```

## Accessibility

- Semantics come from `as` and your markup. The filter, highlight and glow layers are hidden from assistive technology.
- Under `prefers-reduced-transparency`, glass turns nearly opaque and stops refracting.
- Under `prefers-reduced-motion`, interactive glass keeps its glow but stops swelling, stretching and blooming; indicators jump with a short fade; `appear` fades.
- `GlassIndicator` is hidden from assistive technology. Mark the selection itself with `aria-current`, `aria-selected` or a checked radio.
- Text on glass needs contrast against the busiest thing behind it; regular glass frosts and tints for that.

## Limits

- Rounded rectangles and capsules only.
- A backdrop filter sees only what is painted inside its nearest ancestor with a `filter`, `opacity` below 1, `mask`, `clip-path`, `mix-blend-mode` or its own `backdrop-filter`. Glass inside such an ancestor, including glass inside glass, shows that ancestor's content. Fade glass through its own opacity, not a parent's.
- Sharp corners don't refract: the bezel is capped at the corner radius.
- Maps are cached per profile function. Define a custom `profile` once, outside your components, or every render builds new maps.
- `as` must be an element that can hold children. Void elements (`input`, `img`) render frosted, without refraction or highlights; wrap them in a `Glass` instead.
- A `GlassGroup` shares one glass across its members and rebuilds its maps while they move, in a worker where possible. Under a content security policy without `blob:` in `worker-src`, that work runs on the main thread (about 4 ms a frame for a toolbar). Keep groups to a handful of controls.
- The `element` path is experimental and Firefox-only; it repaints the copied element into the glass whenever it changes, so point `backdrop` at the region behind the glass rather than the whole page where you can.

## License

MIT
