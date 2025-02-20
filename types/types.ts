import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';

export type CommitData = RestEndpointMethodTypes['repos']['compareCommits']['response']['data']['commits'][number];

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
  fromTag?: string;
  toTag?: string;
  excludeTypes?: string[];
  excludeScopes?: string[];
  restrictToTypes?: string[];
  includeRefIssues?: boolean;
  useGitmojis?: boolean;
  includeInvalidCommits?: boolean;
  reverseOrder?: boolean;
}

export interface TagPair {
  latest: string;
  previous: string;
}
