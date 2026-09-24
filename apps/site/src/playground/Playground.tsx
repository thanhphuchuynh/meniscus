import { Glass, GlassProvider, type GlassAppearance, type GlassOptions, type ProfileName } from 'meniscus';
import { DEFAULTS, VARIANTS, glassProfile, resolveGlass, roundedRectSdf, type RenderModePreference } from 'meniscus/core';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { CodeBlock, Colophon, Masthead } from '../shared/chrome';
import { SunDial, Switch, useDrag } from '../shared/controls';
import { useEngine } from '../shared/engine';
import { Icon } from '../shared/Icon';
import { RayDiagram } from '../shared/RayDiagram';
import { Scale, Segmented } from '../shared/Scale';
import { plateSrc, useTheme } from '../shared/theme';

type Backdrop = 'engraving' | 'type' | 'grid' | 'bars';

interface Bench {
  width: number;
  height: number;
  capsule: boolean;
  radius: number;
  bezel: number;
  profile: ProfileName;
  refraction: number;
  ior: number;
  caustics: boolean;
  variant: 'regular' | 'clear';
  appearance: GlassAppearance;
  /** The tint controls were touched: use them instead of the appearance's default. */
  tintCustom: boolean;
  blur: number;
  saturation: number;
  tintHex: string;
  tintAlpha: number;
  aberration: number;
  specular: number;
  rim: number;
  shade: number;
  lightAngle: number;
  lightElevation: number;
  mode: RenderModePreference;
  interactive: boolean;
}

const INITIAL: Bench = {
  width: 380,
  height: 150,
  capsule: false,
  radius: 44,
  bezel: 40,
  profile: 'squircle',
  refraction: 1.1,
  ior: 1.5,
  caustics: false,
  variant: 'clear',
  appearance: 'auto',
  tintCustom: false,
  blur: VARIANTS.clear.blur,
  saturation: VARIANTS.clear.saturation,
  tintHex: '#ffffff',
  tintAlpha: 0.03,
  aberration: 0,
  specular: VARIANTS.clear.specular,
  rim: VARIANTS.clear.rim,
  shade: VARIANTS.clear.shade,
  lightAngle: 315,
  lightElevation: DEFAULTS.lightElevation,
  mode: 'auto',
  interactive: true,
};

const PROFILE_PATHS: Record<ProfileName, string> = {
  squircle: 'M2 16 C 2 7, 5 4, 12 4 L 26 4',
  circle: 'M2 16 A 12 12 0 0 1 14 4 L 26 4',
  parabolic: 'M2 16 Q 4 4, 16 4 L 26 4',
  lip: 'M2 16 C 2 5, 6 2, 11 2 C 15 2, 16 4, 26 4',
};

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const fmt = (digits: number) => (v: number) => v.toFixed(digits);

/** The tint an appearance uses by default, as the color and opacity the tint controls show. */
function defaultTintOf(b: Bench, lantern: boolean): { hex: string; alpha: number } {
  const v = VARIANTS[b.variant];
  const dark = b.appearance === 'dark' || (b.appearance === 'auto' && lantern);
  const [r = 255, g = 255, bl = 255, a = 1] = (dark ? v.darkTint : v.tint).match(/[\d.]+/g)!.map(Number);
  return { hex: `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`, alpha: a };
}

/** JSX for the current bench, listing only what differs from the defaults. */
function toJSX(b: Bench): string {
  const v = VARIANTS[b.variant];
  const props: string[] = [];
  if (b.variant !== 'regular') props.push(`variant="${b.variant}"`);
  if (b.appearance !== 'auto') props.push(`appearance="${b.appearance}"`);
  props.push(b.capsule ? 'radius="capsule"' : `radius={${b.radius}}`);
  if (b.bezel !== Math.min(b.capsule ? b.height / 2 : b.radius, DEFAULTS.maxAutoBezel)) props.push(`bezel={${b.bezel}}`);
  if (b.profile !== 'squircle') props.push(`profile="${b.profile}"`);
  if (b.refraction !== DEFAULTS.refraction) props.push(`refraction={${b.refraction}}`);
  if (b.ior !== DEFAULTS.ior) props.push(`ior={${b.ior}}`);
  if (b.caustics) props.push('caustics');
  if (b.blur !== v.blur) props.push(`blur={${b.blur}}`);
  if (b.saturation !== v.saturation) props.push(`saturation={${b.saturation}}`);
  if (b.tintCustom) props.push(`tint="${rgba(b.tintHex, b.tintAlpha)}"`);
  if (b.aberration > 0) props.push(`aberration={${b.aberration}}`);
  if (b.specular !== v.specular) props.push(`specular={${b.specular}}`);
  if (b.rim !== v.rim) props.push(`rim={${b.rim}}`);
  if (b.shade !== v.shade) props.push(`shade={${b.shade}}`);
  if (b.lightAngle !== 315) props.push(`lightAngle={${b.lightAngle}}`);
  if (b.lightElevation !== DEFAULTS.lightElevation) props.push(`lightElevation={${b.lightElevation}}`);
  if (b.mode !== 'auto') props.push(`mode="${b.mode}"`);
  if (b.interactive) props.push('interactive');
  return `import { Glass } from 'meniscus';\n\n<Glass\n${props.map((p) => `  ${p}`).join('\n')}\n>\n  …\n</Glass>`;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bench__group" aria-label={title}>
      <h2>{title}</h2>
      <div className="bench__controls">{children}</div>
    </section>
  );
}

export function Playground() {
  const engine = useEngine();
  const theme = useTheme();
  // On narrow screens the default glass starts narrower than the stage.
  const [b, setB] = useState<Bench>(() => ({ ...INITIAL, width: typeof window !== 'undefined' ? Math.min(INITIAL.width, Math.round(window.innerWidth - 2 * 16 - 48)) : INITIAL.width }));
  const [backdrop, setBackdrop] = useState<Backdrop>('engraving');
  const [probe, setProbe] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Start over the eye in Plate II, where the rays give refraction something to bend.
  const glass = useDrag<HTMLDivElement>(stage, (c, el) => ({ x: c.width * 0.62 - el.offsetWidth / 2, y: c.height * 0.2 - el.offsetHeight / 2 }));
  const set = <K extends keyof Bench>(k: K) => (v: Bench[K]) => setB((s) => ({ ...s, [k]: v }));

  const options: GlassOptions = {
    variant: b.variant,
    appearance: b.appearance,
    radius: b.capsule ? 'capsule' : b.radius,
    bezel: b.bezel,
    profile: b.profile,
    refraction: b.refraction,
    ior: b.ior,
    caustics: b.caustics,
    blur: b.blur,
    saturation: b.saturation,
    tint: b.tintCustom ? rgba(b.tintHex, b.tintAlpha) : undefined,
    aberration: b.aberration,
    specular: b.specular,
    rim: b.rim,
    shade: b.shade,
    lightAngle: b.lightAngle,
    lightElevation: b.lightElevation,
  };
  const g = resolveGlass(options, b.width, b.height);
  const profile = glassProfile(g);
  const code = useMemo(() => toJSX(b), [b]);
  const maxRadius = Math.floor(Math.min(b.width, b.height) / 2);

  const pickVariant = (variant: 'regular' | 'clear') => {
    const v = VARIANTS[variant];
    setB((s) => ({ ...s, variant, blur: v.blur, saturation: v.saturation, specular: v.specular, rim: v.rim, shade: v.shade, tintCustom: false }));
  };
  // Until the tint is touched, the controls show the appearance's own tint.
  const shownTint = b.tintCustom ? { hex: b.tintHex, alpha: b.tintAlpha } : defaultTintOf(b, theme === 'lantern');
  const setTint = (patch: Partial<{ hex: string; alpha: number }>) =>
    setB((s) => ({ ...s, tintCustom: true, tintHex: patch.hex ?? shownTint.hex, tintAlpha: patch.alpha ?? shownTint.alpha }));

  return (
    <GlassProvider mode={b.mode}>
      <Masthead page="playground" />
      <main id="main" className="bench">
        <header className="bench__head">
          <h1>Playground</h1>
          <p>
            Every prop of <code>Glass</code> on one bench. Drag the glass across the specimen, tune it on the right, and copy the result.{' '}
            {engine.refracts ? `${engine.browser} refracts live content, so you’re seeing the full effect.` : `${engine.browser} shows the frosted path; refraction needs a Chromium browser.`}
          </p>
        </header>

        <div className="bench__layout">
          <div className="bench__left">
            <div className={`bench__stage bench__stage--${backdrop}`} ref={stage}>
              {backdrop === 'engraving' ? <img src={plateSrc('opticks-plate-2', theme)} alt="" className="bench__engraving" /> : null}
              {backdrop === 'grid' || backdrop === 'bars' ? (
                // Refraction test targets, drawn as SVG patterns so they follow the ink colors.
                <svg className="bench__pattern" aria-hidden="true">
                  <defs>
                    <pattern id="bench-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M23.5 0V24M0 23.5H24" fill="none" stroke="var(--rule)" strokeWidth="1" />
                    </pattern>
                    <pattern id="bench-bars" width="84" height="10" patternUnits="userSpaceOnUse">
                      <rect width="14" height="10" fill="var(--ink)" />
                      <rect x="28" width="14" height="10" fill="var(--spot)" />
                      <rect x="56" width="14" height="10" fill="var(--glass-edge)" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#bench-${backdrop})`} />
                </svg>
              ) : null}
              {backdrop === 'type' ? (
                <div className="bench__type" aria-hidden="true">
                  <p>
                    In a very dark Chamber, at a round Hole, about one third Part of an Inch broad, made in the Shut of a Window, I placed a Glass Prism,
                    whereby the Beam of the Sun’s Light, which came in at that Hole, might be refracted upwards toward the opposite Wall of the Chamber, and
                    there form a colour’d Image of the Sun.
                  </p>
                </div>
              ) : null}
              <Glass
                ref={glass.ref}
                {...options}
                interactive={b.interactive}
                className="bench__glass"
                style={{ ...glass.style, width: b.width, height: b.height }}
                tabIndex={0}
                role="button"
                aria-label="The glass under test. Drag it, or use the arrow keys, to move it."
                {...glass.handlers}
                onPointerMove={(e) => {
                  glass.handlers.onPointerMove(e);
                  const r = e.currentTarget.getBoundingClientRect();
                  const s = roundedRectSdf(((e.clientX - r.left) / r.width) * b.width, ((e.clientY - r.top) / r.height) * b.height, b.width, b.height, g.radius);
                  setProbe(Math.min(g.bezel, Math.max(0.3, -s.distance)));
                }}
                onPointerLeave={() => setProbe(null)}
              >
                <Icon name="grip" className="bench__grip" />
              </Glass>
            </div>

            <div className="bench__stage-bar">
              <Segmented<Backdrop>
                label="Specimen"
                value={backdrop}
                onChange={setBackdrop}
                options={[
                  { value: 'engraving', label: 'Engraving' },
                  { value: 'type', label: 'Type' },
                  { value: 'grid', label: 'Grid' },
                  { value: 'bars', label: 'Bars' },
                ]}
              />
              <button type="button" className="action action--quiet bench__reset" onClick={() => setB(INITIAL)}>
                <Icon name="reset" /> Reset
              </button>
            </div>

            <div className="bench__figure">
              <RayDiagram bezel={g.bezel} thickness={g.thickness} ior={g.ior} profile={g.profile} caustics={g.caustics} probe={probe ?? g.bezel * 0.24} title="Section through your glass" />
              <p className="caption">
                <b>Fig. 1.</b> A section through the glass on the bench: rim {g.bezel.toFixed(1)} px wide, {g.thickness.toFixed(1)} px thick,{' '}
                <span className="var">n</span> = {g.ior.toFixed(2)}. Largest shift <span className="num">{profile.maxDisplacement.toFixed(1)}</span> px. Hover the glass
                to probe a point.
              </p>
            </div>
          </div>

          <aside className="bench__panel" aria-label="Glass settings">
            <Group title="Shape">
              <Scale label="Width" value={b.width} min={120} max={560} step={2} onChange={set('width')} unit="px" />
              <Scale label="Height" value={b.height} min={44} max={360} step={2} onChange={set('height')} unit="px" />
              <Switch checked={b.capsule} onChange={set('capsule')} label="Capsule">
                Capsule ends
              </Switch>
              {b.capsule ? null : <Scale label="Radius" value={Math.min(b.radius, maxRadius)} min={0} max={maxRadius} step={1} onChange={set('radius')} unit="px" />}
              <Scale label="Bezel" value={b.bezel} min={0} max={Math.max(4, Math.min(120, maxRadius))} step={1} onChange={set('bezel')} unit="px" hint="Capped at the corner radius." />
              <Segmented<ProfileName>
                className="segmented--profiles"
                label="Profile"
                value={b.profile}
                onChange={set('profile')}
                options={(Object.keys(PROFILE_PATHS) as ProfileName[]).map((p) => ({
                  value: p,
                  title: p,
                  label: (
                    <>
                      <svg viewBox="0 0 28 18" aria-hidden="true" className="profile-icon">
                        <path d={`${PROFILE_PATHS[p]} L 26 16 Z`} fill="var(--glass-fill)" />
                        <path d={PROFILE_PATHS[p]} fill="none" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M1 16.5 H 27" stroke="currentColor" strokeWidth="1" />
                      </svg>
                      <span>{p}</span>
                    </>
                  ),
                }))}
              />
            </Group>

            <Group title="Optics">
              <Scale label="Refraction" value={b.refraction} min={0} max={2.5} step={0.05} onChange={set('refraction')} format={fmt(2)} hint="Glass thickness over bezel width." />
              <Scale label={<>Index <span className="var">n</span></>} value={b.ior} min={1} max={2.4} step={0.01} onChange={set('ior')} format={fmt(2)} hint="1.00 air · 1.33 water · 1.50 glass · 2.42 diamond" />
              <Switch checked={b.caustics} onChange={set('caustics')} label="Caustics">
                Caustics: let the rim fold the image
              </Switch>
            </Group>

            <Group title="Surface">
              <Segmented<'regular' | 'clear'> label="Variant" value={b.variant} onChange={pickVariant} options={[{ value: 'regular', label: 'Regular' }, { value: 'clear', label: 'Clear' }]} />
              <Segmented<GlassAppearance>
                label="Appearance"
                value={b.appearance}
                onChange={(appearance) => setB((s) => ({ ...s, appearance, tintCustom: false }))}
                options={[
                  { value: 'auto', label: 'Auto', title: 'Follow the page’s light or dark theme' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
              <Scale label="Blur" value={b.blur} min={0} max={24} step={0.5} onChange={set('blur')} format={fmt(1)} unit="px" />
              <Scale label="Saturation" value={b.saturation} min={0} max={2.5} step={0.05} onChange={set('saturation')} format={fmt(2)} />
              <div className="bench__tint">
                <label className="scale__label" htmlFor="tint-color">
                  Tint
                </label>
                <input id="tint-color" type="color" value={shownTint.hex} onChange={(e) => setTint({ hex: e.target.value })} />
                <Scale label="Tint opacity" value={shownTint.alpha} min={0} max={0.9} step={0.01} onChange={(alpha) => setTint({ alpha })} format={fmt(2)} />
              </div>
            </Group>

            <Group title="Light">
              <div className="bench__sun">
                <SunDial angle={b.lightAngle} onChange={set('lightAngle')} size={104} />
                <p className="caption">
                  Light from <span className="num">{b.lightAngle}°</span>. Drag the sun or use the arrow keys.
                </p>
              </div>
              <Scale label="Elevation" value={b.lightElevation} min={4} max={70} step={1} onChange={set('lightElevation')} unit="°" />
              <Scale label="Highlight" value={b.specular} min={0} max={1} step={0.01} onChange={set('specular')} format={fmt(2)} />
              <Scale label="Rim" value={b.rim} min={0} max={1} step={0.01} onChange={set('rim')} format={fmt(2)} />
              <Scale label="Shade" value={b.shade} min={0} max={1} step={0.01} onChange={set('shade')} format={fmt(2)} />
              <Scale label="Aberration" value={b.aberration} min={0} max={1} step={0.01} onChange={set('aberration')} format={fmt(2)} hint="Adds two filter passes." />
            </Group>

            <Group title="Rendering">
              <Segmented<RenderModePreference>
                label="Path"
                value={b.mode}
                onChange={set('mode')}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'refract', label: 'Refract' },
                  { value: 'frost', label: 'Frost' },
                ]}
              />
              <Switch checked={b.interactive} onChange={set('interactive')} label="Interactive">
                Interactive: swell and glow under the pointer
              </Switch>
            </Group>

            <CodeBlock code={code} label="JSX for this glass" />
          </aside>
        </div>
      </main>
      <Colophon />
    </GlassProvider>
  );
}
