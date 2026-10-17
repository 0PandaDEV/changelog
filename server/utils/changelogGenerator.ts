import { Octokit } from "@octokit/rest";
import type {
  ParsedCommit,
  CommitType,
  ChangelogOptions,
  ChangelogResult,
  ChangelogEntry,
  RefsResult,
} from "#shared/types/changelog";
import type { ParsedGithubInput } from "#shared/utils/github";
import { parseGithubInput, githubCompareUrl } from "#shared/utils/github";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 60 * 1000;
const MAX_PAGES = 5;
const REQUEST_TIMEOUT = 20000;
const MAX_LIST_PAGES = 3;
const cache = new Map<string, CacheEntry<any>>();

const COMMIT_TYPES: CommitType[] = [
  { types: ["feat"], header: "New Features", icon: ":sparkles:" },
  { types: ["fix"], header: "Bug Fixes", icon: ":bug:" },
  { types: ["perf"], header: "Performance", icon: ":zap:" },
  { types: ["refactor"], header: "Refactors", icon: ":recycle:" },
  { types: ["test"], header: "Tests", icon: ":white_check_mark:" },
  { types: ["style"], header: "Styles", icon: ":art:" },
  { types: ["build"], header: "Build", icon: ":package:" },
  { types: ["ci"], header: "CI", icon: ":construction_worker_man:" },
  { types: ["docs"], header: "Documentation", icon: ":memo:" },
  { types: ["chore"], header: "Chores", icon: ":wrench:" },
  { types: ["revert"], header: "Reverts", icon: ":rewind:" },
];

const KNOWN_TYPES = new Set(COMMIT_TYPES.flatMap((t) => t.types));

export class ChangelogError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function compareTags(a: string, b: string): number {
  const split = (name: string) => {
    const clean = name.replace(/^v/i, "");
    const idx = clean.search(/[-+]/);
    return idx < 0
      ? { core: clean, pre: "" }
      : { core: clean.slice(0, idx), pre: clean.slice(idx + 1) };
  };
  const x = split(a);
  const y = split(b);
  const core = y.core.localeCompare(x.core, undefined, { numeric: true });
  if (core !== 0) return core;
  if (!x.pre !== !y.pre) return x.pre ? 1 : -1;
  return y.pre.localeCompare(x.pre, undefined, { numeric: true });
}

function sortTagsDesc(names: string[]): string[] {
  const semver = names.filter((n) => /^v?\d/.test(n));
  const rest = names.filter((n) => !/^v?\d/.test(n));
  return [...semver.sort(compareTags), ...rest.sort((a, b) => b.localeCompare(a))];
}

export class ChangelogGenerator {
  private octokit: Octokit;

  private authed: boolean;

  constructor(token?: string) {
    this.authed = !!token;
    this.octokit = new Octokit({
      auth: token || undefined,
      log: { debug() {}, info() {}, warn() {}, error() {} },
      request: { signal: AbortSignal.timeout(REQUEST_TIMEOUT) },
    });
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (this.authed) return load();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.timestamp < CACHE_TTL) return hit.data;
    const data = await load();
    if (cache.size > 200) cache.clear();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  private wrapError(error: any, owner: string, repo: string): never {
    if (error instanceof ChangelogError) throw error;
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new ChangelogError(
        504,
        "GitHub took too long to respond. Try a smaller range or a token."
      );
    }
    const status = error?.status;
    const remaining = error?.response?.headers?.["x-ratelimit-remaining"];
    if (status === 403 || status === 429) {
      if (status === 429 || remaining === "0") {
        throw new ChangelogError(
          429,
          "GitHub rate limit reached. Add a GitHub token to continue."
        );
      }
      throw new ChangelogError(403, "GitHub denied access to this repository.");
    }
    if (status === 401) throw new ChangelogError(401, "Invalid GitHub token.");
    if (status === 404) {
      throw new ChangelogError(
        404,
        `Repository or ref not found for ${owner}/${repo}. Private repos need a token.`
      );
    }
    if (status === 422) {
      throw new ChangelogError(
        400,
        "These refs can't be compared. Check that both exist."
      );
    }
    throw new ChangelogError(
      status && status >= 400 && status < 500 ? status : 500,
      error?.message || "An error occurred generating the changelog"
    );
  }

  private parseGithubUrl(url: string): ParsedGithubInput {
    const parsed = parseGithubInput(url);
    if (!parsed) throw new ChangelogError(400, "Invalid GitHub URL");
    return parsed;
  }

  private async loadTags(
    owner: string,
    repo: string
  ): Promise<{ defaultBranch: string; tags: string[] }> {
    return this.cached(`tags:${owner}/${repo}`, async () => {
      const [repoData, page1] = await Promise.all([
        this.octokit.repos.get({ owner, repo }),
        this.octokit.repos.listTags({ owner, repo, per_page: 100, page: 1 }),
      ]);
      const names = page1.data.map((t) => t.name);
      if (page1.data.length === 100) {
        const page2 = await this.octokit.repos.listTags({
          owner,
          repo,
          per_page: 100,
          page: 2,
        });
        names.push(...page2.data.map((t) => t.name));
      }
      return {
        defaultBranch: repoData.data.default_branch,
        tags: sortTagsDesc(names),
      };
    });
  }

  async getRefs(githubUrl: string): Promise<RefsResult> {
    const { owner, repo } = this.parseGithubUrl(githubUrl);
    try {
      return await this.cached(`refs:${owner}/${repo}`, async () => {
        const [info, branches] = await Promise.all([
          this.loadTags(owner, repo),
          this.octokit.repos.listBranches({ owner, repo, per_page: 100 }),
        ]);
        return { ...info, branches: branches.data.map((b) => b.name) };
      });
    } catch (error) {
      this.wrapError(error, owner, repo);
    }
  }

  private async latestRelease(
    owner: string,
    repo: string,
    fallback?: string
  ): Promise<string> {
    try {
      const { data } = await this.octokit.repos.getLatestRelease({ owner, repo });
      return data.tag_name;
    } catch (error: any) {
      if (error?.status !== 404) throw error;
      return fallback || "";
    }
  }

  private async getCommits(
    owner: string,
    repo: string,
    head: string,
    base: string
  ): Promise<{ commits: any[]; total: number; truncated: boolean }> {
    const commits: any[] = [];
    let truncated = false;
    let total = 0;

    if (!base) {
      for (let page = 1; page <= MAX_LIST_PAGES; page++) {
        const { data } = await this.octokit.repos.listCommits({
          owner,
          repo,
          sha: head,
          per_page: 100,
          page,
        });
        commits.push(...data);
        if (data.length < 100) break;
        if (page === MAX_LIST_PAGES) truncated = true;
      }
      return { commits, total: commits.length, truncated };
    }

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base,
        head,
        per_page: 100,
        page,
      });
      total = data.total_commits;
      commits.push(...data.commits);
      if (commits.length >= total || data.commits.length === 0) break;
      if (page === MAX_PAGES) truncated = true;
    }
    return { commits: commits.reverse(), total, truncated };
  }

  private parseCommits(commits: any[]): ParsedCommit[] {
    const conventionalRegex = /^([A-Za-z][\w-]*)(?:\(([^)]+)\))?!?\s*:\s*(.+)/;
    return commits.map((commit) => {
      const firstLine = String(commit.commit.message).split("\n")[0]!.trim();
      const match = firstLine.match(conventionalRegex);
      const common = {
        sha: commit.sha,
        url: commit.html_url,
        author: commit.author?.login,
        authorUrl: commit.author?.html_url,
      };
      if (match) {
        const type = match[1]!.toLowerCase();
        return {
          type,
          scope: match[2],
          subject: match[3]!,
          ...common,
        };
      }
      return { type: "other", subject: firstLine, ...common };
    });
  }

  private buildSections(
    commits: ParsedCommit[],
    options: ChangelogOptions
  ): { sections: Record<string, ChangelogEntry[]>; markdown: string } {
    const excludeTypes = new Set(options.excludeTypes || []);
    const excludeScopes = options.excludeScopes || [];
    const customTypes = [
      ...new Set(
        commits
          .map((c) => c.type || "other")
          .filter((t) => t !== "other" && !KNOWN_TYPES.has(t))
      ),
    ];
    const groups: CommitType[] = [
      ...COMMIT_TYPES,
      ...customTypes.map((t) => ({
        types: [t],
        header: t.charAt(0).toUpperCase() + t.slice(1),
        icon: ":label:",
      })),
      { types: ["other"], header: "Other Changes", icon: ":flying_saucer:" },
    ];

    const sections: Record<string, ChangelogEntry[]> = {};
    const lines: string[] = [];

    for (const group of groups) {
      const entries = commits
        .filter(
          (c) =>
            group.types.includes(c.type || "other") &&
            !excludeTypes.has(c.type || "other") &&
            !(c.scope && excludeScopes.includes(c.scope))
        )
        .map<ChangelogEntry>((c) => ({
          hash: c.sha.substring(0, 7),
          url: c.url,
          scope: c.scope || null,
          subject: c.subject || "",
          author: c.author || null,
          authorUrl: c.authorUrl || null,
        }));

      if (!entries.length) continue;
      sections[group.header] = entries;

      const header = options.useGitmojis
        ? `### ${group.icon} ${group.header}`
        : `### ${group.header}`;
      const body = entries.map((e) => {
        const scope = e.scope ? `**${e.scope}**: ` : "";
        const author = e.author ? ` by [@${e.author}](${e.authorUrl})` : "";
        return `- [\`${e.hash}\`](${e.url}) - ${scope}${e.subject}${author}`;
      });
      lines.push(`${header}\n${body.join("\n")}`);
    }

    return { sections, markdown: lines.join("\n\n") };
  }

  async generate(options: ChangelogOptions): Promise<ChangelogResult> {
    const parsed = this.parseGithubUrl(options.githubUrl);
    const { owner, repo } = parsed;
    const requestedBase = options.base || options.fromTag || parsed.base || "";
    const requestedHead = options.head || options.toTag || parsed.head || "";
    const cacheKey = `generate:${JSON.stringify({
      owner,
      repo,
      requestedBase,
      requestedHead,
      options,
    })}`;

    try {
      return await this.cached(cacheKey, async () => {
        let head = requestedHead;
        let base = requestedBase;

        if (!head || (!base && !requestedBase)) {
          const refs = await this.loadTags(owner, repo);
          if (!head) head = refs.defaultBranch;
          if (!requestedBase) {
            const idx = refs.tags.indexOf(head);
            if (idx >= 0) {
              base = refs.tags[idx + 1] || "";
            } else {
              base = await this.latestRelease(owner, repo, refs.tags[0]);
            }
          }
        }

        const { commits, total, truncated } = await this.getCommits(
          owner,
          repo,
          head,
          base
        );

        const ordered = options.reverseOrder ? [...commits].reverse() : commits;
        const { sections, markdown } = this.buildSections(
          this.parseCommits(ordered),
          options
        );
        const date = new Date().toISOString().split("T")[0]!;
        const oldest = !base && !truncated ? commits[commits.length - 1] : undefined;
        const compareUrl = githubCompareUrl(
          { owner, repo },
          base || (oldest ? `${head}@{${oldest.sha}}` : ""),
          head
        );

        const header = `## [${head}] - ${date}`;
        const body = commits.length
          ? markdown || "No changes match the selected filters."
          : "No changes found between these refs.";

        return {
          markdown: `${header}\n\n${body}\n`,
          version: head,
          date,
          sections,
          base,
          head,
          fromTag: base,
          toTag: head,
          totalCommits: total,
          truncated,
          compareUrl,
        };
      });
    } catch (error) {
      this.wrapError(error, owner, repo);
    }
  }
}
