---
title: 'What Happens When You Hit Enter on a URL'
description: 'DNS, TCP, TLS, HTTP — the four-act play behind every request, the status codes that narrate it, and the curl flags that turn networking from folklore into measurement.'
date: 2026-07-31
category: Developer
tags: [cs-foundations, networking, http]
lang: en
translationKey: cs-foundations-06
series: cs-foundations
part: 6
---

Every system you will build from now on is distributed — which means every bug you can't reproduce locally probably lives in the network. This part walks the classic interview question honestly: you type `https://example.com/orders` and press Enter. Four acts follow, each with its own failure modes — and by the end, `curl` becomes your stethoscope.

## Act 1 — DNS: names into numbers

Computers route by IP address; humans remember names. **DNS** bridges them: your machine asks its resolver "where is `example.com`?" and gets back an IP — after the resolver walks the hierarchy (root → `.com` → the domain's own name servers) on a cold ask, or answers instantly from **cache** on a warm one.

Caching is the whole personality of DNS. Every record carries a **TTL** — "believe this answer for N seconds" — which is why DNS changes "propagate" slowly: nothing propagates, caches simply expire at their own pace. Engineering consequences you'll actually meet: a low TTL is what makes traffic switching possible (S07-P13's cutovers ride on this); a stale cache is why "it works for me but not for them"; and `dig example.com` is the two-second test that separates "DNS problem" from "everything else" — the first fork in any connectivity debug.

## Act 2 — TCP: a reliable conversation over an unreliable world

The internet drops, reorders, and duplicates packets as a matter of course. **TCP** builds a reliable byte stream on top: the famous three-way handshake (SYN → SYN-ACK → ACK) opens the conversation, sequence numbers restore order, acknowledgements trigger retransmission of anything lost.

The two facts that matter at work:

- **The handshake costs one round trip before any data flows** — and round trips are the currency of the network (Part 2's latency table: ~ms same-region, ~150 ms+ cross-ocean). This is why connection *reuse* (keep-alive, connection pools) is the single cheapest performance win in networked code, and why the N+1 query of Part 4 hurts so much: n+1 conversations, not just n+1 questions.
- **Ports name the conversation partner**: the IP finds the machine, the port finds the process (Part 5's file-descriptor world — a socket *is* an fd). `443` for HTTPS, `5432` for PostgreSQL; "connection refused" = machine reachable, nobody listening on that port; a *timeout* = likely a firewall silently eating packets (S04-P03's security groups, seen from the client side).

## Act 3 — TLS: the armored envelope

HTTPS is HTTP inside **TLS**. Two things happen in the TLS handshake, and they answer different questions:

- **Encryption** — nobody on the path can read or alter the bytes. Public-key math agrees on session keys; symmetric crypto does the bulk work.
- **Authentication** — you're talking to the *real* `example.com`: the server presents a **certificate**, signed by a certificate authority your machine already trusts, chaining up to a trusted root.

Practical fluency means reading TLS *errors* correctly, because each names its culprit: *expired certificate* (someone forgot to renew — why the industry moved to auto-renewal), *hostname mismatch* (the cert is for `www`, you called the bare domain), *unknown authority* (self-signed, or a corporate proxy is re-encrypting your traffic — that's TLS working as designed, refusing an untrusted middleman). The one thing never to do: bypass verification (`verify=false`) to "fix" it — that keeps the encryption and throws away the authentication, which is the half that stops impersonation.

## Act 4 — HTTP: the request, at last

After DNS, TCP, and TLS, the actual question is plain text (conceptually): a **method** and path, headers, an optional body — answered by a **status code**, headers, and a body. Two literacy skills:

**Status codes as narrative** — the first digit tells you *whose problem it is*:

| Class | Meaning | The ones that teach |
|---|---|---|
| 2xx | success | `201` created, `204` done-nothing-to-say |
| 3xx | go elsewhere | `301` moved forever (cacheable!) vs `302` temporary |
| 4xx | **your** fault | `401` who are you, `403` I know you and no, `404`, `429` slow down |
| 5xx | **their** fault | `500` crash, `502`/`504` a proxy couldn't reach or outwaited the backend |

That 4xx/5xx split is the first triage question of every API incident — and `502/504` specifically point *between* services: the gateway is fine, the thing behind it isn't (Part 5's incidents often live there).

**Methods as contracts**: `GET` reads (safe to retry, cacheable), `PUT`/`DELETE` are idempotent by contract (S02-P03's word again — retrying is safe), `POST` is *not* — which is why payment forms fear the double-click and why retry logic must know its verbs.

## The stethoscope: curl

Folklore says "the network is slow." Measurement says *which act* is slow:

```bash
curl -s -o /dev/null -w \
  "dns %{time_namelookup}s  tcp %{time_connect}s  tls %{time_appconnect}s \
   first-byte %{time_starttransfer}s  total %{time_total}s\n" \
  https://example.com/orders
```

One line, and the four acts each get a number: DNS slow → resolver/TTL story; TCP slow → distance or packet loss; TLS slow → handshake overhead (reuse connections!); long gap to first byte → *the server is thinking* — the problem isn't the network at all, go read Part 5. Add `-v` to watch the whole play with subtitles, `-k` never (see Act 3). Browser DevTools' Network tab shows the same waterfall per resource — same literacy, different costume.

## Key takeaways

- Four acts per request — DNS (cached names), TCP (round trips are the currency), TLS (encryption *and* authentication), HTTP (the actual question).
- Reuse connections; respect idempotent-vs-not verbs; read 4xx as "my fault", 5xx as "theirs", 502/504 as "between".
- TLS errors name their culprits — fix the cause, never `verify=false`.
- `curl -w` with timing variables turns "the network is slow" into "act 3 is slow" — measurement over folklore, every time.

*Next up — Part 7: Databases: The 20% That Powers 80% of Your Work.*
