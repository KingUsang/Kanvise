# 18 · Notifications

Status: draft for owner review. Builds on `00-decisions.md` (§14a, §16, §17,
§19), `01-app-shell.md` (SH-08), `03`, `04`, `05` (LP-03, LP-04), `06`, `07`
(CR-11, CR-12, CR-13), `08` (SM-04), `09` (SA-09, SA-10), `10`, `11`, `12`
(CFG-N, CFG-L), `19`.

**Who:** everyone. Tutors and admins switch their own rows in 12 CFG-N;
students switch theirs in 09 SA-10.
**Goal:** one list of every message Kanvise sends: what triggers it, who gets
it, how, whether it is on by default, and where it can be switched off. Other
specs point here instead of listing messages themselves.

## Flow at a glance

```
Something happens (a lesson is moved, a student hands in, ...)
  → was it done with an Undo toast? → hold until the undo window closes (NTF-03)
  → NTF-01 matrix: recipients, channels, default
  → recipient's switches (12 CFG-N, 09 SA-10) and account settings (12 CFG-L)
  → no email address? → nothing automatic; the tutor gets Send on WhatsApp (NTF-05)
  → delivered: Bell (students), Page, Push, Email (NTF-04 email rules)
```

## Channels

| Channel | What it is | Who has it |
|---|---|---|
| **Bell** | The notification list in the student app's top bar (09 SA-09) | Students |
| **Page** | The thing shows where it belongs: dashboard Needs attention (03 DB-05), the lesson page's Activity (05), Lesson tools (07). There is no notification list for tutors, as in Bobbin | Tutors and admins |
| **Push** | Browser or installed-app push, once the person allows it | Everyone with push on |
| **Email** | Sent to the person's email address, with the rules in NTF-04 | Everyone with an email |

WhatsApp is never sent by Kanvise. Where a student has no email, the tutor
gets a prefilled **Send on WhatsApp** or **Copy message** button (NTF-05).

**Toasts are not notifications.** A toast (01 SH-08) tells the person who just
acted that it worked (**Lesson moved to Tue 2 Dec, 10:00 AM.**). A
notification tells someone else. The same event can do both: the tutor sees
the toast, the student gets the notification after the undo window.

---

## NTF-01 · The notification matrix

**Default:** **Always** means the message can't be switched off, because the
person needs it to take part (an invitation, a moved lesson). **On** or **Off**
is the starting value of a switch. **Setting** names where the switch is.

### Accounts and team

| Event | Recipient | Channel | Default | Setting |
|---|---|---|---|---|
| Student invited (06 STU-03) | The student | Email | Always | None |
| Invitation not accepted after 3 days (one reminder only) | The student | Email | Always | None |
| Student accepted the invitation | The tutor who invited them, and the course's tutors | Page (Students list status) | Always | None |
| Tutor invited (19 TM-03) | The tutor | Email | Always | None |
| Team member invited (19 TM-08) | The new admin | Email | Always | None |
| Tutor or team member accepted | The admin who invited them | Page (Tutors or Team list status) | Always | None |
| Invitation resent | The invited person | Email (new link; the old one stops working) | Always | None |
| Tutor removed from the agency (19 TM-06) | The tutor | Email: **You no longer have access to Science Students Academy.** | Always | None |
| Team member removed (19 TM-09) | The admin | Email, as above | Always | None |
| A course is given to a tutor (created, reassigned, 19 TM-06) | The new tutor | Page, Push, Email | On | CFG-N **Courses given to me** |
| A course's tutor changes | Students on the course | Bell, Push, Email: **Priya Shah is now your tutor for Algebra 1.** | Always | None |
| Email change requested (12 CFG-S) | The new address | Email with the confirm link | Always | None |
| Password changed, password reset | The person | Email | Always | None |
| Data export ready (12 CFG-D, 17 REC-05) | The person who asked | Email with a 7-day link | Always | None |

### Lessons and the classroom

| Event | Recipient | Channel | Default | Setting |
|---|---|---|---|---|
| Lesson or series scheduled (05 LW-3) | Students on it | Bell, Push, Email (one email for a whole series) | Always | None |
| Lesson rescheduled (05 LP-03), held (NTF-03) | Students on it | Bell, Push, Email | Always | None |
| Series changed (This and following lessons) | Students on it | Bell, Push, Email, one message: **Your Monday lessons move to 5:00 PM from 8 Dec.** | Always | None |
| Lesson cancelled (05 LP-04), held (NTF-03) | Students on it | Bell, Push, Email, with the tutor's message if any | Always | None |
| Student added to or removed from a lesson | That student | Bell, Push, Email | Always | None |
| Reminder before the lesson (NTF-02) | Students on it | Bell, Push, Email | On, 30 minutes before; 24 hours before is off | Account: 12 CFG-L **Remind students**. Student: SA-10 **Push**, **Email reminders** |
| Reminder before the lesson (NTF-02) | The lesson's tutor | Push, Email | On, 30 minutes before | CFG-N **Lesson reminder before my lesson** |
| Tutor starts the lesson | Students on it who aren't in yet | Bell, Push. Never email (it would arrive after the start) | On | SA-10 **Push** |
| Tutor presses **Remind** in Lesson tools (07 CR-03) | That student | Bell, Push; Email only when the student has no push | Always (a person sent it) | None |
| A student is waiting and the lesson hasn't started (07 CR-11) | The lesson's tutor | Push, Page | On | CFG-N **A student is waiting for my lesson** |
| 10 minutes after the start, not started (07 CR-11) | The lesson's tutor | Push, Email | On | CFG-N **My lesson hasn't started on time** |
| Not held lesson marked as cancelled (05 LP-02) | Nobody, unless the tutor ticks **Let students know**; then the students on it | Bell, Push, Email, as for a cancelled lesson; held (NTF-03) | Off (the tick starts unticked) | The tick in LP-02 |
| Lesson becomes Not held (05) | The lesson's tutor | Page (Lessons, Not held tab). Admins: dashboard and the daily summary (NTF-06) | Always | None |
| Tutor sends a **Let {student} know** chip (07 CR-12) | The chosen students | Bell, Push; Email when the student has no push | Always (a person sent it) | None |
| Student sends a chip: Running late, Can't make it, Need another time (07 CR-12, 09) | The lesson's tutor | Page (lesson Activity, Lesson tools), Push; Email when the tutor has no push | On | CFG-N **A student sent a message about a lesson** |
| Link opened on a second device (05 LP-05) | The lesson's tutor | Lesson tools notice only | Always | None |
| **Report a concern** sent (07 CR-13) | Agency admins, or Kanvise support | Email | Always | None |

### Lesson summaries and recordings

| Event | Recipient | Channel | Default | Setting |
|---|---|---|---|---|
| Summary completed (08 SM-04), held (NTF-03) | Students on the lesson | Bell, Push. Not emailed (00 section 6) | On | SA-10 **Push** |
| Summary edited after it was completed (08 SM-04) | Students on the lesson | Bell only: **Michael updated the summary of Monday's lesson.** At most once a day per summary; edits to private notes never notify | On | None |
| **No summary needed** (08 SM-07) | Nobody | None | n/a | n/a |
| Lesson marked **Missed** (08 SM-06) | Nobody, unless the tutor ticks **Let Casey know**; then that student | Bell only: **You missed today's lesson. Michael will be in touch about the next one.** No-email students get nothing automatic (NTF-05) | Off (the tick starts unticked) | The tick in SM-06 |
| Summary still to write 24 hours after the lesson (08 SM-04) | The lesson's tutor | Push, Email, once | On | CFG-N **Summary still to write** |
| Kavi's draft is ready (08, once Kavi exists) | The lesson's tutor | Push, Page | On | CFG-N **Kavi's draft is ready** |
| Recording ready (17) | The lesson's tutor | Page (17 REC-01, lesson Session tab) | Always | None |
| Recording ready (17 REC-08) | Students allowed to watch it | Bell | On | None |
| Recording failed (17) | The lesson's tutor | Page (lesson Session tab, 17 REC-02) | Always | None |

### Homework, quizzes and starting checks

| Event | Recipient | Channel | Default | Setting |
|---|---|---|---|---|
| Homework set (10 HW-01) | The chosen students | Bell, Push, Email | On | SA-10 **Push**; email always (it carries the due date) |
| Homework due date changed (10) | The chosen students | Bell, Push | On | SA-10 **Push** |
| Tutor presses **Remind** on homework (10 HW-03) | Students who haven't handed in | Bell, Push | Always (a person sent it) | None |
| Homework overdue | Nobody automatically. The student's app shows it as late; tutors see it in Needs attention (03) and admins in the daily summary | n/a | n/a | n/a |
| Homework handed in (10 HW-04) | The course's tutors | Push, Page. Grouped: **3 students handed in Simultaneous equations worksheet.** (one push per homework per 30 minutes) | On | CFG-N **Homework handed in** |
| Homework marked (10 HW-05) | The student | Bell, Push | On | SA-10 **Push** |
| Asked to redo (10 HW-05) | The student | Bell, Push | On | SA-10 **Push** |
| Quiz set (11) | The chosen students | Bell, Push | On | SA-10 **Push** |
| Quiz finished (11) | The course's tutors | Push, Page | On | CFG-N **Quiz finished** |
| Starting check sent (04 DIAG-D) | The student | Email with the check link; Bell when they have an account | Always | None |
| Tutor presses **Send a reminder** on a starting check (04 DIAG-R) | The student | Email, or the tutor's WhatsApp button | Always (a person sent it) | None |
| Starting check finished (04 DIAG-R) | The course's tutors | Push, Email, Page | On | CFG-N **Starting check finished** |

### Agency admins

| Event | Recipient | Channel | Default | Setting |
|---|---|---|---|---|
| Daily summary (NTF-06) | Each agency admin | Email, only on days with something in it | On | CFG-N **Daily summary for admins** |
| Weekly round-up | Dropped. The daily summary and the dashboard cover it (F-48) | n/a | n/a | n/a |

## NTF-02 · Who gets lesson reminders

The owner's default "reminders go to tutors" is read like this. It needs the
owner's confirmation in review.

1. **Every lesson reminds its tutor.** The tutor of a lesson (including an
   admin with **I teach too** who is the tutor) gets a push and email 30
   minutes before: **Your lesson with Casey starts at 4:00 PM. Open
   classroom.** On by default, switchable in 12 CFG-N. Admins who don't teach
   the lesson get no reminder.
2. **Students are reminded too, by the account's setting.** 12 CFG-L **Remind
   students** (30 minutes before, on; 24 hours before, off) decides what
   students get. A student can switch off push or email reminders in 09
   SA-10.
3. **Chasing people is pressed by the tutor.** Apart from the one automatic
   invitation reminder after 3 days, reminders that chase someone (homework
   not handed in, an unfinished starting check, a payment in spec 13) are only
   sent when the tutor presses **Remind** or **Send a reminder**. Kanvise never
   chases students on its own.

## NTF-03 · Held messages

Follows 01 SH-08: a message caused by an action that has an **Undo** toast is
held until the undo window closes (the person dismisses the toast, leaves the
page, or 5 minutes pass). **Undo** inside the window means nothing is sent.

Held today: lesson rescheduled (05 LP-03), lesson cancelled (05 LP-04),
summary completed (08 SM-04), and any other action whose toast has **Undo**.
The **Send on WhatsApp** and **Copy message** buttons for no-email students
appear only once the window has closed, so a tutor can't send a message about
a change they then undo.

## NTF-04 · Email rules

- **From:** **Michael Chen via Kanvise** (or the agency name) so the student
  knows who it is about.
- **Times** use the account's timezone with the zone named (**4:00 PM WAT**,
  00 section 19). When the student's own timezone (06) is different, their
  time is added: **4:00 PM WAT (3:00 PM your time)** (05 Timezones and
  series).
- **Unsubscribe:** every email that can be switched off has an unsubscribe
  link at the bottom. It works without signing in and shows a small page:
  **You won't get lesson reminder emails any more.** with **Undo** and **Manage
  notifications** (12 CFG-N, or 09 SA-10 for students). The email also carries
  the one-click unsubscribe header for mail apps.
- **Essential emails** (Default **Always** in NTF-01) have no unsubscribe link.
  Their footer says why they were sent: **You're getting this because Michael
  Chen teaches you on Kanvise.**
- **Language:** plain, short, one button. Private notes are never in an email
  (00 section 16). Summaries are not emailed (00 section 6).
- **A bounced email** is shown on the lesson page's Activity (**Email to Casey
  couldn't be delivered.**) with **Send on WhatsApp** or **Copy message**, and
  on the student's page as **Email bouncing** beside the address (06).

## NTF-05 · Students without an email

No-email students are a small edge case (00 section 14a). They get nothing
automatically: no email, and no Bell or Push because they have no account.

Where a message would have gone to them, the tutor gets a ready-made one:
- **Send on WhatsApp** (prefilled, when the student has a phone number, 06) or
  **Copy message** (when they don't).
- Shown after the undo window for: a new lesson or series, a reschedule, a
  cancellation (05 LP-03, LP-04), a completed summary (**Copy summary**, 08
  SM-04), a chip (07 CR-12) and the join link (05 LP-05).
- Lesson reminders are not prepared for them; the tutor sends the join link
  instead.

## NTF-06 · Daily summary for agency admins

Bobbin has no equivalent; it answers F-32 so an admin can see the team's day
without opening the dashboard.

- One email per admin, at 7:00 AM in the account's timezone, only on days when
  at least one line has something in it.
- Subject: **Science Students Academy today: 3 summaries overdue, 1 lesson didn't start**.
- Body, the same three counts as the dashboard's admin rows (03 DB-05), each
  with a link to the filtered list:
  - **Summaries overdue, by tutor** (lesson ended over 48 hours ago, no summary
    and not **No summary needed**): **Michael Chen 2 · Priya Shah 1**.
  - **Lessons that didn't start yesterday** (Not held): topic, course, tutor,
    time.
  - **Hand-ins waiting over 3 days**, by tutor: **Michael Chen 4 (oldest 5
    days)**.
- Footer: unsubscribe link (it switches off CFG-N **Daily summary for admins**).
- Lessons without a tutor (19 TM-06) are listed first when there are any.

## NTF-07 · Turning on push

- Tutors: the row at the top of 12 CFG-N: **Browser notifications:** **On** /
  **Turn on**. When the browser has blocked them: **Your browser is blocking
  notifications. Allow them in the site settings, then come back.**
- Students: the one-time Home card in 09 SA-09 (**Get a reminder before each
  lesson.**), and the switch in SA-10.
- Kanvise asks the browser only after the person presses **Turn on**, never on
  page load.
- On a phone, push needs the installed app on some browsers. The card then
  says: **Add Kanvise to your home screen to get reminders.** (09 SA-10
  **Install Kanvise on your phone**).

## NTF-08 · States

- **Saving a switch** (12 CFG-N, 09 SA-10): the row shows a small **Saved**
  tick; if it fails: **Couldn't save. Try again.** and the old value stays (01
  SH-13).
- **Student Bell list** (09 SA-09): loading is three grey skeleton lines;
  empty: **You're all caught up.**; error: **Couldn't load your notifications.
  Try again.** Opening the list marks everything as read; each item opens the
  thing it is about.
- **Unsubscribe page:** works without signing in. If the link is old or
  already used: **This link has expired. Sign in to manage your
  notifications.**

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor | Student |
|---|---|---|---|---|
| Switch own rows | CFG-N | CFG-N, plus Daily summary | CFG-N | SA-10 (Push, Email reminders) |
| Account reminder rules (12 CFG-L) | Yes | Yes | No | No |
| See delivery problems (bounces) | Yes | Yes | Their students | No |

## Data needed (for the build)

Tables are in `20-data-model.md`: notifications, deliveries, preferences and
unsubscribe tokens DM-15, held messages DM-15, settings DM-14, chip messages
DM-16. The existing `notifications`, `notification_deliveries`,
`email_deliveries` and `push_subscriptions` tables are extended, not replaced.

### Kavi

- Input: none. Kavi never sends a message.
- Output: none. The daily summary and every message here are fixed text with
  counts from the database.
- Failure state: none.
- What the tutor must confirm: nothing; every student message comes from
  something the tutor did (scheduled, completed, set, sent).
- Without Kavi: the same, except the **Kavi's draft is ready** row isn't
  shown in CFG-N.

## Checked against Bobbin

- `14-settings/screenshots/settings-emails--full.png`, `settings-emails.png`:
  Bobbin's account-wide Emails card (attendance emails 10 minutes into the
  lesson, lesson-scheduled emails, reminder emails, rescheduled or cancelled
  emails, course details to clients, client copies). Kanvise keeps the events
  (scheduled, reminders, moved, cancelled) but makes scheduling and changes
  always-on for students, puts reminder timing in 12 CFG-L, and drops the
  client and attendance emails (no clients, and an email 10 minutes into a
  lesson arrives too late, the same reason the "lesson started" email is
  dropped).
- `15-tutor-role/screenshots/tutor-profile-notifications.png`: Bobbin's
  personal Notifications card (**Lesson ready for review**, transcript checks,
  feedback updates), one toggle per row with a line under the title. CFG-N
  copies this layout; **Lesson ready for review** becomes **Kavi's draft is
  ready**.
- `15-tutor-role/screenshots/tutor-profile--default.png`: a tutor's settings
  list includes Notifications under GENERAL, which CFG-N follows in YOU.
- `01-dashboard/screenshots/page--default.png`: Bobbin's shell has no
  notification bell, only the help button beside the account; Kanvise also has
  none for tutors (the Page channel). The student Bell is Kanvise's own.

Final Bobbin pass (FEAT-009):
- `03-lessons/screenshots/classroom--tutor-invite-emailed.png`: the email button on classroom Invite rows; Kanvise's Remind uses push first, email only without push (NTF-01).
- `08-team/screenshots/add-team-member--dialog.png`: invite line "Your organization's emails reach them once they accept."; Kanvise sends a tutor or admin only the invitation and its resend until they accept (NTF-01 invitation rows).
