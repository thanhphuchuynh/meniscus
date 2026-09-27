/**
 * The gzipped size of each export, bundled alone from dist the way an app
 * imports it: minified, React external, production mode, code splitting, and
 * only the chunks loaded up front. Fails when an export is over its budget or
 * has none, or when one kit component brings in another's code.
 *
 *   pnpm --filter meniscus build && pnpm --filter meniscus size
 *   node scripts/size.mjs --update   measures again and writes size.json (budget: kB + 10%)
 */
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const store = join(root, 'size.json');
const KIT = ['GlassDialog', 'GlassPopover', 'GlassTooltip', 'GlassMenu', 'GlassToaster', 'GlassNavbar', 'GlassSidebar', 'GlassSwitch', 'GlassSlider', 'GlassSegmented'];
const EXPORTS = ['Glass', ...KIT];
/** Kit components another may contain: the sidebar collapses into a dialog. */
const ALLOWED = { GlassSidebar: ['GlassDialog'] };
const update = process.argv.includes('--update');

async function measure(name, dir) {
  const entry = join(dir, `${name}.mjs`);
  await writeFile(entry, `export { ${name} } from ${JSON.stringify(join(root, 'dist/index.js'))};\n`);
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    splitting: true,
    minify: true,
    outdir: join(dir, name),
    metafile: true,
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  // The entry chunk and what it imports statically; dynamic imports load later.
  const outputs = result.metafile.outputs;
  const main = Object.keys(outputs).find((file) => outputs[file].entryPoint);
  const upfront = new Set();
  const visit = (file) => {
    if (upfront.has(file)) return;
    upfront.add(file);
    for (const imp of outputs[file].imports) if (imp.kind === 'import-statement' && !imp.external) visit(imp.path);
  };
  visit(main);
  let bytes = 0;
  let code = '';
  for (const file of upfront) {
    const text = await readFile(resolve(file), 'utf8');
    code += text;
    bytes += gzipSync(text, { level: 9 }).length;
  }
  return { kb: bytes / 1024, code };
}

const stored = JSON.parse(await readFile(store, 'utf8').catch(() => '{}'));
const dir = await mkdtemp(join(tmpdir(), 'meniscus-size-'));
try {
  const rows = [];
  let over = false;
  let leaked = false;
  let base = 0;
  for (const name of EXPORTS) {
    const { kb, code } = await measure(name, dir);
    if (name === 'Glass') base = kb;
    // Every component sets its displayName, which survives minification.
    const leaks = KIT.filter((other) => other !== name && !(ALLOWED[name] ?? []).includes(other) && code.includes(`"${other}"`));
    const budget = stored[name]?.budget;
    if (budget === undefined || kb > budget) over = true;
    if (leaks.length) leaked = true;
    rows.push({ export: name, kB: Number(kb.toFixed(1)), 'over Glass': name === 'Glass' ? '' : `+${(kb - base).toFixed(1)}`, budget: budget ?? 'none', leaks: leaks.join(', ') });
  }
  console.table(rows);
  if (update) {
    const next = Object.fromEntries(rows.map((r) => [r.export, { kB: r.kB, budget: Math.ceil(r.kB * 1.1 * 10) / 10 }]));
    await writeFile(store, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Wrote ${store}.`);
  }
  if (leaked) {
    console.error('meniscus size: a component bundles another component’s code. Check its imports.');
    process.exitCode = 1;
  } else if (over && !update) {
    console.error('meniscus size: an export is over its budget, or has none. If the growth is intended, run `node scripts/size.mjs --update` and commit size.json.');
    process.exitCode = 1;
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
