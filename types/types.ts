export interface ParsedCommit {
  type?: string;
  scope?: string;
  subject?: string;
  body?: string;
  sha: string;
  url: string;
  author?: string;
  authorUrl?: string;
}

export interface CommitType {
  types: string[];
  header: string;
  icon: string;
}

export interface ChangelogOptions {
  githubUrl: string;
  base?: string;
  head?: string;
  fromTag?: string;
  toTag?: string;
  excludeTypes?: string[];
  excludeScopes?: string[];
  useGitmojis?: boolean;
  reverseOrder?: boolean;
}

export interface ChangelogEntry {
  hash: string;
  url: string;
  scope: string | null;
  subject: string;
  author: string | null;
  authorUrl: string | null;
}

export interface ChangelogResult {
  markdown: string;
  version: string;
  date: string;
  sections: Record<string, ChangelogEntry[]>;
  base: string;
  head: string;
  fromTag: string;
  toTag: string;
  totalCommits: number;
  truncated: boolean;
  compareUrl: string;
}

export interface RefsResult {
  defaultBranch: string;
  branches: string[];
  tags: string[];
}
