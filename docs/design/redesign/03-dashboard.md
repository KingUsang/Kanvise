# 03 · Dashboard

Status: draft for owner review. Builds on `00-decisions.md` and `01-app-shell.md`.

**Who:** tutors and admins, every day.
**Goal:** answer three questions in one glance: what's on today, what's coming
this week, and what needs me. Everything on it leads somewhere.

Today's Kanvise dashboard has eight stat cards that lead nowhere. This replaces
it entirely.

## Layout (desktop)

```
Good afternoon, Alex                                    [Schedule lesson]
Friday, 27 November 2026

[Banner area: sample course or welcome, at most one at a time]

┌ Today ─────────────────────────────┐  ┌ Needs attention ─────────┐
│ lesson rows                         │  │ attention rows            │
└─────────────────────────────────────┘  └───────────────────────────┘
┌ This week ──────────────────────────┐  ┌ Kavi suggests ────────────┐
│ day strip + lesson list             │  │ suggestion cards          │
└─────────────────────────────────────┘  └───────────────────────────┘
```

Left column about 2/3 width, right column about 1/3. On phones everything
stacks: Today, Needs attention, This week, Kavi suggests.

---

## DB-01 · Header

- **Good morning / afternoon / evening, {first name}**, based on the person's
  timezone. Plain text, no emoji (today's emoji renders as a broken box).
- Date line under it.
- Primary action: **Schedule lesson** → New lesson wizard (spec 05).

## DB-02 · Banner area

Shows at most one banner, in this priority order:

| Banner | When | Content | Actions |
|---|---|---|---|
| Sample course | Sample data exists and the user has no real course yet | **Explore a sample course.** "Algebra 1 Small Group is a ready-made course with lessons, summaries and a course plan, so you can see Kanvise working before your own students arrive." | **Open the sample course**, **Delete sample data** (asks to confirm) |
| Welcome (invited tutor) | A tutor's first visit to an agency | **Welcome to Science Students Academy.** "Your admin has given you access to your courses. Test your classroom before your first lesson." | **Test classroom**, ✕ |

Dismissing a banner shrinks it away; the next one does not appear until the
next visit.

## DB-03 · Today

- Title **Today** with a count, for example **2 lessons**. On the right, text
  links **Open calendar ›**.
- One row per lesson, ordered by time:
  - start and end time;
  - course colour dot and lesson topic;
  - a second line: **1 student · Algebra 1 Small Group** (agency admins also see
    **with Michael Chen**);
  - on the right, a status chip and one action:

| Lesson state | Chip | Action |
|---|---|---|
| Starts in more than 15 minutes | **Planned** (blue) | **Prepare** → lesson page, Lesson plan tab |
| Starts within 15 minutes, or running | **Starting soon** (amber dot) / **Live** (green pulse dot) | **Join** (video camera icon, indigo) → classroom (spec 07) |
| Ended, summary not written | **Awaiting summary** (amber) | **Write summary** → lesson summary (spec 08) |
| Summary done | **Complete** (green) | none; the row opens the lesson |
| Cancelled | **Cancelled** (grey, struck-through topic) | none |

- Clicking anywhere else on the row opens the lesson page.
- **Empty:** **No lessons today.** with **Your next lesson is Monday, 10:00 AM
  · Algebra 1 Small Group.** and a link to it. If nothing is scheduled at all:
  **Nothing scheduled yet.** with **Schedule lesson**.

## DB-04 · This week

- Title **This week**, link **All lessons ›** → `/lessons`.
- A strip of seven day tiles (Mon–Sun). Today's tile has the orange outline.
  A dot under a day means it has lessons. Clicking a tile filters the list
  below to that day; clicking it again shows the whole week.
- Below: the week's remaining lessons in compact rows (time, colour dot,
  topic), grouped by day.
- **‹ ›** arrows beside the title move to the previous or next week.
- **Empty week:** **Nothing scheduled this week.**

## DB-05 · Needs attention

A list of things only this person can unblock. Each row: an icon in a soft
circle, a count and label, a one-line explanation, and a chevron. Rows with
nothing to do stay visible but quiet, so the card shows the user is "all caught
up".

| Row | Shows | Goes to |
|---|---|---|
| Lesson summaries to write | **2 lesson summaries to write** · "From lessons that have ended" | Lessons filtered to Awaiting summary |
| Homework to mark | **3 submissions to mark** · "Handed in and waiting for you" | Homework filtered to To mark |
| Starting checks finished | **1 starting check to review** · "Casey finished the check you sent" | That check's results (spec 04, DIAG-R) |
| Quiz answers to mark | **4 written answers to mark** · only if a quiz has written answers | Quizzes filtered to To mark |
| Invitations not accepted | **1 student hasn't joined yet** · "Invited 3 days ago" | Students filtered to Invited |

When every count is 0, the card shows a single row: **All caught up.** with a
green tick.

## DB-06 · Kavi suggests

Up to three suggestion cards, each with:
- the Kavi mark;
- one sentence saying what Kavi suggests and why, for example **"Casey missed
  most questions on factorising. Start the next lesson there?"**;
- the evidence as a small link, for example **From the starting check, 26 Nov**;
- buttons **Use this** and **Not now**.

**Use this** does the obvious thing (for example sets the next lesson's topic,
or puts the topic first on the course plan) and shows a toast with **Undo**.
**Not now** hides the card and asks one optional question: **Why not?** with
chips **Already planned**, **Not accurate**, **Not relevant**. The answer is
saved as feedback for Kavi.

**Empty:** the card is hidden entirely. There are no placeholder suggestions,
ever.

## DB-07 · Tutor view (agency tutors)

The same layout, scoped to their own lessons and students. No team rows in
Needs attention. A tutor never sees earnings or account-wide totals.

## DB-08 · Admin view (agency admins)

The same layout, plus:
- **Today** shows every tutor's lessons, with **with {tutor}** on each row and a
  **Mine only** toggle.
- An extra Needs attention row: **Lessons without a tutor**.
- A **Live now** link beside Today when any lesson is running, opening a small
  panel listing live lessons with who has joined, refreshing every 15 seconds.
  Admins can open a lesson from there; joining one they don't teach follows
  **Join as an admin?** in spec 07 (CR-09).

## Data needed (for the build)

- Lesson list for today and this week, with status as above.
- Counts for each Needs attention row.
- Kavi suggestions from stored evidence (starting check results, lesson summaries,
  marked work). Until Kavi's backend exists, simple rules produce them (for
  example "lowest topic in the starting check"), shown the same way.
