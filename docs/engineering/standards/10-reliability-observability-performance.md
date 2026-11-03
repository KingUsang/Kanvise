# Reliability, observability, and performance

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard governs service objectives, health, telemetry, alerting, incidents,
capacity, caching, and user-perceived performance across web, API, database,
jobs, storage, and providers.

## Reliability objectives

Measure reliability through user journeys and service boundaries. Initial
objectives become enforceable after their instrumentation has produced a valid
baseline, but instrumentation itself is not optional:

- critical web/API request availability: 99.9% per calendar month, excluding
  reviewed maintenance;
- API p95 server duration: 500 ms for normal reads and 1 second for normal
  mutations, excluding explicitly asynchronous/provider-completion time;
- each scheduled/durable job defines a latest-useful start/completion deadline
  and 99% of successful-eligible work meets it;
- public and dashboard route groups meet Core Web Vitals “good” thresholds at
  the 75th percentile separately for mobile and desktop: LCP ≤ 2.5 s, INP ≤
  200 ms, CLS ≤ 0.1; and
- high-consequence payment, invitation, webhook, upload, and notification work
  exposes reconciliation lag and unresolved terminal failures, not only request
  success.

Segment field data by route group, device/network class, country/region where
privacy-safe and useful, release, and authenticated/public experience. An
aggregate that hides poor Nigerian mobile performance is not acceptable.

SLOs have named SLIs, query definitions, exclusions, owner, dashboard, alert,
and runbook. Changes use an ADR/evidence; targets are not silently weakened after
an incident. Error-budget burn influences release pace: sustained exhaustion
pauses reliability-affecting feature rollout until the service is stable.

## Request context and structured telemetry

Every inbound request accepts a safe correlation ID or generates one, returns
it, and carries it through Hono, database/job records, provider adapters, Next.js
proxies, logs, and Sentry. W3C trace context is the distributed-tracing format.

Application logs are structured JSON with timestamp, level, event name, service,
environment, release SHA, request/trace ID, route template (not raw secret URL),
status, duration, actor/person ID, account ID, resource/job/event ID where useful,
and safe error classification. Use one logger; no production `console.*` or
free-form stack dumping outside its adapter.

Never log authorization/cookies, passwords/OTPs, invite/share/session tokens,
raw webhook bodies, payment details, secrets, presigned URLs, private object keys,
full request/response bodies, or unnecessary email/learner data. Redaction is
central and tested. Log level and sampling preserve failures/security/audit events
while bounding high-volume success logs.

## Metrics and traces

API and route-handler services expose RED metrics: request rate, errors by safe
class/status, and duration histograms by route template. Infrastructure exposes
USE signals where available: utilization, saturation, and errors for CPU, memory,
disk, network, event loop, database pool/queries, and worker capacity.

Domain/async metrics include auth failures, account-resolution latency, payment
confirmation/reconciliation, webhook inbox lag/duplicates/failures, job queue
depth/age/attempts/dead letters, notification channel outcomes, R2 upload/
cleanup failures, classroom startup/join/recording outcomes, and provider
latency/timeouts/rate limits.

Traces span browser navigation where sampled, Next/Hono request boundaries,
canonical auth resolution, important database operations, job execution, and
provider calls. High-cardinality IDs belong in trace/log context, not unbounded
metric labels. Sampling is environment/route/outcome aware and retains errors
and anomalous latency.

Sentry uses the deployed Git SHA as release, correct environment, uploaded source
maps, suspect commits where available, and the same request/trace context. Capture
an unexpected error once at its owning boundary. Server and browser SDKs apply
equivalent PII redaction; user identity is the minimum stable internal ID.

## Health and dependency readiness

Provide distinct endpoints:

- **liveness:** process/event loop is responding; no downstream calls;
- **readiness:** required configuration is valid and the service can perform its
  essential database work; fail closed before receiving traffic;
- **deployment identity:** service, environment, full release SHA, and build time,
  with no secret/config values; and
- **internal diagnostics:** authenticated/limited dependency state for operators,
  not a public deep-health data leak.

Optional providers do not make the entire API unready unless their feature is
configured as required. Their degradation appears in feature state, metrics, and
alerts. Health checks have tight deadlines and do not create expensive cascades.
Graceful shutdown stops readiness, stops claiming work, drains bounded in-flight
requests/jobs, then exits before the platform kill deadline.

## Alerting and incidents

Alerts are actionable symptoms tied to an SLO, security condition, data risk, or
exhaustion—not every individual exception. Use multi-window error-budget burn for
availability/latency, plus direct alerts for payment reconciliation, dead-letter
growth, stuck oldest job, failed backups/restores, migration/deploy failure,
storage exposure, and provider-wide degradation.

Each page has severity, owner, user impact, evidence link, immediate checks,
safe mitigation/rollback, and escalation. Deduplicate related alerts. Low-impact
single errors become tickets/dashboards rather than waking a human.

Maintain concise runbooks for service unavailable, database saturation/restore,
auth failure, cross-account exposure, payment mismatch, job backlog, storage
exposure/orphans, classroom outage, provider outage, bad release, and secret
rotation. Incidents record a timeline, impact, decisions, recovery, and blameless
follow-up with owners/dates. Rehearse restore/failover and high-risk runbooks.

## Web performance

Core Web Vitals are field metrics. Send privacy-safe LCP, INP, and CLS with route
group/release/device context and assess p75 mobile/desktop. Lighthouse/trace tests
under defined throttling catch regressions but do not replace real-user data.

Before merging a material page or dependency change:

- inspect the affected production bundle and network waterfall;
- enforce a measured per-route JavaScript/CSS/image/font budget and prevent
  baseline regression;
- keep client boundaries small and lazy-load heavy editors, PDF/DOCX tooling,
  classroom code, and other task-specific dependencies;
- use Next Image or dimensioned/optimized assets, self-hosted/subset fonts, and
  deliberate preloading only for critical resources;
- avoid request waterfalls and duplicate API reads;
- stream/layout-match loading UI and reserve media/dynamic-content dimensions;
- respect low bandwidth, weak devices, reduced data/motion, and offline failure;
  and
- verify that service-worker caching cannot serve stale authenticated/private
  data across users/accounts.

Performance work begins with trace/network/field evidence and quantifies the
affected users/latency/bytes. Do not add speculative memoization, caching,
preconnects, indexes, or parallel calls without an observed bottleneck or clear
bounded prevention purpose.

## API/database/job performance

All collections are bounded and paginated. Detect and remove N+1 access; use a
coherent aggregate/read model where it materially reduces round trips. Parallel
work has explicit concurrency bounds so one request/job cannot exhaust database
or provider capacity. Expensive exports/imports/processes are asynchronous.

Slow-query telemetry records normalized query/function identity, duration, rows,
and safe context. Optimization uses `EXPLAIN (ANALYZE, BUFFERS)` on representative
non-production data, verified indexes, and before/after measurements. Application
caches never compensate for missing tenant filters or authorization freshness.

Load/capacity tests cover expected peak plus headroom for login/session refresh,
dashboard aggregates, assessment submission, class start/join, notifications,
uploads, and job catch-up after downtime. Define resource limits, queue bounds,
provider quotas, database connections, and graceful degradation before scaling a
second process.

## Caching

Every cache declares owner, key including account/authorization dimensions where
applicable, TTL/freshness reason, invalidation event, maximum safe staleness,
stampede protection, and observability. `no-store` is deliberate for sensitive/
volatile responses, not a reflex; public content uses explicit revalidation/tag
invalidation aligned with product updates.

Never cache access decisions beyond the auth standard, private responses in a
shared cache, presigned URLs past their safe use, or one account's query under an
account-neutral key. Browser/query/service-worker/CDN/API caches are separate
layers and their combined staleness is considered.

## Verification

CI/staging verifies telemetry schema/redaction, health semantics, source-map/
release association, alert queries, and performance budgets. Release evidence
includes exact SHA, web field/lab baseline comparison where affected, API/query/
job benchmark where affected, and a rollback/feature-disable path.

Quarterly or after material topology/traffic change, review SLOs, alerts,
dashboards, retention/cost, capacity, provider quotas, slow queries, bundle
budgets, and runbooks. A green dashboard with missing telemetry is unknown, not
healthy.
