import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { whatsNewPlugin } from './whatsNewPlugin.mjs';

// one self-contained index.html: easy to publish and to open on a phone.
// Port 5180 for the dev server (5173 is Allèle's, which often runs beside it).
// The « Nouveautés » of changes/ are written into the page (whatsNewPlugin.mjs).
export default defineConfig({
  base: './',
  server: { port: 5180, strictPort: true },
  plugins: [whatsNewPlugin(), viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000 }
});
