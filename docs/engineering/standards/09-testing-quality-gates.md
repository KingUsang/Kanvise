# Testing and quality gates

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard defines what Kanvise tests, where it tests it, which evidence is
required before merge/deployment, and how failures/flakes/test data are handled.

## Principles

Tests protect product invariants and user journeys, not implementation trivia.
Choose the lowest test layer that proves the risk, then add a higher-layer test
when wiring, deployment, browser, database, or provider behavior is itself the
risk. A passing mocked route test cannot prove a migration, grant, R2 CORS rule,
or real authentication handoff.

Every bug fix begins with a failing regression test at the narrowest meaningful
boundary. New behavior includes its happy path, important negative paths, and
the failure/retry/concurrency states identified by its standards. Security,
tenant isolation, payments, authorization changes, data migrations, and durable
work require explicit adversarial tests.

Tests are deterministic, isolated, parallel-safe where their layer permits, and
repeatable from a clean checkout. Control time, IDs, randomness, locale, and
timezone. Do not use arbitrary sleeps; wait on an observable state with a bound.
No test depends on execution order or a long-lived shared user/account.

## Test layers

### Unit and component

Use Vitest for pure domain rules, parsers, mappers, schemas, error mapping,
provider adapter behavior, React components, query/mutation behavior, and
accessibility semantics. Prefer observable outputs over private-function mocks.
React tests interact by accessible role/name and use realistic user events.

Unit tests have network disabled. Mock at stable boundaries: provider adapters,
clock, random/ID source, and a typed repository interface. Do not reproduce long
Supabase query chains in every test and mistake them for database proof.

### API/module integration

API integration tests exercise the real Hono middleware order, validation,
authorization, error envelope, and module use case. Protected modules cover
missing/expired identity, inactive membership, wrong capability, wrong account,
hidden resource, malformed input, and database/provider failure mapping.

Where database behavior matters, run against an ephemeral local PostgreSQL/
Supabase database rebuilt from migrations. Use transaction rollback or unique
run-scoped fixtures; assert both response and durable state. Provider HTTP is
served by a controllable fake at the adapter boundary for ordinary CI.

### Database

Database tests run on the clean migration-built schema and prove constraints,
foreign keys, functions, grants/RLS, tenant-crossing rejection, atomicity,
idempotency, locking/concurrency, and migration replay/backfill behavior. They
also run the generated-type drift and advisor checks in the database standard.

### Browser journeys

Playwright covers a small set of critical user journeys and responsive/device
behavior through public product surfaces. Locally/CI, use disposable isolated
fixtures and controlled providers for fast deterministic journey coverage.
Before production, the exact staged commit runs the approved real-provider
journey certification for identity/email, invitations, storage, payments,
classroom, assessment, and other release-critical integrations.

Journey tests assert user-visible behavior and key server-side outcomes; they do
not use hidden fixture routes, test-only product branches, request interception
for the capability being certified, or service-role calls to perform journey
actions. Privileged credentials are limited to preflight, exact-ID evidence, and
guarded cleanup.

### Visual and accessibility

Shared primitives and material pages have stable multi-viewport screenshots for
normal and important state variants. Visual review uses intentional baselines,
not screenshot scripts that merely produce artifacts. Automated WCAG checks run
on representative pages/components; manual keyboard/screen-reader checks follow
the UI standard for complex patterns.

### Production smoke

Post-deployment smoke checks are read-only or explicitly synthetic/idempotent,
verify deployment identity and health dependencies, and avoid real-user data.
They never compensate for staging certification. Destructive recovery or real
provider actions require a runbook and explicit authorization.

## Test data and environments

Factories create the minimum valid domain records using approved terminology.
Every integration/E2E run has a unique run ID attached to database, Auth,
provider metadata, email aliases, and R2 keys. Cleanup uses recorded exact IDs,
verifies the allowed environment/project/bucket, is safe to retry, refuses
untagged/production targets, and runs in `finally`/always steps. A scheduled
orphan cleanup handles interrupted runs with the same guards.

Tests never contain production secrets or copy real learner data. Sensitive
evidence is redacted and retained for the minimum useful period. Staging and
production resources/credentials are separate.

## Coverage and test selection

Line percentage alone is not a quality gate. CI must collect line, branch,
function, and statement coverage for unit/integration suites, publish the report,
and establish the repository baseline before enforcing a ratchet. Once captured,
overall coverage cannot decrease and changed code must cover every new material
branch. Threshold changes are reviewed, never lowered just to merge.

Regardless of percentage, all branches of these invariants are mandatory:
authentication/authorization/tenant selection, payment/access grant,
invitation/token consumption, upload authorization, webhook deduplication, job
claim/retry, destructive operations, and database constraints/migrations.

Path-based test selection may shorten feedback only when a final required gate
still covers shared contracts and transitive consumers. A change to auth,
database types, shared API client, UI primitives, configuration, or lockfile runs
all affected workspaces.

## Pull-request gate

The required PR check runs from `npm ci` on the supported Node version and must
include:

- repository/format/secret/generated-artifact checks;
- lint and TypeScript checks for API and web;
- API and web unit/component/integration tests with coverage;
- API and web production builds;
- migration filename plus clean database rebuild/tests/advisors/type drift;
- API contract/OpenAPI compatibility checks;
- architecture-boundary and standards-document checks;
- accessibility/component visual checks for affected UI; and
- targeted Playwright journeys for materially affected user flows.

Required checks cannot be bypassed by a direct merge. `only`, skipped tests,
focused specs, snapshot changes, lint suppressions, and reduced assertions are
reviewed as code changes, not treated as harmless test edits.

## Staging certification and production gate

Production promotion uses the exact full Git SHA certified in staging; no
rebasing, rebuilding from different source, or independently drifting web/API
commit. The gate verifies both deployments report that SHA before testing.

Real-provider certification is serialized where shared external state demands
it, records manifest/evidence, and performs guarded cleanup. One retry may gather
diagnostics, but a test that passes only on retry is flaky and does not certify a
release. Required journey IDs are explicit; an absent spec, skipped project,
missing provider, incomplete manifest, cleanup refusal, or deployment mismatch
fails certification.

## Flakes and failures

A failing required test blocks merge/release. First classify product regression,
test defect, environment/provider incident, or flaky nondeterminism with evidence.
Do not rerun until green and merge. A confirmed flaky test is assigned an owner,
issue, evidence, and short expiry; if quarantined, its risk receives an explicit
temporary replacement gate. Critical security/payment/tenant journeys are never
silently quarantined.

Test output and CI artifacts must make failure diagnosis possible without leaking
secrets: include request/run IDs, relevant logs, trace, screenshot/video on
failure, database/provider safe state, and exact commit/tool versions.

## Review evidence

Every change reports the commands/gates actually run and their outcome. It does
not claim unrun tests passed. Manual verification states environment, persona,
viewport/device, data setup, observed result, and cleanup. Documentation-only
changes still run link/format/standards checks and any generator validation they
affect.
