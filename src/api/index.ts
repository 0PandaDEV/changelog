import { ChangelogGenerator } from './changelog'

export async function generateChangelog(githubUrl: string, token: string, options = {}) {
  const generator = new ChangelogGenerator(token)
  return generator.generate({
    githubUrl,
    excludeTypes: ['build', 'docs', 'other', 'style'],
    includeRefIssues: true,
    useGitmojis: true,
    includeInvalidCommits: false,
    reverseOrder: false,
    ...options
  })
}
