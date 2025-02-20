<template>
  <div class="container">
    <NuxtRouteAnnouncer />
    <div class="sidebar">
      <div class="header">
        <img src="/logo.webp" alt="Logo" class="logo" />
        <h1>Changelog Generator</h1>
      </div>
      <div class="input-group">
        <label for="githubUrl">GitHub URL:</label>
        <input
          id="githubUrl"
          v-model="githubUrl"
          type="text"
          placeholder="https://github.com/owner/repo" />
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
      <button class="generate-button plausible-event-name=Generate" @click.prevent="generate">
        Generate Changelog
      </button>
      <div v-if="loading" class="loading">Loading...</div>
      <div v-if="error" class="error-output">
        <h2>Error</h2>
        <pre>{{ error }}</pre>
      </div>
    </div>
    <div class="content">
      <div v-if="changelog" class="changelog-output">
        <div class="changelog-header">
          <div class="changelog-info">
            <h2>Changelog</h2>
            <span class="tag-range"> {{ fromTag }} → {{ toTag }} </span>
          </div>
          <button class="copy-button plausible-event-name=Copy" @click="copyChangelog">
            {{ copied ? "Copied!" : "Copy" }}
          </button>
        </div>
        <div v-html="markdownToHtml" class="markdown-content"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import MarkdownIt from "markdown-it";
import MarkdownItGitHubAlerts from "markdown-it-github-alerts";
import type { ChangelogOptions } from "./types/types";
import * as emoji from "node-emoji";
import { ChangelogGenerator } from "./lib/changelogGenerator";
import { useSeoMeta, useHead } from "#imports";

useSeoMeta({
  title: "Changelog Generator",
  description: "Generate changelogs from GitHub repositories",
  ogTitle: "Changelog Generator",
  ogDescription: "Generate changelogs from GitHub repositories",
  ogImage: "/og-image.jpg",
  twitterCard: "summary_large_image",
});

useHead({
  htmlAttrs: {
    lang: "en",
  },
  link: [
    {
      rel: "icon",
      type: "image/x-icon",
      href: "/favicon.ico",
    },
    {
      rel: 'preload',
      href: 'github-markdown-css/github-markdown-dark.css',
      as: 'style'
    },
    {
      rel: 'preload', 
      href: 'markdown-it-github-alerts/styles/github-colors-dark-media.css',
      as: 'style'
    },
    {
      rel: 'preload',
      href: 'markdown-it-github-alerts/styles/github-base.css', 
      as: 'style'
    }
  ],
  meta: [
    { name: "theme-color", content: "#010409" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "format-detection", content: "telephone=no" },
  ],
});

const md = MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});
md.use(MarkdownItGitHubAlerts);

const githubUrl = ref("");
const token = ref("");
const changelog = ref("");
const loading = ref(false);
const error = ref("");
const copied = ref(false);
const fromTag = ref("");
const toTag = ref("");
const options = ref<Partial<ChangelogOptions>>({
  excludeTypes: ["build", "docs", "other", "style"],
  includeRefIssues: true,
  useGitmojis: true,
  includeInvalidCommits: true,
  reverseOrder: false,
});

async function generate() {
  loading.value = true;
  error.value = "";
  changelog.value = "";

  try {
    const generator = new ChangelogGenerator(token.value);
    const result = await generator.generate({
      githubUrl: githubUrl.value,
      ...options.value,
    } as ChangelogOptions);

    changelog.value = result.changelog;
    fromTag.value = result.fromTag;
    toTag.value = result.toTag;
  } catch (e: any) {
    error.value = e.message || "An unexpected error occurred";
  } finally {
    loading.value = false;
  }
}

async function copyChangelog() {
  await navigator.clipboard.writeText(changelog.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

const markdownToHtml = computed(() => {
  let content = changelog.value;
  content = content.replace(
    /:([\w+-]+):/g,
    (match, code) => emoji.get(code) || match
  );
  return `<div class="markdown-body">${md.render(content)}</div>`;
});
</script>

<style>
@import "github-markdown-css/github-markdown-dark.css";
@import "markdown-it-github-alerts/styles/github-colors-dark-media.css";
@import "markdown-it-github-alerts/styles/github-base.css";

*,
body {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.container {
  background-color: #010409;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
    Helvetica, Arial, sans-serif;
  color: #c9d1d9;
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
  border-right: 1px solid #30363d;
  background-color: #010409;
  z-index: 10;
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
  color: #c9d1d9;
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
  color: #c9d1d9;
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #30363d;
  border-radius: 6px;
  font-size: 1rem;
  background-color: #010409;
  color: #c9d1d9;
}

input[type="text"]:focus,
input[type="password"]:focus {
  outline: none;
  border-color: #58a6ff;
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.3);
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
}

.generate-button:hover {
  background-color: #2ea043;
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

.copy-button {
  background-color: #21262d;
  color: #c9d1d9;
  padding: 0.5rem 1rem;
  border: 1px solid #30363d;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.copy-button:hover {
  background-color: #30363d;
  border-color: #8b949e;
}

.tag-range {
  font-size: 0.9rem;
  color: #8b949e;
}

.markdown-content {
  font-size: 14px;
  line-height: 1.5;
  color: #c9d1d9;
  overflow-y: auto;
  flex-grow: 1;
}

.loading {
  text-align: center;
  color: #8b949e;
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
  color: #c9d1d9;
  background: #010409;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans",
    Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
}

.markdown-content :deep(blockquote) {
  margin: 16px 0;
  padding: 0 1em;
  color: #8b949e;
  border-left: 0.25em solid #30363d;
}

.markdown-content :deep(hr) {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #30363d;
  border: 0;
}

.markdown-content :deep(table) {
  display: block;
  width: 100%;
  width: max-content;
  max-width: 100%;
  overflow: auto;
  margin: 16px 0;
  border-spacing: 0;
  border-collapse: collapse;
}

.markdown-content :deep(table tr) {
  background-color: #0d1117;
  border-top: 1px solid #30363d;
}

.markdown-content :deep(table tr:nth-child(2n)) {
  background-color: #161b22;
}

.markdown-content :deep(table th),
.markdown-content :deep(table td) {
  padding: 6px 13px;
  border: 1px solid #30363d;
}

.markdown-content :deep(table th) {
  font-weight: 600;
}

.markdown-content :deep(img) {
  max-width: 100%;
  box-sizing: content-box;
  background-color: #0d1117;
}

.markdown-content :deep(pre) {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #161b22;
  border-radius: 6px;
  margin: 16px 0;
}

@media (max-width: 768px) {
  .sidebar {
    position: relative;
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid #30363d;
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
}
</style>
