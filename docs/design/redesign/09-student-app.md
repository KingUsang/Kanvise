# 09 · Student app

Status: draft for owner review. Builds on `00-decisions.md` (§4, §14a, §16,
§19), `01-app-shell.md`, `04` to `08`, `10`, `11`, `15`.

**Who:** students (children, teens and adults), mostly on phones.
**Goal:** know what's next and get to it in one tap: join the lesson, do the
homework, take the quiz, read what the tutor said. Everything a student sees
mirrors something their tutor did.

The student app is part of the same web app (installable as a PWA), with its
own simpler shell. Words are plain and friendly, never childish.

**Access, decided (00 section 14a):** students get a password account by
invitation (no self sign-up), and a personal join link for each lesson, which
the tutor sends with **Copy**, **WhatsApp** or **Email** (05 LP-05).

## Flow at a glance

```
Invite email → SA-01 set password → SA-03 Home
Join link (lesson) → SA-02 straight into that lesson (no sign-in)
Check link or Your check card → the check (spec 04, DIAG-S)
Home ─┬─ Lessons (SA-04) → lesson (SA-05) → classroom (spec 07)
      ├─ Homework (SA-06) → hand in (spec 10)
      ├─ Courses (SA-07) → course (SA-08): plan, quizzes, resources
      └─ Me (SA-10, from the avatar): profile, notifications, tutors, help
```

---

## SA-01 · Getting in

**From the invitation email** (spec 06):
- Email: **Alex has invited you to Kanvise.** "You'll see your lessons,
  homework and what Alex says after each lesson." Button **Accept invitation**.
- The link opens **Set your password** with the student's name and email
  already filled in: **Password** (8+ characters, a show/hide eye), **Create
  account**. A line: **Already use Kanvise? Sign in instead.** for students
  invited by a second tutor.
- On success: a one-screen welcome, typed in line by line as in onboarding (a
  fixed script, not an AI call): **Hi Casey, I'm Kavi. This is where your
  lessons with Alex live.** with **Let's go**, then Home.
- Expired invite: **This invitation has expired. Ask Alex to send a new one.**

**Signing in later:** the normal sign-in page (restyle deferred), with **Forgot
password?**. Students land on Home.

## SA-02 · Join link (no sign-in)

Each student has their own join link for each lesson (05 LP-05). Opening it:
- Before the classroom opens (12 CFG-L **Classroom opens**, 15 minutes by
  default): the student waiting card (07 CR-02), with **Your lesson starts at
  4:00 PM**.
- Once the classroom is open: **Join** opens the screen that waits for the
  tutor (07 CR-02), or goes straight in once the tutor has started. There is
  no admit step.
- After the lesson: **This lesson has ended.** and, if the student has an
  account, **Sign in to see what Alex said**.
- Expired or revoked: **This link has expired. Ask Alex for a new one.**

The link only opens that lesson, as that student. It never opens the rest of
the app.

## SA-02a · Students without an email

A minor edge case (00 section 14a). The tutor adds the student with no email,
so there is no invitation and no account.
- They get their lessons through join links only (SA-02), sent by the tutor
  on WhatsApp or copied.
- They cannot see homework, quizzes, summaries or recordings in Kanvise, and
  Kanvise sends them nothing. The tutor can still **Copy** a summary and send
  it on WhatsApp (06 No email, 08 SM-05).
- Homework and quizzes can't be set for them (10 HW-01, 11 QZ-03 leave them
  unticked). A starting check reaches them by a personal check link (04).
- Once the tutor adds an email, the invitation goes out and everything from
  then on appears in their app. Past summaries appear too; past homework does
  not.

## SA-03 · Home

**Shell (phone):** a top bar with the tutor's (or agency's) name, the bell
(SA-09) and the student's avatar; a bottom bar with four tabs: **Home** ·
**Lessons** · **Homework** · **Courses** (16 R-02). The avatar opens **Me**
(SA-10). On desktop the same four items sit in a light sidebar, with the same
orange "you are here" marker as the tutor app, and Me at the bottom.

**Home, top to bottom:**

1. **Greeting:** **Hi Casey** and the date.
2. **Next lesson** card (the most important thing on the screen):
   - Course swatch, topic, **Today · 4:00 to 5:00 PM** (in the student's
     timezone), tutor's name and photo.
   - Button by state:

| State | Button |
|---|---|
| Before the classroom opens (12 CFG-L **Classroom opens**) | **Add to calendar** (secondary), and the line **Opens at 3:45 PM** |
| Classroom open, not started (amber **Starting soon**) | **Join** (opens the screen that waits for the tutor, 07 CR-02) |
| Tutor has started (green **Live**) | **Join now** (indigo, with a soft pulse; still on reduced motion) |
| No lesson scheduled | Card reads **No lesson booked yet.** "Alex will add your next one." |

   - **Let Alex know** (07 CR-12): a row of quiet chips under the button,
     shown from 24 hours before the lesson until it ends: **Running late** ·
     **Can't make it** · **Need another time**. Tapping one asks **Tell Alex
     you're running late?** with **Send**. A sent chip shows **Sent 4:02 PM**,
     and each can be sent once per lesson. The tutor gets it in the app and by
     push; nothing about the lesson changes on its own.
3. **To do:** homework due soon and quizzes to take, nearest first, each with a
   due label (**Due tomorrow**, **Due Fri**, **Overdue** in red). Tapping opens
   it. Empty: **Nothing due right now.**
4. **From your last lesson:** the latest lesson summary, collapsed to **What to
   work on** with **Read the full summary ›**. Empty until the first summary.
5. **Your check** (only while one is waiting): **Alex sent you a short
   check before your first lesson. About 10 minutes.** with **Start**.

## SA-04 · Lessons

- Tabs (underline): **Upcoming** · **Past**.
- **Upcoming:** date-grouped rows (**Today**, **Tomorrow**, **Mon 1 Dec**):
  time, topic, course swatch, and **Join** when it's open.
- **Past:** newest first, each with what happened for this student:

| Lesson status (05) | What the student sees |
|---|---|
| Complete, with a summary | **Summary ready** (neutral with a tick) |
| Complete, No summary needed (08 SM-07) | **Done** |
| Awaiting summary | **Waiting for Alex's summary** |
| Not held (nobody started it) | **Didn't go ahead** (grey) |
| Missed, or the student didn't join a lesson that others attended | **Missed** (grey) |
| Cancelled | **Cancelled** (grey, topic struck through) |

  A Not held lesson that the tutor starts later that day moves back to
  Upcoming with **Join now**. Tapping a row opens SA-05.
- Empty: **No lessons yet.** "When Alex books a lesson, it'll show up here."

## SA-05 · A lesson

**Upcoming:** topic, date and time (with timezone: **4:00 PM your time · 3:00
PM Alex's time** when they differ), course, tutor, **Join** (when open), **Add
to calendar**, the **Let Alex know** chips (as in SA-03), and a **Before this
lesson · Homework** card (as on Bobbin's lesson page): homework due before it,
with **Open**, or **Nothing is due before this lesson.**

**Past, with summary:**
- **Summary** (spec 08 as the student sees it): **What we covered** (topics),
  **What went well**, **What to work on**, **Homework** (with **Open**).
  Private notes never appear (00 section 16).
- **Recording** (if there is one and the student may watch it, 06 STU-05): a
  player with a scrub bar and speed control (1×, 1.25×, 1.5×). On phones it
  plays inline and can go full screen.
- **Files from this lesson:** materials the tutor presented or attached.

**Past, no summary yet:** **Alex hasn't added a summary yet.** The recording
shows as soon as it's processed.

**Didn't go ahead (Not held):** **This lesson didn't go ahead.** "Alex will be
in touch about a new time." with **Need another time** (the chip, if not sent
already).

**Missed:** **You missed this lesson.** plus the tutor's note if they sent one
(08 SM-06).

**Cancelled:** **This lesson was cancelled.** plus the tutor's note, if any.

**Report a concern** (07 CR-13): a quiet text link at the bottom of every
lesson page, and in **Me › Help**. It opens the same small dialog as in the
classroom: **What happened** (required), **Send to:** **Your tutoring agency's
admins** (default in an agency) or **Kanvise support** (the only choice for an
independent tutor's student), the line **If someone is in danger now, call
your local emergency number first.**, and **Send**. Toast: **Sent. Thank you
for telling us.** A concern a student raises is never shown to their tutor.

## SA-06 · Homework

- Tabs: **To do** · **Handed in** · **Marked**.
- Each row: title, course, due date, status chip (**Due Fri**, **Overdue**,
  **Handed in**, **Marked · 8/10**, **Redo asked**).
- Tapping opens the homework (10 HW-04): instructions, the tutor's files, and
  **Hand in** (a photo, files or a typed answer, within the hand-in row of the
  upload limits table in `15-resources.md`). After marking: the mark and the
  tutor's feedback.
- Empty **To do:** **No homework right now.**

## SA-07 · Courses

A card per course: course swatch, name, tutor, **12 of 32 topics covered**,
and **Next: Factorising**. If the student has several tutors or agencies,
cards are grouped under each one's name.

## SA-08 · A course

**Header:** course swatch, course name, tutor. Tabs: **Plan** · **Quizzes** ·
**Resources**.

**Plan** (what they're learning), following the Topic status model (04, What
students see):
- The course plan's modules and topics, read-only, with the same words and
  icons the tutor sees: **Taught**, **Knows it** and **Next**, and nothing for
  not yet.
- **Needs work** is tutor-only: the student sees that topic as **Taught** if it
  was taught in a lesson, otherwise unmarked. What to practise reaches the
  student through the lesson summary's **What to work on**.
- A line at the top: **12 of 32 topics covered.** Progress is per course (00
  section 19).
- Statuses appear only after the tutor accepts them (04 CRS-08).

**Quizzes:** quizzes set on this course: **To take**, **Done** (with the score
when the tutor shows it). Taking a quiz: 11 QZ-05.

**Resources:** files the tutor shared with this course, by folder, with **Open**
and **Download**. Empty: **Alex hasn't shared any files yet.**

## SA-09 · Notifications

The full list of what a student is sent, on which channel and with which
default, is in `18-notifications.md`. This section is the student's view.
- A bell in the top bar with a count. The list shows, newest first, for
  example:
  - **Alex started your lesson. Join now.**
  - **Your lesson starts in 30 minutes.**
  - **Alex is running about 10 minutes late.**
  - **New homework: Simultaneous equations worksheet, due Fri.**
  - **Alex added a summary of today's lesson.**
  - **Your homework was marked: 8/10.**
  - **New quiz: Simultaneous equations check.**
  - **Your lesson on Mon was moved to Tue, 4:00 PM.** / **…was cancelled.**
- Push (if allowed) carries the same events. Email is used for reminders and
  changes to a lesson, never for "your lesson has started" (it would arrive
  late). Every email has an unsubscribe link (00 section 19).
- The first time on Home, a one-time card: **Get a reminder before each
  lesson.** with **Turn on notifications** / **Not now**.

## SA-10 · Me

- Profile: photo, name, email, **Timezone** (with current local time). Line:
  **Lesson times are shown in this timezone.**
- **Password:** change it.
- **Notifications:** push on/off; email reminders on/off.
- **Your tutors:** each tutor or agency the student belongs to, for students
  with more than one. Choosing one switches Home, Lessons, Homework and Courses
  to that tutor. (Same account switching as the tutor app, SH-07.)
- **Install Kanvise on your phone** (shown when installable): one tap to add to
  the home screen.
- **Help** (with **Report a concern**) and **Sign out**.

## Empty first day

Right after accepting an invitation, before anything is scheduled:
- Next lesson: **No lesson booked yet.**
- To do: **Nothing due right now.**
- A friendly card: **When Alex books your first lesson, you'll see it here.
  You'll also find homework and what Alex says after each lesson.**

### Kavi

No Kavi feature is student-facing in this version. Students read what their
tutor completed or sent: summaries, homework, quizzes and checks, which Kavi
may have drafted for the tutor (08, 10, 11, 04).
- Input: none from the student app.
- Output: none generated in the student app. The welcome line from "Kavi" in
  SA-01 is a fixed script.
- Failure state: none; nothing in the student app waits on Kavi.
- What the tutor must confirm: everything a student sees was completed, set
  or sent by a tutor first.
- Without Kavi: the student app is the same.

## Permissions and privacy

- Students see only their own lessons, homework, summaries, quizzes and course
  plans. In a group course they see the group's lessons, but not other
  students' summaries, work or scores.
- Private notes never appear (00 section 16).
- Recordings of a group lesson are visible to every student on it who may
  watch recordings, and a lesson is recorded only when every student in it has
  consent (00 section 14d).
- Concerns a student raises go only to the chosen people (07 CR-13).

## Data needed (for the build)

- Student shell routes and the four tabs.
- Next lesson with join state; personal join links.
- Student chips (07 CR-12) and concerns (07 CR-13).
- Notifications list plus push (subscriptions exist), per `18-notifications.md`.
- Course plan read model per student per course, with the student-facing
  labels.
- Recording playback (exists).

## Checked against Bobbin

Bobbin's student side is not in the atlas (students use their join link and
email in the captured flows). The student app was checked against:
- `03-lessons/screenshots/lesson-created--join-available.png`: the per-student
  join link ("Anyone with this link enters the classroom as Atlas.") that
  SA-02 opens, and the **Before this lesson · Homework** card copied into
  SA-05.
- `15-tutor-role/screenshots/tutor-course-set-homework.png`: hand-in
  visibility, which SA-06 and the privacy section follow.
- `01-dashboard/screenshots/dashboard-mobile-app.png`: Bobbin's phone app home
  (greeting, date, Upcoming cards); the student Home uses the same order of
  greeting then next lesson.
- `atlas/kanvise/learner_dashboard_student.png` (today's Kanvise student
  portal): its seven-item purple sidebar, Subjects count, "Recent updates" feed
  and "Report a problem" footer link are replaced by the four tabs, the Next
  lesson card, To do, and Report a concern on lesson pages and in Me.
