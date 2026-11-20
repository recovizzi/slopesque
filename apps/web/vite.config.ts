// The panel's app, built into the extension (MV3): relative paths, no inline script, and no file name starting with
// « _ » (Chrome refuses to load such an extension): every output file is named `assets/<kind>-<hash>`.
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// the extension's version (apps/extension/package.json, its only source): sent to the server, shown in the Extension tab
const version = (JSON.parse(readFileSync(new URL('../extension/package.json', import.meta.url), 'utf8')) as { version: string }).version;

export default defineConfig({
  base: './',
  define: { __EXT_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: { entryFileNames: 'assets/app-[hash].js', chunkFileNames: 'assets/c-[hash].js', assetFileNames: 'assets/a-[hash][extname]' },
    },
  },
});
