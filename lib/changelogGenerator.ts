import { Octokit } from "@octokit/rest";
import type {
  ParsedCommit,
  CommitType,
  ChangelogOptions,
  TagPair,
} from "../types/types";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class ChangelogGenerator {
  private octokit: Octokit;
  private cache: Map<string, CacheEntry<any>>;
  private cacheTTL: number = 3600000;

  constructor(token?: string) {
    this.octokit = new Octokit({ auth: token });
    this.cache = new Map();
  }

  private getCacheKey(method: string, params: Record<string, any>): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(cacheKey: string): T | null {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  private saveToCache<T>(cacheKey: string, data: T): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
  }

  private async getTags(owner: string, repo: string): Promise<TagPair> {
    const cacheKey = this.getCacheKey("getTags", { owner, repo });
    const cached = this.getFromCache<TagPair>(cacheKey);
    if (cached) return cached;

    const { data: tags } = await this.octokit.repos.listTags({
      owner,
      repo,
      per_page: 100,
    });

    const { data: repoData } = await this.octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    if (tags.length === 0) {
      const result = { latest: defaultBranch, previous: "" };
      this.saveToCache(cacheKey, result);
      return result;
    }

    const tagDetails = await Promise.all(
      tags.map(async (tag) => {
        const commitCacheKey = this.getCacheKey("getCommit", {
          owner,
          repo,
          commit_sha: tag.commit.sha,
        });
        const cachedCommit = this.getFromCache<any>(commitCacheKey);

        let commit;
        if (cachedCommit) {
          commit = cachedCommit;
        } else {
          const { data } = await this.octokit.git.getCommit({
            owner,
            repo,
            commit_sha: tag.commit.sha,
          });
          this.saveToCache(commitCacheKey, data);
          commit = data;
        }

        return {
          name: tag.name,
          date: new Date(commit.committer.date),
        };
      })
    );

    tagDetails.sort((a, b) => b.date.getTime() - a.date.getTime());

    const result = {
      latest: defaultBranch,
      previous: tagDetails[0].name,
    };

    this.saveToCache(cacheKey, result);
    return result;
  }

  private async getCommits(
    owner: string,
    repo: string,
    head: string,
    base: string
  ) {
    const cacheKey = this.getCacheKey("getCommits", {
      owner,
      repo,
      head,
      base,
    });
    const cached = this.getFromCache<any[]>(cacheKey);
    if (cached) return cached;

    const commits = [];
    let page = 1;

    if (!base) {
      while (true) {
        const { data } = await this.octokit.repos.listCommits({
          owner,
          repo,
          sha: head,
          per_page: 100,
          page,
        });

        if (data.length === 0) break;
        commits.push(...data);
        if (data.length < 100) break;
        page++;
      }
      this.saveToCache(cacheKey, commits);
      return commits;
    }

    while (true) {
      const { data } = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base,
        head,
        per_page: 100,
        page,
      });
      commits.push(...data.commits);
      if (data.commits.length < 100) break;
      page++;
    }

    const result = commits.reverse();
    this.saveToCache(cacheKey, result);
    return result;
  }

  private parseCommits(commits: any[]): ParsedCommit[] {
    return commits.map((commit) => {
      const message = commit.commit.message;
      const firstLine = message.split("\n")[0].trim();

      const conventionalRegex = /^(\w+)(?:\(([^)]+)\))?(?:!)?: (.+)/;
      const match = firstLine.match(conventionalRegex);

      if (match) {
        const [, type, scope, subject] = match;
        return {
          type: type.toLowerCase(),
          scope,
          subject,
          body: message.split("\n\n")[1],
          sha: commit.sha,
          url: commit.html_url,
          author: commit.author?.login,
          authorUrl: commit.author?.html_url,
        };
      }

      return {
        type: "other",
        subject: firstLine,
        body: message.split("\n\n")[1],
        sha: commit.sha,
        url: commit.html_url,
        author: commit.author?.login,
        authorUrl: commit.author?.html_url,
      };
    });
  }

  private generateChangelogFromCommits(
    commits: ParsedCommit[],
    tags: TagPair,
    options: ChangelogOptions
  ): string {
    const types: CommitType[] = [
      { types: ["feat"], header: "New Features", icon: ":sparkles:" },
      { types: ["fix"], header: "Bug Fixes", icon: ":bug:" },
      { types: ["perf"], header: "Performance", icon: ":zap:" },
      { types: ["refactor"], header: "Refactors", icon: ":recycle:" },
      { types: ["test"], header: "Tests", icon: ":white_check_mark:" },
      {
        types: ["build", "ci"],
        header: "Build",
        icon: ":construction_worker:",
      },
      { types: ["docs"], header: "Documentation", icon: ":memo:" },
      { types: ["other"], header: "Other Changes", icon: ":flying_saucer:" },
    ];

    const sections: string[] = [];
    const processedCommits = new Set<string>();

    if (options.reverseOrder) commits.reverse();

    for (const type of types) {
      if (
        type.types[0] !== "other" &&
        options.excludeTypes?.includes(type.types[0])
      )
        continue;

      const typeCommits = commits.filter(
        (c) =>
          type.types.includes(c.type || "other") &&
          (!options.excludeScopes?.length ||
            !c.scope ||
            !options.excludeScopes.includes(c.scope))
      );

      if (typeCommits.length) {
        const header = options.useGitmojis
          ? `### ${type.icon} ${type.header}`
          : `### ${type.header}`;
        const entries = typeCommits.map((commit) => {
          processedCommits.add(commit.sha);
          const scope = commit.scope ? `**${commit.scope}**: ` : "";
          const author = commit.author
            ? ` by [@${commit.author}](${commit.authorUrl})`
            : "";
          return `- [\`${commit.sha.substring(0, 7)}\`](${
            commit.url
          }) - ${scope}${commit.subject}${author}`;
        });
        sections.push(`${header}\n${entries.join("\n")}`);
      }
    }

    const date = new Date().toISOString().split("T")[0];
    const version = `## [${tags.latest}] - ${date}`;
    return `${version}\n\n${sections.join("\n\n")}\n`;
  }

  private parseGithubUrl(url: string): { owner: string; repo: string } {
    const regex = /github\.com\/([^/]+)\/([^/]+)/;
    const match = url.match(regex);
    if (!match) throw new Error("Invalid GitHub URL");
    return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  }

  async generate(
    options: ChangelogOptions
  ): Promise<{ changelog: string; fromTag: string; toTag: string }> {
    const cacheKey = this.getCacheKey("generate", options);
    const cached = this.getFromCache<{
      changelog: string;
      fromTag: string;
      toTag: string;
    }>(cacheKey);
    if (cached) return cached;

    const { owner, repo } = this.parseGithubUrl(options.githubUrl);
    const tags = await this.getTags(owner, repo);
    const base = options.fromTag || tags.previous;
    const head = options.toTag || tags.latest;
    const commits = await this.getCommits(owner, repo, head, base);

    if (commits.length === 0) {
      const result = {
        changelog: "No changes found between these versions.",
        fromTag: base,
        toTag: head,
      };
      this.saveToCache(cacheKey, result);
      return result;
    }

    const parsedCommits = this.parseCommits(commits);
    const result = {
      changelog: this.generateChangelogFromCommits(
        parsedCommits,
        { latest: head, previous: base },
        options
      ),
      fromTag: base,
      toTag: head,
    };

    this.saveToCache(cacheKey, result);
    return result;
  }
}
