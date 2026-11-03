# ADR 0010: Use immutable releases and tested recovery

**Status:** Accepted
**Owner:** Kanvise engineering
**Date:** 2026-10-30
**Last verified:** 2026-10-30

## Context

Kanvise certifies exact commits, but the API deployment still updates a mutable
server checkout, installs dependencies in place, replaces `dist`, and retains
only one previous build. Operational documents disagree about Scaleway versus
Oracle, PM2 versus systemd, and LiveKit versus PlugNMeet. Backup statements are
mostly provider promises without repository-owned restore evidence.

## Decision

Build each web/API release once and identify it by commit SHA. Promote the exact
staging-certified source and immutable artifact to production. API deployment
uses versioned release directories plus an atomic current pointer, an explicit
systemd service, bounded readiness and external release-identity verification.
Retain known-good releases and record web/API/schema/config identities together.

Treat provider/host details as verified inventory facts rather than permanent
architecture. Apply compatible migrations independently through
expand–migrate–contract. Recovery objectives are enforceable only after isolated
restore drills demonstrate them; ordinary rollback uses compatible immutable
artifacts or a forward database fix.

## Alternatives considered

- **Continue pulling and installing on the live checkout:** simple, but mutable
  branch state, dependency installation, source, and compiled output can diverge.
- **Container/Kubernetes migration now:** could provide immutable artifacts but
  adds operating complexity not justified by the current single-service scale.
- **Vendor-specific architecture documents:** easy initially, but become false
  whenever hosting changes and obscure the real ownership boundaries.

## Consequences

Release storage, artifact retention, deployment scripting, configuration
inventory, and restore drills add work. In return, deployed identity is
reproducible, rollback is deterministic, host replacement is testable, and a
vendor change no longer rewrites the architecture.

## Compatibility and rollout

Keep the current workflow operational while introducing versioned release paths
and service definitions. First inventory and verify each environment, then prove
staging deploy/rollback and restore, and only then change production. Existing
provider-specific documents are historical evidence until classified.
