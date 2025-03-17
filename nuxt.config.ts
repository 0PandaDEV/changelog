// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
  app: {
    head: {
      script: [
        {
          src: "https://plausible.pandadev.net/js/script.pageview-props.tagged-events.js",
          defer: true,
          "data-domain": "changelog.pandadev.net",
        },
      ],
    },
  },
  nitro: {
    preset: "cloudflare-pages",
  },
});
