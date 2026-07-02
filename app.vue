<template>
  <div class="container">
    <NuxtRouteAnnouncer />
    <div class="sidebar">
      <div class="header">
        <img src="/logo.webp" alt="Logo" class="logo" />
        <h1>Changelog Generator</h1>
      </div>
      <form @submit.prevent="generate">
        <div class="input-group">
          <label for="githubUrl">GitHub URL:</label>
          <input
            id="githubUrl"
            v-model="githubUrl"
            type="text"
            placeholder="https://github.com/owner/repo"
          />
        </div>
        <div class="input-group">
          <label for="token">GitHub Token (optional):</label>
          <input id="token" v-model="token" type="password" />
        </div>
        <div class="input-group">
          <label for="fromTag">From Tag (optional):</label>
          <input id="fromTag" v-model="options.fromTag" type="text" />
        </div>
        <div class="input-group">
          <label for="toTag">To Tag (optional):</label>
          <input id="toTag" v-model="options.toTag" type="text" />
        </div>
        <button type="submit" class="generate-button" :disabled="loading">
          {{ loading ? "Generating..." : "Generate Changelog" }}
        </button>
      </form>
      <div v-if="loading" class="loading">Loading...</div>
      <div v-if="error" class="error-output">
        <h2>Error</h2>
        <pre>{{ error.statusMessage || error.message }}</pre>
      </div>
    </div>
    <div class="content">
      <div v-if="changelog" class="changelog-output">
        <div class="changelog-header">
          <div class="changelog-info">
            <h2>Changelog</h2>
            <span class="tag-range">{{ fromTag }} → {{ toTag }}</span>
          </div>
          <div class="button-group">
            <button class="copy-button" @click="copyChangelog">
              {{ copied ? "Copied!" : "Copy" }}
            </button>
            <a class="json-button" :href="jsonApiUrl" target="_blank">
              View as JSON
            </a>
          </div>
        </div>
        <div v-html="markdownToHtml" class="markdown-content"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import * as emoji from "node-emoji";
import type { ChangelogResult } from "./types/types";

interface ChangelogApiResponse extends ChangelogResult {
  version: string;
  date: string;
  sections: Record<string, any>;
}

useSeoMeta({
  title: "Changelog Generator",
  description: "Generate changelogs from GitHub repositories",
  ogTitle: "Changelog Generator",
  ogDescription: "Generate changelogs from GitHub repositories",
  ogImage: "/logo.webp",
  ogType: "website",
  ogUrl: "https://changelog.pandadev.net",
  twitterTitle: "Changelog Generator",
  twitterDescription: "Generate changelogs from GitHub repositories",
  twitterImage: "/logo.webp",
  twitterCard: "summary_large_image",
  twitterSite: "@pandadev_",
  twitterCreator: "@pandadev_",
});

useHead({
  htmlAttrs: { lang: "en" },
  link: [
    { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
    {
      rel: "preload",
      href: "github-markdown-css/github-markdown-dark.css",
      as: "style",
    },
  ],
  meta: [
    { name: "theme-color", content: "#010409" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "format-detection", content: "telephone=no" },
  ],
});

const githubUrl = ref("");
const token = ref("");
const copied = ref(false);
const options = ref({
  fromTag: "",
  toTag: "",
  excludeTypes: ["build", "docs", "other", "style"],
  useGitmojis: true,
  reverseOrder: false,
});

const query = computed(() => {
  const params: Record<string, string> = { url: githubUrl.value };
  if (options.value.fromTag) params.fromTag = options.value.fromTag;
  if (options.value.toTag) params.toTag = options.value.toTag;
  if (options.value.excludeTypes?.length)
    params.excludeTypes = JSON.stringify(options.value.excludeTypes);
  if (options.value.useGitmojis !== undefined)
    params.useGitmojis = options.value.useGitmojis.toString();
  if (options.value.reverseOrder !== undefined)
    params.reverseOrder = options.value.reverseOrder.toString();
  return params;
});

const headers = computed(() => {
  const h: Record<string, string> = {};
  if (token.value) h.Authorization = `Bearer ${token.value}`;
  return h;
});

const { data, pending, error, execute } = useFetch<ChangelogApiResponse>(
  "/api/changelog",
  {
    query,
    headers,
    immediate: false,
    watch: false,
  }
);

const changelog = computed(() => data.value?.markdown || "");
const fromTag = computed(() => data.value?.fromTag || "");
const toTag = computed(() => data.value?.toTag || "");
const loading = computed(() => pending.value);
const jsonApiUrl = computed(
  () => `/api/changelog?${new URLSearchParams(query.value).toString()}`
);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const markdownToHtml = computed(() => {
  let content = changelog.value;
  content = content.replace(/:([\w+-]+):/g, (match, code) => {
    const e = emoji.get(code);
    return e || match;
  });
  return `<div class="markdown-body">${md.render(content)}</div>`;
});

async function generate() {
  if (!githubUrl.value) return;
  await execute();
}

async function copyChangelog() {
  await navigator.clipboard.writeText(changelog.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function updateUrlParams() {
  if (!import.meta.client) return;
  const params = new URLSearchParams();
  if (githubUrl.value) params.set("url", githubUrl.value);
  if (options.value.fromTag) params.set("fromTag", options.value.fromTag);
  if (options.value.toTag) params.set("toTag", options.value.toTag);
  if (options.value.excludeTypes?.length)
    params.set("excludeTypes", JSON.stringify(options.value.excludeTypes));
  if (options.value.useGitmojis !== undefined)
    params.set("useGitmojis", options.value.useGitmojis.toString());
  if (options.value.reverseOrder !== undefined)
    params.set("reverseOrder", options.value.reverseOrder.toString());
  window.history.replaceState(null, "", `?${params.toString()}`);
}

function loadFromUrl() {
  if (!import.meta.client) return;
  const params = new URLSearchParams(window.location.search);
  if (params.has("url")) githubUrl.value = params.get("url")!;
  if (params.has("fromTag")) options.value.fromTag = params.get("fromTag")!;
  if (params.has("toTag")) options.value.toTag = params.get("toTag")!;
  if (params.has("excludeTypes")) {
    try {
      const parsed = JSON.parse(params.get("excludeTypes")!);
      if (Array.isArray(parsed)) options.value.excludeTypes = parsed;
    } catch {}
  }
  if (params.has("useGitmojis"))
    options.value.useGitmojis = params.get("useGitmojis") === "true";
  if (params.has("reverseOrder"))
    options.value.reverseOrder = params.get("reverseOrder") === "true";
}

watch([githubUrl, options], updateUrlParams, { deep: true });

watch(token, (newToken) => {
  if (!import.meta.client) return;
  if (newToken) localStorage.setItem("github-token", newToken);
  else localStorage.removeItem("github-token");
});

onMounted(async () => {
  loadFromUrl();
  if (import.meta.client) {
    const saved = localStorage.getItem("github-token");
    if (saved) token.value = saved;
  }
  if (githubUrl.value) await generate();
});
</script>

<style lang="scss">
@use "github-markdown-css/github-markdown-dark.css";

$bg: #010409;
$border: #30363d;
$text: #c9d1d9;
$muted: #8b949e;
$accent: #58a6ff;

*,
body {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.container {
  background-color: $bg;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
    Helvetica, Arial, sans-serif;
  color: $text;
  position: relative;
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: 350px;
  height: 100vh;
  padding: 2rem;
  border-right: 1px solid $border;
  background-color: $bg;
  z-index: 10;
  overflow-y: auto;
}

.content {
  margin-left: 350px;
  padding: 2rem;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

h1 {
  color: $text;
  font-size: 20px;
  white-space: nowrap;
}

.logo {
  width: 32px;
  height: 32px;
}

.input-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: $text;
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid $border;
  border-radius: 6px;
  font-size: 1rem;
  background-color: $bg;
  color: $text;

  &:focus {
    outline: none;
    border-color: $accent;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.3);
  }
}

.generate-button {
  width: 100%;
  background-color: #238636;
  color: #ffffff;
  padding: 0.75rem 1rem;
  border: 1px solid rgba(240, 246, 252, 0.1);
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #2ea043;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.changelog-output {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.changelog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-shrink: 0;
}

.button-group {
  display: flex;
  gap: 0.5rem;
}

.copy-button,
.json-button {
  background-color: #21262d;
  color: $text;
  padding: 0.5rem 1rem;
  border: 1px solid $border;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;

  &:hover {
    background-color: $border;
    border-color: $muted;
  }
}

.tag-range {
  font-size: 0.9rem;
  color: $muted;
}

.markdown-content {
  font-size: 14px;
  line-height: 1.5;
  color: $text;
  overflow-y: auto;
  flex-grow: 1;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: $bg;
  }

  &::-webkit-scrollbar-thumb {
    background: $border;

    &:hover {
      background: #3f4751;
    }
  }

  :deep(blockquote) {
    margin: 16px 0;
    padding: 0 1em;
    color: $muted;
    border-left: 0.25em solid $border;
  }

  :deep(hr) {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: $border;
    border: 0;
  }

  :deep(table) {
    display: block;
    width: 100%;
    width: max-content;
    max-width: 100%;
    overflow: auto;
    margin: 16px 0;
    border-spacing: 0;
    border-collapse: collapse;

    tr {
      background-color: #0d1117;
      border-top: 1px solid $border;

      &:nth-child(2n) {
        background-color: #161b22;
      }
    }

    th,
    td {
      padding: 6px 13px;
      border: 1px solid $border;
    }

    th {
      font-weight: 600;
    }
  }

  :deep(img) {
    max-width: 100%;
    box-sizing: content-box;
    background-color: #0d1117;
  }

  :deep(pre) {
    padding: 16px;
    overflow: auto;
    font-size: 85%;
    line-height: 1.45;
    background-color: #161b22;
    border-radius: 6px;
    margin: 16px 0;
  }
}

.loading {
  text-align: center;
  color: $muted;
  margin-top: 1rem;
}

.error-output {
  margin-top: 1rem;
  color: #f85149;
}

.markdown-body {
  box-sizing: border-box;
  min-width: 200px;
  margin: 0 auto;
  color: $text;
  background: $bg;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
    Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
}

@media (max-width: 768px) {
  .sidebar {
    position: relative;
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid $border;
  }

  .content {
    margin-left: 0;
    height: auto;
    overflow: visible;
  }

  .container {
    display: flex;
    flex-direction: column;
  }

  input[type="text"],
  input[type="password"] {
    font-size: 16px;
  }

  .markdown-content {
    overflow: visible;
    height: auto;
  }
}

@media (max-width: 480px) {
  .sidebar,
  .content {
    padding: 1rem;
  }

  .changelog-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .button-group {
    width: 100%;
    display: flex;
    justify-content: space-between;
  }
}
</style>
