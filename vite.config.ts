import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// one self-contained index.html: easy to publish and to open on a phone.
// Port 5180 for the dev server (5173 is Allèle's, which often runs beside it).
export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true },
  plugins: [viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000 }
});
