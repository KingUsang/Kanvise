# ADR 0002: Retain append-only imperative migrations

**Status:** Accepted
**Owner:** Kanvise engineering
**Date:** 2026-10-30
**Last verified:** 2026-10-30

## Context

Kanvise has 77 ordered hand-written migrations and no declarative schema tree
or local Supabase configuration. The migration history is already deployed and
contains functions, triggers, grants, data backfills, and provider transitions.

## Decision

Continue using append-only imperative SQL migrations as the canonical schema
history. Improve reproducibility, tests, advisors, type generation, and rollout
checks around that workflow. Do not convert to declarative schemas during the
standards programme.

## Alternatives

- Adopt declarative schemas immediately: rejected because a safe baseline and
  diff-engine migration require a separate project with remote reconciliation.
- Treat the live remote schema as truth: rejected because it is not reviewable
  or reproducible and allows environment drift.
- Squash existing migrations now: rejected because deployed history and data
  migrations make the operation unnecessarily risky.

## Consequences

- Historical schema information remains distributed across migrations.
- Applied files must remain immutable and corrections are always forward-only.
- CI must prove a clean rebuild and generated-type parity.
- A later move to declarative schemas or a carefully baselined squash requires
  a new ADR and environment-by-environment migration plan.
