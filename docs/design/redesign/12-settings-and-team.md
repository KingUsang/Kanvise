# 12 · Settings and team

Status: draft for owner review. Builds on `00-decisions.md` (§9, §14c, §14d,
§16, §17, §19), `01-app-shell.md`, `02`, `06` (STU-11), `07`.

**Who:** tutors (personal settings), independent tutors and agency admins
(account settings).
**Goal:** every setting in one place, each explained in one line, easy to find.

## Layout

Checked against `14-settings/screenshots/page--default.png`,
`settings-jump-to.png` and `settings-search-recording.png`.

Route `/settings`. Header **Settings** · "Set up Kanvise the way you teach." On
the right: **Jump to ▾** and **Find a setting** (search), as in Bobbin.

- **Left list** of sections under small group labels (YOU, YOUR TEACHING,
  ACCOUNT). The current section carries the orange "you are here" marker (01
  SH-15).
- **Content** on the right as cards. Each card has a title and **Show details**
  (expands a short paragraph on what the card's settings do). Each setting is a
  row: a title, one line explaining what it does, and a control on the right
  (toggle, field, choice or button).
- **Saving:** toggles and choices save as they're changed, with a small
  **Saved** tick beside the row. Forms with typed fields (My profile, Business
  details) use **Save changes** at the bottom of the card, disabled until
  something changes, as in Bobbin's Your details. Settings that can't be undone
  use a separate button with a confirmation, never a toggle.
- **Loading:** grey skeleton cards in the shape of the section (as Bobbin's
  `billing--entry.png`), never a spinner on a blank page.
- **If a change doesn't save:** the row keeps its old value and shows
  **Couldn't save. Try again.** (01 SH-13).

| Group | Section | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|---|
| YOU | My profile | Yes | Yes | Yes |
| YOU | Sign-in and security | Yes | Yes | Yes |
| YOU | Notifications | Yes | Yes | Yes |
| YOUR TEACHING | Teaching preferences | Yes | Yes | No |
| YOUR TEACHING | Lessons and classroom | Yes | Yes | No |
| YOUR TEACHING | Kavi | Yes | Yes | No |
| ACCOUNT | Business details | Yes | Yes | No |
| ACCOUNT | Billing | Later | Later | No |
| ACCOUNT | Data and privacy | Yes | Yes | No |

Agency tutors see only the YOU group, as Bobbin's tutors see only Your details,
Password, Two-factor and Notifications (`15-tutor-role/screenshots/tutor-profile--default.png`).

Tutors and team members are not managed here. They have their own pages in
the sidebar's PEOPLE group, as in Bobbin (`19-tutors-and-team.md`, CFG-TM).

---

## CFG-P · My profile (`/profile`, also reachable from the account menu)

- **Photo:** upload, crop to a circle. Shown to students in their app.
- **First name**, **Last name**. Card line: **This is the name shown to others
  in Kanvise.**
- **Display name for students:** placeholder **e.g. Mr Alex**. Line: **What
  your students see. Leave blank to use your name.**
- **Subjects you teach:** chips (the same list as onboarding).
- **Short bio (optional):** 300 characters, shown on the student's course page.
- **Timezone:** searchable by city, shown as **Lagos (WAT) · 4:02 PM** rather
  than Bobbin's raw **Africa/Lagos** list. Line: **Lesson times are shown in
  this timezone.**
- **WhatsApp number (optional):** Line: **Used for the WhatsApp buttons you
  see. Never shown to students unless you share it.**
- **I teach too** (agency admins only, a toggle, off by default). Line: **Turn
  this on to be added to courses as a tutor and lead lessons as their tutor.**
  When it is on, the admin appears in the Tutors list of the course wizard (04
  CW-2) and the lesson wizard (05 LW-1), and their own lessons count as a
  tutor's. When it is off, an admin leads a lesson through **Join as an
  admin?** (07 CR-09). Turning it off while they are a course's only tutor
  asks: **You're the only tutor on 2 courses. Choose a new tutor first.** with
  the reassign list (19 TM-10, TM-06).
  This replaces Bobbin's advice in its admin join dialog ("If you teach this
  lesson from another account, join from that account instead",
  `03-lessons/screenshots/classroom--join-dialog.png`): one account can both
  run the agency and teach.
- **Save changes.**

## CFG-S · Sign-in and security

- **Email:** **Change** beside the field. Line: **This is the email you sign
  in with. We'll send a link to confirm a new one.** **Change** opens Bobbin's
  dialog: **Change your email** · "We'll email a link to the new address. Your
  email changes once you open it." · **New email**, **Current password**,
  **Forgot it? Reset your password.** · **Cancel** · **Send link**. The old
  email keeps working until the link is opened.
- **Password:** current password (with **Forgotten it? Reset your
  password.**), new password (**Must be at least 8 characters.**), confirm,
  and **Change password**, as Bobbin's Password card.
- **Signed-in devices:** list with **Sign out** on each and **Sign out
  everywhere else**.
- Two-step sign-in: later (Bobbin has Two-factor; not in this version). When
  it is added, copy Bobbin's start dialog
  (`15-tutor-role/screenshots/tutor-profile-two-factor-setup.png`): **Turn on
  two-factor authentication** · "Confirm your password to start. You'll scan a
  QR code with your authenticator app on the next step." · **Current
  password** · **Cancel** · **Continue** (disabled until typed).

## CFG-N · Notifications

`18-notifications.md` holds the full list (18 NTF-01: every event, who gets
it, on which channel, the default and where it can be switched off). This
section is where a person switches their own rows. It shows only the rows
that can be switched for that person's role, each with a line under the title
and **Push** and **Email** toggles, as Bobbin's personal Notifications card
(`15-tutor-role/screenshots/tutor-profile-notifications.png`):

| Row | Who sees it | Default |
|---|---|---|
| Lesson reminder before my lesson | Anyone who teaches | Push on, email on |
| A student is waiting for my lesson | Anyone who teaches | Push on, email off |
| My lesson hasn't started on time | Anyone who teaches | Push on, email on |
| A student sent a message about a lesson (07 CR-12) | Anyone who teaches | Push on, email off |
| Homework handed in | Anyone who teaches | Push on, email off |
| Quiz finished | Anyone who teaches | Push on, email off |
| Starting check finished | Anyone who teaches | Push on, email on |
| Summary still to write (after 24 h) | Anyone who teaches | Push on, email on |
| Kavi's draft is ready (once Kavi exists) | Anyone who teaches | Push on, email off |
| Courses given to me | Agency tutors, admins with I teach too | Push on, email on |
| Daily summary for admins (18 NTF-06) | Agency admins | Email on (no push) |

Messages a person needs to take part (invitations, moved or cancelled
lessons, password emails) are always sent and have no row here (18 NTF-01,
**Always**).

- A row at the top: **Browser notifications:** **On** / **Turn on** (asks the
  browser), with a note when the browser has blocked them and how to allow
  them.
- Every email that can be switched off has an unsubscribe link (18 NTF-04).
  It switches that row off, without signing in, and shows the small page in 18
  NTF-04 with **Undo** and **Manage notifications** (which opens this
  section).
- Times in emails use the account's timezone (CFG-A), with the zone named, for
  example **4:00 PM WAT** (00 section 19).

## CFG-T · Teaching preferences

The onboarding answers (spec 02), editable:
- **On my own / With a team** (switching to a team shows **Set up your team**,
  `19-tutors-and-team.md`; switching back is only possible with no other team
  members).
- **Who you mostly teach:** Children and teens · Adults · Both. Sets the
  default lesson length (45 minutes for children and teens, otherwise an hour)
  and the reading level of what Kavi writes for students.
- **How you usually teach:** One-to-one · Small groups · Both. Sets how the
  **People** step of the New course wizard starts (spec 02, "What each answer
  changes").
- **Subjects.** Suggested first in the New course wizard's Subject field.
- Line: **These change your defaults and what Kanvise suggests. They never
  delete anything.**

## CFG-L · Lessons and classroom

Checked against `14-settings/screenshots/settings-lessons--full.png`,
`settings-lessons-reorder.png` and `settings-lessons-reset-confirmation.png`.

**Lessons** card:
- **Default lesson length:** 30 / 45 / 60 / 90 min. Starts at 45 if onboarding
  said Children and teens, otherwise 60.
- **Classroom opens for students:** 5 / 10 / 15 (default) / 30 minutes before.
  This gates students only: tutors and admins can always go in early to set up
  (05 LP-01). The amber **Starting soon** status starts at the same time.
- **Remind students:** 30 min before (default), also 24 hours before (toggle).
- **End lessons automatically:** after everyone leaves, wait 5 / 10 (default)
  / 15 / 30 minutes (toggle, on). After an automatic end the tutor can restart
  the lesson for 60 minutes (07 CR-06).
- Cameras are off on entry for everyone, with no setting to change it (07,
  Room settings; F-43).

**Recordings** card:
- **Record lessons:** on by default, but a lesson is recorded only when every
  student in it has recording consent (00 section 14d, 06 STU-05). Line:
  **Lessons are recorded only when every student has consent. Recordings let
  Kavi draft your lesson summary and let students watch the lesson again.**
  Everyone sees that a lesson is being recorded when they join (07 CR-01,
  CR-04), so there is no separate "show a recording notice" switch.
- **Students can watch recordings:** on by default.
- **Keep recordings for:** 30 / 90 (default) / 365 days. Line: **Recordings are
  deleted after this. Summaries are kept.** Applying a shorter period to older
  recordings is a separate button: **Apply to existing recordings**, with a
  confirmation stating how many will be deleted.

**Test classroom:** button, opens the device check (07 CR-10).

## CFG-K · Kavi

Checked against `14-settings/screenshots/settings-ai-content-style--full.png`
and `settings-ai-style-compare.png`.

**Writing style** card (Bobbin's AI content style):
- Card line: **One style shapes what Kavi drafts for you: lesson summaries,
  course plans and homework instructions. A change only affects what Kavi
  writes from now on.**
- A short table of the three styles, and on the right an **In use** box with
  the current style, its line and **Compare styles**:

| Style | What it means |
|---|---|
| **Detailed** | Full sentences in every section, with an example from the lesson |
| **Structured** (default) | Short bullet points under each section heading. Best for reading on a phone |
| **Concise** | One or two sentences per section |

- **Compare styles** opens a large dialog, **Choose a writing style**: the same
  sample lesson summary written three ways, **Side by side** (default on
  desktop) or **One at a time** (the only view on phones, with arrows). The
  style in use is tinted with **In use** and **Currently in use** (disabled);
  the others have **Use Structured** / **Use Concise**. Choosing one closes the
  dialog with the toast **Kavi will use Concise from now on.**

**Language and levels** card:
- **Language:** English, written in British spelling. One default for every
  account; there is no US English choice. When Kavi mentions a level it uses
  the account's level names below (for example **SS2** or **Year 9**); with
  **None** it names no level. The sample course and the examples in these
  specs stay general (**Algebra 1 Small Group**, 00 section 13).
- **How you name levels (optional):** **None** (default) · **JSS / SS** ·
  **Year (Year 1 to 13)** · **Grade (Grade 1 to 12)**. Used as the choices for
  a course's level, and in what Kavi writes (course plans, quiz and check
  questions). Line: **Kavi uses these names when it mentions a level.**
- The reading level for students comes from **Who you mostly teach** (CFG-T).

**What Kavi does** card (toggles):
- **Kavi drafts lesson summaries:** on.
- **Kavi suggestions on the dashboard:** on (03 DB-06).
- **Kavi can read handed-in work when you ask for feedback:** on. Line:
  **Only when you press Draft feedback with Kavi (10 HW-05).**
- Line: **Kavi only drafts. Nothing reaches your students until you complete,
  set or send it.**

**Where your data goes** card (read-only, no controls): Kavi runs on two
outside services. Named here so tutors and admins know what leaves Kanvise.

| Service | What it does | What is sent | When |
|---|---|---|---|
| **Deepgram** | Turns lesson audio into a transcript | The audio of recorded lessons | Only for lessons recorded with every student's consent |
| **Google Gemini** | Writes Kavi's drafts | Transcript text, Notes for Kavi (08), course plan topics and objectives, lesson summaries, topic statuses and results (for suggestions and Ask Kavi), the typed answers and images of handed-in work (only when the tutor asks for feedback) | Each time Kavi drafts something |

Under the table: **Never sent: private notes (00 section 16), students' email
addresses and phone numbers, passwords.** and **What these services keep, and
for how long, is listed in the data model (20 DM-26).** with a link to
the privacy policy. In short: Deepgram keeps no audio after the transcript is
made; Google keeps Kavi's requests for 55 days to check for abuse, and never
uses them to train its models.

### Kavi

- Input: none; this section configures Kavi.
- Output: the style, language, level names and switches are read by every
  Kavi draft (04, 08, 10, 11, 03 DB-06).
- Failure state: if a change can't be saved, the row shows **Couldn't save.
  Try again.** and keeps the old value. The compare dialog's samples are fixed
  text, so it never waits on Kavi.
- What the tutor must confirm: choosing a style (**Use Structured**) or
  switching a toggle. Nothing changes what was already written.
- Without Kavi: the Kavi section is not shown in the left list. **How you name
  levels** moves to Teaching preferences (CFG-T), since course levels still
  use it.

## CFG-A · Business details

- **Name:** the agency name, or the independent tutor's account name.
- **Logo** (agencies) or photo (independent tutors): shown in the student app.
- **Country and currency:** used later for billing.
- **Timezone:** the account's timezone. Line: **Used for times in emails and
  as the starting timezone for new students.** (Bobbin's General › Timezone,
  `14-settings/screenshots/settings-general--full.png`.)
- **Save changes.**

There is no public web address setting: public pages are retired (00 section
15, F-63).

## CFG-TM · Team (moved)

Tutors and team members moved to `19-tutors-and-team.md`: the Tutors list,
Add tutor, the tutor page, the Team page, removing someone with the required
Reassign step, **I teach too** and the 50-invitations-an-hour limit (19 TM-01
to TM-11). Settings keeps only the **I teach too** toggle (CFG-P) and
**On my own / With a team** (CFG-T).

## CFG-D · Data and privacy

Checked against `14-settings/screenshots/settings-data-export--full.png`.

- **Export a student's data:** as Bobbin's Data export: **Student** (search),
  then **Request export**. Line: **We'll email you a link to download
  everything Kanvise holds about this student. The link works for 7 days.**
- **Export everything:** all students, courses, lessons, summaries and
  homework as CSV files in a ZIP. **Request export** emails a download link
  when ready.
- **Delete a student's data:** pick a student; the dialog follows 06 STU-11
  (what is deleted, what is kept, including group recordings with the
  student's name removed, and the copies held by the services in CFG-K).
  Confirmation requires typing the student's name.
- **Close account:** later (owner deferred the account-closure policy).

## Search and Jump to

- **Find a setting** replaces the content with a results card, as in Bobbin:
  **3 settings matching "record"**, each row with the setting's title, its
  line, and where it lives on the right (**Lessons and classroom ›
  Recordings**). Choosing a row opens that section and highlights the row for
  two seconds. No results: **No settings match "zoom".**
- **Jump to ▾** lists the cards in the current section (for Lessons and
  classroom: **Lessons**, **Recordings**) and scrolls to the one chosen.

## Data needed (for the build)

Tables are in `20-data-model.md`: settings DM-14, notification preferences and
unsubscribe tokens DM-15, people DM-01.

- Personal settings (profile, I teach too, notification preferences per
  channel, unsubscribe tokens).
- Account settings (teaching preferences, lesson defaults, recording rules,
  Kavi style, level names, Kavi switches, timezone).
- Team members and invitations: see 19 and DM-02.
- Per-student export, full export, and per-student deletion jobs.

## Checked against Bobbin

- `14-settings/screenshots/page--default.png`: header, Jump to and Find a
  setting top right, grouped left list, cards with **Show details**, toggle
  rows with title and line.
- `14-settings/screenshots/settings-jump-to.png`: Jump to lists the cards in
  the current section (was "every section" here; corrected).
- `14-settings/screenshots/settings-search-recording.png`: search shows a
  results card with a count and a breadcrumb per row (was "filters the left
  list"; corrected).
- `14-settings/screenshots/settings-lessons--full.png`, `settings-lessons-reorder.png`,
  `settings-lessons-reset-confirmation.png`: Lessons, Recordings and Consent
  cards; **Apply to existing recordings** beside **Days to keep recordings**;
  "Start a lesson before students join their tutor" (Kanvise has no admit
  step, so this is not copied). Bobbin's approval and Lesson insights cards
  are not copied (approvals out of scope; the summary has fixed sections).
- `14-settings/screenshots/settings-ai-content-style--full.png`, `settings-ai-content-style.png`,
  `settings-ai-style-compare.png`: Detailed / Structured / Concise, the In use
  box with Compare styles, the compare dialog with Side by side / One at a
  time, Currently in use, Use Structured, and "a change only affects content
  generated from now on".
- `14-settings/screenshots/settings-general--full.png`, `settings-general-timezone-options.png`:
  the account timezone row (CFG-A).
- `14-settings/screenshots/settings-emails--full.png`, `settings-emails.png`:
  Bobbin's account-wide email switches; Kanvise keeps per-person rows here and
  the full list in `18-notifications.md`.
- `14-settings/screenshots/settings-data-export--full.png`: per-person export
  (CFG-D).
- `14-settings/screenshots/settings-safeguarding--full.png`, `settings-safeguarding.png`,
  `settings-api--full.png`, `settings-api-create-key.png`, `settings-webhooks--full.png`,
  `settings-webhook-add-endpoint.png`, `settings-studybugs--full.png`,
  `settings-beta--full.png`, `settings-beta-feedback.png`, `settings-activity--full.png`,
  `settings-activity-filter.png`, `billing--entry.png`, `billing--loaded.png`,
  `billing--starter-selected.png`: not copied (automatic safeguarding flags,
  API, MCP, webhooks, Studybugs, beta features and the activity log are out of
  scope; Bobbin's Billing is its own subscription plans, not tutors billing
  students, which is the spec 13 proposal). `billing--entry.png` gives the
  skeleton loading state used in Layout.
- `15-tutor-role/screenshots/tutor-profile--default.png`, `tutor-profile-email-change.png`,
  `tutor-profile-password.png`, `tutor-profile-notifications.png`: Your details
  card with **Save changes**, the email and timezone lines, the Change your
  email dialog, the Password card, and a tutor's reduced settings list (CFG-P,
  CFG-S, CFG-N).

Final Bobbin pass (FEAT-009):
- `15-tutor-role/screenshots/tutor-profile-two-factor-setup.png`: Turn on two-factor authentication dialog (CFG-S, later).
- `15-tutor-role/screenshots/tutor-account-menu.png`: tutors reach settings from the sidebar; the account menu only signs out.
