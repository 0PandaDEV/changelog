<template>
  <div class="container">
    <NuxtRouteAnnouncer />
    <div class="sidebar">
      <div class="header">
        <img src="/logo.webp" alt="Logo" class="logo" />
        <h1>Changelog Generator</h1>
      </div>
      <form @submit.prevent="submit">
        <div class="input-group">
          <label for="githubUrl">Repository or compare URL:</label>
          <input
            id="githubUrl"
            v-model="githubUrl"
            type="text"
            placeholder="https://github.com/owner/repo"
            autocomplete="off"
            @input="onUrlInput"
            @paste="onUrlPaste"
            @blur="onUrlBlur"
          />
          <span v-if="repoLabel" class="hint">{{ repoLabel }}</span>
        </div>
        <div class="input-group">
          <label for="token">GitHub Token (optional):</label>
          <input id="token" v-model="token" type="password" />
        </div>
        <div v-if="suggestions.length" class="input-group">
          <label>Suggestions:</label>
          <div class="type-grid">
            <button
              v-for="s in suggestions"
              :key="s.label"
              type="button"
              class="type-chip suggestion"
              @click="applySuggestion(s)"
            >
              {{ s.label }}
            </button>
          </div>
        </div>
        <div class="compare">
          <div class="input-group">
            <label for="base">Base (branch, tag or commit):</label>
            <input
              id="base"
              v-model="base"
              type="text"
              list="refs"
              :placeholder="refs?.tags[0] || 'latest tag'"
              autocomplete="off"
            />
          </div>
          <button
            type="button"
            class="swap-button"
            title="Swap base and head"
            @click="swap"
          >
            ⇅
          </button>
          <div class="input-group">
            <label for="head">Head (branch, tag or commit):</label>
            <input
              id="head"
              v-model="head"
              type="text"
              list="refs"
              :placeholder="refs?.defaultBranch || 'default branch'"
              autocomplete="off"
            />
          </div>
          <datalist id="refs">
            <option v-for="b in refs?.branches" :key="'b' + b" :value="b">
              branch
            </option>
            <option v-for="t in refs?.tags" :key="'t' + t" :value="t">
              tag
            </option>
          </datalist>
        </div>
        <div class="input-group">
          <label>Include:</label>
          <div class="type-grid">
            <label v-for="t in allTypes" :key="t" class="type-chip">
              <input
                type="checkbox"
                :checked="!excludeTypes.includes(t)"
                @change="toggleType(t)"
              />
              {{ t }}
            </label>
          </div>
        </div>
        <div class="input-group toggles">
          <label class="type-chip">
            <input type="checkbox" v-model="useGitmojis" /> Gitmojis
          </label>
          <label class="type-chip">
            <input type="checkbox" v-model="reverseOrder" /> Oldest first
          </label>
        </div>
        <button type="submit" class="generate-button" :disabled="loading">
          {{ loading ? "Generating..." : "Compare" }}
        </button>
        <a
          v-if="githubLink"
          class="github-link"
          :href="githubLink"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on GitHub ↗
        </a>
      </form>
      <div v-if="errorText" class="error-output">
        <h2>Error</h2>
        <pre>{{ errorText }}</pre>
      </div>
    </div>
    <div class="content">
      <div v-if="result" class="changelog-output">
        <div class="changelog-header">
          <div class="changelog-info">
            <h2>Changelog</h2>
            <span class="tag-range">
              {{ result.base || "start" }} → {{ result.head }} ·
              {{ result.totalCommits }} commits
            </span>
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
        <p v-if="result.truncated" class="truncated">
          Too many commits, this list is incomplete.
        </p>
        <div v-html="markdownToHtml" class="markdown-content"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import * as emoji from "node-emoji";
import type { ChangelogResult, RefsResult } from "./types/types";

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

interface Suggestion {
  label: string;
  base: string;
  head: string;
}

const allTypes = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "test",
  "style",
  "build",
  "ci",
  "docs",
  "chore",
  "revert",
  "other",
];

const route = useRoute();
const router = useRouter();

function queryString(key: string): string {
  const value = route.query[key];
  return (Array.isArray(value) ? value[0] : value) || "";
}

function queryTypes(): string[] {
  const raw = queryString("excludeTypes");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return raw.split(",").filter(Boolean);
}

const githubUrl = ref(queryString("url"));
const token = ref("");
const base = ref(queryString("base") || queryString("fromTag"));
const head = ref(queryString("head") || queryString("toTag"));
const excludeTypes = ref<string[]>(queryTypes());
const useGitmojis = ref(queryString("useGitmojis") !== "false");
const reverseOrder = ref(queryString("reverseOrder") === "true");
const copied = ref(false);
const liveRefs = ref<RefsResult | null>(null);
const liveRefsFor = ref("");

const repoKey = computed(() => keyOf(githubUrl.value));

const repoLabel = computed(() => repoKey.value);

function authHeaders(): Record<string, string> {
  return import.meta.client && token.value
    ? { Authorization: `Bearer ${token.value}` }
    : {};
}

function buildQuery(source: {
  url: string;
  base: string;
  head: string;
  excludeTypes: string[];
  useGitmojis: boolean;
  reverseOrder: boolean;
}): Record<string, string> {
  const params: Record<string, string> = { url: source.url };
  if (source.base) params.base = source.base;
  if (source.head) params.head = source.head;
  if (source.excludeTypes.length)
    params.excludeTypes = JSON.stringify(source.excludeTypes);
  if (!source.useGitmojis) params.useGitmojis = "false";
  if (source.reverseOrder) params.reverseOrder = "true";
  return params;
}

const routeQuery = computed(() =>
  buildQuery({
    url: queryString("url"),
    base: queryString("base") || queryString("fromTag"),
    head: queryString("head") || queryString("toTag"),
    excludeTypes: queryTypes(),
    useGitmojis: queryString("useGitmojis") !== "false",
    reverseOrder: queryString("reverseOrder") === "true",
  })
);

const {
  data: result,
  error,
  status,
  refresh,
} = await useAsyncData<ChangelogResult | null>(
  "changelog",
  async () => {
    if (!routeQuery.value.url) return null;
    return await $fetch<ChangelogResult>("/api/changelog", {
      query: routeQuery.value,
      headers: authHeaders(),
    });
  },
  { watch: [routeQuery] }
);

const { data: routeRefs } = await useAsyncData<RefsResult | null>(
  "refs",
  async () => {
    const url = routeQuery.value.url;
    if (!url || !parseGithubInput(url)) return null;
    try {
      return await $fetch<RefsResult>("/api/refs", {
        query: { url },
        headers: authHeaders(),
      });
    } catch {
      return null;
    }
  },
  { watch: [() => routeQuery.value.url] }
);

function keyOf(input: string): string {
  const parsed = parseGithubInput(input);
  return parsed ? `${parsed.owner}/${parsed.repo}` : "";
}

const refs = computed(() => {
  if (liveRefsFor.value && liveRefsFor.value === repoKey.value)
    return liveRefs.value;
  const routeKey = keyOf(routeQuery.value.url ?? "");
  return routeKey && routeKey === repoKey.value ? routeRefs.value : null;
});

const suggestions = computed<Suggestion[]>(() => {
  const r = refs.value;
  if (!r) return [];
  const list: Suggestion[] = [];
  const [t0, t1, t2] = r.tags;
  if (t0) list.push({ label: `${t0} → ${r.defaultBranch}`, base: t0, head: r.defaultBranch });
  if (t0 && t1) list.push({ label: `${t1} → ${t0}`, base: t1, head: t0 });
  if (t1 && t2) list.push({ label: `${t2} → ${t1}`, base: t2, head: t1 });
  if (r.tags.length > 1) {
    const last = r.tags[r.tags.length - 1]!;
    list.push({ label: `${last} → ${t0}`, base: last, head: t0! });
  }
  if (!r.tags.length) list.push({ label: `All of ${r.defaultBranch}`, base: "", head: r.defaultBranch });
  return list;
});

const githubLink = computed(() => {
  const parsed = parseGithubInput(githubUrl.value);
  if (!parsed) return "";
  const r = result.value;
  const sameRepo =
    !!r &&
    r.compareUrl.startsWith(`https://github.com/${parsed.owner}/${parsed.repo}/`);
  const typedBase = base.value.trim();
  const typedHead = head.value.trim();
  const matchesResult =
    sameRepo &&
    (!typedBase || typedBase === r?.base) &&
    (!typedHead || typedHead === r?.head);
  if (r && matchesResult) return r.compareUrl;
  const h = typedHead || (sameRepo && r ? r.head : "") || refs.value?.defaultBranch || "";
  return githubCompareUrl(parsed, typedBase, h);
});

const loading = computed(() => status.value === "pending");
const errorText = computed(() => {
  const e: any = error.value;
  if (!e) return "";
  return e.data?.statusMessage || e.statusMessage || e.message || "Something went wrong";
});

const jsonApiUrl = computed(
  () => `/api/changelog?${new URLSearchParams(routeQuery.value).toString()}`
);

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const markdownToHtml = computed(() => {
  const content = (result.value?.markdown || "").replace(
    /:([\w+-]+):/g,
    (match, code) => emoji.get(code) || match
  );
  return `<div class="markdown-body">${md.render(content)}</div>`;
});

function applyUrlInput(value: string) {
  const parsed = parseGithubInput(value);
  if (!parsed) return;
  const hadRef = parsed.base || parsed.head;
  if (hadRef) {
    base.value = parsed.base || "";
    head.value = parsed.head || "";
  }
  githubUrl.value = githubRepoUrl(parsed);
}

let refsTimer: ReturnType<typeof setTimeout> | undefined;

function onUrlInput() {
  if (!import.meta.client) return;
  clearTimeout(refsTimer);
  refsTimer = setTimeout(loadLiveRefs, 400);
}

function onUrlPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text");
  if (!text || !parseGithubInput(text)) return;
  event.preventDefault();
  applyUrlInput(text);
  loadLiveRefs();
}

function onUrlBlur() {
  applyUrlInput(githubUrl.value);
  loadLiveRefs();
}

async function loadLiveRefs() {
  const parsed = parseGithubInput(githubUrl.value);
  if (!parsed) return;
  const key = `${parsed.owner}/${parsed.repo}`;
  if (liveRefsFor.value === key && liveRefs.value) return;
  if (refs.value && repoKey.value === key) return;
  try {
    liveRefs.value = await $fetch<RefsResult>("/api/refs", {
      query: { url: githubRepoUrl(parsed) },
      headers: authHeaders(),
    });
    liveRefsFor.value = key;
  } catch {
    liveRefs.value = null;
    liveRefsFor.value = "";
  }
}

async function submit() {
  applyUrlInput(githubUrl.value);
  if (!parseGithubInput(githubUrl.value)) return;
  const next = buildQuery({
    url: githubUrl.value,
    base: base.value.trim(),
    head: head.value.trim(),
    excludeTypes: excludeTypes.value,
    useGitmojis: useGitmojis.value,
    reverseOrder: reverseOrder.value,
  });
  const same = JSON.stringify(next) === JSON.stringify(routeQuery.value);
  await router.push({ query: next });
  if (same) await refresh();
}

function applySuggestion(s: Suggestion) {
  base.value = s.base;
  head.value = s.head;
  submit();
}

function swap() {
  [base.value, head.value] = [head.value, base.value];
}

function toggleType(type: string) {
  excludeTypes.value = excludeTypes.value.includes(type)
    ? excludeTypes.value.filter((t) => t !== type)
    : [...excludeTypes.value, type];
}

async function copyChangelog() {
  if (!result.value) return;
  await navigator.clipboard.writeText(result.value.markdown);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

watch(token, (newToken) => {
  if (!import.meta.client) return;
  try {
    if (newToken) localStorage.setItem("github-token", newToken);
    else localStorage.removeItem("github-token");
  } catch {}
});

onMounted(async () => {
  let saved = "";
  try {
    saved = localStorage.getItem("github-token") || "";
  } catch {}
  if (saved) {
    token.value = saved;
    if (error.value) await refresh();
  }
  if (githubUrl.value && !refs.value) loadLiveRefs();
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

  blockquote {
    margin: 16px 0;
    padding: 0 1em;
    color: $muted;
    border-left: 0.25em solid $border;
  }

  hr {
    height: 0.25em;
    padding: 0;
    margin: 24px 0;
    background-color: $border;
    border: 0;
  }

  table {
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

  img {
    max-width: 100%;
    box-sizing: content-box;
    background-color: #0d1117;
  }

  pre {
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

  pre {
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.compare {
  position: relative;
}

.swap-button {
  position: absolute;
  right: 0;
  top: 0;
  background: transparent;
  color: $muted;
  border: 1px solid $border;
  border-radius: 6px;
  padding: 0.1rem 0.5rem;
  cursor: pointer;

  &:hover {
    color: $text;
    border-color: $muted;
  }
}

.type-grid,
.toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.type-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  font-weight: 400;
  font-size: 0.85rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid $border;
  border-radius: 999px;
  cursor: pointer;
}

.github-link {
  display: block;
  margin-top: 0.75rem;
  text-align: center;
  color: $accent;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.hint {
  display: block;
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: $muted;
}

.suggestion {
  background: transparent;
  color: $text;
  font-family: inherit;

  &:hover {
    border-color: $accent;
  }
}

.truncated {
  color: $muted;
  font-size: 0.85rem;
  margin-bottom: 1rem;
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
