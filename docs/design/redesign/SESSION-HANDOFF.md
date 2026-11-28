# Session handoff: start here in a new session

Written 28 Nov 2026 so a new AI session, with no memory of earlier chats and
possibly a fresh sandbox, can carry on. Only the GitHub repo is guaranteed to
survive. Anything under `/projects/sandbox/` outside the repo may be gone.

Read in this order: this file, then `HANDOFF.md` (state, owner decisions,
launch checks, full build order), then `00-decisions.md` (what was agreed; it
wins on conflicts). `README.md` lists every spec and the state ID prefixes.

## 1. What Kanvise is and who it's for

Kanvise is an online tutoring platform. It is for **independent tutors
first** (one-to-one or small groups) and **tutoring agencies second** (a team
of admins and tutors on the same product). It serves Nigeria and families
abroad (UK, North America). Every lesson happens online in the Kanvise
classroom; there is no in-person flow.

The product is being redesigned on the model of the competitor **Bobbin**
(made by the same company as TutorCruncher). The AI assistant is called
**Kavi**. Details: `00-decisions.md` sections 1 and 2.

## 2. How the owner works

- Good design and UX are non-negotiable.
- Check every implementation against the **real Bobbin screenshots**, not only
  the spec text. Follow what Bobbin actually does before inventing behaviour.
- Do real research. Generic sources don't count.
- Plain, human wording. No em dashes in docs (the spec checker rejects them).
- Design and build in sequence. Don't jump ahead to later steps.
- Every state is specified and built: empty, loading, error, offline.
- Animations and an interactive UI are wanted.
- Responsive for admins, tutors and students (`16-responsive.md`).
- Words: **Student** (not `learner`), **Lesson** (not `live class`),
  **Lesson summary** (not `report`), **Course plan**, **tutoring agency**.
  The phrase `tutoring account` is used only on the account switcher. The
  full list is in `00-decisions.md` section 13a.
- Topic statuses: **Knows it**, **Needs work**, **Taught**, **Next**.
- Brand: blue and indigo. Orange only for "you are here" (selected navigation,
  active tab). Indigo primary buttons, underline tabs, a light full-height
  sidebar (`00-decisions.md` section 11, `01-app-shell.md`).
- Phones get a bottom bar: Today, Calendar, Lessons, Students, More. More
  opens the sidebar as a sheet. No hamburger menu.
- The owner writes fast on a phone, with typos. Read generously and ask when
  something is unclear.
- Short, clear answers are preferred.
- Many decisions are delegated ("up to you"). Questions about money or scope
  always go to the owner.

## 3. Repo and workflow

- Repo: `KingUsang/Kanvise`. Every change goes branch, then PR into
  `staging`, then merge after CI passes. Never merge into `main`; the owner
  promotes `staging` to `main`.
- Stack: Next.js in `web/` on Vercel; Hono API in `api/` on Oracle under
  systemd; Supabase Auth and Postgres; Cloudflare R2 storage; PlugNmeet for
  the classroom. npm workspace with one root `package-lock.json`.
- Read first: `AGENTS.md`, `docs/engineering/DOCUMENT_AUTHORITY.md`,
  `docs/engineering/standards/`, and `docs/deviations.md`.
- `docs/deviations.md` is the register of known gaps, about 708 rows. About
  182 are resolved and 526 open. Of the open rows, about 221 are screens the
  redesign replaces, about 240 are backend, security, docs and tests, and about
  55 are payments, operations and performance. **Each PR updates the register
  rows it closes.**
- GitHub CLI: `gh pr ...` and other GraphQL commands fail in this
  environment. Use `gh api` with REST endpoints, for example
  `gh api repos/KingUsang/Kanvise/pulls -f title=... -f head=... -f base=staging -f body=...`.
- CI sometimes fails on a runner Docker network glitch. Rerun the single job
  with `gh api -X POST repos/KingUsang/Kanvise/actions/jobs/{job_id}/rerun`.
- No Docker locally, so database checks run only in CI (`verify.yml`,
  Supabase CLI 2.20.3, Postgres 15).
- Staging has known schema drift (register row 018 of the `DEV-DB` series in
  `docs/deviations.md`): `current_user_school_id()` is missing
  and legacy RLS policies remain.
- Browser end-to-end journeys on staging are disabled; `staging-e2e.yml` runs
  only by `workflow_dispatch`. BrowserStack is optional.
- **Before any promotion to `main`:** remove the `certification` job from
  `.github/workflows/deploy.yml`, and run the read-only schema step (the
  `Report remote schema (read-only)` step in `deploy.yml`) against production.
- Seeded staging logins, all with password `KanviseSeed@2026`:
  - `chidi.okafor@seed.kanvise.test`: agency admin
  - `amaka.eze@seed.kanvise.test`: tutor
  - `ngozi.umeh@seed.kanvise.test`: student
- Open PR #68 (a PostHog wizard) is not ours. Leave it alone.
- The Bobbin atlas lives on branch `research/bobbin-appatlas`, under
  `scratch/bobbin-appatlas/`: one folder per section, each with `spec.md` and
  `screenshots/`. Never merge that branch. To get it locally:
  `git worktree add ../bobbin-atlas origin/research/bobbin-appatlas`.
- Spec checker: a copy is in `history/check.py`. Run
  `python3 docs/design/redesign/history/check.py docs/design/redesign` from the
  repo root. It reads only the top-level `.md` files, so the archived files in
  `history/` are not checked. It must say `RESULT: PASS` before a spec commit.

## 4. What's done

- **Cleanup fix rounds** are merged into `staging` as PRs #53 to #77: the
  audit baseline, a startup fix, retiring Telegram, the account picker,
  migrations plus the schema check and drift fix, feature suggestions, docs
  cleanup, durable jobs, the quiz and mocks retirement, the tutor-invite
  retirement, and the "tutoring agency" wording
  (#77). Staging release SHA: `0c59fa9`.
- **Redesign specs 00 to 20** are written on branch `design/redesign-spec`
  (open PR #78 into `staging`:
  [PR #78](https://github.com/KingUsang/Kanvise/pull/78)). A critic review
  found 76 issues; all were fixed and three review rounds approved. Every spec
  was checked against the Bobbin screenshots and ends with a **Checked against
  Bobbin** list.
- **Owner confirmations** are recorded (`HANDOFF.md` "Owner decisions",
  `00-decisions.md` section 19): recording consent starts unticked; Kavi's
  default style is Structured; admins joining a lesson get Lead preselected;
  the reading of "reminders go to tutors"; join links by Copy, WhatsApp or
  Email; the Gemini under-18 terms are not a blocker.
- **Notifications are precise:** 18 NTF-01 has one entry per event (NTF-101
  to NTF-501) saying when it fires, its text and where it opens.
- **Notes are two kinds:** Student notes (06 STU-06) and Lesson notes (one per
  lesson). "Notes for Kavi" is removed. **Draft with Kavi** uses the
  recording, or the lesson notes when there is no usable recording and the
  tutor presses it (00 section 16).
- **Billing** is out of the build, with room reserved (20 DM-31).
- Latest design commit before this file: `4f2048e`.

Archived working files (kept so they survive a fresh sandbox):
`history/critic-review.md` (the 76 findings), `history/spec-fix-notes.md`
(how each finding was fixed), `history/screenshots-index.md` (which Bobbin
screenshots go with which spec) and `history/check.py` (the checker).

### The specs, one line each

| File | Covers |
|---|---|
| 00-decisions.md | Everything agreed: audience, words, permissions, consent, private notes, Kavi rules, billing left out, standards changes |
| 01-app-shell.md | Sidebar, search, help, account menu, toasts, dialogs, saving and offline, colour rule, accessibility |
| 02-onboarding-and-setup.md | Kavi's scripted onboarding questions, the /setup checklist, invited tutors |
| 03-dashboard.md | Today, This week, Needs attention, Suggestions, Live lessons |
| 04-courses-plan-and-diagnostic.md | Courses, the new course wizard, course plan, topic statuses, starting check |
| 05-lessons-and-scheduling.md | Lesson statuses, lessons list, new lesson wizard, lesson page, join links, timezones, calendar |
| 06-students.md | Students list, add and import, student page, recording consent, student notes, deleting data |
| 07-classroom.md | PlugNmeet boundary, start card, Lesson tools, ending, admin Lead and Watch, device check, second devices |
| 08-lesson-summary.md | Writing the summary, lesson notes, Kavi drafts, completing, No summary needed, missed lessons |
| 09-student-app.md | Student sign-in, join links, students without an email, Home, lessons, homework, courses |
| 10-homework.md | Set, hand in, mark, Kavi feedback drafts |
| 11-quizzes.md | Multiple-choice quizzes: write or generate, take, results |
| 12-settings-and-team.md | Profile, security, notifications, teaching, lessons and classroom, Kavi, business details, data |
| 13-billing.md | Proposal only, not built |
| 14-old-flows-inventory.md | Every current page and what happens to it (Keep, Replace, Retire) |
| 15-resources.md | Library, upload limits, folders, attaching to courses, lesson materials |
| 16-responsive.md | Phone, tablet and desktop rules for every screen and role |
| 17-recordings-and-attendance.md | Attendance rules, recordings page, player, export, delete and retention |
| 18-notifications.md | The notification matrix (NTF-101 to NTF-501), reminders, held messages, email rules, push |
| 19-tutors-and-team.md | Tutors list and page, add and remove with reassign, Team, adding yourself as a tutor, Switch role, invitations |
| 20-data-model.md | Product tables mapped to staging (DM-01 to DM-20), Kavi service (DM-21 to DM-30), billing room (DM-31) |

## 5. Current state and next step

- Build step 1, **Design system and app shell**, was started and then
  cancelled before any work was done. Nothing was written or pushed.
- A local, empty worktree may exist at `/projects/sandbox/kanvise-shell` on
  branch `redesign/01-app-shell` at `0c59fa9`, not pushed. In a fresh sandbox,
  recreate it from staging:
  `git fetch origin && git worktree add -b redesign/01-app-shell ../kanvise-shell origin/staging`.
- PR #78 (the specs) should be merged by the owner, or kept open as the
  reference branch. Build branches start from `staging`, so they don't
  contain the specs; read them from `origin/design/redesign-spec` until #78
  merges.

Build order (full detail and the hidden-links table in `HANDOFF.md` "Build
order"):

1. Design system and app shell (01, 16), with the message channels (18
   Channels, NTF-03, NTF-04).
2. Dashboard and setup (03, 02): dashboard frame, scripted onboarding,
   `/setup` and the sidebar setup card.
3. People and settings: students (06), tutors and team (19), settings (12
   without CFG-K and CFG-N), student sign-in, shell and Me page (09).
4. Courses and lessons: courses, course plan and resources (04, 15), lessons
   and calendar (05), the sample course, the student's course and lesson
   pages (09).
5. Classroom, recordings and attendance (07, 17), with 08 SM-07 No summary
   needed.
6. Lesson summary (08), with the summary on the student's lesson page.
7. Homework and quizzes (10, 11), with the student's pages.
8. Starting check (04, the Without Kavi path).
9. Notification preferences and push (12 CFG-N, 18 NTF-06, NTF-07).
10. The Kavi service and every Kavi feature, last (20, 12 CFG-K). Until then
    every screen uses its **Without Kavi** path.

Every build PR:
- is compared side by side with the Bobbin screenshots named in the spec's
  **Checked against Bobbin** list;
- includes screenshots at 360, 768 and 1280 px wide for each role that sees
  the screen (admin, tutor, student);
- updates the `docs/deviations.md` rows it closes;
- keeps links to screens from later steps **hidden, not disabled**;
- is pushed, and its PR into `staging` opened, by the orchestrator session.

## 6. Open items

Still for the owner (from `HANDOFF.md` and `00-decisions.md` "Open items"):

- Confirm two defaults the specs chose so building could start: students see
  Taught, Knows it and Next, while Needs work is shown to tutors only (04,
  09 SA-08); quizzes in v1 are multiple choice, one attempt, no time limit
  (11).
- Bobbin login and sign-up screenshots, to be supplied by the owner. Until
  then the current Kanvise screens stay.
- The Kavi icon (deferred).
- Accept the three changes to the briefed build order (people and settings
  move to step 3; the student app is built alongside the tutor screens;
  recordings ship with the classroom and resources with courses).
- Launch checks on Deepgram and Google data retention, pricing and an
  accuracy test (`HANDOFF.md` "Launch checks").
- Content needed before launch: the setup video, help guide pages, the sample
  course content (`HANDOFF.md` "Content dependencies").
- Standards and decision ledger amendments that must be approved before the
  matching build step (`00-decisions.md` section 18).

Also open:

- **PlugNmeet panel-docking spike**, needed in the classroom step (5), along
  with the other classroom spikes in 07 "Spikes before build".
- Five small notes from the v3 review, not yet fixed:
  1. Two dashboard rows ship one step before the join links they need.
  2. A course's level can only be set from the course plan header.
  3. Whether Kavi uses a free-text level is not specified.
  4. Undo after completing a summary doesn't say that it closes the Review
     changes sheet.
  5. `HANDOFF.md` cites a nearly blank Bobbin screenshot as the dashboard
     reference; pick a better one when building step 2.
- **Payments revamp:** owned by the owner and deferred. Don't start it.

## 7. Kavi and the AI backend (built last)

What exists on `staging` now:

- Recording transcription with Deepgram nova-3 and a Gemini 2.5 Flash recap
  job in `api/src/jobs/live-class-recording.ts`, stored in the
  `live_class_recaps` table.
- The old Gemini mock import, now retired.
- The `durable_jobs` queue (`api/src/jobs/durable-jobs.ts`,
  `docs/engineering/decisions/0006-postgres-durable-jobs.md`).

The plan is in `20-data-model.md`, Kavi service, DM-21 to DM-30:

- One Kavi service with a provider abstraction.
- Prompts versioned in code; output is JSON validated with zod.
- SSE streaming for short drafts; durable jobs for long ones.
- Kavi only makes drafts. The tutor always accepts or edits.
- Consent gating before any recording is used, and a 5 minute minimum
  recording.
- Cost tracked per request, with no cap during early access.
- 👍 and 👎 feedback on drafts.
- "Kavi suggests" starts as fixed rules, not AI.
- The onboarding chat is scripted, not AI.

## 8. Opening prompt for a new session

Paste this into the new session:

> Continue the Kanvise redesign. Clone KingUsang/Kanvise, check out
> `design/redesign-spec`, and read `docs/design/redesign/SESSION-HANDOFF.md`,
> then `HANDOFF.md` and `00-decisions.md` in the same folder. Then start build
> step 1 (design system and app shell, specs 01 and 16) on a new branch off
> `origin/staging`. Compare every screen with the real Bobbin screenshots on
> branch `research/bobbin-appatlas`, specify and build every state, and open
> the PR into `staging`, not `main`. Use `gh api` REST calls, not `gh pr`.
