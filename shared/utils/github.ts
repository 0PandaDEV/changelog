export interface ParsedGithubInput {
  owner: string;
  repo: string;
  base?: string;
  head?: string;
}

const RESERVED_OWNERS = new Set([
  "orgs",
  "settings",
  "marketplace",
  "features",
  "topics",
  "sponsors",
  "login",
  "about",
]);

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCompareSpec(spec: string): { base?: string; head?: string } {
  const clean = safeDecode(spec).replace(/^[^/:]+:(?=[^/])/, "");
  const sep = clean.includes("...") ? "..." : "..";
  const idx = clean.indexOf(sep);
  const strip = (ref: string) => ref.replace(/^[^/:]+:(?=[^/])/, "");
  if (idx < 0) return { head: strip(clean) };
  return {
    base: strip(clean.slice(0, idx)) || undefined,
    head: strip(clean.slice(idx + sep.length)) || undefined,
  };
}

export function parseGithubInput(input: string): ParsedGithubInput | null {
  let value = (input || "").trim();
  if (!value) return null;

  value = value
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/i, "github.com/")
    .replace(/^(?:https?:)?\/\//i, "")
    .replace(/^(?:www\.)?/i, "");

  if (/^github\.com\//i.test(value)) {
    value = value.replace(/^github\.com\//i, "");
  } else if (/^[^/]+\.[a-z]{2,}\//i.test(value) && !/^[^/]+\/[^/]+$/.test(value)) {
    return null;
  }

  value = value.split(/[?#]/)[0]!;
  const parts = value.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0]!;
  const repo = parts[1]!.replace(/\.git$/i, "");
  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(owner) ||
    RESERVED_OWNERS.has(owner.toLowerCase()) ||
    !/^[A-Za-z0-9._-]+$/.test(repo) ||
    repo === "." ||
    repo === ".."
  ) {
    return null;
  }

  const result: ParsedGithubInput = { owner, repo };
  const kind = parts[2];
  const rest = parts.slice(3);

  if (kind === "compare" && rest.length) {
    Object.assign(result, parseCompareSpec(rest.join("/")));
  } else if ((kind === "tree" || kind === "commits") && rest.length) {
    result.head = safeDecode(rest.join("/"));
  } else if (kind === "blob" && rest.length) {
    result.head = safeDecode(rest[0]!);
  } else if (kind === "releases" && rest[0] === "tag" && rest.length > 1) {
    result.head = safeDecode(rest.slice(1).join("/"));
  } else if (kind === "commit" && rest.length) {
    result.head = safeDecode(rest[0]!);
  }

  return result;
}

export function githubRepoUrl(parsed: ParsedGithubInput): string {
  return `https://github.com/${parsed.owner}/${parsed.repo}`;
}

export function githubCompareUrl(
  parsed: { owner: string; repo: string },
  base?: string,
  head?: string
): string {
  const enc = (ref: string) => ref.split("/").map(encodeURIComponent).join("/");
  const repoUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
  if (base && head) return `${repoUrl}/compare/${enc(base)}...${enc(head)}`;
  if (head) return `${repoUrl}/compare/${enc(head)}`;
  return `${repoUrl}/compare`;
}
