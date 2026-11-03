# Git, repository, and dependency hygiene

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard governs branches, commits, pull requests, worktrees, generated and
binary files, secrets, dependencies, documentation status, and automated-agent
behavior in the Kanvise repository.

## Branch and promotion model

`main` is production and protected. `staging` is the integration/release-candidate
branch and protected. Work happens on short-lived branches from the intended
base, enters `staging` by reviewed pull request, and the exact staging-certified
commit is promoted to `main` without rebasing, squashing, cherry-picking, or
rebuilding different source.

Keep branches focused and short-lived. Synchronize with the target branch before
review rather than merging production/integration branches repeatedly into a
feature history. Emergency production fixes use a reviewed hotfix branch, pass
the proportional gates, land on `main`, and are immediately reconciled back into
`staging` without divergent hand edits.

Direct pushes to protected branches, force pushes, history rewrites, and bypassing
required checks/review are prohibited. Release/deployment automation uses commit
SHAs, not mutable branch state alone.

## Commits and pull requests

Commits are coherent, reviewable, buildable where practical, and use Conventional
Commit form (`type(scope): imperative summary`) for `feat`, `fix`, `refactor`,
`test`, `docs`, `build`, `ci`, `chore`, `perf`, `security`, and `revert`. Do not
mix drive-by formatting, generated churn, unrelated cleanup, or several product
decisions into one commit. Commit messages explain why when the diff cannot.

Never commit secrets, real user data, production exports, credentials, presigned
URLs, Auth sessions, provider payloads containing sensitive data, or unredacted
incident evidence. Author identity and signing follow the repository/GitHub
policy once configured; automation identifies itself.

A pull request states purpose and user impact, linked issue/decision/deviation,
key tradeoffs, tests actually run, screenshots/accessibility evidence for UI,
API/schema compatibility, migration/rollback/backfill impact, security/tenant
impact, operations/observability impact, and follow-up work. Generated files and
lockfile changes are explained. Review resolves conversations before merge.

CODEOWNERS requires appropriate review for auth/security, migrations, CI/deploy,
payments, storage/webhooks, shared architecture/standards, and dependency policy.
The author does not self-approve high-risk changes.

## Worktree discipline

Before any task—human or automated—run `git status --short`, identify the current
branch, and record pre-existing changes. Existing modifications belong to their
author. Do not overwrite, revert, stage, format, rename, delete, or include them
unless the task explicitly owns them.

An intentional requested edit makes a diff; “do not dirty the worktree” means:

- no generated caches, reports, downloaded artifacts, debug output, temporary
  scripts, editor files, or unrelated formatting are left behind;
- only scoped source/doc changes appear beyond the recorded baseline;
- temporary work uses an ignored task directory or `/tmp` and is cleaned by its
  creator;
- `git diff --check`, relevant gates, and final `git status --short` are run; and
- handoff identifies every intentional changed/untracked path plus any preserved
  pre-existing dirt.

Finish by committing/PRing when that workflow was explicitly requested, or hand
off the intentional diff clearly. Do not silently commit, stage, push, open a PR,
change a remote, or discard work merely to make status look clean.

Destructive Git/filesystem actions require exact read-only target resolution and
explicit authorization when the requested task did not already make them clear.
Never use broad reset/clean commands in a mixed worktree. Prefer `apply_patch`
and scoped formatters; inspect overlapping diffs before editing.

## Repository contents

Git contains source, migrations, tests, small required fixtures/assets,
configuration templates, current docs, lockfiles, and intentionally committed
generated contracts. It does not contain:

- dependency/build/cache directories;
- local deployment links or tool state;
- test results, traces, screenshots/videos, coverage, logs, or benchmark output
  unless a small reviewed fixture/baseline is the product of the change;
- downloaded executables/CLIs, database dumps, backups, or temporary exports;
- operating-system metadata, editor swap/backup files, or root-level scratch
  artifacts; or
- duplicated production media/source artifacts.

Required external executables are installed from a pinned version/checksum in
CI/deployment or supplied by a container/package—not checked in. Large product
media belongs in R2/CDN. Git LFS is an exception for an approved repository-owned
binary source asset, not a way to keep arbitrary outputs.

Ignore rules exist at the repository root unless a workspace-specific rule is
genuinely needed. A file becoming ignored does not remove an already tracked
file; cleanup is explicit and reviewed. CI fails on forbidden tracked paths,
oversized additions, secret patterns, case/path collisions, and dirty generated
output.

Directory/file names use lowercase kebab-case for docs/assets and the established
TypeScript convention for code. Do not keep parallel `_`/`-`, old/new, copy,
backup, or casing variants. A replacement removes or marks the prior artifact in
the same change after references are verified.

## Generated files and scripts

Each committed generated file has one documented deterministic root command,
source inputs, tool version, and CI drift check. Never hand-edit it. Database
types and API contracts are committed; build output, Next artifacts, coverage,
reports, and deployment metadata are ignored.

Root scripts are the public contributor interface. Provide one `verify` command
and focused commands for lint, type-check, unit/integration, database, E2E, build,
format/check, and generation. Scripts are non-interactive in CI, fail on errors,
do not modify remote state unless named as such, and have safety guards for
staging/production cleanup or migrations.

One-off investigation scripts live in `/tmp` unless they are maintained, tested,
documented tooling. Repository scripts state inputs, outputs, environment safety,
and cleanup; they do not embed giant generated datasets/binaries.

## Toolchain and dependencies

Kanvise uses npm workspaces with the root `package-lock.json` as the single
dependency lock. Add/update dependencies from the repository root and commit the
manifest and root lock together. Workspace lockfiles are prohibited. CI uses
`npm ci`.

Declare and pin the supported Node major/minor policy in root `engines`,
`packageManager`, and a developer version file; local, CI, staging, and production
use the same supported major. Root documentation must not advertise an older
runtime.

Before adding a dependency, document why platform/existing code is insufficient,
browser/server boundary, maintenance/security/license health, transitive and
bundle/installation cost, and removal path. Prefer one library per capability;
do not add aliases/duplicates to avoid migration work. Runtime dependencies live
in the workspace that imports them, not the monorepo root by convenience.

An automated dependency service opens bounded grouped updates. Lockfile changes
are reviewed; major/runtime/framework/security updates run the full affected
gate and consult release notes/migrations. Critical exploitable advisories receive
immediate triage; other updates have a regular cadence. Audit findings are
evaluated for reachability and environment, never blindly ignored or blindly
upgraded. Exceptions record package, advisory, scope, mitigation, owner, and
expiry.

Maintain a license allow/deny/review policy and software-bill-of-materials/
dependency inventory for releases. Remove unused dependencies and stale overrides
after verification. Package scripts/dependency installers are treated as code
execution and reviewed accordingly.

## Documentation and repository policy

The root README reflects current product language, topology, supported Node/npm,
setup, verification, and links to the engineering index. Workspace boilerplate
READMEs are removed or replaced. Current, superseded, historical, and draft docs
are visibly classified; duplicate numbered/case variants do not compete as
sources of truth.

Maintain `CONTRIBUTING.md`, `SECURITY.md` with private disclosure guidance,
CODEOWNERS, PR/issue templates, and the short root `AGENTS.md`. Architecture
decisions and deviations change with the implementation they govern.

## Verification

Repository CI checks clean deterministic generation, one lockfile, tool versions,
forbidden/large/binary paths, secrets, licenses/advisories, broken doc links,
duplicate migration/path names, formatting, and a clean post-build/test status.
The reviewer compares the final diff/status against the recorded baseline and
rejects unexplained artifacts or unrelated edits.
