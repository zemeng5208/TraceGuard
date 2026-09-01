import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const packageVersion = (JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as { version: string }).version;

export default defineConfig({
  root: 'src/TraceGuard.Desktop',
  plugins: [react()],
  base: './',
  define: {
    __TRACEGUARD_VERSION__: JSON.stringify(packageVersion),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/TraceGuard.Desktop/src', import.meta.url)),
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
