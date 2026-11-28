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
section and is written in the next pass.

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
  new. Transcripts (`live_class_transcript_chunks`,
  `live_class_transcription_sessions`) belong to the Kavi service section.

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
  API, and are never sent to Kavi (00 section 16). Keeping them in their own
  column (or table) makes that rule easy to enforce and test.
- **Owning spec:** 08 (SM-01 to SM-07); student view 09 SA-05.
- **Staging:** `live_class_recaps` (`draft_body`, `published_body`, status
  `pending`, `generating`, `draft`, `published`, `failed`).
- **New or existing:** New table for lesson summaries. `live_class_recaps`
  will be folded into it: its drafts become Kavi drafts (Kavi service
  section) and its published text becomes the summary sections.

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
    feedback draft is kept apart from the feedback (Kavi service section).
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
| `live_class_quick_checks` | Kept only if Quick check (07) reuses it; otherwise replaced by quiz questions |

## Kavi service (built last)

Written in the next pass. This section will describe what Kavi reads (never
private notes), what Deepgram and Google Gemini receive and keep and for how
long, Kavi drafts and their feedback, transcripts
(`live_class_transcript_chunks`, `live_class_transcription_sessions`), the
per-account limits and cost per lesson, failure handling, and the copies
removed when a student's data is deleted (06 STU-11).

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
