# Kanvise engineering rule

Before proposing or changing product behaviour, routes, dashboard UI, database
schema, authentication, tenancy, or deployment, read the relevant architectural
documents in `docs/` first. Treat them as the source of truth over assumptions
or generic framework conventions.

At a minimum, consult:

- `docs/02_KANVISE_System_Architecture_Overview.md` for system boundaries and
  data ownership.
- `docs/01_KANVISE_Technical_Stack_Decision.md` for rendering and client-data
  conventions.
- The feature-specific document in `docs/` before changing an established
  workflow.

When the implementation and the documents conflict, identify the conflict
explicitly before extending the implementation. Do not make remote database or
deployment changes based on an assumption.

## Branching rule

Every new feature, fix, hotfix, refactor, or diagnostic change must be
developed on a new Git branch created for that work. Do not continue unrelated
work on an existing feature branch, and do not merge `main` into an unrelated
branch just to make the branch current. Before changing code, check the current
branch and worktree; if the work belongs elsewhere, preserve the existing work
and create or switch to the appropriate branch first.
