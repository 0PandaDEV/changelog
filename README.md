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