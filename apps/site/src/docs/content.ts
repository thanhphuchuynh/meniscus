export interface PropRow {
  name: string;
  type: string;
  default: string;
  body: string;
}

export const GLASS_PROPS: PropRow[] = [
  { name: 'as', type: 'ElementType', default: "'div'", body: 'The element or component to render. Every other prop it accepts passes through.' },
  { name: 'variant', type: "'regular' | 'clear' | 'tinted'", default: "'regular'", body: 'Regular frosts and tints for legibility over busy content. Clear stays nearly transparent, for glass over media. Tinted is colored glass: tint, or --meniscus-accent, mixed in at 70%, with text that stays readable on it.' },
  { name: 'intensity', type: "'subtle' | 'regular' | 'strong' | number", default: "'regular'", body: 'How strongly the glass bends and lights, as a named step or a number from 0 (subtle) through 0.5 (regular) to 1 (strong). Explicit refraction, specular and aberration win.' },
  { name: 'appearance', type: "'auto' | 'light' | 'dark' | 'adaptive'", default: "'auto'", body: 'Light glass (a pale wash) or dark glass (a smoky one). Auto follows the page’s color scheme through CSS light-dark(). Adaptive reads what is behind the glass and turns light or dark with it, setting data-meniscus-tone and a readable text color. An explicit tint wins.' },
  { name: 'radius', type: "number | 'capsule'", default: '28', body: 'Corner radius in px, capped at half the short side. Capsule rounds the ends fully.' },
  { name: 'bezel', type: 'number', default: 'min(radius, 32)', body: 'Width of the curved band along the outline, in px. Capped at the corner radius.' },
  { name: 'refraction', type: 'number', default: '1', body: 'Glass thickness as a multiple of the bezel width. 0 turns refraction off; higher values bend harder.' },
  { name: 'ior', type: 'number', default: '1.5', body: 'Index of refraction. 1.33 is water, 1.5 window glass, 2.42 diamond.' },
  { name: 'profile', type: "'squircle' | 'circle' | 'parabolic' | 'lip' | (t) => number", default: "'squircle'", body: 'Cross-section of the edge. A function maps depth into the bezel (0 to 1) to height (0 to 1).' },
  { name: 'caustics', type: 'boolean', default: 'false', body: 'Let a steep rim fold the image into doubled lines, as thick real glass does. Off keeps the image one-to-one.' },
  { name: 'blur', type: 'number', default: '5 / 0.5', body: 'Backdrop blur in px, regular / clear.' },
  { name: 'saturation', type: 'number', default: '1.6 / 1.15', body: 'Backdrop saturation multiplier.' },
  { name: 'tint', type: 'string', default: 'from appearance', body: 'Any CSS color laid over the refracted backdrop. Custom properties work.' },
  { name: 'aberration', type: 'number', default: '0', body: 'Chromatic aberration from 0 to 1. At 1, red shifts 25% further than green and blue 25% less. Costs two extra filter passes.' },
  { name: 'specular', type: 'number', default: '0.8 / 0.9', body: 'Strength of the reflected highlight, 0 to 1.' },
  { name: 'rim', type: 'number', default: '0.7 / 0.8', body: 'Strength of the bright grazing-angle line along the outline, 0 to 1.' },
  { name: 'shade', type: 'number', default: '0.35 / 0.3', body: 'Darkening where the rim turns edge-on, 0 to 1. Keeps glass legible on light pages.' },
  { name: 'lightAngle', type: 'number', default: '-45', body: 'Where the light comes from, in degrees clockwise from the top. -45 (or 315) is the top left.' },
  { name: 'lightElevation', type: 'number', default: '18', body: 'Height of the light above the surface, in degrees. Lower lights push highlights toward the outline.' },
  { name: 'mode', type: "'auto' | 'refract' | 'frost' | 'none'", default: "'auto'", body: 'Rendering path. Auto refracts where the browser can. None draws only shape, shadow and interaction.' },
  { name: 'onPathChange', type: '(path, reason) => void', default: '—', body: 'Called with the path this glass draws (refract, frost, webgl, element or none) and why (supported, engine, accessibility, preference, media, copy, group, void or flat), once it has a size and whenever either changes.' },
  { name: 'interactive', type: 'boolean', default: 'false', body: 'Lift on hover, swell on press with light blooming from the touch point, stretch toward the pointer, glow where it touches. When the glass itself moves, it squashes along its path and wobbles as it stops. Keyboard presses animate too.' },
  { name: 'appear', type: 'boolean', default: 'false', body: 'Materialize on mount: fade in, swell into place on a spring, and let the lens gather its bend. A plain fade under reduced motion.' },
  { name: 'ripple', type: 'boolean', default: 'false', body: 'A liquid surface: a tap rings it, a finger drawn across leaves a trail, and moving the glass sloshes it. Waves bend what is behind and catch the light, then die out. Drawn in WebGL: glass over an image, video or canvas backdrop (every browser, Chromium included), or a GlassPane in a GlassStage. Off under reduced motion.' },
  { name: 'optics', type: 'GlassPhysics', default: '—', body: 'Springs for presence, refraction, highlight, tint and lift, from useGlassPhysics. The glass follows them frame by frame without re-rendering; with interactive, a press lifts it and the release sets it ringing.' },
  { name: 'shadow', type: 'string | false', default: 'a soft two-layer shadow', body: 'The box shadow under the glass, or false for none.' },
  { name: 'backdrop', type: 'HTMLElement | RefObject', default: '—', body: 'What lies behind the glass, for browsers that can’t refract the live page: media is refracted in WebGL, any other element as a live copy in Firefox. Must not contain the glass.' },
];

export const STAGE_PROPS: PropRow[] = [
  { name: 'source', type: 'string | TexImageSource | RefObject', default: 'required', body: 'An image URL, or a video, canvas, image or bitmap you render inside the stage (or a ref to one).' },
  { name: 'fit', type: "'cover' | 'contain' | 'fill'", default: "'cover'", body: 'How the source fills the stage, like object-fit.' },
  { name: 'alt', type: 'string', default: "''", body: 'Alt text for an image URL source.' },
  { name: 'crossOrigin', type: "'' | 'anonymous' | 'use-credentials'", default: "'anonymous'", body: 'CORS mode for an image URL. WebGL can only read cross-origin images served with CORS headers.' },
  { name: 'maxPixelRatio', type: 'number', default: '2', body: 'Upper bound on the canvas resolution.' },
  { name: 'animate', type: 'boolean', default: 'false', body: 'Redraw every frame, for canvas sources that change on their own. Playing video always redraws.' },
  { name: 'onStatus', type: '(status) => void', default: '—', body: "Called with 'pending', 'ready' or 'fallback' as the stage settles." },
  { name: 'layered', type: 'boolean', default: 'false', body: 'Composite panes back to front in registration order, refracting earlier panes and soft shadows. Adds one pass per pane and two reusable render textures. Keep stacks small. shadow={false} removes a pane’s shadow. Custom CSS shadows and DOM children are not refracted; positive merge takes precedence.' },
  { name: 'merge', type: 'number', default: '0', body: 'Let panes flow into one body: outlines closer than this many px bridge, and the neck blends the two glasses. 0 keeps panes apart.' },
];

export const INDICATOR_PROPS: PropRow[] = [
  { name: 'target', type: 'HTMLElement | null', default: 'required', body: 'The element to sit under, such as the selected tab. It must share the indicator’s offset parent. Hidden while null.' },
  { name: 'inset', type: 'number', default: '0', body: 'Space between the target’s box and the glass, in px. Negative values grow past the target.' },
  { name: 'stretch', type: 'number', default: '1', body: 'How liquid the move is. 0 slides rigidly; 1 lets the leading edge run ahead while the trailing edge catches up.' },
  { name: 'radius', type: "number | 'capsule'", default: "'capsule'", body: 'Corner radius, as on Glass. Every other Glass prop works too, except as and interactive.' },
];

export const GROUP_PROPS: PropRow[] = [
  { name: 'spacing', type: 'number', default: '24', body: 'How far apart two outlines can be and still bridge, in px. Within twice this, they lean toward each other. 0 never merges.' },
  { name: 'mode', type: "'auto' | 'refract' | 'frost' | 'none'", default: "'auto'", body: 'Rendering path for the merged surface, as on Glass.' },
  { name: 'shadow', type: 'boolean', default: 'true', body: 'A soft shadow outside the merged outline.' },
  { name: 'as', type: 'ElementType', default: "'div'", body: 'The element the group renders. It is the positioned box its members are measured in.' },
  { name: 'backdrop', type: 'HTMLElement | RefObject', default: '—', body: 'What lies behind the group, as on Glass. Over an image or video, Safari and Firefox draw the merged glass in WebGL.' },
  { name: '…glass', type: 'GlassOptions', default: 'provider', body: 'Refraction, tint, blur, light and the rest apply to the whole surface. Members contribute only their outline and radius.' },
];

export const STACK_PROPS: PropRow[] = [
  { name: 'physics', type: "'gentle' | 'snappy' | 'bouncy' | 'stiff' | { mass, stiffness, damping }", default: "'snappy'", body: 'The spring for every layer that sets none.' },
  { name: 'stagger', type: 'number', default: '0.12', body: 'The wait between depth ranks in a shared transition, as a fraction of each layer’s spring period. Nearer layers lead; negative reverses; 0 moves them together.' },
  { name: 'renderer', type: "'auto' | 'css' | 'webgl'", default: "'auto'", body: 'Auto refracts the live page where the browser can and uses WebGL over a media context elsewhere. CSS never uses WebGL; WebGL uses it over media everywhere.' },
  { name: 'appear', type: 'boolean', default: 'false', body: 'Layers shown on mount enter from hidden, staggered by depth.' },
  { name: 'as', type: 'ElementType', default: "'div'", body: 'The element the stack renders.' },
];

export const LAYER_PROPS: PropRow[] = [
  { name: 'kind', type: "'context' | 'control'", default: "'control'", body: 'Control layers are glass that refracts everything beneath them, lower layers included. A context layer is the scene: images, video, gradients or any content.' },
  { name: 'depth', type: 'number', default: 'page order', body: 'Stacking order: higher is nearer. Sets z-index.' },
  { name: 'present', type: 'boolean', default: 'true', body: 'Whether the layer is shown. Changes animate on its springs, staggered with the layers changing in the same render. Absent layers are inert.' },
  { name: 'physics', type: 'preset | { mass, stiffness, damping }', default: 'the stack’s', body: 'This layer’s spring. It also sets the layer’s place in a stagger.' },
  { name: 'source', type: 'img | video | canvas | RefObject', default: 'first inside', body: 'For a context layer: the media the WebGL path draws.' },
  { name: '…glass', type: 'GlassOptions', default: 'provider', body: 'Control layers take every Glass prop: intensity, tint, radius, interactive, ripple and the rest.' },
];

export const CODE = {
  install: 'npm i meniscus',
  quick: `import { Glass } from 'meniscus';

export function Toolbar() {
  return (
    <Glass radius="capsule" interactive>
      <button>Plates</button>
      <button>Search</button>
    </Glass>
  );
}`,
  as: `<Glass as="nav" radius="capsule" aria-label="Sections">
  <a href="/plates">Plates</a>
  <a href="/search">Search</a>
</Glass>

<Glass as="button" type="button" radius="capsule" interactive onClick={play}>
  Play
</Glass>`,
  provider: `import { Glass, GlassProvider } from 'meniscus';

// One light source and one tint for everything below.
<GlassProvider lightAngle={300} tint="rgba(255, 255, 255, 0.18)">
  <Glass as="header" radius="capsule">…</Glass>
  <Glass radius={24}>…</Glass>
</GlassProvider>`,
  mode: `import { Glass, GlassProvider, useGlassMode } from 'meniscus';

function Notice() {
  // What glass draws here, after the browser and accessibility settings.
  const mode = useGlassMode(); // 'refract' | 'frost' | 'none'
  return mode === 'frost' ? <p>The glass on this page is frosted.</p> : null;
}

// One glass, and why it draws the way it does:
<Glass backdrop={videoRef} onPathChange={(path, reason) => console.log(path, reason)} />
// Chromium: 'refract', 'supported'. Safari: 'webgl', 'media'. Reduce Transparency: 'frost', 'accessibility'.

// Or force a path for a subtree:
<GlassProvider mode="frost">…</GlassProvider>`,
  stage: `import { GlassPane, GlassStage } from 'meniscus/webgl';

<GlassStage source="/photos/harbor.jpg" alt="The harbor at dusk" style={{ height: 480 }}>
  <GlassPane radius="capsule" style={{ position: 'absolute', left: 32, top: 32, width: 280, height: 64 }}>
    Now playing
  </GlassPane>
</GlassStage>`,
  video: `function Player() {
  const video = useRef<HTMLVideoElement>(null);
  return (
    <GlassStage source={video} style={{ aspectRatio: '16 / 9' }}>
      <video ref={video} src="/clip.mp4" autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <GlassPane radius="capsule" className="controls">…</GlassPane>
    </GlassStage>
  );
}`,
  backdrop: `const photo = useRef<HTMLImageElement>(null);

<div className="hero">
  <img ref={photo} src="/harbor.jpg" alt="" />
  {/* Chromium refracts the page; Safari and Firefox refract the photo in WebGL. */}
  <GlassGroup spacing={32} backdrop={photo}>
    <Glass radius="capsule" className="toolbar">…</Glass>
    <Glass radius="capsule" className="drop">…</Glass>
  </GlassGroup>
</div>

// Firefox (experimental): a live copy of any element behind the glass.
<Glass as="header" radius="capsule" backdrop={mainRef}>…</Glass>`,
  appear: `const [open, setOpen] = useState(false);

{open && (
  <Glass as="aside" radius={24} appear role="status">
    Saved to your plates.
  </Glass>
)}`,
  indicator: `import { Glass, GlassIndicator } from 'meniscus';

function Tabs({ tabs, current, onSelect }) {
  const [selected, setSelected] = useState<HTMLElement | null>(null);
  return (
    <Glass as="nav" radius="capsule" aria-label="Sections">
      <GlassIndicator target={selected} tint="rgb(255 74 28 / 0.12)" />
      {tabs.map((tab, i) => (
        <button
          key={tab}
          ref={i === current ? setSelected : undefined}
          aria-current={i === current ? 'page' : undefined}
          onClick={() => onSelect(i)}
          style={{ position: 'relative' }}
        >
          {tab}
        </button>
      ))}
    </Glass>
  );
}`,
  group: `import { Glass, GlassGroup } from 'meniscus';

// Lay the members out and move them with CSS or state, as usual.
<GlassGroup spacing={36} className="dock">
  <Glass radius="capsule" className="toolbar">…</Glass>
  <Glass radius="capsule" className="drop" interactive style={{ left: x, top: y }}>
    <SearchIcon />
  </Glass>
</GlassGroup>`,
  merge: `<GlassStage source="/photos/harbor.jpg" merge={28}>
  <GlassPane radius="capsule" style={capsule} />
  <GlassPane radius="capsule" aberration={0.6} style={lens} />
</GlassStage>`,
  profile: `// Depth into the bezel (0 at the outline, 1 at the plateau) to height (0 to 1).
// Define it once, outside components: maps are cached per function.
const bevel = (t: number) => Math.min(1, t * 1.4);

<Glass profile={bevel} bezel={24} />`,
  core: `import { resolveGlass, glassTiles, filterMarkup } from 'meniscus/core';

const glass = resolveGlass({ radius: 'capsule', refraction: 1.2 }, 320, 80);
const tiles = glassTiles(glass); // displacement maps, or null where nothing bends
if (tiles) {
  svg.innerHTML = filterMarkup('lens', { width: 320, height: 80, tiles });
  element.style.backdropFilter = \`url(#lens) blur(\${glass.blur}px) saturate(\${glass.saturation})\`;
}`,
  trace: `import { computeRefractionProfile, traceRay } from 'meniscus/core';

const optics = { bezel: 32, thickness: 32, ior: 1.5 };
traceRay(optics, 6); // a ray entering 6 px in from the outline
// { incidence: 0.69, refraction: 0.44, deviation: 0.25, height: 27.73, shift: 7.12 }
// angles in radians, height and shift in px

computeRefractionProfile(optics).maxDisplacement; // 11.84: the largest shift the renderer applies`,
  stack: `import { Glass } from 'meniscus';

export function Workspace({ open }: { open: boolean }) {
  return (
    <Glass.Stack physics="snappy" stagger={0.12} style={{ height: 480 }}>
      <Glass.Layer kind="context">
        <img src="/photos/harbor.jpg" alt="The harbor at dusk" />
      </Glass.Layer>
      <Glass.Layer as="nav" depth={1} present={open} className="sidebar" radius={22}>…</Glass.Layer>
      <Glass.Layer depth={2} present={open} className="card" radius={26} interactive>…</Glass.Layer>
    </Glass.Stack>
  );
}

/* Layers move in with your CSS: */
.sidebar { translate: calc((1 - var(--meniscus-presence, 1)) * -28px) 0; }`,
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
};

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
