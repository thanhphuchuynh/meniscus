import { readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

/** Entry points that run on the client in React Server Components apps. */
const CLIENT_ENTRIES = ['dist/index.js', 'dist/webgl.js'];

/** The package's public entry points: the ones `exports` names, and the only ones with types. */
const PUBLIC = { index: 'src/index.ts', core: 'src/core/index.ts', webgl: 'src/webgl/index.ts' };

/**
 * Every React module as an entry of its own, so each lands in its own chunk.
 * In one bundled index.js, top-level forwardRef() calls and displayName
 * assignments count as side effects, and an app's bundler kept every
 * component; with a chunk per module, `sideEffects: false` lets it drop the
 * components the app doesn't import. These entries aren't in `exports`.
 */
const MODULES = Object.fromEntries(
  readdirSync('src/react')
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => [`modules/${file.replace(/\.tsx?$/, '')}`, `src/react/${file}`]),
);

export default defineConfig({
  entry: { ...PUBLIC, ...MODULES },
  format: ['esm'],
  target: 'es2022',
  // tsup's declaration build sets baseUrl, which TypeScript 6 deprecates.
  dts: { entry: PUBLIC, compilerOptions: { ignoreDeprecations: '6.0' } },
  sourcemap: true,
  splitting: true,
  clean: true,
  external: ['react', 'react/jsx-runtime'],
  // Bundlers drop module directives, so "use client" is added after the build,
  // and only to the React entries: `meniscus/core` stays importable on the server.
  async onSuccess() {
    for (const file of CLIENT_ENTRIES) {
      const code = await readFile(file, 'utf8');
      if (code.startsWith('"use client"')) continue;
      await writeFile(file, `"use client";\n${code}`);
      const map = JSON.parse(await readFile(`${file}.map`, 'utf8'));
      map.mappings = `;${map.mappings}`;
      await writeFile(`${file}.map`, JSON.stringify(map));
    }
  },
});
