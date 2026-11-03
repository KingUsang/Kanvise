# ADR 0006: Use PostgreSQL-backed durable jobs and outbox

**Status:** Accepted
**Approved:** 2026-11-03 by the product owner
**Date:** 2026-10-30
**Owner:** Kanvise engineering

## Context

Kanvise runs scheduled publication, reminders, notifications, classroom
lifecycle, recording, conversion, and provider reconciliation. Some state is
durable, but scheduling is process-local and presentation conversion can be
detached in memory. A separate Redis/queue platform would add operational cost
before throughput requires it; in-memory work loses effects on restart.

## Decision

Use PostgreSQL job, inbox, and transactional-outbox records as the default queue.
A single scheduler/worker initially claims leased bounded batches, retries with
backoff, and records terminal failures. All handlers are idempotent. The model is
safe for multiple workers before any horizontal rollout, but only one worker is
enabled until concurrency has been verified.

## Alternatives considered

- Keep `node-cron` plus in-memory guards. This is simple but cannot survive a
  restart, coordinate processes, or give operators durable failure/replay state.
- Adopt BullMQ/Redis or a managed queue immediately. It offers mature queue
  features but adds another stateful service and dual-write/outbox concerns at
  Kanvise's current volume.
- Use provider-specific scheduled functions. This fragments operations and does
  not solve transaction-to-event reliability.

## Consequences and migration trigger

PostgreSQL carries modest polling/write load and the team must implement leases,
backoff, retention, and operational views correctly. In return, jobs share the
existing transactional boundary and deployment footprint. Reassess a dedicated
queue when measured database contention, sustained throughput, delay precision,
payload volume, or independent worker scaling exceeds the documented limits; a
replacement requires an ADR and an outbox-compatible migration.

This decision records the approved durable-work architecture. It does not by
itself authorize a migration, deployment, or production data operation; those
changes require their own implementation, verification, and release evidence.
