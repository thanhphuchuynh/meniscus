---
name: meniscus
description: Liquid glass for React, shown as a live two-color optics plate.
colors:
  stock: "#eef2f4"
  stock-deep: "#e2e8ec"
  stock-raised: "#f6f8f9"
  ink: "#0f1a24"
  ink-soft: "#364452"
  ink-faint: "#5a6773"
  rule: "rgba(15, 26, 36, 0.86)"
  rule-faint: "rgba(15, 26, 36, 0.18)"
  spot: "#ff4a1c"
  spot-ink: "#c2320e"
  glass-fill: "#c4e4ec"
  glass-edge: "#7fb9c8"
  lantern-stock: "#0b141d"
  lantern-stock-deep: "#07101a"
  lantern-stock-raised: "#111d28"
  lantern-ink: "#e6edf1"
  lantern-ink-soft: "#b3c0ca"
  lantern-ink-faint: "#8a99a6"
  lantern-rule: "rgba(230, 237, 241, 0.82)"
  lantern-rule-faint: "rgba(230, 237, 241, 0.16)"
  lantern-spot: "#ff643a"
  lantern-spot-ink: "#ff8660"
  lantern-glass-fill: "#173f4b"
  lantern-glass-edge: "#3f8ea3"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, sans-serif"
    fontSize: "clamp(3.1rem, 7.4vw, 6rem)"
    fontWeight: 850
    lineHeight: 0.93
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.2rem, 4.6vw, 3.7rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.024em"
    fontVariation: "'wdth' 125"
  page-title:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.6rem, 5.6vw, 4.6rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, sans-serif"
    fontSize: "clamp(1.7rem, 3vw, 2.3rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  lede:
    fontFamily: "STIX Two Text Variable, STIX Two Text, Times New Roman, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.42
  body:
    fontFamily: "STIX Two Text Variable, STIX Two Text, Times New Roman, serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "STIX Two Text Variable, STIX Two Text, Times New Roman, serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  ui:
    fontFamily: "Archivo Variable, Archivo, Helvetica Neue, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1
  label:
    fontFamily: "STIX Two Text Variable, STIX Two Text, Times New Roman, serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
    fontFeature: "'smcp', 'c2sc'"
  mono:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.65
    fontFeature: "'tnum', 'zero'"
rounded:
  code-inline: "4px"
  notice: "10px"
  panel: "12px"
  segment-row: "14px"
  segment: "11px"
  pill: "999px"
spacing:
  hair: "1px"
  plate-outline-offset: "6px"
  gutter: "clamp(16px, 3.6vw, 44px)"
  plate-pad: "clamp(16px, 3vw, 40px)"
  measure: "66ch"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    typography: "{typography.ui}"
    rounded: "{rounded.pill}"
    padding: "12px 18px 12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.spot-ink}"
    textColor: "{colors.stock}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.pill}"
    padding: "12px 18px 12px 20px"
  button-quiet-hover:
    textColor: "{colors.spot-ink}"
  install-line:
    backgroundColor: "{colors.stock-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.pill}"
    padding: "4px 4px 4px 14px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "38px"
  segmented-option:
    textColor: "{colors.ink-soft}"
    typography: "{typography.ui}"
    rounded: "{rounded.segment}"
    padding: "7px 10px"
  segmented-option-checked:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.ink}"
  switch-track:
    backgroundColor: "{colors.stock-raised}"
    rounded: "{rounded.pill}"
    width: "38px"
    height: "22px"
  switch-knob-on:
    backgroundColor: "{colors.spot}"
    size: "14px"
  code-block:
    backgroundColor: "{colors.stock-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.panel}"
    padding: "18px 20px"
  note:
    backgroundColor: "{colors.stock-raised}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.caption}"
    rounded: "{rounded.panel}"
    padding: "16px 18px"
---

# Design System: meniscus

## Overview

**Creative North Star: "The Ray Plate"**

The site is a page from a two-color optics textbook that happens to be live. Cool plate stock, blue-black ink, and one vermilion spot ink carry everything; pale cyan appears only where there is glass. Every section sits inside an engraved plate frame with a folio, every figure is numbered and captioned, and the diagrams are single-weight line engravings with lettered points and angle arcs, computed by the same library the page is advertising. The glass is the one material that is not ink: it floats over the printed content and bends it.

Dark mode is not an inverted palette but a lantern slide: the same plate, projected. Stock goes to near-black blue, ink turns to pale light, the spot ink brightens, and the glass body darkens to a deep cyan. Users toggle between **print** and **lantern** from the masthead; the choice persists, and otherwise follows the system preference.

Density is editorial: generous gutters, long running measure, figures given room. The system rejects aurora wallpaper with floating cards: there are no gradient backgrounds, no card grids, and no decorative shadows. Depth comes from the glass itself.

**Key Characteristics:**
- Two inks on cool stock, plus vermilion as the only accent and cyan confined to glass.
- Engraved plate frames: 1px rule, faint 1px outline offset 6px, register crosshairs at two corners, small-caps folio set into the top rule.
- Archivo at 125% width, weight 800 to 850, for heads; STIX Two Text for everything that reads; JetBrains Mono for code and numbers.
- Numbered figures with "Fig. n." captions; lettered, single-weight line diagrams.
- Two themes, print and lantern, sharing every token name.
- Glass (the meniscus library) is the only material with depth; it sits on the printed plate and refracts it.

## Colors

The tokens live in `apps/site/src/styles/tokens.json` (W3C design-token format, lantern values under `$extensions["meniscus.themes"]`); `tokens.css` is generated from it by `pnpm --filter site tokens`, and the build fails if the two disagree.

A restrained two-ink print palette: blue-black on cool grey-white, one vermilion spot, and a pale cyan reserved for glass.

### Primary
- **Vermilion Spot Ink** (`spot`): the ray color. The probed ray, its arrowheads, the refraction arc, and the shift dimension in every ray diagram; the active switch knob and track; the scale's filled portion; the sun on the sun dial; the current-page underline in the masthead; focus outlines, text selection, caret; list markers in the manual.
- **Deep Vermilion** (`spot-ink`): the text-safe spot. Used where vermilion must be read as type or sit behind light text: primary button hover, the current table-of-contents entry, section numbers in the manual, "you are here" annotations, spot-lettered points (P, Q, θ₂), shift readouts, syntax keywords.

### Tertiary
- **Glass Cyan** (`glass-fill`): the body of glass drawn in section in the ray diagrams, under a 45-degree hatch.
- **Glass Edge Cyan** (`glass-edge`): the hatch lines inside that glass section.

### Neutral
- **Plate Stock** (`stock`): the page. Also the knob and slider thumb fill, and the paper behind a plate folio.
- **Deep Stock** (`stock-deep`): inline code chips, scrollbar track.
- **Raised Stock** (`stock-raised`): code blocks, the install line, notes, the playground instrument panel, switch track, icon-button hover.
- **Blue-Black Ink** (`ink`): headings, running text, diagram line work, primary button fill, checked segment.
- **Soft Ink** (`ink-soft`): secondary prose, captions, table cells, inactive nav and segment labels.
- **Faint Ink** (`ink-faint`): folios, register marks, table heads, tick graduations, hints, footnotes, and the hatching under the page line in ray diagrams.
- **Rule** (`rule`): plate borders, the colophon rule, table head rules, control outlines.
- **Faint Rule** (`rule-faint`): the plate's outer outline, row dividers, figure dividers, stage borders, link underlines at rest.

### Lantern theme
Every token above has a `lantern-*` counterpart in the frontmatter, applied to the same names under `[data-theme='lantern']` (or dark system preference when no theme is saved). The roles do not change; only the values do. Engravings switch to their `-lantern` duotone at the same time.

### Named Rules
**The Spot Ink Rule.** Vermilion marks light and state, nothing else: rays, the sun, and active or focused controls. It is never a background wash, a decorative stripe, or a heading color. The tab specimen's 12% spot tint behind the current tab is the widest it ever gets.

**The Glass-Only Cyan Rule.** Pale cyan exists only inside glass bodies (the section fill and hatch in ray diagrams). It is not a secondary accent for UI.

**The Two Inks Rule.** Anything that is not a ray, a state, or glass is drawn in ink on stock, with hierarchy made from the three ink strengths and two rule strengths, not from new hues.

## Typography

**Display Font:** Archivo Variable, set expanded (width 125%) (with Helvetica Neue, sans-serif)
**Body Font:** STIX Two Text Variable (with Times New Roman, serif)
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, monospace)

**Character:** A wide, heavy grotesque for plate titles against a scholarly text serif for everything that reads, the pairing of a modern textbook's heads with its captions. Mono is for code and figures only.

The text scale is four fixed steps, each about 1.25x the last: label 12px, ui 15px, body 19px, lede 24px (`--fs-label`, `--fs-ui`, `--fs-body`, `--fs-lede`). Headings are fluid `clamp()` sizes above that.

### Hierarchy
- **Display** (850, clamp(3.1rem, 7.4vw, 6rem), 0.93): the Plate I headline only, max 12ch.
- **Page title** (800, clamp(2.6rem, 5.6vw, 4.6rem), 0.95): the Playground and Manual page heads.
- **Headline** (800, clamp(2.2rem, 4.6vw, 3.7rem), 0.98): each subsequent plate's title.
- **Title** (800, clamp(1.7rem, 3vw, 2.3rem)): manual section heads, preceded by a spot-ink italic section number at lede size.
- **Lede** (400, 24px, 1.42): the opening paragraph of Plate I, max 34ch; drops to body size under 640px.
- **Body** (400, 19px, 1.5): running text, max 52 to 68ch depending on the column (`--measure` 66ch as the default).
- **Caption** (400, 15px, 1.45, soft ink): figure captions, notes, readout terms, table cells.
- **UI** (Archivo 600 to 700, 15px, line-height 1): buttons, nav, segment labels, control labels, legend names (700 at 110 to 112% width).
- **Label** (STIX 600, 12px, all-small-caps, 0.07 to 0.08em tracking, faint ink): plate folios, table heads, the manual's contents title.
- **Mono** (400, 15px, 1.65 in blocks): code, the install line, and every live number (`.num`: tabular figures, slashed zero). Inline code sits one step below its text (0.79em).

### Named Rules
**The Four Steps Rule.** Text uses only 12, 15, 19, and 24px. Anything larger is a heading on a clamp. The ray diagram's SVG lettering is drawn at figure scale and is the only exception.

**The Italic Variable Rule.** Physical quantities (θ, n) and lettered points (A, B, P, Q) are STIX italic, as in a printed figure; live numeric values beside them are mono tabular figures.

**The Small Caps Rule.** Labels are true small caps in the text serif (`font-variant-caps: all-small-caps`), never uppercased sans. "Fig. n." in a caption is bold small caps in ink.

## Layout

The page is a vertical stack of plates, each inset from the viewport by `--gutter` (16 to 44px) and padded inside by `--plate-pad` (16 to 40px). Plates are separated by a large fluid gap (72 to 150px) so each reads as its own leaf.

Inside a plate, layout is a two-column grid: a text or specimen field and a figure column, split roughly 1.35 to 1.6 fractions against 1. Plate titles pair with a paragraph in a two-column head. The figure column is set off by a faint vertical rule and moves below the field, with a faint top rule, under 1080px. Under 640px everything is a single column, readouts go to one column, and the specimen sheet's 12-column grid collapses to full-width cells.

The Playground is a stage plus a sticky instrument panel (320 to 390px) at desktop; the panel becomes static under 1080px. The Manual is a sticky contents column (200 to 250px) plus a body capped at 820px; the contents flow into an auto-fill grid under 960px.

The masthead is a glass capsule, max 980px, sticky 14px from the top and centered; the install line hides under 720px. Scroll padding is 88px so anchors clear it.

## Elevation & Depth

The printed plate is flat. There are no box shadows anywhere in the site's own CSS; hierarchy is made with rules (1px, two strengths), stock tints (deep, base, raised), and the plate frame's double line. Depth belongs to one material only: the meniscus glass, which the library renders with refraction, frost, tint, rim light, and specular highlight over the printed content. The masthead, the Plate I lens, the anatomy specimen, the WebGL panes, the Plate IV specimens, Plate V's capsule and drop, the selection indicators (the masthead lens, tab bars, segmented controls), the playground glass, and the manual's demos are all glass; nothing else lifts.

### Named Rules
**The Only Glass Lifts Rule.** If something needs to sit above the page, it is a `Glass`; otherwise it is ink on stock. Do not add drop shadows to stock surfaces.

**The One Sun Rule.** Every glass on a page shares one light source through `GlassProvider` (the home page's sun dial sets `lightAngle` for all of them, masthead included).

## Shapes

Two geometries meet. The printed plate is square: plate frames, stages, figure borders, tables, and the instrument panel have no radius. Everything you can touch is round: buttons, the install line, icon buttons, switches, and glass capsules are full pills (999px); the segmented control is a 14px rounded row holding 11px segments; code blocks and notes are 12px; the fallback notice is 10px; inline code chips are 4px. Knobs, slider thumbs, anatomy markers, and the sun are circles.

The plate frame is the signature form: a 1px rule border, a second faint 1px outline offset 6px outside it, 13px register crosshairs centered on the top-left and bottom-right corners, and a small-caps folio ("Plate I") set into the top rule on a stock-colored knockout near the right.

## Components

### Buttons
Pill-shaped, confident, and set in expanded Archivo.
- **Shape:** full pill (999px), 1px ink border.
- **Primary:** ink fill, stock text, 15px Archivo 700 at 110% width, padding 12px 18px 12px 20px, trailing arrow icon.
- **Hover / Focus:** primary fills with deep vermilion; the arrow slides 3px right (220ms). Focus is the global 2px spot outline, 3px offset.
- **Quiet:** transparent with ink border; hover turns the border vermilion and the label deep vermilion.
- **Icon button:** 38px circle (34px under 480px), faint-rule border, 18px icon; hover shows raised stock and full rule.
- **Press:** buttons settle to 0.97 scale while held (icon buttons 0.92, the install Copy 0.95), 160ms.
- Actions travel in pairs: primary "Open the playground" then quiet "Read the manual", below the install line.

### Install line
A pill of raised stock with a full-rule border, mono 15px, a faint `$` prompt, the command, and an inset ink pill "Copy" button (Archivo 600) that turns deep vermilion on hover and vermilion when copied, reverting after 1.6s. In the masthead it collapses to the icon only.

### Plate frame
See Shapes. Every home section is a plate with a roman-numeral folio; each has one titled head and at least one numbered figure.

### Figures and captions
Figures are numbered per page ("Fig. 1.", "Fig. 2.", "Fig. 4a." to "4d." for a set). Captions are 15px STIX in soft ink, led by the figure number in bold small caps ink, and describe what the figure shows including live values in mono. Stages holding figures take a faint 1px rule border and no radius.

### Ray diagram (signature)
A section through the glass rim drawn as an engraving: a 1px ink outline, a cyan body with a 45-degree glass-edge hatch, the page as a ruled baseline with faint hatching beneath, a fan of seven ink rays at 55% opacity, and one probed ray in spot at 1.5px with open chevron arrowheads. The surface normal is a 3/4 dash; θ₁ arc in ink, θ₂ arc in spot; the shift PQ is dimensioned in spot below the page. Points are lettered A, B (ink) and P, Q (spot) in STIX italic; notes ("glass, n = 1.50", "the page") are faint italic; "Section A–A" is faint small caps. Beneath it, a two-column readout of term (soft ink) and mono value, divided by faint rules; the shift value is deep vermilion.

### Scales (range inputs)
A native range drawn as an engraved rule: a 1px rule line, graduation ticks every tenth beneath it, and a 2px vermilion fill up to the value. The thumb is a 16px stock circle with a 1.5px ink ring that turns vermilion and scales to 1.15 when active or focused. The label (Archivo 600) and the mono value with a faint unit sit on one baseline above; an optional faint hint below.

### Segmented control
A fieldset whose row is a 14px-radius outline with 3px inset; options are 11px-radius segments in Archivo 600 soft ink. The checked segment sits on a small glass body (Glass Cyan at 72%, a glass-edge hairline, a 1px shadow) that flows from option to option as a stretching drop; the checked label turns ink. Focus draws the spot outline around the segment.

### Switch
A 38 by 22px pill track in raised stock with a rule border and a 14px stock knob. On: the track border and the knob turn vermilion and the knob slides 16px (260ms). Used for layer toggles in the anatomy legend and options in the playground.

### Sun dial
A 96px SVG slider: a rule-weight ring with 36 faint ticks (longer every 90 degrees), a dotted spot radius from the ink center dot to the sun, drawn as a 7px stock circle with a 1.5px spot ring and a spot core. Draggable, arrow keys step 5 degrees (15 with Shift). It sets the one light angle.

### Code block
Raised stock, faint-rule border, 12px radius, mono 15px at 1.65, a small pill "Copy" (12px Archivo) top-right. Syntax coloring comes only from the inks: keywords and entities deep vermilion, properties soft ink, punctuation and comments faint ink.

### Tables
Full-width, collapsed, 15px. Head cells are faint small caps over a full rule; body rows divided by faint rules; row heads in Archivo 700 at 112%. The current row lifts from soft ink to ink and carries a deep vermilion italic annotation. Under 1080px rows stack into blocks.

### Navigation
- **Masthead:** a glass capsule (regular variant, 8px blur, stock tint at 62%) holding the wordmark (Archivo 800 at 125%, with the meniscus mark: an ink vessel and a spot curved surface), nav links in Archivo 600 soft ink, the compact install, and the theme toggle. The current page is ink with a 2px spot underline drawn inset. A small lens (Glass Cyan at 50%) flows to whichever link the pointer or focus is on and fades in place when both leave.
- **Manual contents:** a sticky list under a full top rule with mono section numbers; the current section turns deep vermilion.
- **Colophon:** a full-rule top border, the typesetting and image credits in soft ink, and three Archivo links.

### Glass usage
Glass is always the library's `Glass` (DOM), or `GlassStage` with `GlassPane` (WebGL, over an engraving source), wrapped in one `GlassProvider` per page. Shapes are capsules for bars, buttons, fields, and draggable lenses; fixed radii (28px, 46px) for cards. Tint follows the theme through tokens, never a literal: `glass-wash` for controls over a plate, `glass-wash-clear` for large bodies the engraving reads through, `glass-bar` for the masthead. Draggable glasses carry a two-bar grip icon at 45 to 50% opacity, respond to pointer and arrow keys (10px steps, 40px with Shift), and drive a ray diagram from their own geometry. A single interactive glass button may carry `glass-spot-strong` to mark it as the active control. Selections in glass bars (Plate IV's tab bar, the manual's demo tabs) are a `GlassIndicator` tinted `glass-spot`, the current label in deep vermilion. Glass that merges is a `GlassGroup`: Plate V's capsule and drop share one surface with a 36px surface tension by default.

### Iconography
Custom inline SVG icons on a 24px grid, 1.5px strokes, round caps and joins, no fills: the same single engraving weight as the figures. Rendered at 14 to 20px with `currentColor`.

### Imagery
Imagery is period optics engravings only: Newton's *Opticks* (1704), Plates II and IV, public domain, duotoned to ink on stock for print and to light on dark for lantern, served as WebP. Each raster ships with a provenance sidecar (`.webp.json`) recording origin and processing, and is credited in the colophon. Images sit under glass as the thing being refracted, never as decoration.

### Motion
Two vocabularies. The printed page moves briefly and quietly on one curve, `cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out`): color and border changes take 150 to 200ms, knob and arrow translations 220 to 260ms, the disclosure chevron rotates 90 degrees in 200ms, and buttons press in 160ms. Glass moves like liquid, on the library's springs: selections flow to their target as a drop that stretches, thins and draws back together; interactive glass lifts on hover, swells and blooms light from the touch point when pressed; a card brought back materializes (`appear`); Plate V's drop fuses with its capsule and pulls free by surface tension, and dragged WebGL panes merge on Plate III.

Ambient motion is limited to two moments: Plate I's ray diagram sweeping its probe across the rim on a 9s cosine cycle when nobody is probing (pausing 3.5s after pointer input), and Plate V's drop fusing with the capsule and separating once, 0.7s after the plate first comes into view, holding 1.9s; any touch cancels it. Under `prefers-reduced-motion` neither runs, transitions collapse to near zero, and glass springs become short fades.

## Do's and Don'ts

### Do:
- **Do** put every home section in a plate frame with a roman-numeral small-caps folio and at least one numbered, captioned figure.
- **Do** keep vermilion to rays, the sun, and active or focused states; use `spot-ink` whenever vermilion is read as text.
- **Do** confine pale cyan to glass bodies drawn in section.
- **Do** set text on the four steps only (12, 15, 19, 24px) and headings in expanded Archivo on a clamp.
- **Do** set physical quantities and lettered points in STIX italic and live numbers in mono tabular figures.
- **Do** draw icons and diagram line work at a single engraving weight (1 to 1.5px strokes, no fills).
- **Do** give every raster a provenance sidecar and a colophon credit, and a lantern duotone alongside the print one.
- **Do** define every color for both print and lantern under the same token name.

### Don't:
- **Don't** use aurora or gradient wallpaper with floating cards; the page is flat printed stock.
- **Don't** add box shadows to stock surfaces; only glass has depth.
- **Don't** introduce a second accent hue; hierarchy comes from the ink and rule strengths.
- **Don't** use cyan for UI chrome, links, or highlights outside glass.
- **Don't** round the printed plate: frames, stages, and tables stay square; only touchable things are round.
- **Don't** uppercase sans labels; labels are small caps in the text serif.
- **Don't** use stock photography, generated illustration, or glyph icons; imagery is sourced period engraving and icons are drawn SVG.
