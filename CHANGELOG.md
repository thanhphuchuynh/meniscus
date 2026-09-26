# Changelog

All notable changes to meniscus are recorded here. Versions follow Semantic Versioning. Before 1.0, minor releases may change the public API.

## [Unreleased]

### Changed

- Glass off screen builds its refraction and light maps in idle time once the page is up, or as it scrolls within half a screen, and draws frost until then. Glass on screen still builds them before its first paint. `data-meniscus` and `onPathChange` report the path a glass settles on from the start. On the demo's home page this halves the first render on a throttled phone.
- WebGL stages, media layers, merged groups and element copies make their first draw as they come within half a screen, not while off screen at mount.

### Fixed

- Building maps no longer waits on the GPU. They're encoded on a CPU canvas, which removes about 180 ms of waiting from the demo's first render on a fast desktop.
- WebGL decodes image sources off the main thread before uploading them, so a stage scrolling into view no longer drops frames decoding its image. `GlassRenderer.uploadDecoded()` does the same for your own renderer; `setSource()` still uploads at once.
- The WebGL renderer asks for shader status once, after linking, instead of waiting on each compile.

## [0.4.0] - 2026-09-25

### Added

- `reduceTransparency`, `reduceMotion` and `increaseContrast` on `GlassProvider`, for an app's own accessibility settings: Safari doesn't report Reduce Transparency to the web. A provider adds a setting; it never removes the system's.
- `useGlassPreferences()`: the transparency, motion and contrast settings glass is following.
- `onPathChange(path, reason)` on `Glass`: the path a glass draws (`refract`, `frost`, `webgl`, `element` or `none`) and why, such as `engine`, `accessibility` or `media`.
- A development warning when an ancestor's `opacity`, `filter`, `mask`, `clip-path` or blend mode confines a refracting glass to that ancestor's content.

### Changed

- Under `prefers-contrast: more` and forced colors, glass turns opaque and draws a hairline edge, which forced colors repaint in the system's color.
- `useGlassMode()` reports what glass draws, not what the browser supports: `frost` under reduced transparency or increased contrast.

## [0.3.0] - 2026-09-25

### Added

- `ripple` on `Glass` and `GlassPane`: a damped-wave liquid surface. Taps ring it, fingers leave trails, and the glass sloshes when it starts or stops. Waves refract the backdrop and catch the light, in WebGL, and cost nothing at rest.
- `Glass.Stack` and `Glass.Layer`: depth-ordered glass layers over a scene. Control layers refract the layers beneath them, live in Chromium and in WebGL over media elsewhere, and layers that change together are staggered by depth.
- `useGlassPhysics`, `GlassPhysics` and `SPRINGS`: presence, refraction, highlight, tint and shadow on independent springs with mass, stiffness and damping, driven by momentum rather than durations. `GlassPhysics` runs outside React with a manual scheduler.
- `optics` on `Glass`, and `intensity` (`'subtle' | 'regular' | 'strong'` or 0 to 1) on every glass.

### Changed

- `interactive` glass that moves squashes along its path and wobbles as it stops.
- Glass with a media `backdrop` and `ripple` draws in WebGL in every browser, including Chromium.
- One spring solver now drives press, squash and layer optics.

## [0.2.0] - 2026-09-25

### Added

- Opt-in `GlassStage layered` rendering: stacked panes refract earlier panes and soft shadows, with automatic frosted fallback.
- A flickable demo lens with inertia, spring settling, subtle RGB edges, moving highlights, live refractive-index control and optional synthesized sound.
- A three-layer parallax experiment and draggable flat/glass comparisons for navigation, cards, modals and toasts.
- An independent npm example and a StackBlitz launch button.

## [0.1.1]

### Changed

- Linked the npm package to its GitHub repository, issues, and live documentation.
- Set up GitHub Actions trusted publishing for future npm releases.

## [0.1.0]

### Added

- Optics-based glass surfaces for React, with live Chromium refraction and frosted fallbacks.
- WebGL refraction over images, video, and canvas; glass groups and moving indicators.
- Buttons, tabs, panels, form controls, glyphs, and a loading component.
- Light and dark appearance, reduced-motion behavior, and server-rendering support.
- A demo site, component catalog, playground, manual, and 30-second video.
