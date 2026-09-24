// Writes src/styles/tokens.css from src/styles/tokens.json. `--check` fails instead if the CSS is stale.
import { readFileSync, writeFileSync } from 'node:fs';

const src = new URL('../src/styles/tokens.json', import.meta.url);
const out = new URL('../src/styles/tokens.css', import.meta.url);
const tokens = JSON.parse(readFileSync(src, 'utf8'));

const FONTS = [
  '@fontsource-variable/archivo/wdth.css',
  '@fontsource-variable/stix-two-text/wght.css',
  '@fontsource-variable/stix-two-text/wght-italic.css',
  '@fontsource-variable/jetbrains-mono/wght.css',
];
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'ui-monospace', 'system-ui', 'cursive', 'fantasy']);

function css(type, value) {
  if (type === 'fontFamily') return value.map((f) => (GENERIC.has(f) ? f : `'${f}'`)).join(', ');
  if (type === 'cubicBezier') return `cubic-bezier(${value.join(', ')})`;
  return String(value);
}

// Every token becomes --<its key>; groups only organise the file.
const base = [];
const lantern = [];
(function walk(node, type) {
  for (const [key, v] of Object.entries(node)) {
    if (key.startsWith('$') || !v || typeof v !== 'object') continue;
    const t = v.$type ?? type;
    if (!('$value' in v)) {
      walk(v, t);
      continue;
    }
    const note = v.$description ? ` /* ${v.$description} */` : '';
    base.push(`  --${key}: ${css(t, v.$value)};${note}`);
    const dark = v.$extensions?.['meniscus.themes']?.lantern;
    if (dark !== undefined) lantern.push(`  --${key}: ${css(t, dark)};`);
  }
})(tokens);

const indent = (lines) => lines.map((l) => `  ${l}`).join('\n');
const text = `/* Generated from tokens.json by scripts/tokens.mjs. Edit the JSON, then run \`pnpm --filter site tokens\`. */
${FONTS.map((f) => `@import '${f}';`).join('\n')}

:root {
  color-scheme: light;
${base.join('\n')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='print']) {
    color-scheme: dark;
${indent(lantern)}
  }
}

:root[data-theme='lantern'] {
  color-scheme: dark;
${lantern.join('\n')}
}
`;

if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== text) {
    console.error('tokens.css is out of date: run `pnpm --filter site tokens`.');
    process.exit(1);
  }
} else {
  writeFileSync(out, text);
  console.log(`tokens.css: ${base.length} tokens, ${lantern.length} lantern overrides`);
}
