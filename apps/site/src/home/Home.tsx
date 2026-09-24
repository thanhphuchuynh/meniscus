import { GlassProvider } from 'meniscus';
import { useState } from 'react';
import { CodeBlock, Colophon, Install, Masthead } from '../shared/chrome';
import { Icon } from '../shared/Icon';
import { sitePath } from '../shared/paths';
import { PlateAnatomy } from './PlateAnatomy';
import { PlateRenderers } from './PlateRenderers';
import { PlateSpecimen } from './PlateSpecimen';
import { PlateSpecimens } from './PlateSpecimens';
import { PlateTension } from './PlateTension';
import { PlateInterfaces } from './PlateInterfaces';

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
        <PlateAnatomy sun={sun} onSun={setSun} />
        <PlateRenderers />
        <PlateSpecimens />
        <PlateTension />
        <PlateInterfaces />
        <section className="closing" aria-labelledby="closing-title">
          <div className="closing__text">
            <h2 id="closing-title">Start with one component</h2>
            <p>
              <code>Glass</code> renders any element you name, works with server rendering, and ships no stylesheet. The first paint is frosted; refraction
              switches on after hydration wherever the browser can draw it.
            </p>
            <div className="closing__actions">
              <Install />
              <div className="actions-row">
                <a className="action action--primary" href={sitePath('/playground/')}>
                  Open the playground
                  <Icon name="arrow" />
                </a>
                <a className="action action--quiet" href={sitePath('/docs/')}>
                  Read the manual
                </a>
              </div>
            </div>
          </div>
          <CodeBlock code={QUICK_START} label="Quick start" />
        </section>
      </main>
      <Colophon />
    </GlassProvider>
  );
}
