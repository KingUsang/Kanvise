# 03 · Dashboard

Status: draft for owner review. Builds on `00-decisions.md` and `01-app-shell.md`.

**Who:** tutors and admins, every day.
**Goal:** answer three questions in one glance: what's on today, what's coming
this week, and what needs me. Everything on it leads somewhere.

Today's Kanvise dashboard has eight stat cards that lead nowhere. This replaces
it entirely, with Bobbin's layout (Today and This week on the left, Needs
attention on the right).

## Layout (desktop)

```
Good afternoon, Michael                                   [Schedule lesson]
Friday, 27 November 2026

[Banner area: sample course or welcome, at most one at a time]

┌ Today  2 lessons     Live now ›  Open calendar › ┐  ┌ Needs attention ─────────┐
│ lesson rows                                      │  │ attention rows            │
└──────────────────────────────────────────────────┘  └───────────────────────────┘
┌ This week                          All lessons › ┐  ┌ Suggestions ──────────────┐
│ day strip + lesson list                          │  │ suggestion cards          │
└──────────────────────────────────────────────────┘  └───────────────────────────┘
```

Left column about 2/3 width, right column about 1/3. **Live now ›** is shown to
agency admins only (DB-08).

**Phones** (spec 16 R-07 uses this order): the setup card while unfinished,
then the banner, Today, Needs attention, This week, Suggestions. The top bar
title reads **Today**. There is no separate "next lesson" card: the first row
of Today is the next lesson.

---

## DB-01 · Header

- **Good morning / afternoon / evening, {first name}**, based on the person's
  timezone. Plain text, no emoji (today's emoji renders as a broken box).
- Date line under it, for example **Friday, 27 November 2026**.
- Primary action: **Schedule lesson** → New lesson wizard (spec 05). Agency
  tutors can only pick their own courses in it (spec 05 permissions).

## DB-02 · Banner area

Shows at most one banner, in this priority order:

| Banner | When | Content | Actions |
|---|---|---|---|
| Sample course | Sample data exists and the user has no real course yet | **Explore a sample course.** "Algebra 1 Small Group is a ready-made course with lessons, summaries and a course plan, so you can see Kanvise working before your own students arrive." | **Open the sample course**, **Delete sample data** (asks to confirm) |
| Welcome (invited tutor) | A tutor's first visit to an agency (spec 02, ONB-10) | **Welcome to Science Students Academy.** "Your admin has given you access to your courses. Test your classroom before your first lesson." | **Test classroom**, ✕ |

Dismissing a banner shrinks it away; the next one does not appear until the
next visit.

Bobbin also shows a card asking admins to brief tutors on admitting students
from the classroom. Kanvise has no such step (students' links take them
straight in, 00 section 14a), so there is no classroom tip banner of any kind.

## DB-03 · Today

- Title **Today** with a count, for example **2 lessons**. On the right, text
  links **Live now ›** (agency admins, DB-09) and **Open calendar ›**.
- One row per lesson, ordered by time:
  - start and end time;
  - the course swatch (01, SH-15) and the lesson topic;
  - a second line: **1 student · Algebra 1 Small Group** (agency admins also see
    **with Michael Chen**);
  - on the right, the action and then the status chip, as in Bobbin.

**Join on every upcoming row.** As in Bobbin
(`15-tutor-role/screenshots/tutor-dashboard--default.png`: **Join** beside the
**Planned** chip), tutors and admins always see **Join** on a lesson that
hasn't ended, because their Join classroom is always enabled (05 LP-01; the
pre-entry screen, 07 CR-01, offers **Enter without starting a lesson** before
students can join). What changes is the chip and the button's weight. The
classroom opens for students a set time before the start, from the account's
**Classroom opens** setting (12 CFG-L: 5, 10, 15 or 30 minutes; 15 by
default); that moment turns **Planned** into **Starting soon**. Nothing on the
dashboard uses a fixed number of minutes.

| Lesson state | Chip (icon + text, 01 SH-12) | Action |
|---|---|---|
| Scheduled, classroom not open for students yet | **Planned** (blue dot) | **Join** (video camera icon, secondary style) → classroom pre-entry (07 CR-01) |
| Classroom open, lesson not started | **Starting soon** (amber dot) | **Join** (video camera icon, indigo) → classroom (spec 07) |
| Running | **Live** (green pulsing dot) | **Join** |
| Ended, summary not written | **Awaiting summary** (pen icon, neutral) | **Write summary** → lesson summary (spec 08). For 60 minutes after an automatic end, **Restart this lesson** sits beside it (07 CR-06) |
| The scheduled end passed and nobody started the lesson | **Not held** (grey, crossed-circle icon; status defined in spec 05) | **Open** → lesson page, where the tutor reschedules, starts it anyway or marks it cancelled (05 LP-02) |
| Started, but no student joined, and the tutor marked it missed | **Missed** (grey, person-off icon; 05) | none; the row opens the lesson |
| Summary done, or **No summary needed** | **Complete** (neutral, tick icon) | none; the row opens the lesson |
| Cancelled | **Cancelled** (grey, struck-through topic) | none |

- Planned and Starting soon rows have a **Let Casey know** menu (**Running
  late**, **Starting now**, **Can't make it**; 07 CR-12) in the row's **⋯**.
  A student's message shows under the row: **Casey: running late · 3:58 PM**.
- **Join** has the accessible name "Join classroom for {topic}". An admin
  pressing Join on a lesson they don't teach gets **Join as an admin?** first
  (07 CR-09).
- Offline, **Join** is disabled with the reason under the row (01, SH-13).
- Clicking anywhere else on the row opens the lesson page.
- **Empty:** **No lessons today.** with **Your next lesson is Monday, 10:00 AM
  · Algebra 1 Small Group.** and a link to it. If nothing is scheduled at all:
  **Nothing scheduled yet.** with **Schedule lesson**.

## DB-04 · This week

- Title **This week**, link **All lessons ›** → `/lessons`.
- A strip of seven day tiles (Mon–Sun). Today's tile has the orange outline
  (the "location" token). A small grey dot under a day means it has lessons
  (accessible name, for example "Thursday, 3 lessons"). Clicking a tile filters
  the list below to that day; clicking it again shows the whole week.
- Below: the week's remaining lessons in compact rows (time, course swatch,
  topic), grouped by day.
- **‹ ›** arrows beside the title move to the previous or next week.
- **Empty week:** **Nothing scheduled this week.**

## DB-05 · Needs attention

A list of things only this person can unblock. Each row: an icon in a soft
circle, a count and label, a one-line explanation, and a chevron. As in Bobbin,
a row with nothing to do stays visible but quiet: a grey icon, **0** and a
second line such as **all caught up**. Rows marked "only when there is
something" are hidden at 0.

### Rows for every tutor (independent tutors, agency tutors, and admins who teach)

| Row | Shows | Goes to |
|---|---|---|
| Lesson summaries to write | **2 lesson summaries to write** · "From lessons that have ended" | Lessons filtered to Awaiting summary |
| Homework to mark | **3 submissions to mark** · "Handed in and waiting for you" | Homework filtered to To mark |
| Starting checks finished | **1 starting check to review** · "Casey finished the check you sent" | That check's results (04 DIAG-R); with more than one, the course list of finished checks |
| Links to send (only when there is something) | **2 join links to send** · "Alex has no email. Send Alex's links for this week's 2 lessons." | The next of those lessons, at its join links (spec 05), where **Copy**, **WhatsApp** and **Email** are |

- **Links to send** counts students without an email who have a lesson in the
  next 7 days, where nobody has yet pressed Copy, WhatsApp or Email on that
  student's link for that lesson. Students with an email get their lessons in
  their account, so they never appear here.
- Quizzes are multiple choice and mark themselves, so there is no "answers to
  mark" row.

### Rows for independent tutors and agency admins

| Row | Shows | Goes to |
|---|---|---|
| Students not joined yet | **1 student hasn't joined yet** · "Invited 3 days ago" | Students filtered to Invited |

### Extra rows for agency admins

| Row | Shows | Goes to |
|---|---|---|
| Summaries overdue, by tutor | **3 lesson summaries overdue** · "Michael Chen 2 · Priya Shah 1" | Lessons filtered to Awaiting summary, ended more than 2 days ago, grouped by tutor |
| Lessons that didn't start | **1 lesson didn't start** · "Not held · Algebra 1 Small Group, Tue 4:00 PM" | Lessons filtered to Not held |
| Homework waiting over 3 days | **4 hand-ins waiting over 3 days** · "Oldest: Ada, 5 days" | Homework filtered to To mark, handed in more than 3 days ago |
| Tutors not joined yet | **1 tutor hasn't joined yet** · "Invited 6 days ago" | Tutors filtered to Invited (`19-tutors-and-team.md`) |
| Lessons without a tutor (only when there is something) | **2 lessons without a tutor** · "Michael Chen can no longer sign in. Choose who teaches them." | Those courses, with **Choose a tutor** |

- A summary is overdue when the lesson ended more than 48 hours ago and has
  neither a summary nor **No summary needed**.
- **Lessons without a tutor** should never happen: removing a tutor requires
  choosing a new tutor for each of their courses (19 TM-06). The row shows only
  if a tutor's access ended outside that flow (for example Kanvise support
  closed their sign-in), and **Choose a tutor** opens the same Reassign step. Every
  new course and lesson needs a tutor (specs 04 and 05), so otherwise the row
  never shows.

## DB-06 · Suggestions

Up to three suggestion cards. Suggestions start as fixed rules, so the card
works before Kavi exists. A suggestion never repeats a Needs attention row.

**Rules (checked when the dashboard loads, per course the person teaches):**

| Rule | When | Card text | **Use this** does |
|---|---|---|---|
| Needs work twice | A topic was marked **Needs work** for a student in two lesson summaries in a row | **"Factorising has been Needs work for Casey in the last two lessons. Make it the topic of Monday's lesson?"** | Sets the next lesson's topic |
| Next lesson has no topic | A lesson in the next 3 days has no topic, and the course plan has a **Next** topic | **"Monday's lesson has no topic yet. Use the next topic in the plan, Quadratic graphs?"** | Sets that lesson's topic |
| Nothing booked next week | A course with a lesson in the last 2 weeks has nothing scheduled next week | **"Algebra 1 Small Group has nothing booked next week. Schedule a lesson?"** | Opens the New lesson wizard with the course filled in |

- The earliest lesson's suggestion comes first.
- Each card has the evidence as a small link, for example **From the summaries
  of 20 and 24 Nov**, and the buttons **Use this** and **Not now**.
- **Use this** shows a toast with **Undo** (01, SH-08: it stays until dismissed
  or the window closes). These changes send nothing to students.
- **Not now** hides the card and asks one optional question: **Why not?** with
  chips **Already planned**, **Not accurate**, **Not relevant**. The answer is
  saved as feedback.
- **Empty:** the card is hidden entirely. There are no placeholder suggestions,
  ever.

### Kavi
- Input: lesson summaries (never private notes, 00 section 16), course plan
  statuses, starting check results and marked homework for the courses this
  person teaches.
- Output: extra suggestion cards in the same shape, with the Kavi mark and a
  **Kavi's pick** badge, added after the rule cards (still at most three).
- Failure state: if Kavi is preparing or fails, its cards are simply not shown;
  the rule cards still appear. No error card.
- What the tutor must confirm: **Use this** on each card. Nothing changes until
  it is pressed.
- Without Kavi: the card is titled **Suggestions**, has no Kavi mark, and
  shows only the rule cards above. With Kavi it is titled **Kavi suggests**.

## DB-07 · Tutor view (agency tutors)

The same layout, scoped to their own lessons and students, as on Bobbin's tutor
dashboard. Needs attention has only the rows for every tutor. No **Live now**
link. A tutor never sees earnings or account-wide totals.

## DB-08 · Admin view (agency admins)

The same layout, plus:
- **Today** shows every tutor's lessons, with **with {tutor}** on each row and a
  **Mine only** toggle.
- The extra Needs attention rows above.
- The **Live now ›** link beside Today (DB-09). When any lesson is running it
  shows a green pulsing dot and the count, for example **Live now (2) ›**.

**Difference from Bobbin:** Bobbin gives tutors a **Live view** link too. In
Kanvise a tutor's own live lesson is already the **Live** row in Today with
**Join**, so the page would repeat it. Live now is for admins, who watch many
tutors' lessons.

## DB-09 · Live lessons page

Route `/lessons/live`, admins only. Lessons stays the active sidebar item, and
a **Dashboard ›** link at the top right goes back, as in Bobbin.

- Title **Live lessons**, line **Updated 3:16 PM, refreshes every 15 seconds.**
- One row per running lesson: course swatch, topic, tutor, time started, and
  who has joined (avatars with names; students who haven't joined shown
  greyed). **Join** follows **Join as an admin?** (07 CR-09).
- **Empty:** a green-tinted icon, **No lessons are running right now**, the
  line **Lessons show here while they are in progress, with who has joined each
  one. This page refreshes on its own.** and **Open calendar**.
- Refreshing never moves focus or the scroll position; a change is announced
  politely ("2 lessons running").

## Data needed (for the build)

Tables are in `20-data-model.md`: lessons DM-06, lesson summaries DM-10, homework DM-12, invitations DM-02, topic status DM-05.

- Lesson list for today and this week, with status as above, and the account's
  **Classroom opens** setting.
- Counts for each Needs attention row, including the admin rows grouped by
  tutor, and Copy/WhatsApp/Email presses per student per lesson (for Links to
  send).
- Suggestion rules run on stored data (summary topic statuses, lesson topics,
  schedules). Feedback from **Not now** stored per suggestion.
- Live lessons: who has joined each running lesson, refreshed every 15 seconds.

---

Checked against Bobbin (screenshots opened and compared):
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-dashboard--default.png` (tutor: greeting and date, Today with Live view and Open calendar, This week day strip, Needs attention row at 0 with "all caught up")
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-live-view.png` (Live lessons page, refresh line, empty state, Dashboard link)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/00-recon/screenshots/setup--post-test-data.png` (admin: sample course banner, classroom tip card, Today row with Join and Planned, Needs attention at 0)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/01-dashboard/screenshots/dashboard-help-updates.png` (admin dashboard, full width)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/01-dashboard/screenshots/dashboard-account-menu.png` (right column: help card, sales card, mobile app card)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/01-dashboard/screenshots/page--default.png` (loading state)
- `/projects/sandbox/atlas/kanvise/admin_dashboard.png`, `/projects/sandbox/atlas/kanvise/tutor_dashboard.png` (today's Kanvise stat cards being replaced)

Deliberate differences from Bobbin: Live now is admin-only (DB-08); no
classroom tip card; no trial banner, sales card or mobile app card (billing is
on hold and Kanvise is online only); Needs attention has no safeguarding or
approval rows (out of scope, 00 section 15) and adds homework, starting check,
links and team rows; Suggestions has no Bobbin equivalent.

Final Bobbin pass (FEAT-009):
- `15-tutor-role/screenshots/tutor-dashboard--default.png` (review v1): the
  Planned row shows a yellow **Join** beside the **Planned** chip. DB-03 now
  shows **Join** on Planned rows for tutors and admins (secondary style until
  the classroom opens for students), replacing the earlier **Prepare**.
- `15-tutor-role/screenshots/tutor-account-menu.png`: tutor dashboard with one Today row (Join and Planned side by side), This week strip and Needs attention at 0 "all caught up"; DB-02 to DB-05 match.
- `15-tutor-role/screenshots/tutor-mobile-app-learn-more.png`: the NEW · MOBILE APP card's dialog; the card is not copied (03 has no mobile app card).
