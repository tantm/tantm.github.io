---
title: "Hello, world — why I'm (re)starting this blog"
description: "Kick-off post: what this blog is about, how it's built, and what to expect."
date: 2026-07-20
category: Developer
tags: [meta, astro, blogging]
lang: en
translationKey: hello-world-2026
---

After years of taking notes that never left my private repos, I'm turning this site into a
proper blog. Expect practical, experience-driven posts around four themes:

- **Developer** — tooling, workflows, productivity with AI coding agents
- **Data** — data platforms, pipelines, lakehouse, governance
- **AI** — agentic systems, LLM apps, evaluation
- **Architecture** — patterns and trade-offs from real projects (always anonymized)

## How this site is built

The site is Markdown-first: every post is a plain `.md` file with frontmatter, readable
straight from the GitHub repo and rendered by [Astro](https://astro.build) into a static
site on GitHub Pages.

```yaml
---
title: "Post title"
date: 2026-07-20
category: Data
tags: [spark, lakehouse]
---
```

Adding a post is one command away:

```bash
make new-post TITLE="My next post" CATEGORY=Data
make dev    # preview at localhost:4321
```

## A note on content

I work on client projects, so everything here is generalized: patterns, architectures and
lessons — never client names, internal details or anything confidential.

See you in the next post.
