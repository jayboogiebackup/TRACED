import { defineConfig } from 'vite';

// base './' lets the built game live in any sub-folder of your site (e.g. /game/)
export default defineConfig({
  base: './',
  build: {
    // upload the contents of this folder to e.g. yoursite.com/traced/
    outDir: 'traced',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
