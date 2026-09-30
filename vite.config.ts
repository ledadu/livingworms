import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// one self-contained index.html: easy to publish and to open on a phone
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000 }
});
