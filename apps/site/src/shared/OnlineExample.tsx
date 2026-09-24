import manifest from '../../../../examples/optics/package.json?raw';
import html from '../../../../examples/optics/index.html?raw';
import app from '../../../../examples/optics/src/App.jsx?raw';
import css from '../../../../examples/optics/src/style.css?raw';

/** StackBlitz's native POST API avoids an SDK and uploads only this public example. */
export function OnlineExample() {
  return <form action="https://stackblitz.com/run" method="POST" target="_blank" rel="noopener noreferrer">
    <input type="hidden" name="project[title]" value="Meniscus optics experiment" />
    <input type="hidden" name="project[description]" value="Live Snell’s law, chromatic aberration and directional light in React." />
    <input type="hidden" name="project[template]" value="node" />
    {Object.entries({ 'package.json': manifest, 'index.html': html, 'src/App.jsx': app, 'src/style.css': css }).map(([name, value]) => <input key={name} type="hidden" name={`project[files][${name}]`} value={value} />)}
    <button type="submit" className="action action--primary">Edit in StackBlitz</button>
  </form>;
}
