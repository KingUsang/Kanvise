# Handoff: where things stand (27 Nov 2026)

For continuing this work in a new chat. Read this first, then `00-decisions.md`.

## Repositories and branches

- Repo: `KingUsang/Kanvise`. All work goes **branch → PR into `staging` → merge
  after CI passes**. Never merge into `main`; the owner promotes `staging` to
  `main`.
- `staging`: healthy, has all fix rounds (slices 1–7, rounds 8–10). Staging API:
  `https://staging-api.kanvise.com/health`.
- `design/redesign-spec`: the redesign specs (this folder). Not a code branch;
  no PR yet.
- `research/bobbin-appatlas`: the owner's Bobbin competitor atlas
  (`scratch/bobbin-appatlas/`: spec.md per section, screens.json, ~250
  screenshots). Branched from an old commit; never merge it, only read it.
- Open PR **#77** (`fix/agency-copy`): wording fix ("tutoring agency", "your
  tutor"). Was stuck waiting for GitHub Actions to start; check and merge once
  CI is green.
- Open PR #68 (`posthog/wizard-…`): opened by the PostHog wizard, not by us.
  Untouched.

## Fix work (deviation register)

- Register: `docs/deviations.md` on `staging` (~708 rows). About 182 resolved,
  526 open: ~221 belong to screens the redesign replaces, ~240 backend /
  security / data / docs / tests, ~55 payments, deployment, performance (on hold
  or deferred).
- Plan and history: `/projects/sandbox/Kanvise-fix-plan.md` and
  `/projects/sandbox/step0-report.md` in the sandbox (not in the repo).

## Redesign specs (this folder)

`00-decisions.md` (agreed decisions, wins on conflicts), `01`–`16` (screens and
journeys, every state has an ID), `14-old-flows-inventory.md` (every old page
and feature and what happens to it), `README.md` (index).

## Next steps

1. Run an independent critic review of all specs against the Bobbin atlas,
   `docs/engineering/standards/` and the PlugNMeet reference, then fix what it
   finds (the consistency pass). A first attempt was interrupted.
2. Owner reviews the specs.
3. Build, page by page on staging, starting with the design system and app
   shell, then the dashboard, courses and lessons. Each page PR updates the
   deviation rows for its area and includes screenshots at 360, 768 and 1280px.
4. Backend fix rounds continue in parallel.

## Still open with the owner

- Old slides presenter: keep it, or use only PlugNMeet's whiteboard (specs
  assume the whiteboard)?
- Student self-confidence rating: assumed skipped for now.
- The smaller defaults list (upload limits, unsubscribe link, email timezone,
  invite limit, removing `school_id` claim): owner said "that works"; treat as
  accepted unless told otherwise.
- Kavi icon and login/sign-up screens: deferred, not blockers.
- Payments revamp: on hold; spec 13 is only a proposal.

## Working notes

- No Docker in the sandbox: database checks run only in CI (`verify.yml`).
  Parse SQL locally with libpg-query in a scratch folder under
  `/projects/sandbox` (`/tmp` doesn't persist between tool calls).
- Staging test logins: seeded accounts in `seed.js` (password in
  `SEED_PASSWORD`), for example `chidi.okafor@seed.kanvise.test` (admin),
  `amaka.eze@seed.kanvise.test` (tutor), `ngozi.umeh@seed.kanvise.test`
  (student). Playwright with Chromium in `/projects/sandbox/.pw` can screenshot
  staging (`shoot.mjs`).
- The owner wants plain, human wording, real research (not generic sources),
  and checks against Bobbin before inventing behaviour.
