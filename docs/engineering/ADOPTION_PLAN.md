# Engineering standards adoption plan

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

The standards programme is complete; implementation conformance is not. This is
the execution order for fixing registered deviations without rebuilding Kanvise
several times. Each initiative receives an owner, milestone, measured baseline,
and linked deviation IDs before implementation.

## Priority model

Order work by user/data harm, exploitability, blast radius, likelihood, recovery
difficulty, and how many later fixes depend on it. A blocker protects tenant
isolation, authentication, money, irreversible data, or production recovery.
Then prefer a platform seam that removes many local inconsistencies over many
page-by-page patches.

## Phase 0 — Make change safe and attributable

**Outcome:** one reproducible toolchain, verification command, clean repository
boundary, current document authority, protected branches, and observable release
identity.

- Preserve and separate the current dirty work by ownership; do not bulk-clean.
- Add root toolchain declarations, one lockfile, root verify commands, repository
  policies/CODEOWNERS/templates, secret/artifact/link checks, and generated drift
  gates.
- Classify legacy docs and replace stale onboarding READMEs.
- Finish exact-SHA staging certification and distinguish Staging from Preview.
- Add structured request IDs, safe errors, readiness, release manifests, and a
  verified environment/service inventory.

Primary deviations: `DEV-REPO-*`, `DEV-TEST-002/003/007/008/012`,
`DEV-REL-002/003/006/007/009`, `DEV-OPS-001/002/006/007/013/014`.

**Exit:** a new contributor and CI run the same deterministic gates; every
release and failure identifies its source; existing dirt/artifacts are owned.

## Phase 1 — Establish the security and data authority

**Outcome:** membership-scoped multi-account tenancy is real, removals are fresh,
and the database rejects cross-account relationships.

- Introduce the general tutoring-account membership schema and compatibility
  reads/writes for legacy `user_profiles.school_id` and role fields.
- Implement local full JWT verification with bounded JWKS refresh, then resolve
  canonical person, active membership, capability, input, and scoped resource.
- Migrate account selection away from Auth/profile mutation; add removal,
  multi-account, concurrent-tab, and cross-tenant negative tests.
- Add composite tenant constraints, function/grant hardening, generated local
  types, database rebuild/tests, and safe data backfills.
- Remove `super_admin`; design any future internal support access separately.

Primary deviations: `DEV-DOM-002/003`, `DEV-SEC-*`, `DEV-DB-001/002/003/005/006/007/008/009/012`,
`DEV-API-005/006/007`, `DEV-TEST-001/004`.

**Exit:** every protected request and relational write proves current membership
and account scope; a clean local database rebuild and adversarial tests pass.

## Phase 2 — Create one application contract

**Outcome:** Hono, the frontend, jobs, and tests share typed schemas, stable
errors, and one data-access path.

- Add shared boundary schemas, application errors, top-level mapping, request
  IDs, compatible envelopes, pagination, and generated/validated OpenAPI.
- Move workflows from oversized routes into capability use cases with atomic and
  idempotent boundaries; consolidate duplicate sub-programme routes.
- Generate frontend contracts and move dashboard reads/writes to the shared
  authenticated client, account-scoped query options, and `useMutation`.
- Add explicit loading/refresh/empty/error/session/mutation states and aggregate
  APIs only where one coherent read model is required.
- Ratchet direct session/fetch/effect usage and raw backend-error presentation.

Primary deviations: `DEV-API-*`, `DEV-FE-001..007`, `DEV-FE-009/010/011/013`,
`DEV-TEST-011`, `DEV-REL-003/004/005`.

**Exit:** a feature uses one schema from HTTP validation through typed UI state,
with contract and integration tests catching drift.

## Phase 3 — Converge product language and UI

**Outcome:** Kanvise feels like one tutoring product across Admin, Tutor, and
Learner surfaces while retaining the strong Class-workspace structure.

- Introduce semantic tokens and accessible shared headers, controls, feedback,
  overlays, data views, navigation, and responsive workspace primitives.
- Treat Class workspace hierarchy/tabs/contextual actions/panel states as the
  structural reference; decompose it rather than copying its raw styles.
- Migrate page/entity titles to foreground text and reserve indigo for actions,
  selected state, links, and named heroes.
- Replace Tutor Centre/School/Student/Programme/Course/Mock/direct-assignment
  product copy with tutoring account/Learner/Class/Subject/Quiz/share-link
  assignment through compatibility adapters.
- Retire the standalone Quiz product vertically: public/guest Quiz pages and
  routes, offers, entitlements, orders/Paystack checkout, library/claim/transfer
  flows, cookies, jobs, migrations/data and obsolete tests/docs. Preserve only
  workspace objective-Quiz authoring, assignment, attempts and results. Retire
  theory grading and adaptive/multi-subject exam complexity from the current
  baseline; preserve data safely until migration/disposition is approved.
- Build component accessibility and multi-viewport visual baselines before route
  rollout; ratchet raw colours, custom overlays, and inaccessible interaction.

Primary deviations: `DEV-DOM-001/004..009`, `DEV-UI-*`, `DEV-FE-008/009/014`,
`DEV-TEST-005/006/014`, `DEV-REPO-013`.

**Exit:** representative Admin/Tutor/Learner journeys use the same primitives,
states, semantics, keyboard behavior, and visual assertions; Mock is not a
product concept.

## Phase 4 — Make effects durable and recoverable

**Outcome:** provider events, notifications, conversions, storage, and schedules
survive retries and process loss without duplicate effects.

- Add PostgreSQL jobs/outbox, leases, attempts, dead-letter/replay, correlation,
  one scheduler/worker role, and operational controls.
- Persist verified webhook inbox events before acknowledgement; converge
  payments and notification intents through idempotent use cases.
- Standardise provider deadlines, retryability, rate-limit/backoff, signatures,
  secret rotation, reconciliation, and safe error/log context.
- Separate R2 resources per environment; add upload intents, confirmation,
  lifecycle state, quarantine where warranted, and orphan/deletion workers.
- Remove Telegram routes, delivery, configuration, migrations/data, UI, and docs
  through a verified compatibility-safe cleanup. Replace presentation timers
  and process-local cron protection; add provider/emulator/real-staging failure
  tests.

Primary deviations: `DEV-ARC-006/007`, `DEV-INT-*`, `DEV-PERF-009`,
`DEV-OPS-009/012`, `DEV-TEST-009/013`.

**Exit:** killing/retrying a process at every boundary loses no accepted work,
does not double-grant access, and leaves a replayable operational record.

## Phase 5 — Prove launch and recovery

**Outcome:** measurable reliability/performance, immutable recoverable releases,
and current executable operations.

- Deploy versioned immutable API releases with atomic switch/rollback and
  unprivileged systemd API/worker units; eliminate live checkout installs.
- Validate configuration schemas and move secret/config ownership into the
  environment inventory with rotation and drift control.
- Instrument SLO dashboards, correlated logs/metrics/traces/Sentry, field Web
  Vitals, slow-query/queue/provider metrics, capacity and bundle/lab budgets.
- Configure and prove PostgreSQL/R2/config retention; run isolated restore,
  host-loss, rollback, provider-outage, and secret-rotation drills.
- Complete exact-SHA real-provider staging journeys, production smoke checks,
  alerts, runbooks, and post-deploy observation.

Primary deviations: `DEV-REL-*`, `DEV-PERF-*`, `DEV-OPS-003..014`,
`DEV-TEST-007/009/013`, `DEV-REPO-003/004/014`.

**Exit:** release, rollback, and restore meet measured objectives; user-impact
alerts route to an owner; production readiness is evidence rather than a doc
claim.

## Continuous rule

New work follows the final standard immediately even while legacy code is being
migrated. Each vertical slice closes its deviations, removes superseded paths,
updates current docs/contracts, and raises its gates from documented to warn,
ratchet, then required. Do not open a broad cleanup phase without a user-visible
or risk-reducing exit condition.
