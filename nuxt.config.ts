// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: false },
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
      link: [
        {
          rel: "preload",
          href: "/github-markdown-css/github-markdown-dark.css",
          as: "style",
        },
      ],
    },
  },
  nitro: {
    preset: "cloudflare-pages",
  },
});
