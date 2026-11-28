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

## Owner decisions

Confirmed by the owner (recorded in `00-decisions.md` sections 14, 14b, 14d,
16 and 19):

1. **Recording consent starts unticked** when adding a student (06 STU-03).
   Bobbin starts it ticked. Kanvise unticks it because ticking it is the tutor
   saying consent was given, and recording depends on it (00 section 14d).
2. **"Reminders go to tutors"** is read as: tutors get a reminder of their own
   lessons, students get reminders as set in 12 CFG-L, and chasing reminders
   are only sent when a tutor presses Remind (18 NTF-02).
3. **Kavi's default writing style is Structured** (12 CFG-K). Bobbin defaults
   to Detailed; Structured reads better on phones.
4. **Admins choose Lead or Watch** when joining a lesson they don't teach (07
   CR-09). Lead is always preselected, as the owner said an admin has
   moderator rights. Watch (camera and microphone off, no moderator rights,
   always visible to everyone) is a Kanvise addition, offered only when the
   tutor is already in the lesson.
5. **Personal join links** can be sent by Copy, WhatsApp or Email (05 LP-05).
6. **Gemini API terms and under-18s** are not a launch blocker (20 DM-26).
7. **Two kinds of private note.** **Student notes** on the student page (06
   STU-06), and **lesson notes**: one note per lesson, written in the
   classroom's Lesson tools (07 CR-03) or on the lesson page (05 LP-02), and
   shown as the **Lesson notes** section of the summary (08 SM-01). One record
   in three places (20 DM-10). The **Notes for Kavi** box, **Draft from my
   notes** and **Use my lesson notes** are removed. When there is no usable
   recording, **Draft with Kavi** drafts the summary from the lesson notes,
   and is disabled with a helper line when they are empty. Lesson notes go to
   Kavi only for that lesson's summary draft, when the tutor presses the
   button; student notes never do; neither appears in any notification, email
   or student view (00 section 16, 20 DM-25). This replaces the earlier rule
   that private notes were never sent to Kavi.
8. **Billing is out of the build**, designed in only as reserved room: a
   price per course, who pays on the student, completed lessons per student
   per course (already stored), and a Billing item in Settings hidden until
   billing exists (00 section 14, 20 DM-31). Spec 13 stays a proposal. The
   course wizard and Add student have no billing fields; each notes where
   they will go (04 CW-2, 06 STU-03).

Decided in the specs so building can start, still for the owner to confirm:

1. **Students see Taught, Knows it and Next**; Needs work is shown to tutors
   only (04 Topic status model, 09 SA-08).
2. **Quizzes in v1** are multiple choice, one attempt, no time limit (11).

## Launch checks

- **Confirm before launch** (20 DM-26, DM-27): whether Deepgram's training
  opt-out changes the price; what Deepgram keeps in request logs; whether
  Google offers zero retention for this use; the provider prices behind the
  cost-per-lesson estimate (about $0.27 for a 60 minute recorded lesson).
- **Accuracy test before the recording route ships** (20 DM-27): Nigerian
  English, children's and teens' voices, two speakers, low-bitrate audio. If
  it fails, Kavi drafts only from the lesson notes.
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

Build page by page on `staging`, in this order. No step ships a button, tab,
card or row that opens a screen from a later step: it stays hidden (not
disabled) until that step ships. The table after the list names the places
where this matters most.

1. **Design system and app shell** (01, 16), with the message channels every
   later step sends through: the email rules and held messages (18 Channels,
   NTF-03, NTF-04).
2. **Dashboard and setup** (03, 02), as a slice that grows with every later
   step. This step ships the dashboard frame (DB-01, DB-03, DB-04, DB-07 and
   DB-08 layouts) with their empty states, the scripted onboarding (ONB-01 to
   ONB-11) and the `/setup` page (SET-01 to SET-03) with the sidebar setup
   card (01 SH-02). It is the first screen every tutor sees and the most
   Bobbin-shaped one, so it is the first side-by-side check of the new look
   (`15-tutor-role/screenshots/tutor-dashboard--default.png`,
   `01-dashboard/screenshots/page--default.png`, and the **Set up your
   account** card in `04-courses/screenshots/sample-course--outline.png`).
   Each later step adds its own dashboard rows and setup rows (table below).
3. **People and settings:** students (06), tutors and team (19), settings
   (12, without CFG-K and CFG-N), and the student app's sign-in, shell and Me
   page (09 SA-01, SA-02a, SA-03 frame, SA-09, SA-10), because inviting a
   student in this step sends them to SA-01.
4. **Courses and lessons:** courses, course plan and resources (04 CRS-01 to
   CRS-08 and the wizard; 15), lessons and calendar (05), the sample course,
   and the student's course, lesson and join link pages (09 SA-02, SA-04,
   SA-05, SA-07, SA-08).
5. **Classroom, recordings and attendance** (07, 17), with the student's
   classroom screens (07 CR-02, CR-08), recordings (17 REC-08) and 08 SM-07
   **No summary needed** as this step's summary slice.
6. **Lesson summary** (08), with the summary on the student's lesson page (09
   SA-05).
7. **Homework and quizzes** (10, 11), with the student's pages (HW-04, QZ-05,
   09 SA-06) and the QZ-02 question card's starting check mode.
8. **Starting check** (04 DIAG-D to DIAG-R, the Without Kavi path), built on
   step 7's question card.
9. **Notification preferences and push** (12 CFG-N, 18 NTF-06, NTF-07).
   Every NTF-01 row is sent from the step that owns its event; this step adds
   the switches, push and the admin daily summary.
10. **The Kavi service and every Kavi feature, last** (20, Kavi service
    section, DM-30, 12 CFG-K). Until then every screen uses the **Without
    Kavi** path in its Kavi block.

This keeps the briefed order (shell, dashboard and setup, courses and lessons,
classroom, summary, homework and quizzes, then the rest, Kavi last) with three
deliberate changes for the owner to accept:
- Students, team and settings move up to step 3, before courses, because the
  New course wizard's inline add-student form creates the student exactly as
  06 STU-03 does, and lessons and the classroom read the 12 CFG-L values.
- The student app is built step by step alongside the tutor screens it
  mirrors, instead of as one later step, so no invite or join link points at
  a student screen that doesn't exist yet.
- Recordings ship with the classroom (step 5), because the classroom makes
  them, and resources ship with courses (step 4).

| Place | Opens | Before the later step ships |
|---|---|---|
| 03 DB-01 **Schedule lesson**, DB-03 empty state **Schedule lesson** (step 2) | 05 New lesson wizard (step 4) | Hidden. DB-03 and DB-04 show their empty states (**Nothing scheduled yet.**, **Nothing scheduled this week.**) until lessons exist |
| 03 DB-05 Needs attention (step 2) | Steps 3 to 8 | Each row ships with the step that owns its target: **Students not joined yet** and **Tutors not joined yet** in step 3; **Lessons that didn't start**, **Links to send** and **Lessons without a tutor** in step 4; **Lesson summaries to write** and **Summaries overdue** in step 6; **Homework to mark** and **Homework waiting over 3 days** in step 7; **Starting checks finished** in step 8. The section is hidden while it has no rows |
| 03 DB-06 Suggestions (step 2) | Steps 4 and 6 | **Next lesson has no topic** and **Nothing booked next week** ship in step 4; **Needs work twice** ships in step 6, once summaries set statuses |
| 03 DB-09 Live lessons, DB-03 **Join** and **Live now ›** (step 2) | Classroom (step 5) | Hidden until step 5; DB-03 rows open the lesson page |
| 03 DB-02 banners (step 2) | Steps 3 to 5 | **Sample course** banner from step 4. **Welcome (invited tutor)** banner from step 3, with **Test classroom** hidden until step 5 |
| 02 `/setup` rows and the sidebar setup card (step 2) | Steps 3 to 5 | Each row appears when its target ships: Add your students and Add a tutor in step 3; Create a course, Build the course plan and Schedule your first lesson in step 4; Check your classroom in step 5. Until all five rows exist, the count reads **{n}/{rows shown} completed**. The right column's **Explore the sample course** shows from step 4 |
| 02 onboarding answers (step 2) | Steps 3 and 4 | Saved in step 2 and used as each screen ships: **Yes, I have students** opens STU-04 in step 3; **How they teach** sets the wizard's People step in step 4 |
| 04 CRS-07, DIAG-D (step 4) | Starting check (step 8) | The card is hidden; the course page shows only **Build the course plan**. The CRS-03 Students card shows **Invite not accepted** or nothing |
| 04 CRS-05 Homework and Quizzes tabs (step 4) | Step 7 | Tabs hidden |
| 06 STU-05 Lessons, Homework and quizzes, Summaries, Attendance tabs (step 3) | Steps 4 to 7 | Each tab appears with its step; the Summary tab shows what exists |
| 05 LP-01 **Join classroom**, LP-05 join links (step 4) | Classroom (step 5) | Hidden; the lesson page works for planning, rescheduling and cancelling. Step 4 is not released to real lessons before step 5 |
| 05 LP-01 **Before this lesson** homework card (step 4) | 10 (step 7) | Hidden |
| 07 Lesson tools **Set homework** (step 5) | 10 HW-01 (step 7) | Hidden |
| 08 SM-01 Homework section and **Set homework** (step 6) | 10 HW-01 (step 7) | The Homework section is hidden; the student's summary has no Homework part |
| 05 LP-02 **Write summary**, 07 CR-07 **Write lesson summary**, DB-03 **Write summary** (step 5) | 08 (step 6) | Step 5 ships 08 SM-07 **No summary needed** (the dialog and the Complete state), so ended lessons can be closed; **Write summary** is hidden until step 6 |
| 12 CFG-L values used by 05 and 07 | Settings (step 3) | Already built |

Billing (13) is out of the build: it stays a proposal, on hold with payments.
No step builds it. The room left for it is in 20 DM-31, and the Settings
Billing item stays hidden.

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
