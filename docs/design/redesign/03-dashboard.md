# 03 · Dashboard

Status: draft for owner review. Builds on `00-decisions.md` and `01-app-shell.md`.

**Who:** tutors and admins, every day.
**Goal:** answer three questions in one glance: what's on today, what's coming
this week, and what needs me. Everything on it leads somewhere.

Today's Kanvise dashboard has eight stat cards that lead nowhere. This replaces
it entirely.

## Layout (desktop)

```
Good afternoon, Alex                                    [Schedule live class]
Friday, 27 November 2026

[Banner area: sample course / teaching tip / welcome — at most one at a time]

┌ Today ─────────────────────────────┐  ┌ Needs attention ─────────┐
│ live class rows                         │  │ attention rows            │
└─────────────────────────────────────┘  └───────────────────────────┘
┌ This week ──────────────────────────┐  ┌ Kavi suggests ────────────┐
│ day strip + live class list             │  │ suggestion cards          │
└─────────────────────────────────────┘  └───────────────────────────┘
```

Left column about 2/3 width, right column about 1/3. On phones everything
stacks: Today, Needs attention, This week, Kavi suggests.

---

## DB-01 · Header

- **Good morning / afternoon / evening, {first name}**, based on the person's
  timezone. Plain text, no emoji (today's emoji renders as a broken box).
- Date line under it.
- Primary action: **Schedule live class** → New live class wizard (spec 05).

## DB-02 · Banner area

Shows at most one banner, in this priority order:

| Banner | When | Content | Actions |
|---|---|---|---|
| Sample course | Sample data exists and the user has no real course yet | **Explore a sample course.** "Algebra 1 Small Group is a ready-made course with live classes, reports and a course plan, so you can see Kanvise working before your own students arrive." | **Open the sample course**, **Delete sample data** (asks to confirm) |
| Welcome (invited tutor) | A tutor's first visit to an agency | **Welcome to Science Students Academy.** "Your admin has given you access to your courses. Test your classroom before your first live class." | **Test classroom**, ✕ |
| Teaching tip | One-time tips, shown once each | For example **Students wait until you let them in.** "When you start a live class, students join the waiting room. Let each one in from Class tools." | **Read the classroom guide**, ✕ (dismissed for good) |

Dismissing a banner shrinks it away; the next one does not appear until the
next visit.

## DB-03 · Today

- Title **Today** with a count, for example **2 live classes**. On the right, text
  links **Open calendar ›**.
- One row per live class, ordered by time:
  - start and end time;
  - course colour dot and live class topic;
  - a second line: **1 student · Algebra 1 Small Group** (agency admins also see
    **with Michael Chen**);
  - on the right, a status chip and one action:

| Live class state | Chip | Action |
|---|---|---|
| Starts in more than 15 minutes | **Planned** (blue) | **Prepare** → live class page, Lesson plan tab |
| Starts within 15 minutes, or running | **Starting soon** / **Live** (orange pulse dot) | **Join** (video camera icon, indigo) → classroom (spec 07) |
| Ended, report not written | **Awaiting report** (amber) | **Write report** → class report (spec 08) |
| Report done | **Complete** (green) | none; the row opens the live class |
| Cancelled | **Cancelled** (grey, struck-through topic) | none |

- Clicking anywhere else on the row opens the live class page.
- **Empty:** **No live classes today.** with **Your next live class is Monday, 10:00 AM
  · Algebra 1 Small Group.** and a link to it. If nothing is scheduled at all:
  **Nothing scheduled yet.** with **Schedule live class**.

## DB-04 · This week

- Title **This week**, link **All live classes ›** → `/live-classes`.
- A strip of seven day tiles (Mon–Sun). Today's tile has the orange outline.
  A dot under a day means it has live classes. Clicking a tile filters the list
  below to that day; clicking it again shows the whole week.
- Below: the week's remaining live classes in compact rows (time, colour dot,
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
| Class reports to write | **2 class reports to write** · "From live classes that have ended" | Live classes filtered to Awaiting report |
| Homework to mark | **3 submissions to mark** · "Handed in and waiting for you" | Homework filtered to To mark |
| Diagnostics finished | **1 diagnostic to review** · "Casey finished the check you sent" | That diagnostic's results (spec 04, DIAG-R) |
| Quiz answers to mark | **4 written answers to mark** · only if a quiz has written answers | Quizzes filtered to To mark |
| Invitations not accepted | **1 student hasn't joined yet** · "Invited 3 days ago" | Students filtered to Invited |

When every count is 0, the card shows a single row: **All caught up.** with a
green tick.

## DB-06 · Kavi suggests

Up to three suggestion cards, each with:
- the Kavi mark;
- one sentence saying what Kavi suggests and why, for example **"Casey missed
  most questions on factorising. Start the next live class there?"**;
- the evidence as a small link, for example **From the diagnostic, 26 Nov**;
- buttons **Use this** and **Not now**.

**Use this** does the obvious thing (for example sets the next live class's topic,
or puts the topic first on the course plan) and shows a toast with **Undo**.
**Not now** hides the card and asks one optional question: **Why not?** with
chips **Already planned**, **Not accurate**, **Not relevant**. The answer is
saved as feedback for Kavi.

**Empty:** the card is hidden entirely. There are no placeholder suggestions,
ever.

## DB-07 · Tutor view (agency tutors)

The same layout, scoped to their own live classes and students. No team rows in
Needs attention. A tutor never sees earnings or account-wide totals.

## DB-08 · Admin view (agency admins)

The same layout, plus:
- **Today** shows every tutor's live classes, with **with {tutor}** on each row and a
  **Mine only** toggle.
- An extra Needs attention row: **Live classes without a tutor**.
- A **Live now** link beside Today when any live class is running, opening a small
  panel listing live live classes with who has joined, refreshing every 15 seconds.
  Admins can **Watch** a live class; that follows the admin-observer rules in spec
  07.

## Data needed (for the build)

- Live class list for today and this week, with status as above.
- Counts for each Needs attention row.
- Kavi suggestions from stored evidence (diagnostic results, class reports,
  marked work). Until Kavi's backend exists, simple rules produce them (for
  example "lowest diagnostic topic"), shown the same way.
