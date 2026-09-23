import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

/** Entry points that run on the client in React Server Components apps. */
const CLIENT_ENTRIES = ['dist/index.js', 'dist/webgl.js'];

export default defineConfig({
  entry: { index: 'src/index.ts', core: 'src/core/index.ts', webgl: 'src/webgl/index.ts' },
  format: ['esm'],
  target: 'es2022',
  // tsup's declaration build sets baseUrl, which TypeScript 6 deprecates.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
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
