import { GlassProvider } from 'meniscus';
import packageJson from '../../../../packages/meniscus/package.json';
import { useState } from 'react';
import { CodeBlock, Colophon, Install, Masthead } from '../shared/chrome';
import { OnlineExample } from '../shared/OnlineExample';
import { Icon } from '../shared/Icon';
import { sitePath } from '../shared/paths';
import { PlateDepth } from './PlateDepth';
import { PlateStack } from './PlateStack';
import { PlateAnatomy } from './PlateAnatomy';
import { PlateRenderers } from './PlateRenderers';
import { PlateSpecimen } from './PlateSpecimen';
import { PlateSpecimens } from './PlateSpecimens';
import { PlateTension } from './PlateTension';
import { PlateInterfaces } from './PlateInterfaces';
import { PlateMedia } from './PlateMedia';

const QUICK_START = `import { Glass } from 'meniscus';

export function Toolbar() {
  return (
    <Glass radius="capsule" interactive>
      <button>Plates</button>
      <button>Search</button>
    </Glass>
  );
}`;

export function Home() {
  // One sun for every glass on the page, the masthead included.
  const [sun, setSun] = useState(315);
  return (
    <GlassProvider lightAngle={sun}>
      <Masthead page="home" />
      <main id="main" className="home">
        <PlateSpecimen />
        <nav className="home-index" aria-label="On this page">
          <a href="#browser-support">Browser support</a>
          <a href="#anatomy">How it works</a>
          <a href="#try-online">Quick start</a>
          <a href="#specimens">Examples</a>
          <a href="#depth">Experiments</a>
        </nav>
        {/* The evaluator's questions in order: will it work here, why is it real, how do I start. */}
        <PlateRenderers />
        <PlateAnatomy sun={sun} onSun={setSun} />
        <section id="try-online" className="closing" aria-labelledby="quick-start-title">
          <div className="closing__text">
            <h2 id="quick-start-title">Start with one component</h2>
            <p>
              <code>Glass</code> renders any element you name and ships no stylesheet. It server-renders frosted, then refracts after hydration wherever
              the browser can draw it. The React entries carry <code>"use client"</code>, so Server Components can render them.
            </p>
            <dl className="rd-readout closing__facts">
              <div>
                <dt>Version</dt>
                <dd className="num">{packageJson.version}</dd>
              </div>
              <div>
                <dt>React</dt>
                <dd>18 and 19</dd>
              </div>
              <div>
                {/* ponytail: measured by hand (esbuild, minified, React external, gzip -9); re-measure on release. */}
                <dt>Glass, gzipped</dt>
                <dd>
                  <span className="num">21</span> kB
                </dd>
              </div>
              <div>
                <dt>License</dt>
                <dd>MIT</dd>
              </div>
            </dl>
            <div className="closing__actions">
              <Install />
              <OnlineExample />
              <div className="actions-row">
                <a className="action action--primary" href={sitePath('/playground/')}>
                  Open the playground
                  <Icon name="arrow" />
                </a>
                <a className="action action--quiet" href={sitePath('/docs/')}>Read the manual</a>
              </div>
            </div>
          </div>
          <CodeBlock code={QUICK_START} label="Quick start" />
        </section>
        <PlateSpecimens />
        <PlateTension />
        <PlateInterfaces />
        <PlateMedia />
        <PlateDepth />
        <PlateStack />
        <section id="finish" className="closing closing--final" aria-labelledby="closing-title">
          <div className="closing__text">
            <h2 id="closing-title">Make the glass yours</h2>
            <p>
              Start with the component library, then tune the light and refraction to fit your interface.
            </p>
            <div className="closing__actions">
              <div className="actions-row">
                <a className="action action--primary" href={sitePath('/components/')}>
                  Explore components
                  <Icon name="arrow" />
                </a>
                <a className="action action--quiet" href={sitePath('/docs/')}>Read the manual</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Colophon />
    </GlassProvider>
  );
}
