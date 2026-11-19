// The panel's app, built into the extension (MV3): relative paths, no inline script, and no file name starting with
// « _ » (Chrome refuses to load such an extension): every output file is named `assets/<kind>-<hash>`.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
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
