---
title: 'S3 Deep Dive: More Than File Storage'
description: 'Objects are not files, prefixes are not folders — plus storage classes, lifecycle rules, versioning, presigned URLs, and the public-bucket mistake that made S3 famous.'
date: 2026-07-30
category: Cloud
tags: [aws, s3, storage, aws-zero-to-advanced]
lang: en
translationKey: aws-04
series: aws-zero-to-advanced
part: 4
---

S3 looks like a file share and that resemblance is a trap. It is an **object store** — a different animal with different physics — and it quietly underpins half of AWS: the data lakes of S07, EBS snapshots, log archives, static websites, ML datasets. Understand S3 properly and a dozen later services become obvious; misunderstand it and you'll fight "folders" that don't exist.

## Objects, not files

An S3 **bucket** (globally unique name) holds **objects**: a key (the full "path" string), the bytes, and metadata. The mental model corrections that matter:

- **There are no folders.** `raw/2026/07/orders.parquet` is one flat key; the console just *renders* slashes as a hierarchy. Consequence: "renaming a folder" means copying every object under a prefix — there is no cheap `mv`.
- **Objects are immutable.** You never edit an object; you overwrite the whole thing under the same key. "Append to a file in S3" is not an operation — which is exactly why big data files come in immutable formats like Parquet (S02-P03's escalation path) and why table formats (S07-P03) exist to fake mutability on top.
- **It's an HTTP API, not a disk** (Part 1's everything-is-an-API): ~milliseconds per request, effectively infinite parallel throughput. Optimized code makes *fewer, larger* requests — a thousand 1 KB objects cost more time and money than one 1 MB object.
- **Durability vs availability are different promises**: eleven 9s of durability (your bytes survive) but occasional request errors are normal — clients retry (idempotency, again). Objects land in one **region**, replicated across AZs — residency (S07-P10) is decided by your bucket's region choice.

## Storage classes: the same bytes at five prices

The bytes don't change; the access-pattern promise does. The menu, simplified to what you'll use:

| Class | The deal | Use when |
|---|---|---|
| Standard | Full price, instant, no strings | Hot data, default |
| Intelligent-Tiering | Small monitoring fee, auto-moves tiers | You honestly don't know the access pattern |
| Standard-IA | ~45% cheaper storage, per-GB retrieval fee, 30-day minimum | Backups, older partitions still queried sometimes |
| Glacier Instant | ~68% cheaper, still millisecond access | Archives you rarely touch but can't wait for |
| Glacier Deep Archive | ~95% cheaper, hours to restore, 180-day minimum | Compliance archives (S07-P10's retention years) |

Two traps hide in the fine print: **minimum storage durations** (delete an IA object after a week, pay for 30 days anyway) and **retrieval fees** (move a hot dataset to IA and the "savings" invert). Which is why the honest default for mixed workloads is Intelligent-Tiering, and why the real tool is the next section.

## Lifecycle rules: S07-P12's tiering, made real

The FinOps "tier automatically" pattern is literally an S3 JSON rule:

```json
{
  "Rules": [{
    "ID": "archive-raw-data",
    "Filter": { "Prefix": "raw/" },
    "Transitions": [
      { "Days": 90,  "StorageClass": "STANDARD_IA" },
      { "Days": 365, "StorageClass": "DEEP_ARCHIVE" }
    ],
    "Expiration": { "Days": 2555 }
  }]
}
```

Raw data cools with age: Standard for the working quarter, IA for the year, Deep Archive until the 7-year retention expires, then gone. Written once at design time (S07-P12's "decide retention at design time" — this is the mechanism), it compounds savings forever. Also cover the unglamorous leaks: a rule to **abort incomplete multipart uploads** after 7 days — failed uploads silently bill until you do.

## Versioning: the undo button with a bill

Turn on versioning and overwrites/deletes stop destroying data: old versions stack up; a delete just adds a *delete marker*. Two edges:

- **The good**: fat-finger protection, and the substrate for replication and audit trails. For buckets holding anything irreplaceable, it's non-negotiable.
- **The bill**: every overwritten version keeps billing at full class price. Versioning **without** a lifecycle rule expiring old versions (`NoncurrentVersionExpiration`) is a slow-motion cost incident — the pair travels together, always.

## Presigned URLs: sharing without opening the door

The bucket stays private; your backend (using its IAM role, S04-P02) mints a time-limited URL that grants exactly one operation on exactly one object:

```python
url = s3.generate_presigned_url("get_object",
        Params={"Bucket": "my-app-uploads", "Key": "reports/july.pdf"},
        ExpiresIn=900)   # 15 minutes, this object only
```

This one primitive powers most "download your invoice" and "upload your avatar" features on the internet — user uploads go *directly* to S3 via a presigned PUT, never through (or sized for) your servers. It's the pattern that keeps buckets private while the product stays convenient.

Which brings up the famous failure mode: the **public bucket**. A decade of breach headlines came from "just make it public so the app works." Modern S3 ships with **Block Public Access** on by default — leave it on. The legitimate exception is *deliberate* static website hosting (this blog's pattern via GitHub Pages equivalents; on AWS, prefer CloudFront + Origin Access Control so the bucket itself still isn't public). If you're about to uncheck that box for any other reason, the answer is a presigned URL.

## Hands-on (20 minutes, free tier)

1. Create a bucket (Block Public Access on), upload a file through console and CLI (`aws s3 cp`).
2. Enable versioning; overwrite the file; list versions; delete it; observe the delete marker; restore by deleting the marker. Feel the undo.
3. Add the lifecycle rule above (shorten to 1 day to see it registered) + the multipart-abort rule.
4. Generate a presigned URL from the CLI, open it in a private browser window, watch it work — then expire.

## Key takeaways

- S3 is an object store: flat keys not folders, immutable objects not editable files, an HTTP API not a disk — fewer, larger requests win.
- Storage classes are prices on access-pattern promises; minimum durations and retrieval fees are the fine print; lifecycle rules automate the tiering forever.
- Versioning is the undo button and it bills — pair it with noncurrent-version expiration, always.
- Buckets stay private: presigned URLs for sharing, Block Public Access untouched, CloudFront for the deliberate website case.

*Next up — Part 5: VPC Networking Without the Headache.*
