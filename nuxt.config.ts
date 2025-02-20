// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  app: {
    head: {
      meta: [
        { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' static.cloudflareinsights.com plausible.pandadev.net; style-src 'self' 'unsafe-inline';" }
      ],
      script: process.env.NODE_ENV === 'production' ? [
        {
          src: 'https://plausible.pandadev.net/js/script.tagged-events.js',
          defer: true,
          'data-domain': 'changelog.pandadev.net'
        }
      ] : []
    }
  }
})
