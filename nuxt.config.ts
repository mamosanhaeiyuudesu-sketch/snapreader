import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  runtimeConfig: {
    openaiApiKey: '', // 値は入れない
  },
  nitro: {
    preset: 'cloudflare',
  },
})
