import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { whatsNewPlugin } from './whatsNewPlugin.mjs';
import { chargementPlugin } from './src/monde/chargement-page';

// one self-contained index.html: easy to publish and to open on a phone.
// Port 5180 for the dev server (5173 is Allèle's, which often runs beside it).
// The « Nouveautés » of changes/ are written into the page (whatsNewPlugin.mjs).
// Its scripts go last, after the loading screen (src/monde/chargement-page.ts).
export default defineConfig({
  base: './',
  // .ts.net: an agent's game opened from the dashboard through Tailscale (a phone).
  server: { port: 5180, strictPort: true, allowedHosts: ['.ts.net'] },
  preview: { allowedHosts: ['.ts.net'] },
  plugins: [whatsNewPlugin(), viteSingleFile(), chargementPlugin()],
  build: { target: 'es2020', assetsInlineLimit: 100000000 }
});
