import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  devtools: { enabled: true },
  runtimeConfig: {
    openaiApiKey: '',
  },
  nitro: {
    preset: 'cloudflare',
  },
});
