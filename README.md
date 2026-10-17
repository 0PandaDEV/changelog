# 🚀 GitHub Changelog Generator

Try it at: <https://changelog.pandadev.net>

A modern, fully client-side web application that generates beautiful changelogs from GitHub repositories.

![image](https://github.com/user-attachments/assets/17f8acb9-adc5-4db2-843e-e3e83579d79e)

## ✨ Features

- 📝 Generate changelogs from any public GitHub repository
- 🔒 Support for private repositories with GitHub token
- 🏷️ Filter by tags and commit types
- 😀 Gitmoji support
- ⭐ Markdown rendering with GitHub styling
- 📱 Mobile responsive design
- 📋 Copy to clipboard functionality
- 🌐 Fully client-side - no server needed
- 📄 Generate changelogs from GitHub repositories based on conventional commits
- 🔍 Support for filtering by tags
- 🎨 Customizable output (exclude types, use gitmojis, etc.)
- 📋 Copy to clipboard functionality
- 📄 JSON output for API usage
- 🔗 URL parameter sharing

## 🛠️ Setup

```bash
# 📦 Install dependencies
bun install

# 🔥 Start development server
bun dev

# 🏗️ Build for production
bun run build && node .output/server/index.mjs 
```

## API Usage

There are two ways to use the changelog as an API:

### 1. JSON View in UI

You can use the "View as JSON" button after generating a changelog to access the JSON API endpoint.

Example: `https://changelog.pandadev.net/?url=https://github.com/owner/repo`

### 2. REST API Endpoint

A dedicated REST API endpoint is available at `/api/changelog` that returns pure JSON with proper application/json content type.

#### API Request

```
GET /api/changelog?url=https://github.com/owner/repo
```

#### Query Parameters

- `url`: GitHub repository URL or compare URL (`.../compare/base...head`) (required)
- `base`: Starting branch, tag or commit (optional, defaults to the latest tag)
- `head`: Ending branch, tag or commit (optional, defaults to the default branch)
- `fromTag` / `toTag`: aliases for `base` / `head`
- `excludeTypes`: JSON array or comma separated list of commit types to exclude
- `useGitmojis`: "true" or "false" (defaults to true)
- `reverseOrder`: "true" or "false" (defaults to false)

`GET /api/refs?url=https://github.com/owner/repo` returns `{ defaultBranch, branches, tags }`.

#### Authentication

For private repositories, provide a GitHub token in the Authorization header:

```
Authorization: Bearer your-github-token
```

#### Response Format

```json
{
  "version": "tag-name",
  "date": "YYYY-MM-DD",
  "sections": {
    "New Features": [
      {
        "hash": "7-character-hash",
        "url": "commit-url",
        "scope": "scope-name",
        "subject": "commit message",
        "author": "username",
        "authorUrl": "profile-url"
      }
    ],
    "Bug Fixes": [
      // ...
    ]
  },
  "fromTag": "previous-tag",
  "toTag": "current-tag",
  "markdown": "## [tag-name] - YYYY-MM-DD\n\n### New Features\n- [`hash`](url) - subject\n..."
}
```

## License

MIT
