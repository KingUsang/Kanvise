# ADR 0007: Use layered risk-based test gates

**Status:** Accepted
**Date:** 2026-10-30
**Owner:** Kanvise engineering

## Context

Kanvise has a useful Vitest base and growing Playwright staging work, but no
database test suite, coverage signal, accessibility/visual baseline gate, or one
complete committed certification path. Many API route tests mock Supabase query
chains, which cannot prove migrations, constraints, grants, or concurrency.

## Decision

Use a layered gate: fast unit/component tests; Hono/module integration; clean
migration-built database tests; deterministic browser journeys; exact-SHA real-
provider staging certification; and safe production smoke. Coverage is collected
and ratcheted after measuring the baseline, while critical invariants require
complete branch scenarios regardless of percentage. Passing only on retry does
not certify a release.

## Alternatives considered

- Set an immediate arbitrary coverage percentage. This rewards easy lines and
  would not expose the missing database/provider guarantees.
- Rely mainly on end-to-end tests. They are slower, harder to diagnose, and poor
  at exhaustive authorization/concurrency branches.
- Keep mocked route tests as the main backend proof. They are useful but can
  faithfully model a database behavior that does not exist.

## Consequences and rollout

CI time and test infrastructure increase, particularly for local Supabase and
staging providers. The return is evidence at the boundary where each risk lives.
First make one root verification command, add database rebuild/tests and coverage
reporting, then complete/commit staging certification and add accessibility/
visual baselines. Ratchet the measured baseline rather than blocking adoption on
an invented number.
