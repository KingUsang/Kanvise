# Handoff: where things stand (28 Nov 2026)

For continuing this work in a new chat. Read this first, then `00-decisions.md`.

## Repositories and branches

- Repo: `KingUsang/Kanvise`. All work goes **branch → PR into `staging` → merge
  after CI passes**. Never merge into `main`; the owner promotes `staging` to
  `main`.
- `staging`: healthy, has all fix rounds (slices 1–7, rounds 8–10). Staging API:
  `https://staging-api.kanvise.com/health`.
- `design/redesign-spec`: the redesign specs (this folder). Not a code branch.
- `research/bobbin-appatlas`: the owner's Bobbin competitor atlas
  (`scratch/bobbin-appatlas/`: spec.md per section, screens.json, ~250
  screenshots). Branched from an old commit; never merge it, only read it.
- PR **#77** (`fix/agency-copy`, wording fix) is merged into `staging`.
- Open PR #68 (`posthog/wizard-…`): opened by the PostHog wizard, not by us.
  Untouched.

## Current state

- An independent critic review of every spec (76 findings: 7 blockers, 44
  major, 25 minor) was done against the Bobbin atlas, the standards in
  `docs/engineering/standards/` and the PlugNMeet reference. Every finding was
  fixed or deliberately declined on this branch, and every spec was checked
  against the real Bobbin screenshots, not only the atlas text. Each spec ends
  with a **Checked against Bobbin** list naming the screenshots it was
  compared with and the deliberate differences.
- New specs from that pass: 17 recordings and attendance, 18 notifications,
  19 tutors and team, 20 data model (with the Kavi service, DM-21 to DM-30).
- Every screen state has a stable ID; the prefixes are in `README.md`.
- What was decided is in `00-decisions.md`. Section 18 there lists the
  standards and decision-ledger changes the specs need before build.

## Owner confirmations needed

These are decided in the specs so building can start, but the owner should
confirm each one:

1. **Recording consent starts unticked** when adding a student (06 STU-03).
   Bobbin starts it ticked. Kanvise unticks it because ticking it is the tutor
   saying consent was given, and recording depends on it (00 section 14d).
2. **"Reminders go to tutors"** is read as: tutors get a reminder of their own
   lessons, students get reminders as set in 12 CFG-L, and chasing reminders
   are only sent when a tutor presses Remind (18 NTF-02).
3. **Kavi's default writing style is Structured** (12 CFG-K). Bobbin defaults
   to Detailed; Structured reads better on phones.
4. **Students see Taught, Knows it and Next**; Needs work is shown to tutors
   only (04 Topic status model, 09 SA-08).
5. **Quizzes in v1** are multiple choice, one attempt, no time limit (11).
6. **Private notes are never sent to Kavi in v1**, even for tutor-only
   answers (20 DM-25, 00 section 17). This is stricter than 00 section 16.

## Launch blockers and checks

- **Gemini API terms and under-18s (blocker).** Google's Gemini API additional
  terms say the service must not be used in an app likely to be accessed by
  people under 18. Kanvise has child and teen students. Confirm with Google,
  or move Kavi's writing provider to Vertex AI or another provider whose
  terms allow it (20 DM-26; DM-21 makes this a configuration change).
- **Confirm before launch** (20 DM-26, DM-27): whether Deepgram's training
  opt-out changes the price; what Deepgram keeps in request logs; whether
  Google offers zero retention for this use; the provider prices behind the
  cost-per-lesson estimate (about $0.27 for a 60 minute recorded lesson).
- **Accuracy test before the recording route ships** (20 DM-27): Nigerian
  English, children's and teens' voices, two speakers, low-bitrate audio. If
  it fails, Kavi drafts only from the tutor's notes.
- **Classroom spikes** before building spec 07 (07 Spikes before build):
  starting a lesson without reloading the room, per-student Quick check
  results, the admin name label, and phones as a second device. Each has a
  fallback written in 07.

## Content dependencies

These must exist before launch. None blocks building the screens.

- The "first lesson" setup video, with captions (02 SET-01). Until it exists,
  the card shows a still image and the help guide link.
- The help guide pages linked from /setup and the help menu (01 SH-04, 02).
- The sample course content, Algebra 1 Small Group (02, 03, 04).
- The Kavi icon (01 SH-05 entity icons; deferred by the owner).
- Login and sign-up screens: the owner will supply Bobbin's login and sign-up
  screenshots; until then the current Kanvise screens stay (deferred, not a
  blocker).

## Build order

Build page by page on `staging`, in this order:

1. Design system and app shell (01, 16).
2. Dashboard (03) and setup (02).
3. Courses and lessons, including the calendar (04, 05).
4. Students (06).
5. Classroom (07).
6. Lesson summary (08).
7. Student app (09).
8. Homework and quizzes (10, 11).
9. Recordings, notifications, tutors and team, settings, resources (17, 18,
   19, 12, 15).
10. The Kavi service and every Kavi feature, last (20, Kavi service section).
    Until then every screen uses the **Without Kavi** path in its Kavi block.

Billing (13) stays on hold with payments.

Every page PR:
- includes screenshots at 360, 768 and 1280 px wide;
- includes a side-by-side with the Bobbin screenshot it copies (named in the
  spec's **Checked against Bobbin** list), so differences are visible;
- updates the deviation register rows for its area (`docs/deviations.md` on
  `staging`);
- uses the state IDs from the spec in its title or description.

Backend fix rounds continue in parallel.

## Fix work (deviation register)

- Register: `docs/deviations.md` on `staging` (~708 rows). About 182 resolved,
  526 open: ~221 belong to screens the redesign replaces, ~240 backend /
  security / data / docs / tests, ~55 payments, deployment, performance (on hold
  or deferred).
- Plan and history: `/projects/sandbox/Kanvise-fix-plan.md` and
  `/projects/sandbox/step0-report.md` in the sandbox (not in the repo). The
  spec fix pass notes (finding by finding) are in
  `/projects/sandbox/spec-fix-notes.md`.

## Working notes

- No Docker in the sandbox: database checks run only in CI (`verify.yml`).
  Parse SQL locally with libpg-query in a scratch folder under
  `/projects/sandbox` (`/tmp` doesn't persist between tool calls).
- Staging test logins: seeded accounts in `seed.js` (password in
  `SEED_PASSWORD`), for example `chidi.okafor@seed.kanvise.test` (admin),
  `amaka.eze@seed.kanvise.test` (tutor), `ngozi.umeh@seed.kanvise.test`
  (student). Playwright with Chromium in `/projects/sandbox/.pw` can screenshot
  staging (`shoot.mjs`).
- Spec consistency checker (outside the repo):
  `python3 /projects/sandbox/.spec-check/check.py docs/design/redesign` (no
  duplicate or undefined IDs, no banned words, no em dashes).
- The owner wants plain, human wording, real research (not generic sources),
  good design and UX, and checks against the real Bobbin screenshots before
  inventing behaviour.
