// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://saswatanandi.github.io',
  base: '/paper-explorer',
  output: 'static',
  integrations: [react()],
  // Add the Vite configuration here
  vite: {
    worker: {
      // Explicitly set the output format for workers to ES Module
      format: 'esm'
    }
  }
});
