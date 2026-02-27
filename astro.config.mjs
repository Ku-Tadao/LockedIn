import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ku-tadao.github.io',
  base: '/LockedIn',
  output: 'static',
  build: {
    assets: '_assets',
  },
});
