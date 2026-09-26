import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', outDir: 'dist3d', rollupOptions: { input: 'proto3d.html' } }
});
