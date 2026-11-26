# Kanvise execution slices

**Status:** Proposed execution breakdown; does not approve product or architecture changes
**Basis:** `ADOPTION_PLAN.md`, `deviations.md`, and the current owner deferrals
**Rule:** Close one slice with linked deviations, evidence, and an explicit exit check before expanding its scope. Preserve existing worktree changes and keep deferred operational evidence out of unrelated gates.

## 1. Repository and release safety

**Scope:** Attribute and protect existing worktree changes; close credential and artifact exposure; fix CI path/release identity gaps; establish the minimum reproducible contributor verification interface. Start with `DEV-SEC-011/012/014`, `DEV-REPO-003/005/011/015/018/021`, `DEV-OPS-015/016`, and applicable `DEV-TEST-*` records.

**Exit:** Tracked credentials/artifacts have an owner-approved disposition; CI builds the files it consumes and rejects unsafe release inputs; repository checks are reproducible; no unrelated cleanup is bundled.

**Tradeoff:** Small, contained changes reduce accidental release and credential risk early. Worktree attribution and history-sensitive credential remediation can take coordination; do not discard, rewrite, or clean existing changes as a shortcut.

## 2. Authentication, tenancy, and database authority

**Scope:** Implement the approved multi-account membership model and request-scoped account context; align JWT verification and fresh authorization; reconcile route policy; verify database constraints, grants, RLS, and functions. Link `DEV-SEC-*`, `DEV-DB-*`, `DEV-API-005/006/007`, `DEV-DOM-002/003`, and `DEV-TEST-001/004/029`.

**Exit:** A person can hold the approved memberships/roles; every protected request and relationship is checked in the selected active account; removal takes effect on the next request; route-level negative cases and a clean disposable database build prove isolation.

**Tradeoff:** This is the highest-impact structural slice and touches schema, middleware, API, and account selection. Compatibility reads/backfills add temporary complexity, but doing it before broad API/UI conformance avoids rebuilding those layers.

## 3. API contracts and workflow integrity

**Scope:** Add boundary schemas, stable safe errors, bounded pagination, and shared response contracts; then close per-feature transaction, idempotency, and concurrency gaps. Link `DEV-API-*`, `DEV-TEST-*`, and workflow deviations such as `DEV-CLS-*`, `DEV-ASN-*`, `DEV-PAY-*`, and `DEV-INV-*` as each feature is taken.

**Exit:** Each changed feature has one validated request/response contract, account-scoped resource authorization, explicit failure mapping, retry/concurrency behavior, and focused boundary evidence. Do not convert this into a one-shot rewrite of all routes.

**Tradeoff:** Contract work prevents frontend/backend drift and reduces partial writes, but compatibility adapters and staged migrations increase per-feature effort. Prioritize security, money, and irreversible data effects first.

## 4. Frontend and product consistency

**Scope:** Migrate active dashboard features to the approved shared client/query/state patterns and semantic UI primitives; close initial, refresh, empty, error, retry, URL, keyboard, and responsive gaps. Link `DEV-FE-*`, `DEV-UI-*`, and approved domain deviations `DEV-DOM-*` to the affected feature slice. Retired standalone/public/paid Quiz work follows the approved retirement decision and preserves data until disposition is approved.

**Exit:** Each migrated feature uses the shared account-aware request/cache path, preserves useful data during refresh failure, exposes recoverable errors, restores meaningful URL state, and passes focused accessibility/responsive checks.

**Tradeoff:** Shared primitives and query behavior lower long-term inconsistency; incremental migration means temporary visual and state differences remain until each feature is converted. Use the Class workspace structure as the reference, not its raw styles or oversized component.

## 5. Durable effects and provider recovery

**Scope:** Make webhook, notification, payment, upload, and scheduled effects replayable with independent delivery state, bounded provider calls, and reconciliation. Link `DEV-INT-*`, `DEV-JOB-*`, `DEV-NTF-*`, `DEV-EML-*`, `DEV-PSH-*`, `DEV-PAY-*`, `DEV-UPL-*`, and `DEV-PNM-*` by workflow.

**Exit:** Accepted effects survive process restart and retry without duplicate grants; each channel/provider failure is observable and independently recoverable; storage objects have an owned lifecycle.

**Tradeoff:** Durable state and replay controls add schema and operational work, but remove reliance on process memory and synchronous retries. ADR 0006 approves PostgreSQL-backed jobs, inbox, and transactional outbox as the default; implementation remains separately planned and must satisfy its lease, retry, idempotency, concurrency, and verification requirements.

## 6. Deployment and recovery proof — deferred

**Scope:** Immutable release promotion, environment/configuration evidence, production process topology, SLO/performance measurements, backup retention, restore/rollback drills, and real-provider staging certification (`DEV-OPS-*`, `DEV-REL-*`, `DEV-PERF-*`, `DEV-TEST-007/009/013`).

**Status:** Deferred by the owner for later; it does not block unrelated audit closure or feature work. No staging certification, production change, restore drill, or performance campaign is implied by this plan.

**Tradeoff:** Deferral preserves focus on present security/data-authority blockers and avoids treating unavailable operational evidence as a prerequisite. It leaves release/recovery claims unproven until this slice is explicitly scheduled and completed.

## Slice completion record

Before implementation, add the named owner, milestone, baseline, exact deviation IDs, and required verification evidence for that slice. Record architecture choices as Proposed until the owner approves the specifically named decision. Close deviations only with evidence from the completed gate, not because a plan or code change exists.
