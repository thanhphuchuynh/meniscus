# Living optics implementation plan

**Goal:** Make the approved lens, layered optics and UI comparison experiences interactive and runnable online.

**Architecture:** Keep demo motion and audio in the site. Reuse Glass optical props and the existing release spring. Add opt-in layered WebGL rendering using framebuffer passes, so each pane samples the image and shadows below it. Preserve the default single-pass renderer.

**Constraints:** No new runtime dependencies. Preserve the Opticks visual identity. Sound starts off. Motion respects reduced motion, cancellation, resize and unmount. Native keyboard controls remain available. GitHub README links to a runnable example because it cannot embed one.

## Tasks

- [x] Lens: test bounded motion and settling; implement velocity tracking, inertial spring release, virtual light, subtle aberration, live index control and optional Web Audio clink.
- [x] Depth: implement opt-in layered stage rendering with owned framebuffer cleanup, ordered pane passes and refracted shadows; add three-pane parallax experiment with keyboard controls and fallback notice.
- [x] Gallery: native range-controlled comparison divider; reusable example presentation with flat/glass views, modal/card/toast examples and keyboard/touch access.
- [x] Example: standalone Vite React project using the published package; README StackBlitz badge and site link. Document new stage option and renderer limitations.
- [x] Proof: unit suite, typecheck/build, browser checks for motion, comparison, dialog, layered shader and responsive layout. Review final diff and fix material issues.

## Decisions and progress

- Scope approved in conversation. Execute inline on `feat/living-optics`; no publishing as part of this change.
- Layered mode adds two reusable render targets and one pass per pane; this cost is opt-in. Merge takes precedence when enabled.
- Existing `interactive` release spring supplies the wobble; positional inertia belongs to the demo drag controller.

- Motion: three focused tests pass, including rapid flick bounds and deterministic settling.
- Full suite: 80 tests pass. Typecheck and production build pass. Standalone example installs meniscus 0.1.1 from npm and builds.
- Review: fixed per-pane shadow disabling in layered mode; custom CSS shadows remain DOM shadows. GPU regression first failed with a pixel difference of 1,185,649, then passed with zero difference.
- Browser proof covers inertia, settling, index updates, layered pixels/orientation/resize, comparison pointer/keyboard/touch, dialog save, toast dismissal, reduced motion and responsive width. WebGL context loss/restoration also passes, with no browser page errors.
