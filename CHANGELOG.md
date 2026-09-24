# Changelog

All notable changes to meniscus are recorded here. Versions follow Semantic Versioning. Before 1.0, minor releases may change the public API.

## [Unreleased]

### Added

- `ripple` on `Glass` and `GlassPane`: a damped-wave liquid surface. Taps ring it, fingers leave trails, and the glass sloshes when it starts or stops. Waves refract the backdrop and catch the light, in WebGL, and cost nothing at rest.

### Changed

- `interactive` glass that moves squashes along its path and wobbles as it stops.
- Glass with a media `backdrop` and `ripple` draws in WebGL in every browser, including Chromium.

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
