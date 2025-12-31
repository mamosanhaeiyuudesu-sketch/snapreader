import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  devtools: { enabled: true },
  runtimeConfig: {
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
  nitro: {
    preset: 'cloudflare',
  },
});
