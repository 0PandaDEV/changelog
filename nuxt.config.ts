// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  app: {
    head: {
      script: process.env.NODE_ENV === 'production' ? [
        {
          src: 'https://plausible.pandadev.net/js/script.tagged-events.js',
          defer: true,
          'data-domain': 'changelog.pandadev.net'
        }
      ] : []
    }
  },
  nitro: {
    preset: "cloudflare-pages",
  },
})
