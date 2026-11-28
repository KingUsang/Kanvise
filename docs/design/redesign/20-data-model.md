# 20 · Data model

Status: draft for owner review. Builds on `00-decisions.md` (§13, §16, §17,
§18, §19) and every feature spec's **Data needed** section, which now points
here.

**Who:** whoever plans and builds the backend.
**Goal:** one list of the product tables the redesign needs: what each is for,
its key columns, which spec owns it, and what already exists on `staging`, so
the work can be sized (F-44).

**How to read this:**
- Names in `code` are real tables on `origin/staging` (from
  `supabase/migrations/`), or proposed names for new ones, marked **New**.
- Database names keep their old words (00 section 13): a Lesson is still a row
  in `live_classes`, an agency is a row in `schools`. Only the product words
  change.
- **Existing** means the table is there and is extended; **New** means it must
  be created; **Retire** means the redesign stops using it (DM-20).
- Every table is scoped by `school_id` (the account) and goes through the API,
  as today (the public schema is locked behind the API on staging).
- Key columns are the ones the specs depend on, not a full schema. Types,
  indexes and row rules are for the build.

The Kavi service (what Kavi reads, keeps, costs and how it fails) is the last
section, DM-21 to DM-30, and is built last, after every feature works without
Kavi.

---

## DM-01 · People, accounts and memberships

- **Purpose:** who someone is, which accounts (independent tutor or agency)
  they belong to, and in which role.
- **Key columns:**
  - `user_profiles`: name, email (optional for students), phone (optional),
    photo, display name for students, bio, timezone (New column), WhatsApp
    number (New), `supabase_auth_id` (empty for a student who hasn't accepted
    or has no email, F-01), `is_active`.
  - `schools`: account name, logo, `account_type` (`centre` = agency,
    `independent`), timezone (New), business details (12 CFG-A).
  - `account_memberships`: person, account, role (`admin`, `tutor`,
    `student`), status (invited, active, removed), joined and removed times.
  - Student fields from 06: goal (free text), status, recording consent
    (DM-09), can watch recordings (DM-09).
- **Owning specs:** 06 (students), 12 (CFG-P, CFG-A), 19 (tutors and admins),
  01 SH-07 (account switching).
- **Staging:** `user_profiles`, `schools`, `account_memberships`,
  `student_centre_memberships` (older student-to-account link).
- **New or existing:** Existing, extended. Remove the `school_id` claim
  dependency in favour of memberships (00 section 19). The old `learner` role
  value in the first migrations is already replaced by `student`.

## DM-02 · Invitations

- **Purpose:** invite students, tutors and team members; resend; expire;
  enforce 50 invitations an hour per account (19 TM-11).
- **Key columns:** account, invited by, role, email, `token_hash` (never the
  token), status (sent, accepted, expired, revoked), `expires_at` (7 days),
  accepted at, the person created, resent count. The hourly limit counts rows
  by account and created time.
- **Owning specs:** 06 STU-03, STU-08; 19 TM-03, TM-08, TM-11; 18 NTF-01.
- **Staging:** `account_invitations` (has `token_hash`, `expires_at`, role
  `tutor` or `student`), `tutor_invites` (older, single use).
- **New or existing:** Existing. Add the `admin` role to
  `account_invitations` for team members, and fold `tutor_invites` into it.

## DM-03 · Courses and course tutors

- **Purpose:** the course every lesson belongs to (00 section 3), its students
  and its tutor.
- **Key columns:**
  - `courses`: account, name, subject, description, colour (course swatch,
    01 SH-15), level (from 12 CFG-K level names), `is_trial` (New, the
    **This is a trial** switch, 04 CW-1), status (active, archived; New),
    created by.
  - Course tutor: course, tutor, assigned by, assigned at, ended at (kept as
    history so reassignment in 19 TM-06 is traceable).
  - Course students: course, student, added at, removed at.
- **Owning spec:** 04 (CRS, CW); reassignment 19 TM-06.
- **Staging:** `courses` (also has `programme_id`, `sub_programme_id`, price
  and publish columns), `tutor_course_assignments`, `enrolments`.
- **New or existing:** Existing. Price, publishing and programme links are
  left unused (priced classes and programmes are retired, DM-20). Add
  `ended_at` to `tutor_course_assignments`. A course has one or more current
  tutors (04 CW-2); each lesson has exactly one (05 LW-1).

## DM-04 · Course plan

- **Purpose:** the plan of modules, topics and objectives for a course (04
  Course plan), with its status.
- **Key columns:**
  - `course_plans` (New): course, status (**Draft**, **Active**,
    **Archived**, 04 Course plan status), copied from (course plan id, for
    **Copy plan from another course**), created by, activated at.
  - `plan_modules` (New): plan, title, position.
  - `plan_topics` (New): module, title, position, depends on (other topics,
    for the starting check rules in 04).
  - `plan_objectives` (New): topic, text, position.
- **Owning spec:** 04 (CRS-06, Course plan status).
- **Staging:** none.
- **New or existing:** New.

## DM-05 · Topic status per student

- **Purpose:** where each student is on each topic: **Next**, **Taught**,
  **Needs work**, **Knows it** (04 Topic status model), tracked separately per
  course (00 section 19).
- **Key columns:**
  - `topic_statuses` (New): student, topic, course, current status, source
    (lesson summary, starting check, homework, quiz, set by hand), changed by,
    changed at.
  - `topic_status_events` (New): the history, one row per change, with the
    old and new status, source, source id (the lesson, check, homework or
    quiz), changed by.
  - `topic_status_proposals` (New): rows waiting in **Review changes** (04
    CRS-08): student, topic, proposed status, source, created at, accepted or
    dismissed, by whom. Nothing changes `topic_statuses` without an accepted
    proposal or a person setting it by hand.
- **Owning spec:** 04 (Topic status model, CRS-08); fed by 08, 10, 11, 04
  starting check.
- **Staging:** none.
- **New or existing:** New.

## DM-06 · Lessons and series

- **Purpose:** every lesson, its students, status and series rule (05).
- **Key columns:**
  - `live_classes`: course, tutor, topic (title), linked plan topic (New),
    `scheduled_at`, `duration_minutes`, timezone (New: the lesson's own zone
    from 05 LW-2), status, started at, ended at, restart until (New, 60
    minutes after an automatic end, 07 CR-06), `recurrence_group_id`,
    `occurrence_date`, `timetable_slot_id`, room fields for PlugNmeet
    (`provider_room_id`, `provider_room_status`, `classroom_provider`).
  - **Status** stores the 05 values: `planned`, `live`, `not_held`,
    `awaiting_summary`, `missed`, `complete`, `cancelled`. **Starting soon**
    is worked out from the time and 12 CFG-L **Classroom opens**, not stored.
    `not_held` is set by a job when the scheduled end passes without a start.
    Today's technical states (`starting`, `ready`, `ending`, `interrupted`)
    move to a separate room-state column, since they describe the classroom,
    not the lesson.
  - Quick checks (07 CR-03): `live_class_quick_checks` is reused. It already
    has the lesson, tutor, questions, `provider_poll_id` and `published_at`.
    Add closed at, class totals per option and, if the Quick check spike
    passes, each student's choice. `candidate_id` and the `candidate` status
    were for Kavi-made questions in the classroom, which v1 doesn't have
    (07), so they are left unused.
  - Lesson students (New): lesson, student, added at, removed at.
  - Series rule: weekday, start time, timezone (the anchor zone, so a series
    keeps its local time when clocks change), starts on, ends on or count,
    exceptions (moved or cancelled occurrences). Staging's
    `class_timetables` and `class_timetable_slots` already hold weekday, start
    time, timezone and date range.
  - Lesson activity (New): lesson, event (created, started, joined, left,
    ended, rescheduled, cancelled, restarted, chip sent, email bounced), who,
    when, details.
- **Owning spec:** 05 (Lesson statuses, LW, LP, Calendar); 07 for room state.
- **Staging:** `live_classes`, `class_timetables`, `class_timetable_slots`,
  `live_class_jobs`, `plugnmeet_webhook_inbox`, `durable_jobs`.
- **New or existing:** Existing, extended; status values migrated. Lesson
  students and activity are new.

## DM-07 · Join links

- **Purpose:** one personal link per student per lesson (05 LP-05), plus the
  admin Lead and Watch tokens and the added-device link (07).
- **Key columns:** lesson, student (or person and role for staff), `token_hash`,
  expires at (2 hours after the scheduled end), revoked at, last opened at,
  open count, active connection (the device currently in the lesson, for
  **Join here instead**).
- **Owning spec:** 05 LP-05; 07 CR-05, CR-09, CR-14; 09 SA-02.
- **Staging:** `live_class_guests` (has `session_token_hash`, `expires_at`,
  `revoked_at`, for guest links, which are retired).
- **New or existing:** New table for student links, built on the same hashed
  token pattern. Guest rows are retired (DM-20).

## DM-08 · Attendance

- **Purpose:** who was in each lesson, when and for how long (17 Attendance
  rules).
- **Key columns:** lesson, person, role in the lesson (tutor, student, admin
  Lead, admin Watch; New), first joined at, last left at, seconds connected,
  rejoin count (New), status (**Attended**, **Late**, **Left early**,
  **Missed**, **Tutor didn't join**; New, set when the lesson ends),
  deleted-student flag (New, 06 STU-11).
- **Owning spec:** 17; shown in 05 LP-02, 06 STU-05, 19 TM-04.
- **Staging:** `attendance_records` (`joined_at`, `left_at`,
  `duration_seconds`), `guest_live_class_attendance` (retired with guests),
  `telegram_attendance_checkins` (retired with the Telegram layer).
- **New or existing:** Existing, extended. Missed rows are written for
  students on the lesson who never joined.

## DM-09 · Recordings and consent

- **Purpose:** the recording of a lesson, whether it may be watched, and each
  student's recording consent with its history (00 section 14d).
- **Key columns:**
  - `live_class_recordings`: lesson, storage key, status (`pending`,
    `uploaded`, `ready`, `failed`), length, size, delete after (New, from 12
    CFG-L), deleted at and by (New).
  - Not-recorded reason on the lesson (New): recorded, consent missing (with
    the students), recording off.
  - Recording consent (New): student, state (given, not given), recorded by,
    at; one history row per change (06 STU-05 **Record consent**, **Withdraw
    consent**, import).
  - Can watch recordings per student (New, starts from the account default,
    06 STU-05).
- **Owning spec:** 17 (REC); consent 06; checks at start and restart 07.
- **Staging:** `live_class_recordings`, `live_class_recording_segments`,
  `recorder_fleet_readiness`, `recorder_fleet_desired_state`,
  `live_class_recording_share_links` (retired: no public links).
- **New or existing:** Existing for recordings; consent and watch rules are
  new. Transcripts are `lesson_transcripts` (DM-28) and follow the
  recording's retention (DM-25); the pilot transcript tables are retired
  (DM-20).

## DM-10 · Lesson summaries

- **Purpose:** the summary a tutor completes after a lesson (08), and the
  lesson-level outcome when no summary is written.
- **Key columns:** lesson, sections (**What we covered**, **What went well**,
  **What to work on**, **Homework** link), private notes (separate column, 00
  section 16), Notes for Kavi (separate, not private, 08), status (draft,
  complete), no-summary reason (**No summary needed** with the optional
  reason chip, 08 SM-07), ticked topics with **Got it** / **Needs more work**,
  objectives ticked in the lesson (07), completed by, completed at, edited at,
  Kavi draft used (yes or no, which route).
- **Private notes rule:** private notes are readable only by the course's
  tutors and the account's admins, are never returned by any student-facing
  API, and are never sent to Kavi (00 section 16; in this version not even
  for tutor-only output, DM-25). Keeping them in their own
  column (or table) makes that rule easy to enforce and test.
- **Owning spec:** 08 (SM-01 to SM-07); student view 09 SA-05.
- **Staging:** `live_class_recaps` (`draft_body`, `published_body`, status
  `pending`, `generating`, `draft`, `published`, `failed`).
- **New or existing:** New table for lesson summaries. `live_class_recaps`
  will be folded into it, as described in DM-29: its drafts become expired
  Kavi drafts and its published text is kept as an earlier summary.

## DM-11 · Starting check

- **Purpose:** the optional check a tutor sends after a course plan exists (04
  DIAG).
- **Key columns:**
  - Check (New): course, plan, questions (from the shared MCQ editor, DM-13),
    topics covered, created by, sent at.
  - Attempt (New): check, student, `token_hash`, expires at, status (sent,
    started, finished, cancelled), answered count, finished at, minutes taken,
    reminders sent.
  - Answers (New): attempt, question, topic, chosen option, result (knew,
    didn't know, not sure, skipped), answered at.
  - Results feed `topic_status_proposals` (DM-05), never `topic_statuses`
    directly.
- **Owning spec:** 04 (DIAG-D, DIAG-P, DIAG-S, DIAG-R, starting check rules).
- **Staging:** none. (`mock_attempts` and `mock_answers` hold old mock exams;
  not reused, DM-20.)
- **New or existing:** New.

## DM-12 · Homework and hand-ins

- **Purpose:** homework a tutor sets, and what students hand in (10).
- **Key columns:**
  - `assignments`: course, tutor, title, instructions, due at (`deadline_at`),
    files, students (New, for one-student homework), hand-in mode (New),
    marking mode (New), linked lesson (New), linked topics (New), from a Kavi
    suggestion (New).
  - `submissions`: homework, student, files, typed answer (New), handed in at,
    `is_late`, version (New), mark (`score`), feedback, marked at and by, redo
    asked (New), topic choice (**Got it** / **Needs more work**, New). Kavi's
    feedback draft is kept apart from the feedback (`kavi_drafts`, DM-28).
  - Upload counts per account and per student per day (15 Upload limits),
    from `upload_intents`.
- **Owning spec:** 10 (HW-01 to HW-05); limits 15.
- **Staging:** `assignments`, `submissions`, `upload_intents`,
  `direct_assignments` and `direct_assignment_submissions` (guest homework by
  link, retired).
- **New or existing:** Existing, extended.

## DM-13 · Quizzes

- **Purpose:** multiple-choice quizzes inside a course, tied to topics (11).
- **Key columns:**
  - Quiz (New): course, title, topics, status (draft, sent), sent at,
    students, show score to students.
  - Question (New): quiz, text, options, correct option, topic, position.
    The same editor writes starting check questions (DM-11).
  - Attempt and answers (New): quiz, student, started at, finished at, score
    (one mark per question), chosen option per question. One attempt each, no
    time limit (11).
- **Owning spec:** 11.
- **Staging:** `mock_exams`, `mock_questions`, `mock_question_options`,
  `mock_attempts`, `mock_answers` and the question bank tables, built for
  priced mock exams and a question bank, which are retired.
- **New or existing:** New, small tables. The mock and question bank tables
  are not reused (their versioning, audiences and pricing don't apply).

## DM-14 · Settings

- **Purpose:** account and personal settings read across the product (12).
- **Key columns:**
  - Account (New columns on `schools`, or a new account settings table):
    default lesson length, classroom opens for students (5, 10, 15, 30
    minutes; default 15), remind students (30 minutes on, 24 hours off), end
    lessons automatically (on) and delay (5, 10, 15, 30 minutes; default 10),
    record lessons (on), students can watch recordings (on), keep recordings
    for (30, 90, 365 days; default 90), timezone, teaching preferences
    (on my own or with a team, who you mostly teach, how you usually teach,
    subjects), level names, Kavi writing style and switches.
  - Person (New columns on `user_profiles`, or a person settings table):
    **I teach too** (admins, 12 CFG-P, 19 TM-10), timezone, display name.
- **Owning spec:** 12 (CFG-P, CFG-T, CFG-L, CFG-K, CFG-A); onboarding answers
  02.
- **Staging:** `schools` (`account_type`, business details),
  `programmes.teaching_mode` (old per-programme setting).
- **New or existing:** New columns.

## DM-15 · Notifications and preferences

- **Purpose:** what each person is sent, how, and what they switched off (18).
- **Key columns:**
  - `notifications` (student Bell list): recipient, type, title, body, read,
    related item.
  - `notification_deliveries`: event, recipient, channel, status (`pending`,
    `sent`, `failed`, `skipped`), attempts, error, sent at. Add **release at**
    (New) so held messages (18 NTF-03) wait for the undo window, and
    cancelled when **Undo** is pressed.
  - `email_deliveries`, `email_provider_daily_usage`, `push_subscriptions`,
    `push_deliveries`: as today; bounces feed the lesson Activity (18 NTF-04).
  - Preferences (New): person, row (the CFG-N or SA-10 switch), push on, email
    on.
  - Unsubscribe tokens (New): person, row, `token_hash`, used at.
- **Owning spec:** 18; switches 12 CFG-N and 09 SA-10.
- **Staging:** `notifications`, `notification_deliveries`, `email_deliveries`,
  `email_provider_daily_usage`, `push_subscriptions`, `push_deliveries`,
  `telegram_deliveries` (retired with Telegram).
- **New or existing:** Existing, extended; preferences and unsubscribe tokens
  are new.

## DM-16 · Chip messages and concerns

- **Purpose:** the one-tap **Let {student} know** messages (07 CR-12) and
  **Report a concern** (07 CR-13).
- **Key columns:**
  - Chip messages (New): lesson, from, to (one student, everyone, or the
    tutor), chip (running late with minutes, starting now, can't make it,
    need another time), sent at. One per chip per person per lesson.
  - Concerns (New): lesson (optional), raised by, sent to (agency admins or
    Kanvise support), text, created at, handled at. Never visible to the
    tutor when a student raised it.
- **Owning spec:** 07 (CR-12, CR-13); 09 for the student side.
- **Staging:** none. (`feedback_reports` is the Share feedback store, not
  concerns.)
- **New or existing:** New.

## DM-17 · Added devices and device checks

- **Purpose:** the tutor's second device in a lesson (07 CR-14) and the device
  check result per person and browser (07 CR-10, ticks 02 **Check your
  classroom**).
- **Key columns:**
  - Added devices (New): lesson, person, `token_hash` (10 minutes, once),
    connected at, removed at.
  - Device checks (New): person, browser or device fingerprint, date, result
    per step (microphone, speakers, camera, connection).
- **Owning spec:** 07; setup 02.
- **Staging:** none.
- **New or existing:** New.

## DM-18 · Resources and uploads

- **Purpose:** the file library, folders, sharing to courses and lesson
  materials (15).
- **Key columns:** file (owner, account, name, type, size, storage key),
  folder, shared with courses, attached to lessons, presented on the
  whiteboard (PDF and images within 10 MB), upload counters.
- **Owning spec:** 15.
- **Staging:** `notes` (course files), `live_class_presentations` and their
  pages, `upload_intents`.
- **New or existing:** Existing, extended with folders and course sharing.

## DM-19 · Offline queue (client only)

- **Purpose:** keep what a person typed when the connection drops (01 SH-13,
  16 R-08), for example summary text and private notes, and send it when the
  connection is back.
- **Where:** in the browser only (IndexedDB), per person and device, cleared
  on sign-out. There is no server table. The server takes each queued save
  like any other save and rejects one that is older than the saved version,
  which the page then shows as a conflict (01 SH-13).
- **Owning spec:** 01 SH-13.
- **New or existing:** New, client side.

## DM-20 · Tables the redesign stops using

Retired features (00 section 15) leave these tables unused. Removing them is a
separate clean-up with its own migration and backup, not part of the redesign
build:

| Staging tables | Why |
|---|---|
| `programmes`, `sub_programmes`, `payments`, `paystack_subaccounts`, `kanvise_subscriptions`, `school_promos`, `reviews` | Priced classes, programmes and public pages are retired; billing is on hold (13) |
| `mock_*` tables, `question_banks`, `bank_question*`, `question_media`, `question_stimul*`, `mock_marketplace_*`, `mock_access_*`, `mock_entitlements`, `mock_orders`, `mock_import_jobs`, `guest_mock_*` | Mock exams, the question bank, the marketplace and the PDF import are retired; quizzes use DM-13 |
| `live_class_guests`, `guest_live_class_attendance`, `live_class_recording_share_links`, `direct_assignments`, `direct_assignment_submissions` | Guest flows and share links are retired |
| `telegram_*` | The Telegram teaching layer is not part of the redesign |
| `avatar_configs` | The avatar builder is retired |
| `school_slug_redirects`, `waitlist_signups`, `landing_analytics_events`, `registration_intents` | Public pages and self sign-up are retired (marketing site only) |
| `live_class_transcript_chunks`, `live_class_transcription_sessions` | Live transcription pilot; Kavi is never live in the classroom in v1, and transcripts are `lesson_transcripts` (DM-28) |
| `live_class_recaps` | Folded into lesson summaries (DM-29), then read-only |

`live_class_quick_checks` is not retired: Quick check (07 CR-03) reuses it
(DM-06).

## Kavi service (built last)

**This whole section is built last.** Every screen in specs 02 to 19 is built
and works first with its **Without Kavi** path (00 section 17). Kavi is then
added on top, feature by feature, without changing those screens' manual
paths. Nothing earlier in the build may wait on anything below.

**What exists on `origin/staging` today** (read from the code, so the build
starts from facts):
- `api/src/jobs/live-class-recording.ts`: after a recording is ready, a
  `recording_process` job on `live_class_jobs` downloads it from R2, sends the
  whole file to Deepgram (`nova-3`, `smart_format`, `punctuate`,
  `diarize=false`, 15 minute timeout), saves the transcript as a private R2
  JSON object (`raw_transcript_key`), then sends up to 120,000 characters of
  it to Gemini (`gemini-2.5-flash`, temperature 0.2, JSON mode) with an inline
  prompt, and writes the result into `live_class_recaps.draft_body` with five
  old headings (Topics covered, Key explanations, and so on). Three attempts,
  five minutes apart; the last failure sets the recap to `failed`.
- It checks no consent and no minimum length, has no prompt version, checks
  the JSON only with `JSON.parse`, records no cost, and passes the Gemini key
  in the URL (`?key=`).
- `api/src/domain/mock-pdf-import.ts`: the retired mock PDF import, also
  Gemini 2.5 Flash with a JSON response schema, retries 500/502/503/504 twice
  and logs token counts to the console. Retired with mocks (DM-20); only its
  retry and token-logging ideas carry over.
- `api/src/jobs/durable-jobs.ts` and `durable_jobs` (migration
  `20261120090700`): a general queue with `job_type`, `dedupe_key` (unique),
  `payload`, attempts and `max_attempts`, leases claimed with
  `FOR UPDATE SKIP LOCKED`, `extend`, dead letters (`failed`), `cancel` and
  `replay`. Jobs have no account column; the account goes in the payload.
- `zod` (v4) is already an API dependency, used for request contracts.
- `live_class_transcript_chunks` and `live_class_transcription_sessions` come
  from the live transcription pilot. No API code reads or writes them.
- No Kavi code, prompt store, cost record or feedback store exists.

## DM-21 · One Kavi service and its providers

- **One service in the API** (`api/src/kavi/`), the only code that talks to an
  AI provider. Routes and jobs call it with a feature name (DM-30), the
  account, the person asking, and the inputs. Nothing else reads provider keys.
- **Two provider interfaces**, so a model or vendor can change without
  touching features:
  - Writing: `generate(template, input, options)` and a streaming version.
    Today: Google Gemini through a paid Cloud project (DM-26 says why it must
    be paid). The model name is configuration, never code: the Gemini pricing
    page says `gemini-2.5-flash` is deprecated and from 1 December 2026 is
    routed to `gemini-3.5-flash-lite`, so the model in use is recorded on
    every request (DM-28) and checked before launch.
  - Transcribing: `transcribe(audio, options)`. Today: Deepgram `nova-3`
    pre-recorded, with `mip_opt_out=true` on every request (DM-26) and
    `diarize=true` (included in the pre-recorded price) so the tutor and the
    students are told apart.
- Keys stay in the API environment (`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`) and
  go in request headers (`x-goog-api-key`, `Authorization`), never in URLs or
  logs.
- **Switched off is a normal state.** When the account's Kavi switch for a
  feature is off (12 CFG-K), or the service isn't configured, the service
  says "not available" and the screen shows its Without Kavi path. That is
  how every screen runs before this section is built.

## DM-22 · Prompt templates and output checks

- **Templates live in code**, one file per feature and version, for example
  `course_plan@3`. A template holds the instructions, the input fields it
  accepts, the zod schema of its output, and the model settings. A changed
  template gets a new version; old versions stay so feedback can be compared.
- **Every request records** the template id and version, the model and the
  provider (DM-28). Feedback (DM-27) is stored against the same version.
- **Inputs are built by one context builder per feature** from the account's
  own rows, checked against what the person asking may see (the Permissions
  table of the owning spec). Writing style, language and level names from 12
  CFG-K, and reading level from CFG-T, are added to every writing request.
- **Output is JSON, checked with zod.** If it fails the schema (missing
  fields, a quiz question without exactly one correct option, a topic that
  isn't in the plan), the service asks once more with the error added. If the
  second answer also fails, the request ends as `failed` and the screen shows
  its honest failure state (the **Couldn't generate** line in each spec's
  Kavi block). No partial or invented output is shown.
- **Not enough to go on** is decided before calling the model, by fixed rules
  in each spec (for example notes under 20 characters, 08 SM-02; a one-word
  topic with no objectives, 04 and 11). Such requests are recorded as
  `not_enough` and cost nothing.
- Provider errors: 429 is not retried at once (it usually means a quota
  reset); 500, 502, 503 and 504 are retried up to twice with a short wait, as
  the old import did. A request that still fails is `failed`.

## DM-23 · Short drafts, streamed

- Used for: course plan (04 CRS-06), regenerate untouched modules (04 CRS-04),
  lesson plan (05 LP-01), quiz questions (11 QZ-01, QZ-02), starting check
  questions (04 DIAG-D, DIAG-P), suggested topic order (04 DIAG-R), homework
  suggestion and homework feedback (10 HW-01, HW-05), the summary draft from
  notes (08 SM-02), and Ask Kavi (06 STU-05).
- **Server-sent events** on `POST /kavi/:feature/stream`. Events: `status`
  (preparing, retrying), `item` (one finished module, topic, question or
  section, each already checked with its own zod schema), `done` (the whole
  draft, checked again), `error` (with the spec's failure kind: not enough,
  couldn't generate, not available).
- Items appear only once they pass their check, so the screen never shows
  half a JSON object. 01 SH-12 rules apply: the region is busy, announced once
  when done.
- A retry (DM-22) clears the items shown so far and streams again; the status
  stays **preparing**. A final failure removes Kavi's items and leaves what the
  tutor wrote untouched.
- **Stop** closes the stream and cancels the provider call. The request is
  recorded as `cancelled`; nothing Kavi wrote is kept.
- The finished draft is saved in `kavi_drafts` (DM-28) before it is shown, so
  a reload shows the same draft instead of paying for a new one.
- Limits: one stream per person per feature at a time; a request has a
  60 second limit, then it is `failed`.

## DM-24 · Recording to summary draft, as background jobs

The long route runs on the existing `durable_jobs` queue, not on SSE. It
replaces today's `recording_process` job on `live_class_jobs`;
`recording_finalize` (merging recorder segments) is not Kavi and stays where
it is.

1. **`kavi_transcribe`** (dedupe key `kavi_transcribe:<lesson id>`), queued
   when the recording becomes `ready`. Payload: `school_id`, lesson id,
   recording id. When it runs it checks again, because consent can change
   after the lesson:
   - every student on the lesson had consent for the whole recording (DM-09);
     if not, no transcript is made, and the summary card shows **This lesson
     wasn't recorded.** or the consent reason (08 SM-01, 17 REC-02);
   - the recording is at least 5 minutes (300 seconds); if not, no transcript
     is made and 08 shows **Too short**;
   - the account's **Kavi drafts lesson summaries** switch is on (12 CFG-K).
   Then it sends the audio to Deepgram (the lease is extended while it
   waits), saves the transcript (DM-28 `lesson_transcripts`) and queues step 2.
2. **`kavi_summary_draft`** (dedupe key
   `kavi_summary_draft:<lesson id>:<template version>`). Builds the 08 input
   (transcript, objectives and topics, objectives ticked in the lesson, quick
   check totals, last summary's What to work on), calls the writing provider,
   checks and retries as in DM-22, and saves a `kavi_drafts` row. It sends the
   tutor **Kavi's draft is ready** (18 NTF-01) and nothing to students.
- Up to 3 attempts per job, 5 minutes apart, as today. After the last one the
  draft is `failed` and 08 SM-02 shows **Kavi couldn't draft this right now.**
  with **Draft from my notes instead**. The recording itself is never held up:
  students can watch it whatever happens to the transcript.
- If the tutor completes the summary (or presses **No summary needed**) before
  the draft is ready, step 2 is cancelled; a transcript already made follows
  the normal retention (DM-25).
- **Turnaround is not promised.** No screen says how long this takes (08 SM-02
  shows progress only). The time from recording ready to draft ready is
  recorded per lesson (DM-28) and measured in the accuracy test (DM-27)
  before any number is written anywhere.

## DM-25 · Safety rules

These apply to every Kavi feature and are tested, not just written down:

- **Drafts only.** Kavi output is stored as a draft (DM-28) and becomes real
  only when a person presses the confirm action named in the owning spec's
  Kavi block. Kavi never sends anything to a student and never changes a
  course plan or topic status (00 section 9, 17).
- **Never pre-ticks, pre-accepts or pre-scores.** Kavi's picks start unticked
  with a **Kavi's pick** badge (08 SM-01); marks and **Got it** / **Needs more
  work** are never filled (10 HW-05, 08 SM-02); course plan changes go through
  CRS-08 with every row unticked. The API rejects a confirm request that
  carries Kavi picks the tutor didn't select.
- **Private notes are never sent to Kavi in this version.** 00 section 16
  allows tutor-only use, but v1 uses none, so the promise in 12 CFG-K
  (**Never sent: private notes**) is simply true. The context builders have no
  access to the private notes columns (DM-10, 06 STU-06). The only notes Kavi
  reads are the separate **Notes for Kavi** box (08 SM-01), including text the
  tutor copied in on purpose with **Use my lesson notes**.
- **Consent gate.** No transcript is made unless every student on the lesson
  consented (DM-24). Without a transcript, Kavi drafts only from notes.
- **Minimum length.** Recordings under 5 minutes are not transcribed.
- **One account at a time.** Every request, draft, job payload and usage row
  carries `school_id`. A context builder reads only that account's rows, and
  only what the asking person may see. No examples, caches or saved context
  are shared between accounts, and no account's data is used in another's
  prompt.
- **Transcripts follow recordings.** A transcript is deleted when its
  recording is deleted, by hand (17 REC-06) or by **Keep recordings for**
  (12 CFG-L), and when any student on the lesson has their data deleted (06
  STU-11). Drafts made from it are deleted with it unless a tutor already
  completed the summary (the completed summary is the tutor's).
- **What is never sent to a provider:** private notes, students' email
  addresses, phone numbers and passwords (12 CFG-K). Student first names are
  sent only where the output needs them (summary, feedback, Ask Kavi).
- **Students never call Kavi** (09). Every Kavi request comes from a tutor or
  admin.

## DM-26 · What Deepgram and Gemini keep

This is what 12 CFG-K **Where your data goes** and 06 STU-11 point to. Read
from the providers' public terms; lines marked **confirm before launch** must
be checked against the signed agreements first.

| Provider | What Kanvise sends | What the provider keeps, and for how long | On deletion in Kanvise |
|---|---|---|---|
| **Deepgram** (`nova-3`, pre-recorded) | The audio of consented recordings of 5 minutes or more | With `mip_opt_out=true` on the request, Deepgram's Model Improvement Program page says data "is retained only for the duration necessary to process the request". Without it, Deepgram may keep samples for model training, so the flag is required on every call. Whether opting out changes the price: **confirm before launch**. Request logs (time, length, model, no audio): **confirm before launch** | Nothing left to delete if the flag was set. Kanvise deletes its own transcript (DM-25) |
| **Google Gemini API** (paid Cloud project) | Transcript text, Notes for Kavi, course plan topics and objectives, lesson summaries, topic statuses and results, typed answers and images of handed-in work (only when the tutor asks for feedback) | Paid tier: Google says it doesn't use prompts or responses to improve its products, and keeps prompts, context and outputs for 55 days only to detect abuse and for legal requests (Gemini API terms and abuse monitoring page). The free tier uses data for training and human review, so Kanvise never uses it. Kanvise sends inline content only (no Files API, no context caching), so nothing else is stored | Kanvise can't delete Google's 55-day abuse logs early; they expire. The privacy policy says so. Whether Google offers zero retention for this use: **confirm before launch** |

**Launch blocker to clear:** the Gemini API additional terms say the service
must not be used in an app "directed towards or likely to be accessed by
individuals under the age of 18". Kanvise students include children and teens
(02 ONB-03). Students never call Kavi, but Google may still count Kanvise as
such an app. Confirm with Google before launch, or move the writing provider
to Vertex AI or another provider under terms that allow it. DM-21 makes that
a configuration change.

## DM-27 · Cost and quality controls

- **No hard monthly cap during early access.** Kavi is not blocked by a quota.
  Usage is watched instead: `kavi_usage` (DM-28) per account per day, and an
  alert to Kanvise (not to the tutor) when an account spends more than 10
  times the median for a week. A cap is decided later from real numbers.
- **Cost is recorded per request:** input and output tokens (from Gemini's
  `usageMetadata`, including thinking tokens) or audio seconds (Deepgram),
  times the price for that model in a price table in code with its date.
- **Kavi cost per lesson**, estimated the same way each time: audio minutes ×
  Deepgram price, plus the summary request's tokens × Gemini price, plus any
  other requests linked to the lesson (lesson plan, homework suggestion).
  Worked example at the prices on the providers' pages when this was written
  (**confirm before launch**): a 60 minute recorded lesson is 60 × $0.0043
  (Deepgram `nova-3` pre-recorded) ≈ $0.26, plus about 12,000 input tokens ×
  $0.30 per million and about 3,000 output tokens × $2.50 per million
  (Gemini 2.5 Flash, paid) ≈ $0.01, so about $0.27. The notes route costs
  about $0.01. Transcription is most of the cost. The measured figure from
  `kavi_usage` replaces this estimate once lessons run.
- **Feedback:** 👍 / 👎 on every draft (04, 05, 08, 11) and **Not now** with
  **Why not?** on suggestion cards (03 DB-06). A 👎 asks one optional
  question, **Why not?**, with chips **Wrong facts**, **Not what we did**,
  **Wrong level**, **Too long**, **Other** and a short text box. Each answer is
  stored with the draft, the feature, and the template version (DM-28).
  Kanvise's team reads it per template version; tutors see only their own
  thumbs. Rule cards (before Kavi) store the same feedback so the rules can be
  improved too.
- **Accuracy test before launch**, with the owner's consent and real or
  staged recordings: Nigerian English accents, children's and teens' voices,
  two speakers talking over each other (tutor and one student), and
  low-bitrate, audio-first recordings as PlugNMeet makes them on weak
  connections. Measure word error rate on a hand-checked sample, whether
  diarization tells tutor and student apart, how many drafts the tutor keeps
  with small edits, and the time from recording ready to draft ready. If
  accuracy is poor, the recording route stays off and the notes route ships
  alone.
- **"About 5 minutes" is unverified.** No screen promises a time until the
  test above measures it (F-21).

## DM-28 · Kavi tables

All **New**, all scoped by `school_id`, all behind the API.

- **`kavi_requests`:** one row per call to a provider. Columns: id,
  `school_id`, person asking, feature (DM-30), template id, template version,
  provider, model, related item (lesson, course, homework, hand-in, quiz,
  check, student), status (`succeeded`, `failed`, `not_enough`, `cancelled`,
  `not_available`), retried (yes or no), failure reason (short, no content),
  input tokens, output tokens, audio seconds, cost (with currency and the
  price table date), started at, finished at, durable job id (for DM-24).
  Inputs and outputs are not stored here.
- **`kavi_drafts`:** what Kavi wrote, kept apart from the real record. Columns:
  id, `school_id`, request id, feature, related item, output (JSON, as checked
  by the template's schema), status (`ready`, `used`, `partly_used`,
  `discarded`, `failed`, `expired`), used by, used at, created at. A draft is
  never shown to students. Drafts that were never used are deleted after 30
  days; used ones are kept while the record they fed exists, so the summary's
  **Kavi draft used** flag (DM-10) and feedback stay explainable.
- **`kavi_feedback`:** id, `school_id`, draft id (or rule card id for rule
  suggestions), feature, template id and version, person, rating (up, down,
  not now), reason chip, text (up to 500 characters), created at.
- **`kavi_usage`:** one row per account per day per feature: requests,
  succeeded, failed, input tokens, output tokens, audio seconds, cost. Built
  from `kavi_requests` by a nightly job; read by Kanvise's team, and later by a
  quota if one is set.
- **`lesson_transcripts`:** id, `school_id`, lesson, recording, storage key (a
  private R2 object, as today's `raw_transcript_key`), provider, model,
  language, audio seconds, speaker count, status (`pending`, `ready`,
  `skipped`, `failed`), skipped reason (consent missing, too short, Kavi off),
  delete after (copied from the recording, DM-09), deleted at, ready at (for
  the turnaround measure in DM-24).
- `live_class_transcript_chunks` and `live_class_transcription_sessions`
  are not reused: Kavi is never live in the classroom in this version (07).
  They join the DM-20 list.
- The Kavi switches, style, language and level names are account settings
  (DM-14).

## DM-29 · Moving `live_class_recaps` into lesson summaries

`live_class_recaps` is folded into the lesson summaries table (DM-10) in one
migration, with a backup first:

- Rows with `published_body` become completed lesson summaries. Their old
  five headings don't map to the new sections, so the text goes into a
  read-only **earlier summary** column shown as written, and the lesson is
  `complete`. No text is rewritten by Kavi.
- Rows in `draft` or `generating` become `kavi_drafts` with status `expired`
  (made by the old prompt, without consent checks), and their lessons become
  **Awaiting summary** so the tutor writes the summary as normal. Rows in
  `failed` or `pending` keep only the lesson status.
- `raw_transcript_key` becomes a `lesson_transcripts` row only if every
  student on the lesson has consent recorded; otherwise the transcript object
  is deleted. Old transcripts follow the recording's retention from then on.
- `publishClassRecap` and the `live_class_recaps` reads in the API are
  replaced by the summary routes (08). The table is then read-only and joins
  DM-20.

## DM-30 · Every Kavi feature

The table the build works from. Each row is built only after its **Without
Kavi** path works.

| Feature | Owning spec and state | Input | Output | Without Kavi |
|---|---|---|---|---|
| Onboarding questions | 02 ONB-01 to ONB-08 | None (scripted, no AI call) | Fixed lines | The same scripted lines; ONB-11 as a form |
| Course plan | 04 CRS-06 | Subject, description and text area, teaching context (02 ONB-03), style and levels | Modules, topics, objectives as a Draft plan (streamed) | **Start blank** or **Copy plan from another course** |
| Regenerate untouched modules | 04 CRS-04 | The plan, which modules are untouched | Redrafted modules in a preview | The tutor edits modules by hand |
| Starting check questions | 04 DIAG-D, DIAG-P | Chosen topics and objectives, subject, level | Two MCQ per topic (streamed) | The tutor writes them in the 11 editor; DIAG-D sends the same way |
| Suggested topic order | 04 DIAG-R | Check results (statuses come from rules) | **Suggested order** card | No card; the tutor orders the Next strip |
| Lesson plan | 05 LP-01 | Lesson topic, linked plan topic and objectives, plan around it, last summary's What we covered and What to work on, lesson length | Objectives, timed structure, activities, check for understanding (tutor-only) | **Write my own** with the template |
| Student questions and suggestions | 06 STU-05 | Goal, topic statuses, completed summaries, homework and quiz results, check results, attendance (no private notes) | Short answer with **Based on** links; up to three **Kavi's pick** cards | Question box hidden; Summary tab cards; rule **Suggestions** |
| Classroom | 07 | None live in v1 | None | Lesson tools as written |
| Summary draft from recording | 08 SM-01, SM-02 | Transcript (all consented, 5 minutes or more), objectives and topics, ticked objectives, quick check totals, last What to work on | What went well, What to work on, unticked **Kavi's pick** topics, one homework suggestion (background job, DM-24) | Blank editor with the same five sections |
| Summary draft from notes | 08 SM-01, SM-02 | **Notes for Kavi** and the same lesson facts | The same draft (streamed) | Blank editor |
| Dashboard suggestions | 03 DB-06 | Summaries (no private notes), plan statuses, check results, marked homework | Extra **Kavi's pick** cards after the rule cards | Rule cards titled **Suggestions** (built first) |
| Homework suggestion | 10 HW-01 (from 08 SM-02) | The summary draft and lesson topics | Title and instructions that **Use this** copies into HW-01 | HW-01 filled in by hand |
| Homework feedback | 10 HW-05 | Title, instructions, the student's typed answer and images, linked topics (only on request, only with the CFG-K switch on) | Feedback in a separate **Kavi's pick** box; never a mark | The tutor writes feedback |
| Quiz questions | 11 QZ-01, QZ-02 | Ticked topics and objectives, subject, levels, reading level, count, difficulty | MCQ with topic and explanation, labelled **Kavi** until checked (streamed) | **Write my own** |
| Kavi settings | 12 CFG-K | None | Settings read by every row above | Section hidden; level names move to CFG-T |
| Student app, billing, resources, recordings, notifications, team | 09, 13, 15, 17, 18, 19 | None | None (18 sends **Kavi's draft is ready** to the tutor) | Unchanged |

The rule cards in 03 DB-06 are the first version of **Kavi suggests**: they
ship with the dashboard, store feedback in `kavi_feedback`, and Kavi's cards
are added after them later.

## Checked against Bobbin

- No Bobbin screenshot shows its data model. The tables here follow what the
  Bobbin screens need and Kanvise copies: per-person attendance with join,
  leave and time in session
  (`09-recordings/screenshots/recording-session--detail.png`), invitations
  with **Invite not accepted** and **Resend invite**
  (`08-team/screenshots/team-member-created--list.png`), the tutor's linked
  courses and activity counts (`07-tutors/screenshots/tutor-created--detail.png`),
  and per-person notification switches
  (`15-tutor-role/screenshots/tutor-profile-notifications.png`).
- Kavi service: Bobbin's plan dialog says AI drafts and the tutor must
  **review every module before using it with students**
  (`15-tutor-role/screenshots/tutor-course-plan-describe.png`), the same
  drafts-only rule as DM-25. Bobbin shows a skeleton while its insights are
  prepared (`03-lessons/screenshots/sample-insights--recheck.png`), as
  Kanvise's preparing state does. Before a lesson Bobbin shows **AI insights
  coming soon** with a list of what AI will write
  (`03-lessons/screenshots/lesson-ended--insights-status.png`); Kanvise
  doesn't copy that placeholder, because every Kavi area has a working manual
  path instead (DM-30). Bobbin's own sessions in the atlas were "too short to
  analyze" (`15-tutor-role/spec.md`), which is why DM-24 sets a 5 minute
  minimum.
