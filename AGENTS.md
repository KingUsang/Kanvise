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

## Branch, worktree, and release workflow

1. Start every feature, fix, hotfix, refactor, or diagnostic change from the
   latest `origin/staging`.
2. Give each task its own Git branch and separate worktree. Do not continue
   unrelated work on an existing feature branch, and do not merge `main` into
   an unrelated branch just to make it current. Before changing code, check the
   current branch and worktree; preserve existing work and switch to the task's
   proper branch and worktree when necessary.
3. Commit and push the task branch when its implementation and checks pass.
4. Review the feature branch and merge it into `staging`.
5. Deploy both the Vercel frontend and API from `staging`.
6. Test the actual staging environment, not only local builds or unit tests.
7. After the release is approved, open a `staging` to `main` pull request.
8. Production deployments must come only from `main`.
