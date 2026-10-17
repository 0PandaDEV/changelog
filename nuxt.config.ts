// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
  ssr: true,
  vite: {
    build: {
      modulePreload: { polyfill: false },
      chunkSizeWarningLimit: 1500,
    },
  },
  app: {
    head: {
      script:
        process.env.NODE_ENV === "production"
          ? [
              {
                src: "https://rybbit.pandadev.net/api/script.js",
                defer: true,
                "data-site-id": "3",
              },
            ]
          : [],
    },
  },
  nitro: {
    preset: "cloudflare-pages",
    cloudflare: {
      nodeCompat: true,
    },
  },
});
