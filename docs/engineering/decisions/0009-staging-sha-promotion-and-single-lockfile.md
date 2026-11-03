# ADR 0009: Promote exact staging SHAs and use one workspace lockfile

**Status:** Accepted
**Date:** 2026-10-30
**Owner:** Kanvise engineering

## Context

Production certification is intended to prove one staged web/API commit, but the
repository history contains repeated branch merges and the current repo has both
root and API lockfiles. Promoting rewritten source invalidates staging evidence;
multiple locks permit local/CI dependency graphs to diverge.

## Decision

Use protected `staging` as the release-candidate integration branch and promote
the exact certified commit to protected `main` without rewriting it. Use npm
workspaces and the root `package-lock.json` as the only lockfile. Hotfixes land on
production through review/gates and reconcile immediately back to staging.

## Alternatives considered

- Squash/cherry-pick staging work into main. This produces clean history but a
  different SHA/source graph from the artifact that certification proved.
- Deploy independently from feature branches. This increases parallelism but
  removes one auditable release candidate.
- Keep a lockfile per workspace. npm workspaces already resolve from the root;
  nested locks confuse commands and update ownership.

## Consequences and rollout

Feature PRs may still squash into staging before certification. After certification,
promotion preserves the commit. Branch protection and deployment identity enforce
the rule. Reconcile/remove the nested lock through a dedicated dependency change,
add the root toolchain metadata, and make CI fail when another workspace lock or
post-verification dirt appears.
