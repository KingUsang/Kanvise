# Enforcement and adoption

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard makes the preceding standards operational. It defines authority,
change control, deviation ownership, waivers, review evidence, enforcement
stages, and the sequence for bringing the implementation into conformance.

## Authority order

For engineering decisions, use this order:

1. approved standards and accepted ADRs under `docs/engineering/`;
2. current feature contracts explicitly linked from the document authority map;
3. executable contracts: migrations, runtime schemas, generated API/database
   types, and tests;
4. implementation behavior; and
5. historical, audit, progress, incident, plan, or unclassified documents as
   evidence only.

Higher authority does not make contradictory implementation safe. Record the
conflict in `docs/deviations.md`, preserve compatibility deliberately, and plan
the migration. Product requirements can change a standard through the decision
process; code drift cannot silently change one.

## Standard and ADR changes

Standards state durable cross-cutting rules. ADRs capture consequential choices
and alternatives. Feature docs describe a workflow within those boundaries.
Runbooks describe operating procedures and never redefine product/security
policy.

A standards change includes motivation, affected standards/ADRs/deviations,
alternatives, security/tenant/data/compatibility impact, rollout, enforcement,
and owner approval. Update all affected indexes and links in the same change.
Do not edit an accepted ADR to disguise a reversed decision: supersede it with a
new ADR and reciprocal links. Review standards at least quarterly and after a
material incident, topology change, or product-domain decision.

Major architecture decisions require the product owner's explicit confirmation;
silence, general permission to continue, or approval of a surrounding slice is
not confirmation. This includes changing system/data ownership, adding or
replacing durable infrastructure, authentication/tenancy models, database
architecture, public API compatibility strategy, deployment topology, and
providers with meaningful lock-in or recurring cost. Keep the named decision
`Proposed` with alternatives and practical consequences until confirmed.

## Deviation lifecycle

Every known conflict uses a stable `DEV-<AREA>-NNN` ID and records standard,
observed evidence, concrete risk, status, owner, and target milestone before
remediation begins. The current compact register may omit owner/date until the
first triage; unowned entries cannot remain scheduled for implementation.

Statuses are `Untriaged`, `Accepted temporarily`, `Planned`, `In progress`,
`Blocked`, and `Resolved`. Resolving an entry requires a code/doc reference and
verification evidence; deleting the row is prohibited. If investigation proves
there was no conflict, close it with the evidence rather than erasing history.

A new change must not increase a known deviation. When touching deviating code,
either conform it, avoid enlarging the conflict, or receive a bounded waiver.
Security, tenant isolation, irreversible data-loss, secret exposure, and
production-recovery gaps block release unless the accountable owner explicitly
accepts the time-bounded risk.

## Waivers

A waiver is exceptional, narrow, and temporary. It records deviation ID, exact
scope, reason conformance is currently worse, risk and affected users/data,
compensating controls, evidence/monitoring, accountable owner, approver, expiry,
and removal issue. It never exempts unrelated work or silently renews itself.

Expired waivers fail the relevant gate. No waiver may authorize cross-tenant
access, unverified authentication, knowingly exposed secrets, fabrication of
test/release evidence, or an irreversible production action without a tested
recovery plan.

## Change evidence

Every pull request names the affected standards and deviations. Evidence scales
with risk but the author always reports tests actually run and checks:

- product terminology and workflow compatibility;
- authorization, account scope, sensitive data, and abuse cases;
- API/schema/migration/backfill compatibility;
- loading, empty, error, retry, accessibility, responsive, and visual UI states;
- idempotency, provider failure, job recovery, and storage lifecycle;
- performance/telemetry/alert/runbook impact;
- release, configuration, rollback, and cleanup impact; and
- final diff/status against the recorded worktree baseline.

Reviewers verify the evidence rather than accepting a checked box. Generated
screenshots, reports, plans, mocks, or successful retries do not substitute for
the required boundary proof.

## Enforcement levels

Controls progress through four explicit levels:

1. **Documented:** the rule, deviation, owner, and intended gate are known.
2. **Warn:** automation reports existing and new violations without blocking
   while a measured baseline and false-positive fixes are completed.
3. **Ratchet:** existing debt is baselined; any new violation or regression
   blocks, and touched code is expected to improve.
4. **Required:** the repository and changed scope must fully comply; a bounded
   approved waiver is the only bypass.

Never enable a noisy gate and normalize bypassing it. A gate has a named owner,
deterministic local command, actionable output, runtime target, failure policy,
and documented remediation. Emergency bypasses are logged, expire, and create
follow-up review.

## Mandatory merge and release controls

Protected-branch merge requires the root verification contract defined by the
testing and repository standards, plus CODEOWNERS review for high-risk areas.
CI rejects newly introduced secrets, forbidden artifacts, stale generated
contracts, migration collisions, architecture-boundary violations, broken local
doc links, and unexplained worktree output. Coverage, accessibility, performance,
raw-token/style, and direct-fetch rules begin as measured ratchets before full
enforcement.

Production additionally requires the exact-SHA staging certification, protected
approval, compatible migration evidence, release manifest, rollback/forward
plan, readiness and release-identity checks, and proportional post-deploy smoke
evidence. Remote database or infrastructure mutation is never inferred from an
implementation request; it requires explicit production authority.

## Adoption rules

Follow `docs/engineering/ADOPTION_PLAN.md`. It orders foundations before broad
feature cleanup so later work uses one membership model, contract, query layer,
design system, durable job model, and release mechanism. Work in vertical slices
that leave a usable product and close registered deviations with tests.

Do not perform repository-wide renames, formatting, component rewrites, or
schema replacement as one cleanup. Provide compatibility adapters, backfills,
telemetry, and removal criteria; remove old paths only after callers/data are
proved migrated. Re-baseline counts only through reviewed evidence, never to
make a gate green.

## Ownership and reporting

Each standards area and adoption initiative has one directly responsible owner
even when several people contribute. The engineering owner maintains the ledger,
authority map, deviations, adoption state, and quarterly review. Security and
operations risks have explicit accountable approvers.

A concise standards report shows: deviations opened/closed/overdue by area;
waivers and expiry; gate level; failing/flaky checks; SLO/error-budget health;
restore/deployment drill dates; dependency/security exposure; and the next
adoption milestone. Counts are navigation, not success: verified risk reduction
and deletion of duplicate paths are the outcome.
