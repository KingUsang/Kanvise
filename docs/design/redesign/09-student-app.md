# 09 · Student app

Status: draft for owner review. Builds on `00-decisions.md`, `01-app-shell.md`,
`04`–`08`.

**Who:** students (children, teens and adults), mostly on phones.
**Goal:** know what's next and get to it in one tap: join the lesson, do the
homework, take the quiz, read what the tutor said. Everything a student sees
mirrors something their tutor did.

The student app is part of the same web app (installable as a PWA), with its
own simpler shell. Words are plain and friendly, never childish.

## Flow at a glance

```
Invite email → SA-01 set password → SA-03 Home
Join link (lesson) → SA-02 straight into the lesson (no sign-in)
Check link → the check (spec 04, DIAG-S)
Home ─┬─ Lessons (SA-04) → lesson (SA-05) → classroom (spec 07)
      ├─ Homework (SA-06) → hand in (spec 10)
      ├─ Courses (SA-07) → course (SA-08): plan, resources, quizzes
      └─ Me (SA-10): profile, notifications, tutors, sign out
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
- On success: a one-screen welcome from Kavi (typing in, as in onboarding):
  **Hi Casey, I'm Kavi. This is where your lessons with Alex live.** with
  **Let's go**, then Home.
- Expired invite: **This invitation has expired. Ask Alex to send a new one.**

**Signing in later:** the normal sign-in page (restyle deferred), with **Forgot
password?**. Students land on Home.

## SA-02 · Join link (no sign-in)

Each student has their own join link for each lesson (spec 05). Opening it:
- Before the classroom opens: the student waiting card (spec 07, CR-02), with
  **Your lesson starts at 4:00 PM**.
- When the tutor has started: straight into the lesson as that student.
- After the lesson: **This lesson has ended.** and, if the student has an
  account, **Sign in to see what Alex said**.
- Expired or not theirs: **This link has expired. Ask Alex for a new one.**

The link only opens that lesson. It never opens the rest of the app.

## SA-03 · Home

**Shell (phone):** a top bar with the tutor's (or agency's) name and the
student's avatar; a bottom bar with four tabs: **Home** · **Lessons** ·
**Homework** · **Courses**. The avatar opens **Me** (SA-10). On desktop the
same four items sit in a light sidebar, with the same orange "you are here"
marker as the tutor app.

**Home, top to bottom:**

1. **Greeting:** **Hi Casey** and the date.
2. **Next lesson** card (the most important thing on the screen):
   - Course colour dot, topic, **Today · 4:00–5:00 PM** (in the student's
     timezone), tutor's name and photo.
   - Button by state:

| State | Button |
|---|---|
| More than 15 min away | **Add to calendar** (secondary) |
| Within 15 min, not started | **Join** (disabled look, label **Opens at 3:45 PM**) |
| Tutor has started | **Join now** (indigo, with a soft pulse) |
| No lesson scheduled | Card reads **No lesson booked yet.** "Alex will add your next one." |

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
  time, topic, course dot, and **Join** when it's open.
- **Past:** newest first, each with its status: **Summary ready** (green),
  **Waiting for Alex's summary**, **Missed**, **Cancelled**. Tapping opens
  SA-05.
- Empty: **No lessons yet.** "When Alex books a lesson, it'll show up here."

## SA-05 · A lesson

**Upcoming:** topic, date and time (with timezone: **4:00 PM your time · 3:00
PM Alex's time** when they differ), course, tutor, **Join** (when open), **Add
to calendar**, and **Before this lesson:** homework due before it, if any.

**Past, with summary:**
- **Summary** (spec 08 as the student sees it): **What we covered** (topics),
  **What went well**, **What to work on**, **Homework** (with **Open**).
- **Recording** (if there is one): a player with a scrub bar and speed control
  (1×, 1.25×, 1.5×). On phones it plays inline and can go full screen.
- **Files from this lesson:** materials the tutor presented or attached.

**Past, no summary yet:** **Alex hasn't added a summary yet.** The recording
shows as soon as it's processed.

**Missed:** **You missed this lesson.** plus the tutor's note if they sent one.

## SA-06 · Homework

- Tabs: **To do** · **Handed in** · **Marked**.
- Each row: title, course, due date, status chip (**Due Fri**, **Overdue**,
  **Handed in**, **Marked · 8/10**).
- Tapping opens the homework (spec 10): instructions, the tutor's files, and
  **Hand in** (upload files or type an answer). After marking: the score and
  the tutor's feedback.
- Empty **To do:** **No homework right now.**

## SA-07 · Courses

A card per course: colour dot, name, tutor, and **Next: Factorising**. If the
student has several tutors or agencies, cards are grouped under each one's
name.

## SA-08 · A course

**Header:** colour dot, course name, tutor. Tabs: **Plan** · **Quizzes** ·
**Resources**.

**Plan** (what they're learning):
- The course plan's modules and topics, read-only, with simple marks per topic:
  **Taught** (tick), **Next** (highlighted), and nothing for not yet.
- **Knows it** and **Needs work** are shown to the student as **You know this**
  and **Practise this** (gentler words for the same statuses). *(Pending owner
  decision on whether students see these; default: yes.)*
- A line at the top: **12 of 32 topics so far.**

**Quizzes:** quizzes set on this course: **To take**, **Done** (with score if
the tutor shows scores). Taking a quiz: spec 11.

**Resources:** files the tutor shared with this course, by folder, with **Open**
and **Download**. Empty: **Alex hasn't shared any files yet.**

## SA-09 · Notifications

- A bell in the top bar with a count. The list shows, newest first:
  - **Alex started your lesson. Join now.**
  - **Your lesson starts in 30 minutes.**
  - **New homework: Simultaneous equations worksheet, due Fri.**
  - **Alex added a summary of today's lesson.**
  - **Your homework was marked: 8/10.**
  - **New quiz: Linear equations check.**
  - **Your lesson on Mon was moved to Tue, 4:00 PM.** / **…was cancelled.**
- The same events go out as push notifications (if allowed) and by email for
  the lesson start, reminders, and changes to a lesson.
- The first time on Home, a one-time card: **Get a reminder before each
  lesson.** with **Turn on notifications** / **Not now**.

## SA-10 · Me

- Profile: photo, name, email, **Timezone** (with current local time).
- **Password:** change it.
- **Notifications:** push on/off; email reminders on/off.
- **Your tutors:** each tutor or agency the student belongs to, for students
  with more than one. Choosing one switches Home, Lessons, Homework and Courses
  to that tutor. (Same account switching as the tutor app, SH-07.)
- **Install Kanvise on your phone** (shown when installable): one tap to add to
  the home screen.
- **Help** and **Sign out**.

## Empty first day

Right after accepting an invitation, before anything is scheduled:
- Next lesson: **No lesson booked yet.**
- To do: **Nothing to do right now.**
- A friendly Kavi card: **When Alex books your first lesson, you'll see it
  here. You'll also find homework and what Alex says after each lesson.**

## Permissions and privacy

- Students see only their own lessons, homework, summaries, quizzes and course
  plans. In a group course they see the group's lessons, but not other
  students' summaries, work or scores.
- Private notes never appear.
- Recordings of a group lesson are visible to every student on it.

## Data needed (for the build)

- Student shell routes and the four tabs.
- Next lesson with join state; personal join links.
- Notifications list plus push (subscriptions exist).
- Course plan read model per student, with the student-facing labels.
- Recording playback (exists).
