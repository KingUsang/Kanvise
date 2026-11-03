# Deployment and operations

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard governs environments, release promotion, migrations, runtime
configuration, secrets, backups, recovery, rollback, infrastructure ownership,
and production operations.

## Environment model

Kanvise has four distinct environment classes:

- **Local** is disposable developer infrastructure and must not require or
  mutate shared production resources.
- **Pull-request preview** proves the web build and review UI. It is untrusted,
  short-lived, and receives no production secrets or privileged shared-provider
  access by default.
- **Staging** is the persistent production-like integration environment on the
  `staging` branch. It uses isolated database, storage, provider credentials,
  domains, queues, and test identities.
- **Production** serves real users from protected `main` releases.

GitHub's existing environment named `Preview` currently represents persistent
staging for API deployment. That name is a recorded deviation: configuration
and documentation must converge on `Staging` so a temporary PR preview cannot
be mistaken for the release-candidate environment.

Data, buckets, credentials, webhooks, callback URLs, provider resources, and
cleanup jobs are environment-scoped. Production data is never copied to a lower
environment unless an approved, auditable sanitisation process removes personal,
authentication, payment, and secret-bearing data.

## Current topology and inventory

The architectural boundary is stable even when a vendor changes: Vercel runs
Next.js; one persistent compute environment runs the Hono API and separately
owned scheduler/worker roles; Supabase owns Auth and PostgreSQL; Cloudflare R2
owns objects; PlugNMeet owns live-room media; its recorder capacity currently
uses AWS infrastructure.

Maintain a current, non-secret environment inventory containing service,
provider/account, region, domain, runtime/process owner, repository/workflow,
data class, dependencies, backup method, alert/runbook, and engineering owner.
Provider or host identity must be verified from its control plane or runtime,
not inferred from DNS, an old document, or a public health response.

Diagrams and runbooks that still describe Scaleway, PM2, self-hosted LiveKit,
or tutorial-centre capacity are historical until revalidated. A one-time
migration/exit plan is not the standing operations manual.

## Release contract

Build and test once, identify every artifact by immutable commit SHA, certify
that exact source and configuration class in staging, then promote without
source rewriting. Production requires protected-environment approval and the
risk-proportional gates in the testing standard. A release record contains web
SHA/deployment, API SHA/artifact, migration range, configuration version,
operator/approval, evidence links, start/end time, and outcome.

Deployments are serialized per service/environment. They fail closed when the
target checkout is dirty, identity/configuration is missing, migration or
certification evidence is absent, or the observed release SHA differs from the
requested SHA. Installation uses the root lockfile and declared toolchain.

API releases use immutable release directories or artifacts and an atomic
current-release switch. Do not `pull` mutable source and install a new dependency
graph in the live application directory as the release mechanism. Restart the
correct systemd unit, wait for bounded readiness, verify externally visible
release identity, and retain at least one known-good artifact for rollback.
Run the API, scheduler, and worker as unprivileged users with explicit service
units, resource limits, graceful shutdown, restart policy, and centralized logs.

Vercel deploys the exact intended web SHA. Automatic branch/preview deployment
does not itself certify production. Web and API compatibility spans rolling or
independently completed deploys; each release records both observed SHAs.

## Database deployment

All schema changes follow the database standard and expand–migrate–contract.
CI proves a clean rebuild and dry-runs the ordered production plan. Staging
applies the same migration files before certification; production applies only
after protected approval and verifies the remote history afterward.

A code release must work with the schema visible during every deployment phase.
Destructive contract migrations, large table rewrites, blocking indexes, and
backfills are separate reviewed operations with measured locks/runtime,
checkpoints, cancellation, and recovery. They never run automatically merely
because application code reached `main`. Database rollback normally means a
compatible forward fix or restoring to a new verified instance—not editing an
applied migration or blindly reversing data loss.

Before a high-risk data operation, verify a recent usable backup and its restore
procedure. A backup claim is not accepted until a periodic restore drill proves
the retained data, credentials, extensions, grants, and application startup.

## Configuration and secrets

Every service validates a typed environment schema at startup and fails before
readiness on missing, malformed, or mutually inconsistent configuration.
Maintain a safe `.env.example`/configuration inventory with purpose, owner,
secret classification, environments, rotation method, and consumers; never
record values in Git, logs, build output, test evidence, or client bundles.

Secrets live in the environment's approved secret manager or protected
deployment environment, are least-privilege and environment-specific, and are
delivered at runtime where possible. Long-lived shared credentials require an
owner, rotation schedule, audit trail, and overlap/revocation procedure. Rotate
immediately after exposure or staff/access change. `NEXT_PUBLIC_` values are
public configuration, never secrets.

Configuration changes are reviewed, attributable, tested in staging, included
in the release/change record, and reversible. Manual server `.env` edits and
dashboard-only settings without an inventory entry are configuration drift.

## Backup, recovery, and continuity

Classify state before launch or a new durable feature: PostgreSQL, private and
public R2 objects, provider configuration, deployment configuration, and source
artifacts each need an owner, backup/retention mechanism, encryption/access
rules, restore steps, and tested recovery objective. Ephemeral caches/builds are
recreated rather than backed up.

Until business impact analysis approves stricter values, the minimum objectives
are:

| State/service | Recovery point objective | Recovery time objective |
|---|---:|---:|
| PostgreSQL identity, membership, payments, teaching records | 24 hours | 4 hours |
| User-owned private R2 objects | 24 hours | 8 hours |
| Web/API code and configuration | immutable released source/config; no data loss | 1 hour |

These are objectives, not current compliance claims. Launch readiness requires
verified provider retention/PITR settings and successful restore drills. Payment
provider reconciliation and durable inbox/outbox records must repair effects
between a restored database point and provider truth. Missing R2 recovery is a
known launch risk, not an acceptable permanent policy.

Quarterly restore drills use an isolated target, measure actual RPO/RTO, prove
application readiness, record gaps, and do not overwrite production. Maintain
encrypted off-host copies for host/bootstrap configuration; an unencrypted copy
on the same host or developer machine is not a backup.

## Rollback and incident-safe changes

Each release has an explicit rollback/forward-fix decision before production:

- web/API-only failures return traffic to the last compatible immutable release;
- expand migrations stay in place while code rolls back;
- incompatible or destructive data changes use the rehearsed recovery/forward
  plan, never an improvised down migration;
- provider/config changes restore the prior version or disable the feature with
  a tested kill switch; and
- background jobs are paused/drained without losing leases or duplicating work.

Rollback success requires readiness, release-identity, critical-journey, queue,
and error-rate checks. Keep incident evidence; do not erase failed artifacts or
logs needed for diagnosis.

## Infrastructure and access

Desired infrastructure, DNS, service definitions, recorder/controller resources,
alerting, and backup policy move toward reviewed declarative configuration.
Until then, every manual resource has a reproducible runbook and inventory entry;
scripts are idempotent, versioned, guarded by explicit environment/identity, and
tested away from production.

Production access is individual, least-privilege, MFA-protected, time-bounded
where supported, and auditable. Shared root logins and permanent broad cloud
keys are prohibited. Emergency access is logged and reviewed. DNS, GitHub,
Vercel, Supabase, Cloudflare, compute, AWS, payment, email, and monitoring have
at least two recoverable administrators without sharing credentials.

Capacity, certificates/domains, quotas, billing, backups, and dependency/provider
expiry have proactive monitors. The current scheduler singleton is explicitly
configured in exactly one environment service until durable coordination permits
scale-out.

## Change and operational evidence

Routine low-risk changes follow the normal reviewed release. Database, auth,
tenancy, payment, storage, DNS, provider, infrastructure, backup, and security
changes include blast radius, compatibility, migration, observability, rollback,
and operator steps. High-risk production work has a second reviewer and a timed
change record; irreversible steps require explicit owner authorization.

After deployment, verify release identity, readiness, key SLIs, migration/job
state, provider callbacks, and the proportional smoke journey. Observe through
the defined window and link evidence. A green workflow without these checks is
transport success, not a proven release.

Runbooks are short, current, executable under pressure, and include symptoms,
safe diagnosis, authority/credentials, mitigation, verification, escalation,
communication, and follow-up. Drill restore, API-host loss, expired/rotated
credentials, provider outage, stuck jobs, and rollback at least quarterly or
after material topology change.
