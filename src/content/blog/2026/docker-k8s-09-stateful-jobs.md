---
title: 'State, Storage & Batch Jobs on K8s'
description: 'PersistentVolumes and claims demystified, when a StatefulSet is actually needed, Jobs and CronJobs for pipeline work — and an honest answer to "should the database live in Kubernetes?"'
date: 2026-08-19
category: DevOps
tags: [docker-k8s, kubernetes, data]
lang: en
translationKey: docker-k8s-09
series: docker-k8s
part: 9

---

<!-- TODO(img): hero — SP-F blueprint: a storage map — three pod capsules at top; below them a claim ticket labeled "PVC" connected by a dashed line to a disk cylinder labeled "PV"; a vending-machine box at the right labeled "STORAGECLASS" dispensing a new disk; title "CLAIM, DON'T OWN" -->

Everything so far treated Pods as disposable — kill one, an identical replacement appears. That works because they were stateless. But real systems have databases, queues, and nightly pipelines, and "disposable" is exactly what a database is not. This part covers how Kubernetes handles the stuff that must survive: volumes, the StatefulSet, and batch workloads — plus the question every team eventually argues about.

## What you'll learn

- Wire persistent storage with the PV → PVC → StorageClass triangle, and say who owns each piece.
- Decide when a workload genuinely needs a StatefulSet instead of a Deployment.
- Run pipeline work with Jobs and CronJobs — the DE series' scheduling ideas, in-cluster.
- Argue the "database in K8s?" question with reasons instead of vibes.

**Prerequisites:** Parts 7–8. Part 4's volume lesson (Compose) is the single-machine version of today's topic.

## 1. The storage triangle: claim, don't own

Compose (Part 4) had one machine, so a volume was just a named folder. A cluster has N machines, and your Pod might restart on any of them — so storage must be an object *of the cluster*, not of a node. Kubernetes splits it in three:

| Object | What it is | Who creates it |
|---|---|---|
| **PersistentVolume (PV)** | An actual chunk of storage (a cloud disk, an NFS share) | The cluster / a provisioner |
| **PersistentVolumeClaim (PVC)** | A *request*: "I need 10Gi, read-write" | You, next to your app YAML |
| **StorageClass** | The catalog entry that provisions PVs on demand ("fast-ssd", "cheap-hdd") | Platform team / cloud defaults |

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pg-data
spec:
  accessModes: [ReadWriteOnce]        # one node mounts it at a time — like a disk
  storageClassName: fast-ssd          # which catalog entry provisions it
  resources: { requests: { storage: 10Gi } }
```

The pattern is deliberate indirection: **apps claim, the platform provides.** Your YAML says "10Gi of fast storage" and never names a disk — the StorageClass provisions a real volume on whatever cloud you're on. It's the same decoupling Services gave you for networking (Part 7): consumers name what they need, not where it lives. And the punchline that surprises people: a PVC's data **survives Pod deletion** — kill the Pod, the claim and its volume remain, and the replacement mounts the same data.

## 2. StatefulSet: for when identity matters

A Deployment's Pods are interchangeable — random names, shared storage claims, any order. Some systems can't live like that: a Postgres primary is *not* interchangeable with its replica; cluster members need stable names to find each other. A **StatefulSet** gives each Pod three things a Deployment won't:

- **A stable name** — `pg-0`, `pg-1`, `pg-2` — that survives rescheduling (not the random `web-7f9b...` suffix).
- **Its own PVC** — `pg-0` always remounts *its* disk; replicas never swap data by accident.
- **Ordered operations** — `pg-0` starts before `pg-1`; updates roll in reverse order.

The test is one question: **do replicas of this thing have distinct identities?** Databases, Kafka-class brokers, anything electing a leader → yes, StatefulSet. Your API, worker pool, or frontend — where any replica can serve any request → no, Deployment. If you're unsure, it's almost always a Deployment; reaching for StatefulSet "to be safe" buys you ordering constraints and per-Pod volumes you don't want.

## 3. Jobs and CronJobs: pipelines enter the cluster

Deployments keep things running *forever*; a pipeline should run *to completion*. That's a **Job** — and a **CronJob** is a Job on a schedule:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
spec:
  schedule: "0 2 * * *"                 # cron syntax, 02:00 daily
  concurrencyPolicy: Forbid             # never overlap runs
  jobTemplate:
    spec:
      backoffLimit: 3                   # retries before giving up
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: report
              image: myreports:2.1.0
              args: ["--run-date", "$(RUN_DATE)"]
```

If you've read the DE series, this YAML is old friends in new clothes: retries (`backoffLimit`) work because your script exits non-zero on failure (S02-P03's exit-code contract), `concurrencyPolicy: Forbid` protects non-reentrant work, and re-runs are safe only if the job is **idempotent** — Kubernetes supplies the scheduler, your code still supplies the discipline. What CronJob does *not* give you: dependencies between jobs, backfills, or a UI of run history — the moment job B needs job A's output, you've outgrown CronJob and want an orchestrator (Airflow-class, S02-P08). CronJob is cron with retries and logs, not a pipeline platform.

## 4. So... should the database live in Kubernetes?

The argument, honestly compressed:

- **Run it in-cluster when:** it's dev/staging (fast, cheap, disposable); or you have a platform team comfortable operating a mature operator (the community's PG operators automate backups, failover, upgrades); or you're on-prem where a managed service isn't an option.
- **Use a managed database when:** the data is production-critical and your team's edge is *product*, not database operations. RDS-class services (S04's data parts) sell exactly the hard parts: backups tested, failover rehearsed, upgrades somebody else's 2 a.m.
- The trap either way: **the volume is not the backup.** A PVC survives Pod death, not region failure, not `DELETE FROM` at the wrong prompt. Whatever you choose, restore-tested backups are a separate, non-negotiable system.

For most product teams the honest default in 2026 is still: stateless things in the cluster, state in managed services. Not because K8s can't — operators are genuinely good now — but because "can" and "should spend your innovation budget there" are different questions (Part 11 makes this argument for the cluster itself).

## Practice (20 minutes — local cluster)

```bash
# 1. Prove a PVC outlives its Pod
kubectl apply -f pvc.yaml          # the 10Gi claim from section 1 (default StorageClass is fine)
kubectl run scribe --image=alpine --overrides='{"spec":{"containers":[{"name":"scribe","image":"alpine","command":["sh","-c","echo survived > /data/proof.txt && sleep 3600"],"volumeMounts":[{"name":"d","mountPath":"/data"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"pg-data"}}]}}'
kubectl delete pod scribe                       # kill the writer
# re-create the same pod, then:
kubectl exec scribe -- cat /data/proof.txt      # "survived" — the claim kept the data

# 2. A Job that retries — run a container that fails twice then succeeds is hard to fake,
#    so watch the retry machinery with a job that always fails:
kubectl create job doomed --image=alpine -- sh -c "exit 1"
kubectl get pods -l job-name=doomed -w          # watch backoff retries appear, then Ctrl-C

# 3. A CronJob every minute (for observation, not production)
kubectl create cronjob tick --image=alpine --schedule="*/1 * * * *" -- date
kubectl get jobs -w                             # a new job per minute; Ctrl-C after two
kubectl logs -l job-name=<latest-job-name>      # the timestamp output

# 4. Clean up
kubectl delete cronjob tick; kubectl delete job doomed; kubectl delete pod scribe; kubectl delete pvc pg-data
```

Expected results: step 1's second Pod reads the file the first one wrote — storage decoupled from Pod lifecycle, seen with your own eyes. Step 2 shows Pods multiplying with `Error` status as the backoff machinery retries. Step 3 mints one Job per minute, each leaving logs.

## Check yourself

1. Who creates the PV, the PVC, and the StorageClass — and why is that split useful?
2. A teammate wants a StatefulSet for the API "because we can't lose requests." Right call?
3. Your nightly CronJob now needs to wait for an upstream job and support backfills. What's the move?

<details><summary>See answers</summary>

1. You write the PVC (the request); the StorageClass (platform/cloud catalog) provisions the PV (the actual disk) on demand. The split lets app YAML stay portable — it names *what* it needs, while the platform decides *how* it's provided per environment.
2. No — request durability has nothing to do with StatefulSet. API replicas are interchangeable (no distinct identity, no per-replica disk), so it's a Deployment; losing in-flight requests is solved by readiness probes, graceful shutdown, and retries at the client/queue layer.
3. Graduate to an orchestrator (Airflow-class): CronJob has no inter-job dependencies, no backfill concept, and no run-history UI. Keep the container; move the scheduling.

</details>

## Key takeaways

- Storage is claim-based: apps request via PVC, StorageClass provisions the PV — and a claim's data outlives any Pod.
- StatefulSet answers exactly one question — "do replicas have distinct identities?" Databases yes; APIs no. Default to Deployment.
- Jobs run to completion, CronJobs on schedule; retries and safety come from your exit codes and idempotency — and dependencies mean you've outgrown cron.
- Databases *can* live in K8s (operators are real); production default remains managed services — and either way, the volume is not the backup.

*Next — Part 10: Deploy Patterns: Rolling, Blue-Green, Canary.*
