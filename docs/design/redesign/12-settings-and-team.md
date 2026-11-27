# 12 · Settings and team

Status: draft for owner review. Builds on `00-decisions.md`, `01-app-shell.md`.

**Who:** tutors (personal settings), agency admins (account and team settings).
**Goal:** every setting in one place, each explained in one line, easy to find.

## Layout

Route `/settings`. Header **Settings** · "Set up Kanvise the way you teach." On
the right: **Find a setting** (search) and **Jump to ▾**.

A left list of sections (underline-style active marker in orange), the content
on the right as cards. Each setting is a row: a title, one line explaining what
it does, and a control on the right (toggle, field, or button). Changes save as
they're made, with a small **Saved** tick beside the row. Settings that can't
be undone use a separate button with a confirmation, never a toggle.

| Group | Section | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|---|
| YOU | My profile | Yes | Yes | Yes |
| YOU | Sign-in and security | Yes | Yes | Yes |
| YOU | Notifications | Yes | Yes | Yes |
| YOUR TEACHING | Teaching preferences | Yes | Yes | No |
| YOUR TEACHING | Lessons and classroom | Yes | Yes | No |
| YOUR TEACHING | Kavi | Yes | Yes | No |
| ACCOUNT | Business details | Yes | Yes | No |
| ACCOUNT | Team | No | Yes | No |
| ACCOUNT | Billing | Later | Later | No |
| ACCOUNT | Data and privacy | Yes | Yes | No |

---

## CFG-P · My profile (`/profile`, also reachable from the account menu)

- **Photo:** upload, crop to a circle. Shown to students in their app.
- **First name**, **Last name**.
- **Display name for students:** placeholder **e.g. Mr Alex**. Line: **What
  your students see. Leave blank to use your name.**
- **Subjects you teach:** chips (the same list as onboarding).
- **Short bio (optional):** 300 characters, shown on the student's course page.
- **Timezone:** searchable, with the current local time.
- **WhatsApp number (optional):** Line: **Used for the WhatsApp buttons you
  see. Never shown to students unless you share it.**

## CFG-S · Sign-in and security

- **Email:** change it (sends a confirmation to the new address; the old one
  keeps working until confirmed).
- **Password:** **Change password** (current, new, confirm).
- **Signed-in devices:** list with **Sign out** on each and **Sign out
  everywhere else**.
- Two-step sign-in: later.

## CFG-N · Notifications

Rows with **Push** and **Email** toggles:

| Notification | Default |
|---|---|
| Lesson reminder (30 min before) | Push on, email on |
| A student is waiting for my lesson | Push on, email off |
| My lesson hasn't started on time | Push on, email on |
| Homework handed in | Push on, email off |
| Quiz finished | Push on, email off |
| Starting check finished | Push on, email on |
| Summary still to write (after 24 h) | Push on, email on |
| Weekly round-up (Monday morning) | Email on |

A row at the top: **Browser notifications:** **On** / **Turn on** (asks the
browser), with a note when the browser has blocked them and how to allow them.

## CFG-T · Teaching preferences

The onboarding answers (spec 02), editable:
- **On my own / With a team** (switching to a team shows **Set up your team**,
  CFG-TM; switching back is only possible with no other team members).
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

- **Default lesson length:** 30 / 45 / 60 / 90 min. Starts at 45 if onboarding
  said Children and teens, otherwise 60.
- **Classroom opens:** 5 / 10 / 15 (default) / 30 minutes before. This gates
  students only: tutors and admins can always go in early to set up (05 LP-01).
  The amber **Starting soon** status starts at the same time.
- **Remind students:** 30 min before (default), also 24 hours before (toggle).
- **End lessons automatically:** 10 minutes after everyone leaves (toggle, on).
- **Record lessons:** on by default. Line: **Recordings let Kavi draft your
  lesson summary and let students watch the lesson again.** When on, everyone
  sees **This lesson is being recorded** when they join.
- **Students can watch recordings:** on by default.
- **Keep recordings for:** 30 / 90 (default) / 365 days. Line: **Recordings are
  deleted after this. Summaries are kept.** Applying a shorter period to older
  recordings is a separate button: **Apply to existing recordings**, with a
  confirmation stating how many will be deleted.
- **Students' cameras:** **Off when they join** (default) · **On when they
  join**.
- **Test classroom:** button, opens the device check (spec 07, CR-10).

## CFG-K · Kavi

- **Kavi drafts lesson summaries:** on by default.
- **Kavi suggestions on the dashboard:** on by default.
- **Writing style:** **Short** · **Balanced** (default) · **Detailed**, shown
  side by side as the same lesson summary written three ways (like Bobbin's AI
  content style), each with **Use this style**.
- **Language for students:** **UK English** · **US English** (affects
  spelling in what Kavi writes).
- Line: **Kavi only drafts. Nothing reaches your students until you complete
  it.**

## CFG-A · Business details

- **Name:** the agency name, or the independent tutor's account name.
- **Logo** (agencies) or photo (independent tutors): shown in the student app.
- **Address for students (optional):** web address for links,
  `kanvise.com/{slug}`, with a warning when changing it: **Old links will stop
  working.**
- **Country and currency:** used later for billing.
- **Default timezone** for new students.

## CFG-TM · Team (agencies)

Two tabs: **Tutors** · **Admins**.

**Tutors:**
- List: name, email, courses (count), status (**Active**, **Invite not
  accepted**), and **⋯** (Resend invite, Remove).
- **Invite a tutor** dialog: first name (optional), last name, email, and
  **Courses (optional)**. Line: **We'll email them an invite to set a password
  and sign in. They'll see only the courses you give them.** Button **Send
  invite**.
- **Remove tutor:** **Remove Michael Chen? They'll lose access straight away.
  Their courses need a new tutor before their next lessons.** with a list of
  affected courses and a **Reassign to** dropdown. **Remove** (red).

**Admins:**
- List as above.
- **Invite an admin** dialog: as above. Line: **Admins can see and change
  everything in this account, including other tutors' courses.**
- **Remove admin:** as above, without reassignment. The last admin can't be
  removed: **There must be at least one admin.**

## CFG-D · Data and privacy

- **Export your data:** all students, courses, lessons, summaries and homework
  as CSV files in a ZIP. **Request export** emails a download link when ready.
- **Delete a student's data:** pick a student; explains what's deleted
  (profile, work, recordings) and what's kept (anonymised lesson counts).
  Confirmation requires typing the student's name.
- **Close account:** later (owner deferred the account-closure policy).

## Search and Jump to

- **Find a setting** filters the left list and highlights matching rows as you
  type (for example "record" shows Record lessons, Students can watch
  recordings, Keep recordings for).
- **Jump to ▾** lists every section.

## Data needed (for the build)

- Personal settings (profile, notification preferences per channel).
- Account settings (teaching preferences, lesson defaults, recording rules,
  Kavi preferences).
- Team members and invitations (today's account invitations).
- Export job and per-student deletion job.
