# Changelog Generator

Live at <https://changelog.pandadev.net>

Generate a changelog from conventional commits for any GitHub repo. Compare any two branches, tags or commits.

![image](https://github.com/user-attachments/assets/17f8acb9-adc5-4db2-843e-e3e83579d79e)

## Setup

```bash
bun install
bun dev
bun run build
```

## API

```
GET /api/changelog?url=https://github.com/owner/repo
GET /api/refs?url=https://github.com/owner/repo
```

`url` accepts any GitHub URL, including `/tree/...`, `/releases/tag/...` and `/compare/a...b`.

| Param | Description |
| --- | --- |
| `base` | Branch, tag or commit to start from. Defaults to the latest release or tag. |
| `head` | Branch, tag or commit to end at. Defaults to the default branch. |
| `excludeTypes` | JSON array or comma separated list of commit types to leave out. Defaults to none. |
| `useGitmojis` | `false` to hide section icons. |
| `reverseOrder` | `true` for oldest first. |

`fromTag` and `toTag` still work as aliases for `base` and `head`.

For private repos or higher rate limits, send `Authorization: Bearer <github token>`.

`/api/changelog` returns:

```json
{
  "version": "main",
  "date": "YYYY-MM-DD",
  "sections": {
    "New Features": [
      {
        "hash": "b0d2109",
        "url": "commit-url",
        "scope": "web",
        "subject": "serve logo and favicon",
        "author": "username",
        "authorUrl": "profile-url"
      }
    ]
  },
  "base": "v1.0.0",
  "head": "main",
  "totalCommits": 12,
  "truncated": false,
  "compareUrl": "https://github.com/owner/repo/compare/v1.0.0...main",
  "markdown": "..."
}
```

`/api/refs` returns `{ defaultBranch, branches, tags }`.

## GitHub Action

Generate a changelog inside a workflow. It runs in the job and reads GitHub with the job token, nothing goes through the hosted site.

```yaml
name: Release
on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: 0PandaDEV/changelog@main
        id: changelog
        with:
          exclude-types: chore,docs
      - run: gh release create "$TAG" --notes "$NOTES"
        env:
          GH_TOKEN: ${{ github.token }}
          GH_REPO: ${{ github.repository }}
          TAG: ${{ github.ref_name }}
          NOTES: ${{ steps.changelog.outputs.markdown }}
```

On a tag push, `head` is the tag and `base` is the previous tag. Otherwise `head` is the default branch and `base` is the latest release.

| Input | Description |
| --- | --- |
| `token` | Defaults to `github.token`. Use a personal token for other private repos. |
| `repository` | `owner/repo` or any GitHub URL. Defaults to the current repo. |
| `base`, `head` | Branch, tag or commit. |
| `exclude-types`, `exclude-scopes` | Comma separated lists. |
| `use-gitmojis` | `false` to hide section icons. |
| `reverse-order` | `true` for oldest first. |
| `output-file` | Also write the markdown to this path. |
| `step-summary` | `true` to add the changelog to the job summary. |

Outputs: `markdown`, `json`, `base`, `head`, `total-commits`, `compare-url`.

After changing the generator, run `bun run build:action` and commit `action/dist`.
