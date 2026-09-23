# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: TypeScript in a pnpm workspace. The library builds with tsup (ESM plus type declarations) and takes React 18/19 as a peer dependency. The demo site uses Vite + React 19. Vitest covers the optics math. Chosen because it is the lean, standard setup for a public React library, and a static demo deploys anywhere.

## Users

React developers building web apps who want Apple-style Liquid Glass surfaces (navigation bars, buttons, cards, sheets, toolbars) without writing shaders or SVG filters by hand. They evaluate the library by looking at it in their own browser and reading the API.

## Product Purpose

A public, open-source npm package that renders liquid glass in React: light refracting through a curved glass edge, frosting, tint, a specular rim light, optional chromatic aberration, and an interactive response to pointer and press. Success means a developer drops in one component, gets convincing glass on the first render, and every browser shows a good surface.

## Positioning

The refraction is derived from optics, not faked. The displacement comes from a real bezel height profile and Snell's law, and the rim light from the same surface normals, so the look follows modeled light rather than a blur and a border. A second renderer, built on WebGL, gives true refraction in every browser over image, video, or canvas sources.

## Operating Context

- Used inside React apps, including server-rendered ones (Next.js), over arbitrary page content.
- Three rendering paths behind one API:
  - Chromium: SVG displacement filters inside `backdrop-filter` refract live page content.
  - Safari and Firefox: a frosted fallback (blur, saturation, tint, rim light) through the same props, because those engines cannot run SVG filters inside `backdrop-filter`.
  - WebGL mode: true refraction in all browsers, limited to a source the developer passes in (image, video, canvas), not arbitrary DOM.
- Evaluated through a demo site that doubles as the landing page, plus the README.

## Capabilities and Constraints

- DOM refraction depends on browser support for SVG filters in `backdrop-filter`. Chromium-only as of 2026-09; re-verify per browser release.
- Filters cost GPU time. Defaults stay cheap; expensive layers such as chromatic aberration are opt-in.
- Must be safe to server-render: no window access during render, and a graceful first paint before client detection.
- Respects `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Open decision: the license. MIT is assumed for scaffolding until the user confirms.

## Brand Commitments

- Name: **meniscus**, published unscoped on npm as `meniscus` (free as of 2026-09-23). The name refers to the curved surface of a liquid, which is the curved glass edge the library models.
- Apple's Liquid Glass is the reference for the effect, not for the brand. Never use Apple's marks or imply affiliation.

## Evidence on Hand

None yet: no users, downloads, stars, testimonials, or benchmarks. Future work must not fabricate any of these. Demo content (imagery, sample UI) is authored or sourced for the demo, labeled as such, and listed for the user to review.

## Product Principles

1. **Optics first.** Every visual layer traces back to modeled light: surface profile, refraction, reflection.
2. **Degrade honestly.** Every browser gets a finished surface, never a broken one, and the library reports which rendering path is active.
3. **One component, good defaults.** Convincing glass with zero configuration; depth for those who want to tune it.
4. **Pay for what you use.** Costly effects are opt-in, and the library never re-renders maps it has already built.

## Accessibility & Inclusion

- Text on glass must stay legible. Tint and frosting defaults protect contrast.
- `prefers-reduced-transparency` makes glass more opaque. `prefers-reduced-motion` disables elastic motion.
- Interactive glass keeps native semantics and visible focus states.
