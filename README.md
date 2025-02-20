# GitHub Changelog Generator

A modern web application that generates beautiful changelogs from GitHub repositories. Built with Nuxt 3.

## Features

- Generate changelogs from any public GitHub repository
- Support for private repositories with GitHub token
- Filter by tags and commit types
- Gitmoji support
- Markdown rendering with GitHub styling
- Mobile responsive design
- Copy to clipboard functionality

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file in the root directory:

```env
GITHUB_TOKEN=your_github_token_here # Optional for private repos
```

## Tech Stack

- Nuxt 3
- Vue 3
- TypeScript
- GitHub API
- Markdown-it
