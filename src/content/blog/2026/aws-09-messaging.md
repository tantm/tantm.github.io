---
title: 'SQS, SNS & EventBridge: Decoupling Systems'
description: 'Queue vs pub/sub vs event bus in one decision, why every consumer must be idempotent, and the DLQ — the most important queue you hope stays empty.'
date: 2026-08-04
category: Cloud
tags: [aws, sqs, event-driven, architecture]
lang: en
translationKey: aws-09
series: aws-zero-to-advanced
part: 9
---

The birth pain: your checkout calls the invoice service, which calls the email service — synchronously. The email provider has a bad minute, and suddenly *checkout* is down (CS-P8's blocked-thread lesson, now spanning services). The fix is the Observer pattern at system distance (CS-P10): put a buffer between "this happened" and "things react to it." AWS gives you three flavors of that buffer, and choosing among them is one decision, not three products to memorize.

## What you'll learn

- Pick among queue, pub/sub, and event bus in one breath, from what the traffic needs to do.
- Explain at-least-once delivery mechanically, and why idempotency stops being optional.
- Configure retries, backoff, and a dead-letter queue so failures become visible instead of infinite.
- Alarm on the signal that actually predicts trouble.

**Prerequisites:** Part 7 (event-driven handlers) and Part 2 (roles). Part 6's replication-lag lesson rhymes with this one.

## 1. The three shapes

```mermaid
flowchart TB
  subgraph Q["SQS — queue: 1 producer → 1 consumer group"]
    P1[Producer] --> S1[(Queue)] --> C1[Worker fleet]
  end
  subgraph N["SNS — pub/sub: 1 event → N subscribers, fan-out now"]
    P2[Producer] --> T[Topic] --> C2[Email svc]
    T --> C3[Analytics]
    T --> Q2[(SQS per subscriber)]
  end
  subgraph E["EventBridge — bus: M producers → rules → N targets"]
    P3[Many producers] --> B[Bus] -->|rule: order.created| C4[Target]
    B -->|rule: payment.failed| C5[Target]
  end
```

- **SQS** is a **queue**: work sits until *one* consumer processes it. Its virtues are buffering and pacing — a traffic spike becomes a longer queue, not a dead worker (the load-leveling that keeps S04-P03's right-sized fleet honest; queue depth is also the natural autoscaling signal).
- **SNS** is **pub/sub**: one message, delivered to *all* subscribers now. The canonical production combo is **SNS→SQS fan-out**: the topic broadcasts, each subscriber gets its *own* queue, so a slow consumer delays only itself.
- **EventBridge** is an **event bus**: many producers, many consumers, with *routing rules matching event content* — plus the schema registry instinct (S07-P06) and native events from AWS services themselves. It's the "nervous system" choice when events outnumber point-to-point flows.

The decision in one breath: **one consumer → SQS; broadcast one producer's events → SNS(+SQS); many-to-many with content routing → EventBridge.** When unsure, start with SQS — it's the one you'll never regret owning.

## 2. At-least-once: the contract nobody reads

Every one of these services is **at-least-once**: duplicates are not a bug, they are the design. The mechanism that produces them is worth understanding once — SQS doesn't delete a message when a consumer *reads* it; the message becomes invisible for a **visibility timeout** while the consumer works, and is deleted only when the consumer confirms. Crash before confirming (or outlive the timeout) and the message *reappears* — which is exactly what you want (no lost work) and exactly what duplicates you (the work may have partially happened).

Therefore the iron rule, third appearance in this curriculum (S02-P06's pipelines, S02-P08's tasks, now messaging): **every consumer must be idempotent.** Process the same message twice → same end state. The standard tools: make the operation naturally idempotent (set status = paid, upsert by key), or track processed message/business IDs and skip repeats. If your consumer isn't idempotent, you don't have a bug that *might* happen — you have a bug scheduled for your first bad deploy.

Related fine print that bites: **visibility timeout must exceed your worst-case processing time** (or you've built a duplicate generator), and **ordering is not guaranteed** in standard queues — FIFO variants exist and trade throughput for order, but the senior move is designing consumers that don't *need* global order (per-entity state machines beat sequence assumptions).

## 3. Retry, backoff, and the DLQ

The queue retries for you — that's the point — but *unbounded* retry turns one poison message (malformed payload, bug in the consumer) into an infinite loop that starves everything behind it. The mandatory circuit breaker is the **dead-letter queue**: after N failed receives (start around 3–5), the message moves to a DLQ instead of cycling forever.

The DLQ is the most load-bearing empty thing in your architecture, and it needs three decisions made *before* the incident: an **alarm on its depth** (a non-empty DLQ is a page — it's your S02-P06 "final failure" basket, materialized), a **replay path** (fix the consumer, then *re-drive* messages back — a built-in operation; the whole failure mode becomes: nothing lost, fix, replay), and **retention** long enough to survive a long weekend. Lambda consumers (S04-P07) plug straight into this: event source mappings handle batching and retries, and the failure destination is — the same DLQ pattern.

## 4. Making the buffer honest

- **A queue hides consumer death.** Synchronous calls fail loudly; a queue just grows. **Alarm on age of oldest message** (staleness, the user-facing truth) more than on depth (which spikes legitimately).
- **Events are contracts** — S02's schema discipline applies: version your payloads, add fields instead of repurposing them (CS-P10's "add, don't repurpose," messaging edition), and put the event schema where both producer and consumer teams can see it.
- **Cost is per-request** (S04-P01's meter): polling and tiny messages add up mostly as *requests*, so batch sends and receives where latency allows — the messaging edition of S04-P04's fewer-larger-requests rule.

## Practice (25 minutes — get a message delivered twice on purpose, then survive it)

Everything here is free-tier SQS. The goal is to *see* at-least-once delivery happen, because reading about it never convinces anyone.

```bash
Q=$(aws sqs create-queue --queue-name lab-main --query QueueUrl --output text)
DLQ=$(aws sqs create-queue --queue-name lab-dlq  --query QueueUrl --output text)
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url $DLQ --attribute-names QueueArn \
          --query Attributes.QueueArn --output text)

# 1. Wire the dead-letter queue: after 3 failed receives, the message moves there
aws sqs set-queue-attributes --queue-url $Q --attributes \
  "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\",\"VisibilityTimeout\":\"5\"}"

aws sqs send-message --queue-url $Q --message-body '{"order":"A-1"}' >/dev/null

# 2. RECEIVE IT — but do NOT delete it. This simulates a consumer that crashed mid-work.
aws sqs receive-message --queue-url $Q --query 'Messages[].Body'     # got it once
sleep 6                                                              # visibility timeout expires
aws sqs receive-message --queue-url $Q --query 'Messages[].Body'     # THE SAME MESSAGE, AGAIN

# 3. Keep not-deleting it. After maxReceiveCount it leaves for the DLQ.
sleep 6; aws sqs receive-message --queue-url $Q >/dev/null
sleep 6; aws sqs receive-message --queue-url $Q >/dev/null
sleep 6
aws sqs receive-message --queue-url $Q  --query 'Messages[].Body'    # empty: main queue is clear
aws sqs receive-message --queue-url $DLQ --query 'Messages[].Body'   # it is HERE, waiting for a human

# 4. The metric that predicts trouble is AGE, not count
aws sqs get-queue-attributes --queue-url $Q --attribute-names \
  ApproximateNumberOfMessages ApproximateAgeOfOldestMessage --query Attributes

aws sqs delete-queue --queue-url $Q; aws sqs delete-queue --queue-url $DLQ
```

Expected results: step 2 is the whole lesson — the identical message comes back after the visibility timeout, without anyone re-sending it. Nothing failed, nothing is misconfigured; that *is* at-least-once delivery, and it's why your handler must be safe to run twice on the same message. Step 3 shows the dead-letter queue doing its job: a message that can never succeed stops circling forever and lands somewhere a human can find it. An empty DLQ is the most reassuring thing on a dashboard, and a non-empty one is the most informative.

## Check yourself

1. Your payment consumer occasionally charges a customer twice, and the logs show the same message ID processed twice. Is the queue broken?
2. You have a dead-letter queue configured and nobody has looked at it in four months. What's the likely state, and what should exist alongside it?
3. Your queue has 50,000 messages and the team is alarmed. Your colleague's queue has 12 messages and they're relaxed. Who should be worried?

<details><summary>See answers</summary>

1. No — that's the documented contract. At-least-once delivery means a message can be delivered more than once whenever a consumer fails to delete it in time, which happens on crashes, slow processing, and timeouts. The fix is on your side: make the handler idempotent, typically by recording processed message IDs or by keying the side effect (one charge per order ID) so a repeat is a no-op.
2. It's probably non-empty and full of failures nobody knows about — which means real work silently stopped happening months ago. Alongside a DLQ you need an alarm on its depth (any message at all is worth a notification), and a documented replay path so someone can fix the cause and put the messages back.
3. Depends entirely on the *age* of the oldest message, not the count. A queue with 50,000 messages moving fast (oldest is 3 seconds) is a healthy buffer absorbing a burst. A queue with 12 messages whose oldest is 40 minutes has a consumer that is stuck or failing — the small number is the alarming one. Alarm on age, not depth.

</details>

## Key takeaways

- One decision, three shapes: SQS for one consumer, SNS(+SQS fan-out) for broadcast, EventBridge for many-to-many with content routing — default to SQS when unsure.
- At-least-once is the contract: visibility timeout mechanics guarantee occasional duplicates, so every consumer must pass the process-twice test.
- Bounded retries + DLQ + alarm + replay path — decided before the incident — turn poison messages from an outage into a routine fix-and-redrive.
- Alarm on oldest-message age, treat event payloads as versioned contracts, and batch requests: a silent growing queue is the failure mode to design against.

*Next up — Part 10: CloudWatch & X-Ray: See Your System.*
