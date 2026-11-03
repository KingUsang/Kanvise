# ADR 0008: Use SLO-led correlated observability

**Status:** Accepted
**Date:** 2026-10-30
**Owner:** Kanvise engineering

## Context

Kanvise has Sentry setup and scattered useful event logs, but no request IDs,
distributed traces, application metrics, real-user Core Web Vitals, SLO/error
budgets, or current alert/runbook system. The public health endpoint only proves
the process can return JSON. Fixed trace sampling and console logs cannot answer
which release/account/journey is failing or whether users are within a target.

## Decision

Define user/service SLIs and initial SLOs, correlate structured logs/metrics/
traces/Sentry by request and release, separate liveness/readiness/identity, and
alert on user-impact/error-budget symptoms. Measure web performance with real-
user p75 LCP/INP/CLS split by mobile/desktop, supported by lab budgets. Capture a
baseline before enforcing bundle/coverage-style performance ratchets.

## Alternatives considered

- Rely on Sentry exceptions and uptime checks. They miss slow/stale/partial
  failures, queue lag, provider ambiguity, and healthy-HTTP broken journeys.
- Log everything without metrics/traces. This is expensive and hard to aggregate,
  and high-volume PII risk grows.
- Set only infrastructure alerts. Low CPU does not mean payment, classroom, or
  account switching works for users.

## Consequences and rollout

Telemetry has implementation and storage cost and requires cardinality/redaction
discipline. First add request/release context, structured logger and health
semantics; then RED/domain/job/provider metrics, traces, RUM, dashboards, alerts,
and runbooks. Validate initial targets against baseline and adjust only through
recorded evidence, not by silently redefining queries after failures.
