---
title: 'Registries, Tags & Container Best Practices'
description: 'Push your first image, learn why "latest" is a lie, and adopt the five habits — non-root, signals, healthchecks, runtime config, stdout logs — that make containers production-ready.'
date: 2026-08-05
category: DevOps
tags: [docker-k8s, docker, security]
lang: en
translationKey: docker-k8s-05
series: docker-k8s
part: 5
cover: images/s11-p05-hero.png
---

Your image only lives on your laptop until it's in a **registry** — the warehouse other machines pull from. This part covers the shipping step, the tag discipline that prevents "which version is even running?", and five production habits. It closes Stage A: after this, your containers are ready for orchestration.

## What you'll learn

- Push and pull images with a registry, and read image names correctly.
- Explain why a tag is a movable sticker, not a version — and what to do about it.
- Apply the five production habits: non-root, signal handling, healthchecks, runtime config, stdout logs.
- Run a vulnerability scan and interpret the result calmly.

**Prerequisites:** Parts 1–4. A free Docker Hub account (or any registry) for the practice.

## 1. Registries and the anatomy of an image name

A registry is object storage for image layers plus an API. Docker Hub is the default public one; clouds have their own (ECR-class); companies run private ones. Every image name has the same anatomy:

```text
registry.example.com / team-or-user / app-name : tag
└── where (default: Docker Hub) ──┘ └─ what ─┘ └ which┘
```

The workflow is three commands:

```bash
docker build -t yourname/hello-api:0.1.0 .
docker push  yourname/hello-api:0.1.0
docker pull  yourname/hello-api:0.1.0     # any machine, same image
```

## 2. Tags: movable stickers, not versions

Here is the mistake that causes real incidents: treating a tag as a version. A **tag is a pointer** — a sticker you can peel off one image and put on another. `myapp:latest` today and `myapp:latest` tomorrow can be *completely different images*.

Consequences, in ascending severity:

- "Works on my machine" returns: two machines `pull latest` at different times and run different code.
- A deploy "without changes" changes behavior, because someone pushed a new `latest` overnight.
- Rollback becomes impossible: the tag you'd roll back to has *moved too*.

The discipline that fixes all three:

- **Ship immutable version tags** (`:1.4.2`, or the git commit `:a1b2c3d`). Never reuse them.
- **`latest` is for humans experimenting locally**, never for deploys. Most teams simply ban it in production manifests.
- For the paranoid tier (supply-chain security): pull by **digest** (`@sha256:...`) — the content hash that *cannot* move. CI systems increasingly pin digests for exactly this reason.

## 3. The five production habits

Each habit is one line of Dockerfile or config, and each prevents a real incident class:

**1. Run as non-root.** By default your app runs as root *inside* the container. Container isolation is good but shares the kernel (Part 2) — a breakout from a root container is far worse. Two lines fix it:

```dockerfile
RUN adduser --system --no-create-home appuser
USER appuser
```

**2. Handle signals — you are PID 1.** Part 2 warned you: `docker stop` sends SIGTERM to your app. Apps that ignore it get force-killed after 10s, dropping in-flight requests. Use the exec form of `CMD` (`CMD ["python", "app.py"]`, not `CMD python app.py` — the shell form puts a shell at PID 1 that swallows signals), and make your framework shut down gracefully on SIGTERM.

**3. Declare a healthcheck.** "The process is running" is not "the app is working" (a wedged app still has a live process). One line lets the platform tell the difference:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8000/health || exit 1
```

Compose used this in Part 4 (`service_healthy`); Kubernetes turns it into probes in Part 8. Same idea everywhere: *the app reports its own health*.

**4. Config at runtime, never at build time.** One image, every environment (the Part 3 secrets rule, generalized): read config from environment variables, inject per environment. If you must rebuild the image to change a setting, that setting is in the wrong place.

**5. Log to stdout, not files.** A container that writes `/var/log/app.log` buries its logs in a disposable layer (Part 2). Write to stdout/stderr; the platform collects, ships, and rotates. This is why `docker logs` works — and why every log pipeline expects it.

## 4. Scanning: know what's inside the box

Your image contains an OS's worth of packages, each with known vulnerabilities (CVEs). Scanning compares your layers against vulnerability databases:

```bash
docker scout cves yourname/hello-api:0.1.0   # or trivy image ...
```

How to read the result *calmly*: every real image has findings. Triage like a professional — **critical/high on packages you actually run** matter first; the fix is usually *rebuilding on a newer base image* (`python:3.12-slim` gets patched constantly — your image doesn't, until you rebuild). This is why teams rebuild images on a schedule even without code changes, and why slim images (Part 3) matter: fewer packages, fewer findings, smaller attack surface.

## Practice (15 minutes)

```bash
# 1. Tag discipline: build once, tag twice
docker build -t hello:0.1.0 .            # any small Dockerfile from Part 3
docker tag hello:0.1.0 hello:latest      # two stickers, same image
docker images hello                       # same IMAGE ID on both lines — proof

# 2. Move the sticker (the "latest" trap, live)
echo "# change" >> Dockerfile
docker build -t hello:latest .            # latest now points elsewhere
docker images hello                       # 0.1.0 unchanged; latest = new ID

# 3. Push both (create a free Docker Hub account first)
docker login
docker tag hello:0.1.0 YOURNAME/hello:0.1.0
docker push YOURNAME/hello:0.1.0

# 4. Scan it
docker scout cves hello:0.1.0 | head -30  # read: severity, package, fixed-in
```

Expected results: step 1 shows one IMAGE ID with two tags. Step 2 shows `latest` moved while `0.1.0` stayed — the whole argument for immutable tags, in two commands.

## Check yourself

1. Production runs `myapp:latest`. A bug appears that wasn't there yesterday, with "no deploys". What likely happened, and what tagging policy prevents it?
2. Why does the shell form `CMD python app.py` break graceful shutdown?
3. Your scanner reports 200 vulnerabilities. What do you look at first, and what's usually the fix?

<details><summary>See answers</summary>

1. Someone pushed a new image to the `latest` tag, and a restart/reschedule pulled it — a silent deploy. Immutable version tags (and banning `latest` in production) prevent it, and make rollback possible.
2. It puts a shell at PID 1; the shell receives SIGTERM and does not forward it to your app, so the app never gets to shut down gracefully and is force-killed. The exec form `CMD ["python", "app.py"]` makes your app PID 1.
3. Critical/high findings in packages your app actually uses. The usual fix is rebuilding on an updated base image — which is why scheduled rebuilds exist even without code changes.

</details>

## Key takeaways

- A registry is the warehouse; an image name is where/what/which — and the "which" (tag) is a movable sticker, so ship immutable versions and ban `latest` from deploys.
- Five habits make a container production-ready: non-root user, exec-form CMD with graceful SIGTERM, a healthcheck, runtime config, stdout logs.
- Scan images and triage calmly: critical findings in packages you run, fixed by rebuilding on fresh bases — on a schedule, not just on code changes.
- Stage A complete: you can build, compose, and ship proper containers. Stage B asks the next question — who runs all of these in production?

*Next — Part 6: Why You Need an Orchestrator.*
