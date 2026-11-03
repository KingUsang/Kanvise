# Engineering standards decision ledger

**Status:** Current
**Owner:** Kanvise engineering
**Last verified:** 2026-10-30

This ledger tracks proposals through all standards slices. A proposal is not a
standard until its status is **Approved**.

| ID | Slice | Decision | Status | Tradeoff / note |
|---|---|---|---|---|
| GOV-001 | Governance | Use one engineering index, thin AGENTS files, standards by slice, ADRs, runbooks, and a separate deviation register. | Approved | Small documentation overhead prevents competing sources of truth. |
| GOV-002 | Governance | Track decisions as Proposed, Approved, Deferred, or Rejected. | Approved | Keeps discussion and enforceable rules separate. |
| DOM-001 | Product domain | Customer types are Independent Tutor and Tutoring Agency; the neutral boundary is a tutoring account. | Approved | Clear product language while legacy persistence names remain temporarily. |
| DOM-002 | Product domain | Admin, Tutor, and Learner are product roles; an Admin may also teach. | Approved | Capabilities can overlap without multiplying roles. |
| DOM-003 | Product domain | A person may belong to multiple tutoring accounts; authorization is membership- and active-account-specific. | Approved | Requires later auth/schema work but avoids preserving the known single-account limitation. |
| DOM-004 | Product domain | `super_admin` is not a product role. | Approved | Internal support access needs a separate auditable design. |
| DOM-005 | Product domain | Class, Subject, and Session are the teaching hierarchy. | Approved | Product clarity now; persistence renames are deferred to safe migrations. |
| DOM-006 | Product domain | Classes are One-to-one or Group; default to One-to-one and enforce at most one active Learner through the authoritative API transaction initially. | Approved | Flexible conversion without prematurely adding a difficult database constraint. |
| DOM-007 | Product domain | Assessments contain Quizzes and Assignments; Mock Exam is removed as a product concept. | Approved | Exam-preparation behavior becomes Quiz configuration instead of a parallel domain. |
| DOM-008 | Product domain | Guest-capable standalone assignments are called share-link assignments. | Approved | Describes user behavior more clearly than the legacy `direct assignment` name. |
| DOM-009 | Product domain | Quizzes exist only inside an authenticated tutoring workspace; standalone paid/public offers, marketplace/library access and guest Quiz attempts are retired. | Approved | Keeps Kanvise focused as a tutoring workspace and removes a parallel commerce/anonymous-access product. |
| DOM-010 | Product domain | The current Quiz baseline is simple objective/MCQ only; theory grading, adaptive/multi-subject exam modes and advanced exam-import behavior are deferred. | Approved | A narrower learning activity is easier to make reliable and consistent before adding assessment complexity. |
| ARC-001 | Architecture | Next.js owns presentation/session gates; Hono is the sole business API and privileged application-data runtime. | Approved | One authority avoids duplicated validation and access-control drift. |
| ARC-002 | Architecture | Public data is server-first; dashboard business data is client-fetched through the shared query layer after a server session gate. | Approved | Requires deliberate loading states but avoids token props and mixed cache models. |
| ARC-003 | Architecture | Supabase Auth proves identity and manages sessions; Kanvise membership and authorization remain application concerns. | Approved | Prevents identity-provider metadata from becoming the permanent domain model. |
| ARC-004 | Architecture | PostgreSQL owns durable state, R2 owns bytes, and PlugNMeet owns ephemeral media-room facts. | Approved | Explicit authority makes reconciliation and failure recovery testable. |
| ARC-005 | Architecture | Scheduler/worker is a distinct logical role; only one scheduler instance runs until cross-process coordination is implemented. | Approved | Preserves simple MVP deployment without pretending in-memory guards support horizontal scaling. |
| ARC-006 | Architecture | Durable asynchronous work cannot rely on in-memory timers or fire-and-forget promises. | Approved | Adds persistence overhead where loss or restart matters. |
| SEC-001 | Auth and tenancy | Supabase Auth proves identity; Hono resolves current Kanvise authorization from PostgreSQL. | Approved | One canonical read per protected request buys immediate removal and avoids stale JWT authority. |
| SEC-002 | Auth and tenancy | Verify asymmetric JWTs locally with bounded, refreshable JWKS caching and full standard-claim validation. | Approved | Avoids an Auth network call per request while remaining compatible with key rotation. |
| SEC-003 | Auth and tenancy | Roles belong to tutoring-account memberships; one person may have different roles in multiple accounts. | Approved | Requires schema/auth migration but directly supports the near-term multi-account requirement. |
| SEC-004 | Auth and tenancy | The client selects active account context, but Hono verifies membership; persisted selection is preference only and subdomains are unnecessary. | Approved | Simple switching without treating routing or storage as security. |
| SEC-005 | Auth and tenancy | Authorization is uncached by default; future caches require evidence, invalidation, metrics, and at most 60 seconds of staleness. | Approved | Favors correct revocation until performance data justifies complexity. |
| SEC-006 | Auth and tenancy | Every route declares a fail-closed access policy and protected routes use the standard JWT → person → membership → capability → validation → resource sequence. | Approved | Some onboarding/public routes need explicit alternative policies. |
| SEC-007 | Auth and tenancy | Invitations and anonymous links use hashed, scoped, expiring/revocable tokens with atomic consumption where applicable. | Approved | Small persistence cost prevents bearer-token leakage and replay. |
| DB-001 | Database | Retain append-only imperative SQL migrations as the canonical schema history. | Approved | Avoids a risky conversion of 77 deployed migrations; requires stronger rebuild and drift checks. |
| DB-002 | Database | Applied migrations are immutable; corrections and reversals are new forward migrations. | Approved | History stays reproducible at the cost of retaining historical complexity. |
| DB-003 | Database | Stable invariants use database constraints and account-scoped relationships prevent cross-tenant references. | Approved | Additional composite keys/indexes buy durable isolation beyond query filters. |
| DB-004 | Database | Use expand–migrate–contract for incompatible changes and assess locks/backfills before deployment. | Approved | Slower rollouts avoid blocking writes and code/schema incompatibility. |
| DB-005 | Database | Browser roles have no application-data privileges by default; exposed tables retain RLS while Hono uses the privileged server boundary. | Approved | Centralizes access but requires strict Hono authorization because service role bypasses RLS. |
| DB-006 | Database | Database functions are invoker by default; definer functions require empty search paths and explicit least-privilege grants. | Approved | More verbose SQL prevents privilege-escalation surfaces. |
| DB-007 | Database | Development fixtures do not belong in production migrations; production data changes are narrow, idempotent, and verified. | Approved | Separating fixtures adds setup work but prevents fake data in real environments. |
| DB-008 | Database | CI rebuilds migrations from zero, tests database security/integrity, reviews advisors, and rejects generated-type drift. | Approved | Increases CI time in exchange for deploy confidence and usable types. |
| API-001 | Backend/API | Hono remains the authoritative business API; complex workflows leave thin route handlers for capability modules/use cases. | Approved | Avoids duplicated Next.js logic and giant routers without imposing a ceremonial repository layer. |
| API-002 | Backend/API | Preserve and complete the compatible success/error envelopes rather than replacing them wholesale. | Approved | Enables incremental migration while stable codes, request IDs, and safe details fix present inconsistency. |
| API-003 | Backend/API | Validate all HTTP boundaries with shared Zod-compatible runtime schemas and validate sensitive/public output contracts. | Approved | Adds schema maintenance but removes unchecked JSON and enables OpenAPI generation. |
| API-004 | Backend/API | Protected routes use one centrally composed policy pipeline and named capabilities rather than ad hoc router middleware/role arrays. | Approved | Central enforcement prevents mount-order and omission bugs; explicit exceptions remain necessary. |
| API-005 | Backend/API | Typed application errors and one top-level mapper own client errors; raw exception/database/provider messages never reach callers. | Approved | Migration work replaces repetitive catches and makes failures predictable and safe. |
| API-006 | Backend/API | Every account-scoped resource query derives and reapplies verified account context; hidden cross-account resources return 404. | Approved | Repeated scope predicates are intentional defense in depth. |
| API-007 | Backend/API | Retry-sensitive mutations, jobs, and webhooks are idempotent and multi-write invariants are atomic. | Approved | Durable keys/transactions add complexity but prevent duplicate or partial effects. |
| API-008 | Backend/API | API schemas become the executable contract and generate/validate OpenAPI; handwritten endpoint inventories are not authoritative. | Approved | Initial tooling effort prevents perpetual code/document drift. |
| FE-001 | Frontend | Public/SEO data is server-first; authenticated dashboard business data uses client-side TanStack Query after a server session gate. | Approved | Predictable dashboard caching costs one client fetch, mitigated by layout-preserving loading states. |
| FE-002 | Frontend | One typed client based on `authenticatedApiFetch` owns tokens, refresh, envelopes, safe errors, and cancellation. | Approved | Centralization removes repeated session reads and Authorization construction. |
| FE-003 | Frontend | State ownership is explicit: query cache for server data, URL for shareable navigation, local state for interaction, versioned storage only for safe preferences/drafts. | Approved | Requires deliberate modeling but prevents competing sources of truth. |
| FE-004 | Frontend | Feature-owned account-scoped query keys/options and `useMutation` govern dashboard reads and writes. | Approved | Some setup per feature buys deduplication, targeted invalidation, and safe account switching. |
| FE-005 | Frontend | Application data is not fetched in effects or mirrored into component state. | Approved | External-system effects remain valid; existing fetch effects migrate incrementally. |
| FE-006 | Frontend | Route and feature views explicitly handle first load, refresh, empty, retryable error, session expiry, and mutation states. | Approved | More state design prevents blank, spinner-only, or dead-end failure screens. |
| FE-007 | Frontend | Capability-based modules colocate API/schema/query/UI/tests; route files compose and oversized multi-workflow clients are decomposed. | Approved | Avoids both giant components and premature generic abstractions. |
| FE-008 | Frontend | Independent cached resources may fetch in parallel; coherent read models use an aggregate API instead of hidden component `Promise.all` bundles. | Approved | Balances latency against cache granularity and backend consistency. |
| UI-001 | UI/design | One semantic token and accessible primitive system governs Admin, Tutor, and Learner product surfaces. | Approved | Persona navigation can differ, but shared controls/states must not. |
| UI-002 | UI/design | The newer Class workspace is the interaction-structure reference, not a literal source for raw styling or component architecture. | Approved | Preserves its stronger task model without copying its drift and oversized implementation. |
| UI-003 | UI/design | Dashboard page/entity titles use foreground text; indigo is reserved for actions, selection, links, and intentional hero variants. | Approved | Removes arbitrary black-versus-blue headers while retaining purposeful brand moments. |
| UI-004 | UI/design | Components consume semantic tokens; raw visual values are confined to token definitions. | Approved | Upfront token migration prevents thousands of one-off colour/radius/shadow decisions. |
| UI-005 | UI/design | Shared Page/Workspace headers, controls, overlays, feedback states, data views, and navigation expose named variants. | Approved | Primitive ownership reduces repeated markup and ensures state/accessibility fixes propagate. |
| UI-006 | UI/design | WCAG 2.2 AA, keyboard/focus behavior, reflow, reduced motion, and accessible status feedback are definition-of-done requirements. | Approved | Adds verification time but prevents exclusion and costly retrofits. |
| UI-007 | UI/design | The dashboard shell owns page gutters and responsive primitives own their mobile transformation. | Approved | Stops doubled padding, hidden critical data, and page-specific breakpoint behavior. |
| UI-008 | UI/design | Material UI changes require component, accessibility, state, and multi-viewport visual verification. | Approved | Baselines require maintenance but catch the small inconsistencies this programme targets. |
| INT-001 | Integrations | Every provider is isolated behind one typed, timed, observable, redacting adapter with deliberate retry/idempotency policy. | Approved | Adapter work prevents provider payloads and failure behavior leaking throughout features. |
| INT-002 | Integrations | Effect-bearing webhooks persist a verified deduplicated inbox event before acknowledgement and process it idempotently. | Approved | Adds a worker hop but survives provider retries, process loss, and poison events. |
| INT-003 | Async work | Select PostgreSQL-backed jobs/outbox as the default durable queue, with one scheduler/worker initially. | Approved | Product owner approved ADR 0006 on 2026-11-03; implementation still requires leases, retries, idempotency, and separate verification. |
| INT-004 | Async work | Jobs use atomic leases, bounded batches/retries/backoff, dead-letter state, correlation, and idempotent handlers. | Approved | More state than cron flags buys recoverability and operator control. |
| INT-005 | Storage | Public/private R2 buckets and credentials are separate per environment; private access is short-lived and authorized. | Approved | More resources/configuration prevent accidental public or cross-environment exposure. |
| INT-006 | Storage | Uploads use durable intents, server confirmation/content checks, risk-based quarantine, explicit lifecycle state, and orphan cleanup. | Approved | Extra lifecycle steps prevent unregistered, spoofed, unsafe, and permanently orphaned objects. |
| INT-007 | Notifications | One durable notification intent fans out to independently idempotent in-app/email/push delivery records. | Approved | Partial channel failure remains retryable without duplicating successful delivery. Telegram is retired. |
| INT-008 | Integrations | Payments and other high-consequence provider effects converge through one server-verified atomic/idempotent use case and reconciliation path. | Approved | Duplicate observations are expected; access is granted exactly once at Kanvise's boundary. |
| TEST-001 | Testing | Use layered unit/component, API integration, database, browser, real-provider staging, visual/accessibility, and production-smoke evidence. | Approved | More infrastructure places proof at the boundary where each failure can occur. |
| TEST-002 | Testing | Tests are isolated/deterministic, use observable waits, and create run-scoped data with exact-ID guarded cleanup. | Approved | Factory/cleanup work prevents order dependence and dirty shared environments. |
| TEST-003 | Testing | Security, tenancy, payments, tokens, storage, webhooks, jobs, destructive actions, and migrations require explicit negative/concurrency branches regardless of coverage percentage. | Approved | Risk coverage matters more than an attractive aggregate number. |
| TEST-004 | Testing | Collect coverage, establish the real baseline, then ratchet overall and changed-code coverage without arbitrary initial thresholds. | Approved | Avoids gaming an invented target while still preventing regression. |
| TEST-005 | Testing | Database behavior is proven against a clean migration-built local database; mocked Supabase chains are not database evidence. | Approved | Slower integration setup catches schema/grant/concurrency defects mocks cannot. |
| TEST-006 | Testing | Production promotion requires real-provider certification of the exact staged web/API SHA and a complete evidence/cleanup manifest. | Approved | Longer release feedback prevents certifying different code or fake integrations. |
| TEST-007 | Testing | A pass only on retry is flaky and cannot certify; flakes need ownership, evidence, expiry, and explicit temporary risk coverage. | Approved | Reduces false confidence and rerun-until-green behavior. |
| TEST-008 | Testing | One root PR verification gate covers lint, types, tests, builds, database, contracts, boundaries, generated artifacts, and affected UI/journeys. | Approved | A longer but predictable command replaces partial local/CI interpretations. |
| REL-001 | Reliability | Instrument initial availability/latency/job and Core Web Vital SLOs, then govern reliability through error budgets. | Approved | Targets expose user impact; baseline validation prevents pretending unmeasured systems comply. |
| REL-002 | Observability | Correlate structured redacted logs, RED/domain metrics, W3C traces, jobs/providers, and Sentry by request and release SHA. | Approved | Telemetry cost buys diagnosis across web, API, database, worker, and provider boundaries. |
| REL-003 | Operations | Separate liveness, readiness, deployment identity, and protected diagnostics; drain requests/jobs on shutdown. | Approved | More endpoints/lifecycle logic prevent false health and abrupt work loss. |
| REL-004 | Alerting | Page on actionable user-impact/error-budget/security/data symptoms with owned runbooks; route low-impact events to tickets. | Approved | Reduces alert fatigue while covering silent high-consequence failures. |
| PERF-001 | Web performance | Judge LCP/INP/CLS from real-user p75 mobile/desktop data; use Lighthouse/traces and bundle budgets as regression tools. | Approved | Lab tests remain useful without being misrepresented as field experience. |
| PERF-002 | Performance | Establish route/bundle/query/job/capacity baselines and ratchet budgets; optimize from evidence rather than folklore. | Approved | Measurement work avoids speculative caches/indexes and quantifies tradeoffs. |
| PERF-003 | Caching | Every cache declares tenant-aware key, owner, TTL, invalidation, maximum staleness, stampede control, and metrics. | Approved | More design effort prevents stale access and cross-account data reuse. |
| PERF-004 | Capacity | Bound pagination, parallelism, queues, provider calls, database connections, uploads, and expensive work before scaling processes. | Approved | Explicit backpressure favors graceful degradation over cascading failure. |
| REPO-001 | Git | Protected short-lived-branch PRs enter staging; the exact certified staging SHA is promoted to protected main without rewrite. | Approved | Release history is less cosmetically linear after certification but evidence matches deployed source. |
| REPO-002 | Git | Commits use coherent Conventional Commit form and PRs carry test, UI, schema, security, operations, and rollback evidence proportional to risk. | Approved | More explicit review context reduces archaeology and hidden cross-cutting impact. |
| REPO-003 | Worktrees | Record the initial status, preserve unrelated changes, create only scoped diffs, remove own artifacts, verify, and report final status exactly. | Approved | Intentional changes may remain uncommitted only as an explicit handoff, never unexplained dirt. |
| REPO-004 | Repository | Build/cache/test/deployment artifacts, downloaded tools, backups, OS metadata, scratch files, and duplicated large media do not belong in Git. | Approved | External installation/storage adds setup but keeps clones, reviews, and history safe. |
| REPO-005 | Generation | Committed generated contracts have one deterministic command and CI drift gate; ordinary output remains ignored. | Approved | Regeneration discipline prevents both stale contracts and noisy artifacts. |
| REPO-006 | Dependencies | npm workspaces use one root lockfile, one declared Node/npm toolchain, and `npm ci` in CI. | Approved | Central resolution prevents workspace/CI graph divergence. |
| REPO-007 | Dependencies | Add/update dependencies through evidence, automated bounded updates, security/license policy, and full affected gates. | Approved | Review overhead controls supply-chain, bundle, and maintenance cost. |
| REPO-008 | Governance | Current root/workspace docs, CODEOWNERS, contribution/security policies, templates, and document status prevent competing instructions. | Approved | Small repository-policy maintenance makes ownership and safe contribution explicit. |
| OPS-001 | Environments | Distinguish disposable local, untrusted PR preview, persistent isolated staging, and protected production environments. | Approved | More resources and configuration eliminate dangerous preview/staging ambiguity and cross-environment effects. |
| OPS-002 | Releases | Build once and promote exact-SHA immutable web/API artifacts with recorded web, API, schema, and configuration identity. | Approved | Artifact/release management adds work but makes certification and rollback truthful. |
| OPS-003 | API deployment | Use versioned API releases, an atomic current pointer, explicit systemd roles, readiness, and external release verification. | Approved | Replaces simple in-place installs with deterministic deploy and rollback behavior. |
| OPS-004 | Migrations | Deploy compatible expand–migrate–contract schema changes independently; destructive operations require a reviewed measured runbook. | Approved | Multi-phase delivery is slower but avoids irreversible automatic damage and code/schema races. |
| OPS-005 | Configuration | Typed startup validation and a reviewed environment/secret inventory govern configuration; dashboard/server drift is prohibited. | Approved | Inventory and rotation overhead prevent unknown runtime state and secret reuse. |
| OPS-006 | Recovery | PostgreSQL, R2, configuration, and release artifacts have owned RPO/RTO, retention, and isolated restore drills. | Approved | Backup cost and quarterly drills turn provider promises into usable recovery. |
| OPS-007 | Topology | Stable service boundaries are architectural; provider/host/process details are verified current inventory facts. | Approved | Avoids rewriting architecture around stale vendor assumptions while preserving operational specificity. |
| OPS-008 | Operations | Production access, changes, post-deploy verification, runbooks, capacity, and incident drills are least-privilege, attributable, and evidence-backed. | Approved | Operational ceremony scales with risk and reduces silent/manual failure. |
| ENF-001 | Authority | Approved standards and ADRs outrank unclassified feature docs and implementation drift; conflicts enter the deviation register. | Approved | Explicit authority prevents old `Approved` labels and current bugs from becoming policy. |
| ENF-002 | Deviations | Track stable deviation IDs through ownership, status, remediation evidence, and closure; never delete history to imply conformance. | Approved | Register maintenance provides an auditable debt and risk trail. |
| ENF-003 | Waivers | Exceptions are narrow, owned, compensated, approved, and expiring; critical isolation/auth/secret/evidence violations are not waivable. | Approved | Temporary delivery flexibility cannot become silent permanent policy. |
| ENF-004 | Gates | Introduce controls as documented, warn, ratchet, then required with deterministic local commands and named owners. | Approved | Baseline debt can migrate without allowing new drift or normalizing bypasses. |
| ENF-005 | Adoption | Execute foundations, security/data authority, application contract, UI/domain convergence, durable effects, then launch/recovery proof. | Approved | Dependency order avoids rebuilding UI/API work after tenancy and contract changes. |
| ENF-006 | Change evidence | PR and release evidence is proportional to risk and explicitly covers standards, deviations, security, states, compatibility, operations, verification, and worktree scope. | Approved | More review evidence for risky work reduces hidden cross-cutting failures. |

## Remaining slices

| Order | Slice | Status |
|---:|---|---|
| 1 | Product domain and terminology | Approved |
| 2 | System architecture and ownership boundaries | Approved |
| 3 | Authentication, authorization, and tenancy | Approved |
| 4 | Database and migrations | Approved |
| 5 | Backend/API conventions | Approved |
| 6 | Frontend conventions | Approved |
| 7 | UI, design system, and accessibility | Approved |
| 8 | Integrations, storage, and asynchronous work | Approved |
| 9 | Testing and quality gates | Approved |
| 10 | Reliability, observability, and performance | Approved |
| 11 | Git, repository, and dependency hygiene | Approved |
| 12 | Deployment and operations | Approved |
| 13 | Final consolidation and enforcement | Approved |
