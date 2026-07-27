---
title: 'Security Basics Every Developer Ships With'
description: 'One attacker model (input is code until proven data), the three bug families behind most breaches, secrets that never touch git, and least privilege as a default posture.'
date: 2026-08-04
category: Developer
tags: [cs-foundations, security, web]
lang: en
translationKey: cs-foundations-11
series: cs-foundations
part: 11
---

Security is taught as a specialist elective and then turns out to be a line item in *your* code review, forever. The good news: the bulk of real-world breaches come from a handful of bug families, and all of them fall to one mental model. **Every input is code until proven data.** A URL parameter, a form field, a filename, a JSON body, an HTTP header — the attacker writes them, and somewhere in your system there's an interpreter (SQL engine, browser, shell, template engine) willing to *execute* what you pass along. Security basics = knowing your interpreters and never letting untrusted text reach one raw.

## The injection family: one bug, many costumes

```mermaid
flowchart LR
  A[Attacker-controlled input] --> B{Reaches an interpreter?}
  B -->|SQL engine| C["SQL injection<br/>' OR 1=1 --"]
  B -->|Browser DOM| D["XSS<br/>&lt;script&gt; in a comment"]
  B -->|Shell| E["Command injection<br/>; rm in a filename"]
  B -->|LLM prompt| F["Prompt injection<br/>(S03-P08's teaser)"]
  B -->|None — treated as data| G[Safe]
```

**SQL injection** is the classic: build a query with string concatenation and the input `' OR 1=1 --` rewrites your `WHERE` clause. The fix has been the same for twenty years and you already met it in P7: **parameterized queries, always** — the driver sends the query shape and the values separately, so values can never become syntax. Any string-built SQL in review is a blocking comment (P9's category), no matter how "internal" the tool.

**XSS (cross-site scripting)** is the same bug where the interpreter is the *browser*: user content rendered into HTML unescaped means someone's "comment" runs as script in every other visitor's session — with their cookies. Modern frameworks escape by default; XSS survives at the escape hatches (raw-HTML props with dangerous-sounding names — the name is the warning) and in hand-built string templates. Rule: framework escaping stays on, raw HTML only for content *you* authored, never for anything user-shaped.

**Command injection** is the same bug where the interpreter is the shell: `os.system("convert " + filename)` plus a filename containing `;` runs the attacker's command. Fix: argument arrays (`subprocess.run([...])`, never `shell=True` with user input) — the P7 parameterized-query move, shell edition. And **prompt injection** (S03-P08) is the newest costume: text your LLM reads is input that behaves like instructions. Same model, no complete fix yet — which is why you saw "least privilege on tools" there.

## Auth: the part everyone hand-rolls wrong

Two words that aren't synonyms: **authentication** (who are you) and **authorization** (what may you do). The working rules for each:

- **Never store passwords** — store slow, salted hashes (bcrypt/argon2-family). A leaked table of fast hashes (or worse, plaintext) turns one breach into credential-stuffing against every site the users share passwords with. This is also why you don't invent your own scheme: use your framework's auth or a managed identity provider; the hand-rolled version is a semester of exam questions you haven't seen.
- **Authorization is checked on the server, per request, against the resource.** The classic hole isn't a broken login — it's `GET /invoices/4823` returning someone else's invoice because the code checked *that* you're logged in but not *whose* invoice that is (IDOR — insecure direct object reference). Hiding the button in the UI is not a check; the attacker uses `curl` (P6), not your frontend.
- **Sessions ride on cookies, so protect the cookies**: `HttpOnly` (scripts can't read them — caps XSS damage), `Secure` (HTTPS only, P6's mindset), `SameSite` (blunts cross-site request forgery). Four flags that turn several attack classes into non-events.

## Secrets: the breach you commit yourself

A password in code is one `git push` from public — and **git remembers** (P9's graph: deleting the file in a new commit deletes nothing; the secret lives in history and must be rotated, not removed). The discipline:

- Secrets live in **environment/config injected at runtime** — env vars, a secrets manager — never in code, never in the repo, mirroring S02-P03's config-outside-code habit and S04-P02's key-in-repo incident.
- **`.gitignore` the env file from day zero** and commit a `.env.example` with names but no values.
- Assume any secret that ever touched a repo, a log line, or a chat message is burned: **rotate it**. Rotation being cheap is itself a design goal — it's why identity-based, keyless auth (S04-P02's roles) beats long-lived keys wherever available.

## Least privilege as a default posture

The blast-radius idea from S04-P02, generalized: every component gets the minimum it needs, so a compromise of one piece is an incident, not a catastrophe. The app's DB user can't `DROP TABLE` (P7's constraints as last line); the upload service can write to *its* bucket only (S04-P04's Block Public Access by default); the reporting job gets read-only replicas; the intern's script doesn't run as admin. None of this prevents the initial bug — it prevents the bug from becoming the headline.

Two habits complete the posture: **HTTPS everywhere, verification on** (P6 said it: `verify=false` in production code is a blocking review comment — you're switching off the only proof you're talking to the right server), and **keep dependencies patched** — most real compromises exploit a *known* vulnerability in an *unpatched* library; the dependency-update bot (P9's CI making the right thing automatic) is a security control, not busywork.

## Key takeaways

- One model covers most breaches: input is code until proven data — know your interpreters (SQL, browser, shell, LLM) and use parameterized/escaped paths, never string-building.
- Auth: framework or managed identity, slow salted hashes, and authorization checked server-side per resource — the login can be perfect while `/invoices/4823` leaks everything.
- Secrets never touch git; env/secret-manager injection, `.env.example` for shape, and rotate anything that ever leaked — git history is forever.
- Least privilege + HTTPS-with-verification + patched dependencies: three boring defaults that turn bugs into incidents instead of headlines.

*Next up — Part 12: From School Project to Production System — the series finale.*
