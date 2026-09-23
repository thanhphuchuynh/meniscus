import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const lib = (p: string) => fileURLToPath(new URL(`../../packages/meniscus/src/${p}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Develop against the library source so edits hot-reload without a rebuild.
    alias: [
      { find: /^meniscus\/core$/, replacement: lib('core/index.ts') },
      { find: /^meniscus\/webgl$/, replacement: lib('webgl/index.ts') },
      { find: /^meniscus$/, replacement: lib('index.ts') },
    ],
  },
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        playground: fileURLToPath(new URL('./playground/index.html', import.meta.url)),
        docs: fileURLToPath(new URL('./docs/index.html', import.meta.url)),
      },
    },
  },
});
