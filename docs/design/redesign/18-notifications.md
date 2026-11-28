# 18 · Notifications

Status: draft for owner review. Builds on `00-decisions.md` (§14a, §16, §17,
§19), `01-app-shell.md` (SH-08), `03`, `04`, `05` (LP-03, LP-04), `06`, `07`
(CR-11, CR-12, CR-13), `08` (SM-04), `09` (SA-09, SA-10), `10`, `11`, `12`
(CFG-N, CFG-L), `19`.

**Who:** everyone. Tutors and admins switch their own rows in 12 CFG-N;
students switch theirs in 09 SA-10.
**Goal:** one list of every message Kanvise sends: the exact moment it fires,
who gets it, how, what it says on each channel, where tapping it lands,
whether it is on by default, and where it can be switched off. Other specs
point here instead of listing messages themselves.

## Flow at a glance

```
Something happens (a lesson is moved, a student hands in, ...)
  → was it done with an Undo toast? → hold until the undo window closes (NTF-03)
  → NTF-01 matrix: recipients, channels, default
  → recipient's switches (12 CFG-N, 09 SA-10) and account settings (12 CFG-L)
  → no email address? → nothing automatic; the tutor gets Send on WhatsApp (NTF-05)
  → delivered: Bell (students), Page, Push, Email (NTF-04 email rules)
  → tapped: opens the target in the entry (signed out: sign in first, NTF-09)
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

**How to read it.** Each group starts with an overview table. Every message
then has its own entry (NTF-101 onward) that says:
- **Fires:** the exact moment it is sent, and what happens if the trigger is
  undone or the lesson has changed by then.
- **Bell**, **Page**, **Push**, **Email:** what lands on each channel. Push is
  a title and a body. Email is a subject and its one button.
- **Opens:** where tapping the Bell item or the push, or pressing the email
  button, takes the person.
- **Not sent when:** the cases where the message is dropped, and any
  grouping or "at most once" rule.

Only the channels a message uses are listed. The rules every row shares
(students who haven't accepted, signed-out people, timezones) are in NTF-09,
so the entries don't repeat them.

**Default:** **Always** means the message can't be switched off, because the
person needs it to take part (an invitation, a moved lesson). **On** or **Off**
is the starting value of a switch. **Setting** names where the switch is.

### Accounts and team

| Event | Recipient | Channels | Default | Setting |
|---|---|---|---|---|
| NTF-101 Student invited (06 STU-03) | The student | Email | Always | None |
| NTF-102 Invitation not accepted after 3 days | The student | Email | Always | None |
| NTF-103 Student accepted the invitation | The tutor who invited them, and the course's tutors | Page | Always | None |
| NTF-104 Tutor invited (19 TM-03) | The tutor | Email | Always | None |
| NTF-105 Team member invited (19 TM-08) | The new admin | Email | Always | None |
| NTF-106 Tutor or team member accepted | The admin who invited them | Page | Always | None |
| NTF-107 Invitation resent | The invited person | Email | Always | None |
| NTF-108 Tutor removed from the agency (19 TM-06) | The tutor | Email | Always | None |
| NTF-109 Team member removed (19 TM-09) | The admin | Email | Always | None |
| NTF-110 A course is given to a tutor | The new tutor | Page, Push, Email | On | CFG-N **Courses given to me** |
| NTF-111 A course's tutor changes | Students on the course | Bell, Push, Email | Always | None |
| NTF-112 Email change requested (12 CFG-S) | The new address; a notice to the old address | Email | Always | None |
| NTF-113 Password changed | The person | Email | Always | None |
| NTF-114 Password reset asked for | The person | Email | Always | None |
| NTF-115 Data export ready (12 CFG-D, 17 REC-05) | The person who asked | Email | Always | None |

#### NTF-101 · Student invited

- **Fires:** immediately, when the tutor presses **Add student** (06 STU-03)
  with an email filled in, or saves an email onto a no-email student (06
  STU-07). Adding a student has no Undo, so nothing is held.
- **Email:** subject **Michael has invited you to Kanvise.** · button
  **Accept invitation**.
- **Opens:** **Set your password** (09 SA-01) with the name and email filled
  in. A person who already uses Kanvise follows **Sign in instead** and lands
  on Home (09 SA-03) with the new tutor added to **Your tutors** (09 SA-10).
- **Link life:** the link works for 7 days and once, as tutor invitations do
  (19 TM-11). After that: **This invitation has expired. Ask Michael to send a
  new one.**
- **Not sent when:** the student has no email (NTF-05).

#### NTF-102 · Invitation not accepted after 3 days

- **Fires:** 72 hours after the latest invitation email (NTF-101 or NTF-107),
  if it still hasn't been accepted.
- **Email:** subject **Reminder: Michael has invited you to Kanvise.** ·
  button **Accept invitation**.
- **Opens:** as NTF-101.
- **Not sent when:** the invitation was accepted, or the student was removed
  (06 STU-09). Sent once per student: a resend before the 72 hours restarts
  the wait; after this reminder Kanvise never reminds on its own again.

#### NTF-103 · Student accepted the invitation

- **Fires:** the moment the student presses **Create account** (09 SA-01), or
  signs in through **Sign in instead**.
- **Page:** the student's row on Students (`/students`, 06 STU-01) changes
  from **Invited** to active, and the dashboard row **Students not joined
  yet** (03 DB-05) drops by one.

#### NTF-104 · Tutor invited

- **Fires:** immediately, when the admin presses **Add tutor** (19 TM-03).
- **Email:** from **Science Students Academy via Kanvise**. Subject **Science
  Students Academy invited you to teach on Kanvise.** · button **Accept
  invitation**.
- **Opens:** the set-password page, then the invited tutor's welcome (02
  ONB-10). An existing Kanvise user signs in instead and lands on the
  dashboard (`/dashboard`) with Science Students Academy in their account
  switcher (01 SH-07).
- **Not sent when:** the person was removed before it went out. The link works
  for 7 days and once (19 TM-11).

#### NTF-105 · Team member invited

- **Fires:** immediately, when an admin presses **Add team member** (19
  TM-08).
- **Email:** subject **Science Students Academy added you to its team on
  Kanvise.** · button **Accept invitation**.
- **Opens:** the set-password page, then the dashboard (`/dashboard`). An
  existing Kanvise user signs in instead and gets the agency in their account
  switcher.
- **Not sent when:** as NTF-104.

#### NTF-106 · Tutor or team member accepted

- **Fires:** the moment the invited person sets their password or signs in
  from the invitation.
- **Page:** the **Invite not accepted** chip goes from their row on Tutors
  (`/tutors`, 19 TM-01) or Team (`/team`, 19 TM-07), and the dashboard row
  **Tutors not joined yet** (03 DB-05) drops by one.

#### NTF-107 · Invitation resent

- **Fires:** immediately, when someone presses **Resend invite** (06 STU-08,
  19 TM-11). The old link stops working at that moment.
- **Email:** the same email as the first invitation (NTF-101, NTF-104 or
  NTF-105) with a new link.
- **Opens:** as the first invitation.
- **Not sent when:** the last invitation went out less than an hour ago; the
  button is disabled with **Sent less than an hour ago.**

#### NTF-108 · Tutor removed from the agency

- **Fires:** immediately, when the admin presses **Remove** or **Remove and
  reassign** (19 TM-06). There is no Undo, so nothing is held.
- **Email:** subject **You no longer have access to Science Students
  Academy.** The body says their other Kanvise accounts are untouched. No
  button.
- **Not sent when:** the tutor had never accepted the invitation; their link
  just stops working.

#### NTF-109 · Team member removed

- **Fires:** immediately, when an admin presses **Remove** (19 TM-09).
- **Email:** as NTF-108.
- **Not sent when:** as NTF-108.

#### NTF-110 · A course is given to a tutor

- **Fires:** immediately, when the tutor is saved on a course: creating the
  course (04 CW-3), **Courses** in Add tutor (19 TM-03), or **Remove and
  reassign** (19 TM-06).
- **Page:** the course appears in their Courses list (`/courses`) and its
  lessons in Lessons and on the dashboard.
- **Push:** title **New course: Algebra 1 Small Group** · body **Science
  Students Academy gave you Algebra 1 Small Group, with 4 upcoming lessons.**
- **Email:** subject **You're now teaching Algebra 1 Small Group** · button
  **Open the course**.
- **Opens:** the course page (`/courses/:id`).
- **Not sent when:** the person gave the course to themselves; or the tutor
  hasn't accepted their invitation yet (they see the course when they
  accept). One action that gives several courses sends one message: **You're
  now teaching 2 courses: Algebra 1 Small Group and Physics 1.**, opening
  Courses (`/courses`).

#### NTF-111 · A course's tutor changes

- **Fires:** immediately, when the change is saved (19 TM-06 reassign, or a
  tutor change on the course).
- **Bell:** **Priya Shah is now your tutor for Algebra 1.**
- **Push:** title **New tutor for Algebra 1** · body **Priya Shah is now your
  tutor for Algebra 1.**
- **Email:** from **Science Students Academy via Kanvise**. Subject **Priya
  Shah is now your tutor for Algebra 1** · button **Open the course**.
- **Opens:** the course in the student app (09 SA-08).
- **Not sent when:** a tutor was only added beside the existing one, so the
  student's tutor hasn't changed. One message per student per save, however
  many lessons move.

#### NTF-112 · Email change requested

- **Fires:** immediately, when the person presses **Send link** in **Change
  your email** (12 CFG-S).
- **Email:** to the new address. Subject **Confirm your new email for
  Kanvise** · button **Confirm email**.
- **Notice to the old address:** sent at the same time. Subject **Someone asked
  to change your Kanvise email.** · text **If this was you, no action is needed.
  If it wasn't, reset your password now.** · button **Reset password**. The old
  address keeps working until the new one is confirmed.
- **Opens:** confirms the change, then Settings, Sign-in and security
  (`/settings`, 12 CFG-S), showing the new email. Signed out: sign in with the
  new email, then the same page.
- **Not sent when:** never dropped. Asking again replaces the earlier link.

#### NTF-113 · Password changed

- **Fires:** immediately, when a password is saved (12 CFG-S **Change
  password**, or a finished reset).
- **Email:** subject **Your Kanvise password was changed** · button **Reset
  your password** (for "This wasn't me").
- **Opens:** the Forgot password page with the email filled in.

#### NTF-114 · Password reset asked for

- **Fires:** immediately, when someone presses **Forgot password?** on the
  sign-in page and enters an email that has an account. The page says the same
  thing whether or not the email has an account.
- **Email:** subject **Reset your Kanvise password** · button **Choose a new
  password**.
- **Opens:** the Reset password page; after saving, the person is signed in
  and lands on the dashboard (students: Home, 09 SA-03).

#### NTF-115 · Data export ready

- **Fires:** when the export file has finished building, after **Request
  export** (12 CFG-D) or **Export CSV** (17 REC-05).
- **Email:** subject **Your Kanvise export is ready** · button **Download
  export**. The link works for 7 days.
- **Opens:** the download, for the person who asked only. Anyone else signed
  in sees 01 SH-14a; an old link shows **This link has expired. Request a new
  export from Settings.**

### Lessons and the classroom

| Event | Recipient | Channels | Default | Setting |
|---|---|---|---|---|
| NTF-201 Lesson or series scheduled (05 LW-3) | Students on it | Bell, Push, Email (one email for a whole series) | Always | None |
| NTF-202 Lesson rescheduled (05 LP-03) | Students on it | Bell, Push, Email | Always | None |
| NTF-203 Series changed (This and following lessons) | Students on it | Bell, Push, Email, one message | Always | None |
| NTF-204 Lesson cancelled (05 LP-04) | Students on it | Bell, Push, Email | Always | None |
| NTF-205 Student added to a lesson | That student | Bell, Push, Email | Always | None |
| NTF-206 Student removed from a lesson | That student | Bell, Push, Email | Always | None |
| NTF-207 Reminder before the lesson (NTF-02) | Students on it | Bell, Push, Email | On, 30 minutes before; 24 hours before is off | Account: 12 CFG-L **Remind students**. Student: SA-10 **Push**, **Email reminders** |
| NTF-208 Reminder before the lesson (NTF-02) | The lesson's tutor | Push, Email | On, 30 minutes before | CFG-N **Lesson reminder before my lesson** |
| NTF-209 Tutor starts the lesson | Students on it who aren't in yet | Bell, Push. Never email | On | SA-10 **Push** |
| NTF-210 Tutor presses **Remind** in Lesson tools (07 CR-03) | That student | Bell, Push; Email only without push | Always (a person sent it) | None |
| NTF-211 A student is waiting and the lesson hasn't started (07 CR-11) | The lesson's tutor | Page, Push | On | CFG-N **A student is waiting for my lesson** |
| NTF-212 10 minutes after the start, not started (07 CR-11) | The lesson's tutor | Push, Email | On | CFG-N **My lesson hasn't started on time** |
| NTF-213 Not held lesson marked as cancelled (05 LP-02) | Nobody, unless the tutor ticks **Let students know** | Bell, Push, Email | Off (the tick starts unticked) | The tick in LP-02 |
| NTF-214 Lesson becomes Not held (05) | The lesson's tutor; admins | Page, Push for the tutor; admins also the daily summary (NTF-06) | On | CFG-N **My lesson didn't take place** |
| NTF-215 Tutor sends a **Let {student} know** chip (07 CR-12) | The chosen students | Bell, Push; Email only without push | Always (a person sent it) | None |
| NTF-216 Student sends a chip (07 CR-12, 09) | The lesson's tutor | Page, Push; Email only without push | On | CFG-N **A student sent a message about a lesson** |
| NTF-217 Link opened on a second device (05 LP-05) | The lesson's tutor | Page (Lesson tools only) | Always | None |
| NTF-218 **Report a concern** sent (07 CR-13) | Agency admins, or Kanvise support | Email | Always | None |

**Lesson messages in general.** Every lesson email to a student has that
student's own join link as its button (**Join lesson**, 05 LP-05), so it
works without signing in (09 SA-02). Before the classroom opens, the link
shows the waiting card with **Your lesson starts at 4:00 PM** (07 CR-02).
Bell items and pushes open the lesson in the student app (09 SA-05), where
**Join** appears once the classroom opens.

#### NTF-201 · Lesson or series scheduled

- **Fires:** immediately, when the tutor presses **Schedule lesson** or
  **Schedule 10 lessons** in 05 LW-3. The toast has no Undo, so nothing is
  held.
- **Bell:** **Michael booked a lesson: Quadratic equations, Mon 1 Dec at 4:00
  PM.** For a series: **Michael booked 10 lessons: Mondays at 4:00 PM from 1
  Dec.**
- **Push:** title **New lesson booked** · body as the Bell item.
- **Email:** subject **Lesson booked: Mon 1 Dec, 4:00 PM WAT** · button
  **Join lesson**. For a series, one email: subject **10 lessons booked:
  Mondays at 4:00 PM WAT from 1 Dec** · button **See your lessons**. Each
  lesson's join link then comes in its reminder (NTF-207).
- **Opens:** one lesson: Bell and push open the lesson in the student app (09
  SA-05), the email opens the join link (09 SA-02). A series: the student
  app's Lessons, Upcoming tab (09 SA-04).
- **Not sent when:** never dropped for a student on the lesson. A lesson
  booked less than 30 minutes ahead gets no reminder (NTF-207), so this
  email, with its join link, is the only one.

#### NTF-202 · Lesson rescheduled

- **Fires:** when the undo window of **Lesson moved to Tue 2 Dec, 10:00 AM.**
  closes (05 LP-03, NTF-03): the toast is dismissed, the tutor leaves the
  page, or 5 minutes pass. **Undo** inside the window sends nothing.
- **Bell:** **Your lesson on Mon 1 Dec was moved to Tue 2 Dec, 4:00 PM.**
- **Push:** title **Lesson moved** · body as the Bell item.
- **Email:** subject **Lesson moved to Tue 2 Dec, 4:00 PM WAT** · button
  **Join lesson** (the same link, which follows the new time).
- **Opens:** Bell and push: the lesson in the student app (09 SA-05). Email:
  the join link (09 SA-02).
- **Not sent when:** the lesson is moved again before this message goes out
  (one message with the latest time); it is moved back to its old time inside
  the window (nothing is sent); or it is cancelled first (only NTF-204 goes).

#### NTF-203 · Series changed

- **Fires:** when the undo window closes after a **This and following
  lessons** reschedule (05 LP-03, NTF-03).
- **Bell:** **Your Monday lessons move to 5:00 PM from 8 Dec.**
- **Push:** title **Lessons moved** · body as the Bell item.
- **Email:** subject **Your Monday lessons move to 5:00 PM WAT from 8 Dec** ·
  button **See your lessons**.
- **Opens:** the student app's Lessons, Upcoming tab (09 SA-04).
- **Not sent when:** undone in the window. One message per student per
  change, never one per lesson.

#### NTF-204 · Lesson cancelled

- **Fires:** when the undo window of **Lesson cancelled.** closes (05 LP-04,
  NTF-03). **Undo** inside the window puts the lesson back to Planned and
  sends nothing.
- **Bell:** **Your lesson on Mon 1 Dec, 4:00 PM was cancelled.** For a series:
  **Your Monday lessons from 8 Dec are cancelled.**
- **Push:** title **Lesson cancelled** · body as the Bell item.
- **Email:** subject **Lesson cancelled: Mon 1 Dec, 4:00 PM WAT** · button
  **See your lessons**. The tutor's **Message to students**, if written, is in
  the body.
- **Opens:** the cancelled lesson in the student app (09 SA-05, **This lesson
  was cancelled.**); for a series, Lessons (09 SA-04).
- **Not sent when:** undone in the window. A held move of the same lesson
  (NTF-202) is dropped, so the student gets only the cancellation.

#### NTF-205 · Student added to a lesson

- **Fires:** immediately, when the tutor saves the student onto an existing
  lesson.
- **Bell, Push, Email:** as NTF-201, with **Michael added you to a lesson:
  Quadratic equations, Mon 1 Dec at 4:00 PM.**
- **Opens:** as NTF-201.
- **Not sent when:** as NTF-201.

#### NTF-206 · Student removed from a lesson

- **Fires:** immediately, when the tutor presses **Remove from this lesson**
  (05 LP-05). If that toast has **Undo**, the message is held (NTF-03).
- **Bell:** **You're no longer on the lesson on Mon 1 Dec, 4:00 PM.**
- **Push:** title **Lesson change** · body as the Bell item.
- **Email:** subject **You're no longer on the lesson on Mon 1 Dec, 4:00 PM
  WAT** · button **See your lessons**.
- **Opens:** the student app's Lessons (09 SA-04). The lesson is no longer
  listed.
- **Not sent when:** the lesson has already ended.

#### NTF-207 · Reminder before the lesson (students)

- **Fires:** 30 minutes before the lesson's start time. With 12 CFG-L **also
  24 hours before** on, a second one goes 24 hours before. The moment is the
  same in every timezone; the times written in the message follow NTF-09.
- **Bell:** **Your lesson starts in 30 minutes.** (24 hours before: **Your
  lesson with Michael is tomorrow at 4:00 PM.**)
- **Push:** title **Lesson at 4:00 PM** · body **Your lesson with Michael
  starts at 4:00 PM.**
- **Email:** subject **Reminder: your lesson with Michael at 4:00 PM WAT
  today** (24 hours before: **Reminder: your lesson with Michael tomorrow at
  4:00 PM WAT**) · button **Join lesson**.
- **Opens:** Bell and push: the lesson in the student app (09 SA-05). Email:
  the join link (09 SA-02), which shows the waiting card until the classroom
  opens at 3:45 PM (07 CR-02).
- **Not sent when:**
  - the lesson is cancelled, or the student was removed from it;
  - the lesson is Live already (the tutor started early);
  - the lesson was moved: the reminder follows the new time, and the one for
    the old time is never sent;
  - the lesson was scheduled or moved less than 30 minutes before its start
    (less than 24 hours before, for the 24-hour reminder). The booking or
    move message (NTF-201, NTF-202) already has the time;
  - a move or cancellation of the lesson is still being held (NTF-03): the
    reminder waits for the window to close and is dropped if its time has
    passed by then;
  - the student switched the channel off in 09 SA-10 (**Push** or **Email
    reminders**). The Bell item still goes.

  One reminder per student per lesson for each time (30 minutes, 24 hours).

#### NTF-208 · Reminder before the lesson (tutor)

- **Fires:** 30 minutes before the lesson's start time.
- **Push:** title **Lesson at 4:00 PM** · body **Your lesson with Casey starts
  at 4:00 PM.** (a group: **with Algebra 1 Small Group**).
- **Email:** subject **Your lesson with Casey starts at 4:00 PM WAT** ·
  button **Open classroom**.
- **Opens:** classroom pre-entry for the lesson (`/lessons/:id/classroom`, 07
  CR-01).
- **Not sent when:** the same cases as NTF-207 (cancelled, Live, moved,
  scheduled less than 30 minutes ahead, a held change), and when the tutor is
  already in the classroom. Admins who don't teach the lesson never get it
  (NTF-02).

#### NTF-209 · Tutor starts the lesson

- **Fires:** the moment the tutor or an admin presses **Start lesson** (07
  CR-01, CR-03), including **Start anyway** on a Not held lesson (05 LP-02).
- **Bell:** **Michael started your lesson. Join now.**
- **Push:** title **Your lesson has started** · body **Michael has started
  your lesson. Join now.**
- **Opens:** the classroom for that lesson, straight into the room (as **Join
  now** on 09 SA-03).
- **Not sent when:** the student is already in the room or on the waiting
  screen (07 CR-02), which brings them in by itself; or the lesson is
  restarted after an automatic end (07 CR-06). Never emailed (it would arrive
  late). Once per student per lesson.

#### NTF-210 · Remind in Lesson tools

- **Fires:** immediately, when the tutor presses **Remind** beside a student
  who is **Not here yet** (07 CR-03).
- **Bell:** **Your lesson with Michael has started. Join now.**
- **Push:** title **Michael is waiting for you** · body **Your lesson with
  Michael has started. Join now.**
- **Email** (only when the student has no push): subject **Your lesson with
  Michael has started** · button **Join lesson**.
- **Opens:** Bell and push: the classroom, as NTF-209. Email: the join link
  (09 SA-02).
- **Not sent when:** the student has joined. At most once every 5 minutes per
  student; in between, the button reads **Reminded 4:05 PM**.

#### NTF-211 · A student is waiting

- **Fires:** at the start time, if a student is on the waiting screen (07
  CR-02) and the lesson hasn't started; or, after the start time, the moment
  the first student arrives there.
- **Page:** the lesson page Activity (05 LP-01) shows **Casey is waiting ·
  4:01 PM**.
- **Push:** title **Casey is waiting** · body **Casey is waiting for your 4:00
  PM lesson.**
- **Opens:** classroom pre-entry (`/lessons/:id/classroom`, 07 CR-01).
- **Not sent when:** the lesson has started, or the tutor is already in the
  classroom. Once per lesson: students who arrive later are added to the
  Activity line, with no new push.

#### NTF-212 · Lesson hasn't started on time

- **Fires:** 10 minutes after the start time, if the lesson still hasn't
  started. At the same moment the student's waiting card says **Michael is
  running late. We've let them know you're waiting.** (07 CR-02).
- **Push:** title **Your 4:00 PM lesson hasn't started** · body **Casey is
  waiting.** (with nobody waiting: **Students can join once you start.**)
- **Email:** subject **Your 4:00 PM WAT lesson hasn't started** · button
  **Open classroom**.
- **Opens:** classroom pre-entry (`/lessons/:id/classroom`, 07 CR-01).
- **Not sent when:** the lesson has started, been cancelled or moved, or the
  tutor is already in the classroom. Once per lesson.

#### NTF-213 · Not held lesson marked as cancelled

- **Fires:** only when the tutor ticks **Let students know** in **Mark as
  cancelled** (05 LP-02), and then when the undo window closes (NTF-03).
- **Bell, Push, Email:** as NTF-204, with **Your lesson on Mon 1 Dec, 4:00 PM
  didn't go ahead and has been cancelled.**
- **Opens:** as NTF-204.
- **Not sent when:** the tick is left off (the default), or the action is
  undone.

#### NTF-214 · Lesson becomes Not held

- **Fires:** at the lesson's scheduled end, if nobody started it.
- **Page:** the lesson moves to the **Not held** tab on Lessons (`/lessons`,
  05 LL-01) and its page shows the grey **This lesson didn't take place.**
  banner (05 LP-02). Admins: the **Lessons that didn't start** row on the
  dashboard (03 DB-05) and the next daily summary (NTF-06).
- **Push (the tutor):** **Your 4:00 PM lesson with Casey didn't take place.**
  Not sent to students.
- **Opens:** the lesson page (`/lessons/:id`).

#### NTF-215 · Tutor sends a Let {student} know chip

- **Fires:** immediately, when the tutor presses a chip (07 CR-12) in Lesson
  tools, on the lesson page or on the dashboard.
- **Bell:** the chip's message: **Michael is running about 10 minutes late.
  Stay on your lesson page.** · **Michael is starting your lesson now.** ·
  **Michael can't make today's lesson and will be in touch about a new
  time.**
- **Push:** title **Message from Michael** · body the chip's message.
- **Email** (only when the student has no push): subject the chip's first
  sentence, for example **Michael is running about 10 minutes late** · button
  **Join lesson** (for **Can't make it**: **See your lessons**).
- **Opens:** Bell and push: the lesson in the student app (09 SA-05). Email:
  the join link (09 SA-02), or Lessons (09 SA-04) for **Can't make it**.
- **Not sent when:** the student has no email (the tutor gets **Send on
  WhatsApp** or **Copy message**, NTF-05). Each chip once per lesson.

#### NTF-216 · Student sends a chip

- **Fires:** immediately, when the student presses **Send** on **Running
  late**, **Can't make it** or **Need another time** (09 SA-03, SA-05, 07
  CR-02).
- **Page:** the lesson page Activity and Students card (**Casey: running late
  · 3:58 PM**, 05 LP-01) and Lesson tools (07 CR-03).
- **Push:** title **Casey: running late** · body **Casey: running late for
  your 4:00 PM lesson.** (**Casey can't make your 4:00 PM lesson.**, **Casey
  needs another time for your 4:00 PM lesson.**)
- **Email** (only when the tutor has no push): subject **Casey is running
  late for your 4:00 PM WAT lesson** · button **Open the lesson**.
- **Opens:** the lesson page (`/lessons/:id`); for **Need another time**,
  with **Reschedule** beside the message.
- **Not sent when:** each chip once per lesson per student.

#### NTF-217 · Link opened on a second device

- **Fires:** the moment a join link is opened while the first device is still
  in the lesson (05 LP-05).
- **Page:** Lesson tools only: **Casey's link was just opened on another
  device.** with **Get a new link** (07 CR-03).
- **Not sent when:** the tutor isn't in the classroom; nothing else is sent.

#### NTF-218 · Report a concern sent

- **Fires:** immediately, when the person presses **Send** (07 CR-13, 09
  SA-05).
- **Email:** to each chosen admin: subject **A concern was raised about a
  lesson on Algebra 1 Small Group** · button **Open the lesson**. The body
  has the lesson, the time, who sent it and what they wrote. To Kanvise
  support: the same email to the support inbox, with no button.
- **Opens:** the lesson page (`/lessons/:id`), for admins.
- **Not sent when:** never dropped. The person it is about is not told, and
  a concern a student raises never goes to their tutor.

### Lesson summaries and recordings

| Event | Recipient | Channels | Default | Setting |
|---|---|---|---|---|
| NTF-301 Summary completed (08 SM-04) | Students on the lesson | Bell, Push. Not emailed (00 section 6) | On | SA-10 **Push** |
| NTF-302 Summary edited after it was completed (08 SM-04) | Students on the lesson | Bell only | On | None |
| **No summary needed** (08 SM-07) | Nobody | None | n/a | n/a |
| NTF-303 Lesson marked **Missed** (08 SM-06) | Nobody, unless the tutor ticks **Let Casey know** | Bell only | Off (the tick starts unticked) | The tick in SM-06 |
| NTF-304 Summary still to write 24 hours after the lesson (08 SM-04) | The lesson's tutor | Push, Email, once | On | CFG-N **Summary still to write** |
| NTF-305 Kavi's draft is ready (08, once Kavi exists) | The lesson's tutor | Page, Push | On | CFG-N **Kavi's draft is ready** |
| NTF-306 Recording ready (17) | The lesson's tutor | Page | Always | None |
| NTF-307 Recording ready (17 REC-08) | Students allowed to watch it | Bell | On | None |
| NTF-308 Recording failed (17) | The lesson's tutor | Page, Push | On | CFG-N **A recording didn't save** |

#### NTF-301 · Summary completed

- **Fires:** when the undo window after **Complete** closes (08 SM-04,
  NTF-03).
- **Bell:** **Michael added a summary of today's lesson.** (another day:
  **Michael added a summary of Monday's lesson.**)
- **Push:** title **Lesson summary ready** · body as the Bell item.
- **Opens:** the past lesson in the student app (09 SA-05), at the Summary.
- **Not sent when:** undone in the window; the lesson was closed with **No
  summary needed** (08 SM-07). Lesson notes and student notes are never part
  of it (00 section 16). A no-email student gets nothing; the tutor sees **Copy summary** and
  **Send on WhatsApp** (NTF-05).

#### NTF-302 · Summary edited after it was completed

- **Fires:** when the tutor saves an edit to a part the student sees (08
  SM-04).
- **Bell:** **Michael updated the summary of Monday's lesson.**
- **Opens:** as NTF-301.
- **Not sent when:** only the lesson notes changed; or this summary already sent
  one today (at most once per summary per day, in the account's timezone).

#### NTF-303 · Lesson marked Missed

- **Fires:** when the tutor confirms **Mark as missed** with **Let Casey
  know** ticked (08 SM-06). Held if its toast has **Undo** (NTF-03).
- **Bell:** **You missed today's lesson. Michael will be in touch about the
  next one.**
- **Opens:** the lesson in the student app (09 SA-05, **You missed this
  lesson.**).
- **Not sent when:** the tick is off (the default). No-email students get
  nothing automatic (NTF-05).

#### NTF-304 · Summary still to write

- **Fires:** 24 hours after the lesson actually ended (**End lesson** or the
  automatic end, 05 Lesson statuses), if it is still Awaiting summary.
- **Push:** title **Summary still to write** · body **Casey's lesson summary
  from yesterday is still waiting.**
- **Email:** subject **Casey's lesson summary from yesterday is still
  waiting** · button **Write summary**.
- **Opens:** the summary editor (`/lessons/:id/summary`, 08 SM-01).
- **Not sent when:** the summary was completed, or the lesson was closed with
  **No summary needed** or marked **Missed**. A restart (07 CR-06) moves the
  24 hours to the new end. It goes to whoever is the lesson's tutor at that
  time (after a reassign, the new tutor, 19 TM-06). Once per lesson.

#### NTF-305 · Kavi's draft is ready

- **Fires:** when Kavi finishes drafting the summary (08), once Kavi exists.
- **Page:** the Awaiting summary banner on the lesson page (05 LP-02) shows
  that a draft is waiting.
- **Push:** title **Kavi's draft is ready** · body **Kavi drafted the summary
  of your lesson with Casey. Check it before you complete it.**
- **Opens:** the summary editor (`/lessons/:id/summary`).
- **Not sent when:** the tutor is already in the summary editor, or the
  draft failed (the editor shows the failure, 08).

#### NTF-306 · Recording ready (tutor)

- **Fires:** when the recording finishes processing, usually within 30
  minutes of the lesson ending (17 REC-01).
- **Page:** the lesson's row on Recordings (`/recordings`, 17 REC-01) shows
  **▷ Watch**, and the lesson page Session tab (05 LP-02) shows the player.

#### NTF-307 · Recording ready (students)

- **Fires:** when the recording finishes processing.
- **Bell:** **The recording of Monday's lesson is ready to watch.**
- **Opens:** the past lesson in the student app (09 SA-05), at the
  recording.
- **Not sent when:** the account doesn't let students watch recordings (12
  CFG-L), this student may not (06 STU-05), or they are no longer on the
  course (17 REC-08).

#### NTF-308 · Recording failed

- **Fires:** when processing fails.
- **Page:** **Recording failed** on the Recordings row (17 REC-01), with the
  explanation in the expanded row and on the lesson's Session tab (17 REC-02).
- **Push (the tutor):** **The recording of your 4:00 PM lesson didn't save.**
  Students are never told.

### Homework, quizzes and starting checks

| Event | Recipient | Channels | Default | Setting |
|---|---|---|---|---|
| NTF-401 Homework set (10 HW-01) | The chosen students | Bell, Push, Email | On | SA-10 **Push**; email always (it carries the due date) |
| NTF-402 Homework due date changed (10 HW-03) | The chosen students | Bell, Push | On | SA-10 **Push** |
| NTF-403 Tutor presses **Remind** on homework (10 HW-03) | Students who haven't handed in | Bell, Push | Always (a person sent it) | None |
| Homework overdue | Nobody automatically. The student's app shows it as late; tutors see it in Needs attention (03) and admins in the daily summary | n/a | n/a | n/a |
| NTF-404 Homework handed in (10 HW-04) | The course's tutors | Page, Push, grouped | On | CFG-N **Homework handed in** |
| NTF-405 Homework marked (10 HW-05) | The student | Bell, Push | On | SA-10 **Push** |
| NTF-406 Asked to redo (10 HW-05) | The student | Bell, Push | On | SA-10 **Push** |
| NTF-407 Quiz set (11 QZ-04) | The chosen students | Bell, Push | On | SA-10 **Push** |
| NTF-408 Quiz finished (11 QZ-05) | The course's tutors | Page, Push, grouped | On | CFG-N **Quiz finished** |
| NTF-409 Starting check sent (04 DIAG-D) | The student | Email; Bell when they have an account | Always | None |
| NTF-410 Tutor presses **Send a reminder** on a starting check (04 DIAG-R) | The student | Email, or the tutor's WhatsApp button | Always (a person sent it) | None |
| NTF-411 Starting check finished (04 DIAG-R) | The course's tutors | Page, Push, Email | On | CFG-N **Starting check finished** |

#### NTF-401 · Homework set

- **Fires:** immediately, when the tutor presses **Set homework** (10 HW-01).
- **Bell:** **New homework: Simultaneous equations worksheet, due Fri.**
- **Push:** title **New homework from Michael** · body as the Bell item.
- **Email:** subject **New homework: Simultaneous equations worksheet, due
  Fri 5 Dec, 6:00 PM WAT** · button **Open homework**.
- **Opens:** the homework in the student app (10 HW-04).
- **Not sent when:** never dropped for a ticked student (no-email students
  can't be ticked, 10 HW-01).

#### NTF-402 · Homework due date changed

- **Fires:** immediately, when the tutor saves a new due date (10 HW-03
  **Edit** or **Extend due date**).
- **Bell:** **The due date for Simultaneous equations worksheet moved to
  Sat.**
- **Push:** title **Due date changed** · body as the Bell item.
- **Opens:** the homework in the student app (10 HW-04).
- **Not sent when:** the student's work is already marked. Other edits
  (title, instructions, files) send nothing.

#### NTF-403 · Remind on homework

- **Fires:** immediately, when the tutor presses **Remind** on a student who
  hasn't handed in (10 HW-03).
- **Bell:** **Michael is waiting for your Simultaneous equations worksheet.**
- **Push:** title **Homework reminder** · body as the Bell item.
- **Opens:** the homework in the student app (10 HW-04).
- **Not sent when:** the student has handed in. At most once a day per
  student per homework.

#### NTF-404 · Homework handed in

- **Fires:** the first hand-in on a homework sends at once. Further hand-ins
  in the next 30 minutes are collected and sent as one push when the 30
  minutes end.
- **Page:** the homework's Students column (`/homework/:id`, 10 HW-03), the
  **To mark** tab on Homework (`/homework`, 10 HW-02) and the dashboard row
  **Homework to mark** (03 DB-05).
- **Push:** title **Homework handed in** · body **Casey handed in Simultaneous
  equations worksheet.** Grouped: **3 students handed in Simultaneous
  equations worksheet.**
- **Opens:** one hand-in: marking for that student (10 HW-05). Several: the
  homework page (`/homework/:id`, 10 HW-03).
- **Not sent when:** the student changes work they already handed in
  (**Change my work**) before it is marked. A hand-in after **Ask to redo**
  counts as a new one.

#### NTF-405 · Homework marked

- **Fires:** when the tutor presses **Save** or **Save and next** in marking
  (10 HW-05).
- **Bell:** **Your homework was marked: 8/10.** (feedback only: **Michael
  marked your Simultaneous equations worksheet.**)
- **Push:** title **Homework marked** · body as the Bell item.
- **Opens:** the homework in the student app (10 HW-04), showing the mark and
  feedback.
- **Not sent when:** the tutor saves the same marking again later; the student
  sees the change but isn't notified twice.

#### NTF-406 · Asked to redo

- **Fires:** when the tutor chooses **Ask to redo** (10 HW-05).
- **Bell:** **Michael asked you to redo Simultaneous equations worksheet.**
- **Push:** title **Homework to redo** · body as the Bell item.
- **Opens:** the homework in the student app (10 HW-04), with **Redo asked**
  and the feedback.

#### NTF-407 · Quiz set

- **Fires:** immediately, when the tutor presses **Send to students** (11
  QZ-04). Saving a draft sends nothing.
- **Bell:** **New quiz: Simultaneous equations check.**
- **Push:** title **New quiz from Michael** · body **New quiz: Simultaneous
  equations check, due Fri.**
- **Opens:** the quiz start screen in the student app (11 QZ-05).

#### NTF-408 · Quiz finished

- **Fires:** when a student presses **Hand in** on a quiz (11 QZ-05). Grouped
  as in NTF-404: the first sends at once, the rest from the next 30 minutes in
  one push.
- **Page:** the **By student** list on the quiz page (`/quizzes/:id`, 11
  QZ-06).
- **Push:** title **Quiz finished** · body **Casey finished Simultaneous
  equations check: 7 out of 10.** Grouped: **3 students finished Simultaneous
  equations check.**
- **Opens:** the quiz page (`/quizzes/:id`, 11 QZ-06).

#### NTF-409 · Starting check sent

- **Fires:** immediately, when the tutor presses **Send** (04 DIAG-D).
- **Bell:** **Michael sent you a short check before your first lesson.**
- **Email:** subject **Michael has sent you a short check before your first
  lesson** · button **Start the check** (04 DIAG-S).
- **Opens:** the check (04 DIAG-S). The email link goes through sign-in.
- **Not sent when:** the student has no email; the tutor gets the personal
  check link with **Copy** and **WhatsApp** in the dialog (04 DIAG-D).

#### NTF-410 · Starting check reminder

- **Fires:** immediately, when the tutor presses **Send a reminder** (04
  DIAG-R).
- **Email:** subject **Reminder: Michael's short check is waiting** · button
  **Carry on with the check**.
- **Opens:** the check where the student stopped (04 DIAG-S).
- **Not sent when:** the student has finished, or the check was cancelled. A
  no-email student gets nothing from Kanvise; the tutor gets **Send on
  WhatsApp** or **Copy message** with the same link.

#### NTF-411 · Starting check finished

- **Fires:** the moment the student finishes the check (04 DIAG-S **All
  done**).
- **Page:** the dashboard row **Starting checks finished** (03 DB-05) and the
  student's row on the course page (`/courses/:id`).
- **Push:** title **Starting check finished** · body **Casey finished the
  starting check for Algebra 1 Small Group.**
- **Email:** subject **Casey finished the starting check for Algebra 1 Small
  Group** · button **See the results**.
- **Opens:** Casey's results (04 DIAG-R).
- **Not sent when:** the student only paused (**Save and finish later**).

### Agency admins

| Event | Recipient | Channels | Default | Setting |
|---|---|---|---|---|
| NTF-501 Daily summary (NTF-06) | Each agency admin | Email, only on days with something in it | On | CFG-N **Daily summary for admins** |
| Weekly round-up | Dropped. The daily summary and the dashboard cover it (F-48) | n/a | n/a | n/a |

#### NTF-501 · Daily summary

- **Fires:** at 7:00 AM in the account's timezone, every day.
- **Email:** subject **Science Students Academy today: 3 summaries overdue, 1
  lesson didn't start** · button **Open the dashboard**. Each line in the body
  links to its filtered list (NTF-06).
- **Opens:** the dashboard (`/dashboard`).
- **Not sent when:** every line is 0, or the admin switched it off.

## NTF-02 · Who gets lesson reminders

The owner's default "reminders go to tutors" is read like this. The owner
confirmed this reading (00 section 19).

1. **Every lesson reminds its tutor.** The tutor of a lesson (including an
   admin with **I teach too** who is the tutor) gets a push and email 30
   minutes before: **Your lesson with Casey starts at 4:00 PM.** with **Open
   classroom** (NTF-208). On by default, switchable in 12 CFG-N. Admins who
   don't teach the lesson get no reminder.
2. **Students are reminded too, by the account's setting.** 12 CFG-L **Remind
   students** (30 minutes before, on; 24 hours before, off) decides what
   students get (NTF-207). A student can switch off push or email reminders
   in 09 SA-10.
4. **No reminder for a lesson that has changed.** Reminders are skipped for
   cancelled, moved (the new time gets its own) and already started lessons,
   and for lessons booked or moved less than 30 minutes ahead (NTF-207).
3. **Chasing people is pressed by the tutor.** Apart from the one automatic
   invitation reminder after 3 days, reminders that chase someone (homework
   not handed in, an unfinished starting check, a payment in spec 13) are only
   sent when the tutor presses **Remind** or **Send a reminder**. Kanvise never
   chases students on its own.

## NTF-03 · Held messages

Follows 01 SH-08: a message caused by an action that has an **Undo** toast is
held until the undo window closes (the person dismisses the toast, leaves the
page, or 5 minutes pass). **Undo** inside the window means nothing is sent.

Held today: lesson rescheduled and series changed (NTF-202, NTF-203, 05
LP-03), lesson cancelled (NTF-204, 05 LP-04), a Not held lesson marked as
cancelled with **Let students know** (NTF-213), summary completed (NTF-301, 08
SM-04), and any other action whose toast has **Undo**. When several held
messages about one lesson are waiting for the same student, only the last
state is sent: a move then a cancel sends only the cancellation, and a move
undone sends nothing.
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

## NTF-09 · Rules for every message

**Who is left out**
- **Students without an email** get nothing automatic (NTF-05). Where a row
  would reach them, the tutor gets **Send on WhatsApp** or **Copy message**
  once any undo window has closed.
- **Students who haven't accepted their invitation** get only the invitation
  messages (NTF-101, NTF-102, NTF-107). Lesson, homework and quiz messages
  reach them once they accept (06 STU-03); by then everything already
  scheduled or set is in their app, and the next reminders reach them as
  normal. Until then the tutor can still send a join link by hand (05 LP-05).
- **Tutors and admins who haven't accepted** get only their invitation and
  its resend.
- **Removed people** (06 STU-09, 19 TM-06, TM-09) get nothing after the
  removal email, and messages still being held for them are dropped.

**Where a tap lands**
- A Bell item, a push and an email button about the same event open the same
  place, except that lesson emails to students open the join link (NTF-01,
  Lesson messages in general). Opening a Bell item marks it read (NTF-08).
- On a phone with Kanvise installed (09 SA-10), a push opens in the installed
  app; otherwise in a browser tab.
- **Signed in:** the target opens straight away.
- **Signed out:** the sign-in page (`/auth/login`) opens first, then the
  target, as in 01 SH-14b. A student who has never set a password and opens an
  invitation lands on **Set your password** (09 SA-01) instead.
- **No sign-in needed:** join links (09 SA-02), personal check links (04 The
  rules) and unsubscribe links (NTF-04).
- **Another of the person's accounts:** when the target belongs to a
  different tutor or agency the person is in, Kanvise switches to that account
  first (01 SH-07, 09 SA-10 **Your tutors**).
- **Gone or no longer theirs** (deleted, cancelled for good, removed from the
  course): the shared Not available page (01 SH-14a), with **Go to dashboard**
  or, for students, **Go to Home**.

**Times in the text**
- Bell items and pushes show times in the reader's own timezone (09 SA-10, 12
  CFG-P), without the zone name.
- Emails use the account's timezone with the zone named (**4:00 PM WAT**) and
  add the student's own time when it differs (NTF-04).
- "Today", "tomorrow" and day names are worked out in the same timezone as
  the times beside them.

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
