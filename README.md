# tantm.github.io

Personal blog of **Thái Minh Tân** — notes on Data, AI & Software Engineering.
Built with [Astro](https://astro.build), Markdown-first, deployed to GitHub Pages.

**Live:** https://tantm.github.io

## Structure

```
├── src/
│   ├── content/blog/<year>/<slug>.md   ← posts (plain Markdown + frontmatter)
│   ├── pages/          # routes: /, /blog, /categories, /tags, /profile, /search, /404, rss.xml
│   ├── layouts/        # BaseLayout (SEO meta, theme init, back-to-top)
│   ├── components/     # Header, Footer, ThemeToggle, PostCard, AdSlot,
│   │                   #   TableOfContents, PostNav, RelatedPosts
│   ├── styles/         # global.css (design tokens, dark/light)
│   ├── consts.ts       # site metadata, categories, AdSense client id
│   └── content.config.ts
├── public/cv/          # public CV (view online + download)
├── scripts/new-post.sh
├── Makefile
└── .github/workflows/deploy.yml
```

## Writing a post

```bash
make new-post TITLE="My post title" CATEGORY=Data   # creates draft .md
make dev                                            # preview at http://localhost:4321
```

Frontmatter:

```yaml
---
title: "Post title"
description: "One-line summary (used in list + SEO)"
date: 2026-07-20
category: Data        # Developer | Data | AI | Architecture | (anything)
tags: [spark, lakehouse]
lang: en              # en (default) | vi
translationKey: my-post-2026   # optional — links EN ↔ VI versions
draft: true           # remove (or false) to publish
---
```

Posts live under `src/content/blog/<year>/` — readable directly on GitHub/VSCode.

### Bilingual site (EN–VI)

The whole site is bilingual: English is the default (no URL prefix), Vietnamese lives
under `/vi/…` (home, blog index, categories, tags, profile, search — same content,
Vietnamese UI). The header has an EN↔VI switcher that always points at the exact
counterpart page. UI strings live in `src/i18n.ts`; page bodies are shared components
in `src/components/pages/` so each page exists once and is rendered per language.

Blog **posts** keep a single canonical URL per language (`/blog/<year>/<slug>`, no
`/vi/` prefix) — the page chrome follows the post's own `lang`.

### Bilingual posts (EN–VI)

Each language version is its own `.md` file with its own slug (Vietnamese slug is fine).
Set `lang: vi` on the Vietnamese one and give **both** files the same `translationKey`:

- the post page shows a "read in Vietnamese/English" banner linking the pair,
  plus `hreflang` alternates for SEO;
- the blog index gets an EN/VI filter (only shown when VI posts exist) and VI cards
  get a `VI` badge;
- prev/next and related posts stay within the post's language.

`make new-post TITLE="..." LANG=vi` scaffolds a Vietnamese draft.

### Images & diagrams

- **Images (png/jpg/svg):** put them in `src/content/blog/<year>/images/` and reference with a
  relative path — works on GitHub *and* gets optimized by Astro at build:

  ```markdown
  ![Architecture overview](./images/my-post-architecture.png)
  ```

- **Diagrams:** use a ` ```mermaid ` code block — rendered as a diagram on the website
  (dark/light aware) and natively by GitHub too:

  ````markdown
  ```mermaid
  flowchart LR
    A[Source] --> B[Lakehouse] --> C[Serving]
  ```
  ````

## Site features

- Full-text search at `/search` — [Pagefind](https://pagefind.app) index generated during
  `make build` (not available on the dev server).
- Per-post: reading time, sticky table of contents (desktop) + collapsible TOC (mobile),
  reading-progress bar, copy button on code blocks, heading anchor links,
  prev/next navigation, related posts (shared tags/category).
- Category colors: each category (Data/AI/Architecture/Developer) has its own accent,
  defined in `src/consts.ts` (`CATEGORY_META`) + `src/styles/global.css` (`[data-cat]`).
- Dark/light theme, self-hosted fonts (Inter + JetBrains Mono), RSS, sitemap, OG tags.

## Commands

| Command | What |
|---|---|
| `make dev` | Dev server with hot reload |
| `make build` | Production build → `dist/` |
| `make preview` | Serve the built `dist/` locally |
| `make new-post TITLE="..." [CATEGORY=...] [LANG=vi]` | Scaffold a new draft post |
| `make publish [MSG="..."]` | **Full pipeline:** build → commit → push → wait for deploy → verify site live |
| `make push [MSG="..."]` | Commit + push only (no build/verify — prefer `make publish`) |

## Deploy

`make publish` runs everything end-to-end. Under the hood, pushing to `master` triggers
`.github/workflows/deploy.yml` (build → deploy Pages); the script then waits for the
workflow and smoke-tests https://tantm.github.io.

Requires Node >= 22 (Astro 7) — the Makefile auto-activates it via nvm + `.nvmrc`.

## Content rules

- Never publish client names, internal codenames, contract numbers or any confidential detail.
- Only the **public CV** is published (`public/cv/`); the confidential portfolio stays local.
