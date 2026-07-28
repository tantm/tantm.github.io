---
title: "Building Images That Don't Embarrass You"
description: 'Write a Dockerfile line by line, understand why instruction order decides your build speed, and cut a 1GB image to a fraction with multi-stage builds.'
date: 2026-08-05
category: DevOps
tags: [docker-k8s, docker, devops]
lang: en
translationKey: docker-k8s-03
series: docker-k8s
part: 3
cover: images/s11-p03-hero.png
---

Part 2 showed that an image is a stack of layers. This part teaches you to *build* those layers well. The difference between a careless Dockerfile and a good one: builds that take 10 seconds instead of 5 minutes, and images of 180 MB instead of 1.2 GB. Both differences come from the same two ideas.

## What you'll learn

- Read and write a Dockerfile: the 7 instructions that matter.
- Use the layer cache — and stop breaking it with wrong instruction order.
- Cut image size with slim base images, `.dockerignore`, and multi-stage builds.
- Recognize the two classic Dockerfile mistakes in any repo you join.

**Prerequisites:** Parts 1–2 (containers, images, layers). Docker installed.

## 1. A Dockerfile, line by line

A **Dockerfile** is the recipe for an image. Each instruction creates one layer. Here is a complete, honest example for a small Python API:

```dockerfile
# 1. Start from a base image — pick the "slim" variant, not full
FROM python:3.12-slim

# 2. Set the working directory inside the image
WORKDIR /app

# 3. Copy ONLY the dependency list first (this order matters — see section 2)
COPY requirements.txt .

# 4. Install dependencies — one layer, no cache junk left behind
RUN pip install --no-cache-dir -r requirements.txt

# 5. Now copy the rest of your code
COPY . .

# 6. Document the port the app listens on
EXPOSE 8000

# 7. The command PID 1 runs (remember Part 2: your app gets the signals)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run it:

```bash
docker build -t my-api:dev .
docker run -d -p 8000:8000 my-api:dev
```

That's 90% of every Dockerfile you'll ever read. The remaining 10% (`ENV`, `ARG`, `USER`, `HEALTHCHECK`) arrives in Part 5.

## 2. The cache: why instruction order decides build speed

Docker caches every layer. On rebuild, it reuses cached layers from the top **until the first line whose input changed** — from that point down, everything rebuilds.

This single rule explains the strange `COPY` order in section 1:

```text
GOOD ORDER (code change = 10s rebuild)     BAD ORDER (code change = 5min rebuild)
────────────────────────────────────       ────────────────────────────────────
FROM python:3.12-slim            cached    FROM python:3.12-slim            cached
COPY requirements.txt .          cached    COPY . .                     ← CHANGED
RUN pip install ...              cached    RUN pip install ...          rebuilds!
COPY . .                     ← CHANGED     (pip reinstalls everything, every time)
```

Your code changes many times a day. Your dependencies change once a week. So: **copy the rarely-changing things first, the frequently-changing things last.** That's the whole optimization, and it's worth minutes on every single build.

![The layer cache breaks downward — put frequently-changing code last](images/s11-p03-concept1.png)

## 3. Size: three cuts that do almost all the work

Big images are slow to push, slow to pull, slow to start, and carry more attack surface. Three cuts, in order of effort:

**Cut 1 — pick a slim base.** `python:3.12` is ~1 GB (it includes compilers and man pages you'll never use). `python:3.12-slim` is ~150 MB. One word, ~850 MB saved. (`alpine` variants are smaller still, but can break Python packages that need glibc — slim is the safe default.)

**Cut 2 — add `.dockerignore`.** `COPY . .` copies *everything*, including `.git`, virtualenvs, and test data. Create a `.dockerignore` next to the Dockerfile:

```text
.git
.venv
__pycache__
*.pyc
tests/
.env
```

The `.env` line is also a **security** rule: secrets must never be baked into image layers — anyone with the image can read every layer.

**Cut 3 — multi-stage builds** (the pro move, essential for compiled languages):

```dockerfile
# Stage 1 "builder": has the whole toolchain, gets thrown away
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build            # produces dist/

# Stage 2: the image you actually ship — server only, no toolchain
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

The final image contains only stage 2. Node, npm, and 800 MB of `node_modules` never ship. The pattern is universal: *build with a fat image, ship with a thin one.*

## 4. Two mistakes you'll now recognize everywhere

1. **`COPY . .` before installing dependencies** — every code change reinstalls the world (section 2). You'll find this in half the Dockerfiles on the internet.
2. **Secrets in layers** — `COPY .env .` or `RUN echo $TOKEN > config`. Layers are forever; `docker history` shows them. Config comes in at *runtime* (`docker run -e` or mounted files), never at build time.

## Practice (15 minutes)

Measure the wins yourself:

```bash
mkdir img-lab && cd img-lab
printf 'flask==3.0.3\n' > requirements.txt
printf 'print("hello")\n' > main.py

# 1. The "bad" version
cat > Dockerfile <<'EOF'
FROM python:3.12
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["python", "main.py"]
EOF
docker build -t lab:fat .            # note the total time
docker images lab:fat                # note the SIZE (~1GB)

# 2. Fix base image + order
cat > Dockerfile <<'EOF'
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
EOF
docker build -t lab:slim .
docker images lab:slim               # compare SIZE

# 3. Prove the cache: change code, rebuild
echo 'print("v2")' > main.py
time docker build -t lab:slim .      # pip layer says CACHED; rebuild is seconds
```

Expected results: `lab:fat` is roughly 1 GB, `lab:slim` under 200 MB. The step-3 rebuild reuses the pip layer (look for `CACHED` in the output) and finishes in seconds.

## Check yourself

1. You change one line of code and the rebuild takes 5 minutes, reinstalling all dependencies. What's wrong with the Dockerfile?
2. Why is `COPY .env .` a security incident, not just bad style?
3. What problem do multi-stage builds solve, and for which languages do they matter most?

<details><summary>See answers</summary>

1. Code is copied *before* the dependency install, so the code change invalidates the cache for the install layer. Move `COPY requirements.txt` + install above `COPY . .`.
2. The secret becomes a permanent image layer — anyone who can pull the image can extract it with `docker history`/`docker save`, even if a later layer deletes the file. Secrets belong at runtime.
3. They separate the build toolchain from the shipped image: compile in a fat stage, copy only artifacts into a thin final stage. Most valuable for compiled/bundled languages (Go, Java, Node frontends) where the toolchain dwarfs the artifact.

</details>

## Key takeaways

- Seven instructions cover 90% of Dockerfiles — and each one is a layer.
- The cache breaks downward from the first changed line: copy stable things (dependencies) first, volatile things (code) last.
- Size comes from three cuts: slim base, `.dockerignore` (which is also a secrets rule), and multi-stage builds.
- Secrets never go in layers — layers are forever; config enters at runtime.

*Next — Part 4: Docker Compose: Your Local Environment as Code.*
