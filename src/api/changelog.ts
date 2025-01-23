import { Octokit } from '@octokit/rest'
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import _ from 'lodash'

type CommitData = RestEndpointMethodTypes['repos']['compareCommits']['response']['data']['commits'][number]

interface ParsedCommit {
  type?: string
  scope?: string
  subject?: string
  body?: string
  sha: string
  url: string
  author?: string
  authorUrl?: string
}

interface CommitType {
  types: string[]
  header: string
  icon: string
}

interface ChangelogOptions {
  githubUrl: string
  fromTag?: string
  toTag?: string
  excludeTypes?: string[]
  excludeScopes?: string[]
  restrictToTypes?: string[]
  includeRefIssues?: boolean
  useGitmojis?: boolean
  includeInvalidCommits?: boolean
  reverseOrder?: boolean
}

interface TagPair {
  latest: string
  previous: string
}

export class ChangelogGenerator {
  private octokit: Octokit

  constructor(token?: string) {
    this.octokit = new Octokit({ auth: token })
  }

  private async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const { data } = await this.octokit.repos.get({ owner, repo })
    return data.default_branch
  }

  private async getTags(owner: string, repo: string): Promise<TagPair> {
    // Get latest tag
    const { data: tags } = await this.octokit.repos.listTags({
      owner,
      repo,
      per_page: 1
    })

    // Get default branch
    const { data: repoData } = await this.octokit.repos.get({ owner, repo })
    const defaultBranch = repoData.default_branch

    return {
      latest: defaultBranch,  // Always use default branch as latest
      previous: tags[0]?.name || defaultBranch // Use latest tag as base, fallback to default branch
    }
  }

  async generate(options: ChangelogOptions): Promise<string> {
    const { owner, repo } = this.parseGithubUrl(options.githubUrl)
    const tags = await this.getTags(owner, repo)
    const commits = await this.getCommits(owner, repo, tags.latest, tags.previous)
    
    console.log('Tags:', tags)
    console.log('Total commits:', commits.length)
    
    if (commits.length === 0) {
      return 'No changes found between these versions.'
    }

    const parsedCommits = this.parseCommits(commits, options)
    console.log('Parsed commits:', parsedCommits.length)
    console.log('First parsed commit:', parsedCommits[0])
    
    return this.generateChangelog(parsedCommits, tags, options)
  }

  private parseGithubUrl(url: string): { owner: string; repo: string } {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)/
    const match = url.match(regex)
    if (!match) throw new Error('Invalid GitHub URL')
    return { owner: match[1], repo: match[2] }
  }

  private async getCommits(owner: string, repo: string, head: string, base: string): Promise<CommitData[]> {
    console.log(`Comparing ${base}...${head}`)
    const commits: CommitData[] = []
    let page = 1

    while (true) {
      const { data } = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base,  // Latest tag (v0.3.3)
        head,  // Default branch (main)
        per_page: 100,
        page
      })

      console.log(`Found ${data.commits.length} commits`)
      console.log('First commit:', data.commits[0]?.commit?.message)
      
      commits.push(...data.commits)
      
      if (data.commits.length < 100) break
      page++
    }

    return commits
  }

  private parseCommits(commits: CommitData[], options: ChangelogOptions): ParsedCommit[] {
    return commits
      .map(commit => {
        const message = commit.commit.message
        
        // Parse conventional commit format: <type>[(scope)]: <description>
        const conventionalCommitRegex = /^(\w+)(?:\(([^)]+)\))?(?:!)?: (.+)/
        const match = message.split('\n')[0].match(conventionalCommitRegex)

        if (match) {
          const [, type, scope, subject] = match
          return {
            type: type.toLowerCase(),
            scope: scope,
            subject: subject,
            body: message.split('\n\n')[1],
            sha: commit.sha,
            url: commit.html_url,
            author: commit.author?.login,
            authorUrl: commit.author?.html_url
          } as ParsedCommit
        }

        if (options.includeInvalidCommits) {
          return {
            type: 'other',
            subject: message.split('\n')[0],
            sha: commit.sha,
            url: commit.html_url,
            author: commit.author?.login,
            authorUrl: commit.author?.html_url
          } as ParsedCommit
        }

        return null
      })
      .filter((commit): commit is ParsedCommit => commit !== null)
  }

  private generateChangelog(commits: ParsedCommit[], tags: TagPair, options: ChangelogOptions): string {
    const types = this.getTypes(options)
    const sections: string[] = []

    if (options.reverseOrder) {
      commits.reverse()
    }

    for (const type of types) {
      const typeCommits = commits.filter(c => 
        c.type && type.types.includes(c.type) &&
        (!options.excludeScopes?.length || !c.scope || !options.excludeScopes.includes(c.scope))
      )

      if (typeCommits.length) {
        const header = options.useGitmojis ? `### ${type.icon} ${type.header}` : `### ${type.header}`
        const entries = typeCommits.map(commit => {
          const scope = commit.scope ? `**${commit.scope}**: ` : ''
          const author = commit.author ? ` by [@${commit.author}](${commit.authorUrl})` : ''
          return `- [\`${commit.sha.substring(0, 7)}\`](${commit.url}) - ${scope}${commit.subject}${author}`
        })

        sections.push(`${header}\n${entries.join('\n')}`)
      }
    }

    const date = new Date().toISOString().split('T')[0]
    const version = `## [${tags.latest}] - ${date}`
    
    return `${version}\n\n${sections.join('\n\n')}\n`
  }

  private getTypes(options: ChangelogOptions): CommitType[] {
    const allTypes: CommitType[] = [
      { types: ['feat'], header: 'New Features', icon: ':sparkles:' },
      { types: ['fix'], header: 'Bug Fixes', icon: ':bug:' },
      { types: ['perf'], header: 'Performance', icon: ':zap:' },
      { types: ['refactor'], header: 'Refactors', icon: ':recycle:' },
      { types: ['test'], header: 'Tests', icon: ':white_check_mark:' },
      { types: ['build', 'ci'], header: 'Build', icon: ':construction_worker:' },
      { types: ['docs'], header: 'Documentation', icon: ':memo:' },
      { types: ['other'], header: 'Other Changes', icon: ':flying_saucer:' }
    ]

    if (options.restrictToTypes?.length) {
      return allTypes.filter(t => 
        _.intersection(t.types, options.restrictToTypes).length > 0
      )
    }

    return allTypes.filter(t =>
      !options.excludeTypes?.length ||
      _.intersection(t.types, options.excludeTypes).length === 0
    )
  }
}
