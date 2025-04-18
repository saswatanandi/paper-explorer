// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://saswatanandi.github.io',
  base: '/paper-explorer',
  output: 'static',
  integrations: [react()]
});
