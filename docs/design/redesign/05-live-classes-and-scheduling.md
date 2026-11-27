# 05 · Live classes and scheduling

Status: draft for owner review. Builds on `00-decisions.md`, `01-app-shell.md`
and `04-courses-plan-and-diagnostic.md`.

**Who:** tutors and agency admins.
**Goal:** put a live class on the calendar in under a minute, with the right
students and a topic from the course plan, and make it easy to move or cancel.

A live class is one scheduled sitting of a course. Every live class belongs to a
course. All live classes are online, in the Kanvise classroom.

## Live class statuses

| Status | Meaning | Chip |
|---|---|---|
| Planned | In the future | Blue |
| Live | Started in the classroom and not ended | Orange, pulsing dot |
| Awaiting report | Ended; the tutor hasn't completed the report | Amber |
| Complete | Report done | Green |
| Cancelled | Cancelled | Grey |

## Flow at a glance

```
/live-classes (LS-01)   /calendar (CAL-01)   Course page › New live class   Dashboard › Schedule live class
  → New live class wizard: LW-1 Course and students → LW-2 Topic and time → LW-3 Review
  → Live class page /live-classes/:id (LP-01 planned)
      ↳ Reschedule (LP-03) · Cancel (LP-04) · Join live class (spec 07)
```

---

## LS-01 · Live classes list

**Header:** **Live classes** · "Every live class across all your courses." · primary
**New live class**.

**Status tabs (underline):** **All** · **Planned** · **Awaiting report** ·
**Complete** · **Cancelled**. Each shows a count when above 0.

**Toolbar:** **Filter** (Course, Student, Tutor for admins, Date range) and
search **Search live classes…**.

**Table:**
| Column | Content |
|---|---|
| Live class | Colour dot, topic, course name under it |
| Date | **Mon 1 Dec** and **10:00 AM · 1 hour** |
| Students | Avatars, **2 students** |
| Tutor | Admins only |
| Status | Chip |

Clicking a row opens the live class. Sorted by date, nearest first for Planned,
newest first for the others.

**Empty (no live classes at all):** live class icon, **No live classes yet**, "Live classes belong
to a course. Schedule one and your students get the link." and **New live class**
(or **Create a course** first if there are no courses).
**Empty tab:** **Nothing awaiting a report.** · **All caught up.**

## CAL-01 · Calendar (summary)

- **Week** view by default, **Day** and **Month** as a segmented switch. Today
  is marked in orange.
- **‹ Today ›** navigation and the date range, for example **23–29 Nov 2026**.
- **Filter** (Course, Student, Tutor for admins, Status).
- Live classes are blocks in their course colour with topic and student names.
  Clicking a block opens a small popover: topic, time, students, status, and
  **Open live class** / **Join** when it's starting.
- Dragging a block reschedules it (asks to confirm, LP-03). Clicking an empty
  slot opens the New live class wizard with that date and time filled in.
- Times show in the tutor's timezone, labelled under the header: **Times in
  Lagos time (WAT).**
- Primary action **New live class**.

---

## New live class wizard

Dialog (SH-10), 520px, three steps.

### LW-1 · Course and students

Title **Course and students** · subtitle **Pick a course and who's attending.**

- **Course:** a dropdown with colour dots. If opened from a course page, it's
  pre-selected and locked with a small **Change** link.
- **Students:** the course's students, all ticked by default, with
  **1 of 1 selected** and **Clear**. Students can be unticked for this live class
  only (for example someone is away).
- **Tutor** (admins only): the course tutor pre-selected.
- No courses yet: the step shows **You need a course first.** with **Create a
  course**.

**Continue** validates: a course and at least one student. Errors: **Choose a
course.** · **Choose at least one student.**

### LW-2 · Topic and time

Title **Topic and time** · subtitle **What's this live class about, and when is it?**

**Topic:**
- A field **Live class topic**, required. Placeholder **e.g. Solving Systems of
  Linear Equations**.
- Under it, if the course has a plan: **From the course plan:** up to three
  chips from **Next**, the first marked **Next**, plus **Browse the
  plan**. Tapping a chip fills the topic and links the live class to that plan
  topic (shown as a small link icon in the field).
- For groups where students have different Next topics: a line **Casey's
  next topic is Factorising; Alex's is Indices.**

**Time:**
- **Starts** and **Ends** (date-time pickers). Defaults: the next whole hour
  after now (or the slot clicked on the calendar), one hour long. Changing
  **Starts** moves **Ends** with it.
- **Repeat:** **Doesn't repeat** · **Every week** · **Every 2 weeks** ·
  **Custom…**. Weekly shows day chips (Mon–Sun, the start day pre-selected) and
  **Ends** **after 10 live classes** / **on a date**.
- **Clash warning** (not blocking), shown inline: **You already have Algebra 1
  Small Group from 10:00 to 11:00 AM.** with **See calendar**.

**Continue** validates: topic required (**Add a live class topic.**), end after
start (**The live class must end after it starts.**), not in the past
(**Choose a time in the future.**).

### LW-3 · Review and schedule

Title **Review and schedule** · subtitle **Check the details before scheduling.**

Rows with **Edit** links: Topic (with **From the course plan** if linked),
Course, Students, Tutor (admins), Starts, Ends, Repeats (**Every Monday, 10
live classes, until 2 Feb**).

A line above the button: **Students get an email with the live class time and a
link to join. They'll get a reminder 30 minutes before.**

Button **Schedule live class** (or **Schedule 10 live classes**).

**On success:** the dialog closes, the live class page opens (or the calendar
stays, if started there), and a toast says **Live class scheduled** /
**10 live classes scheduled**. Setup step 4 ticks if not already.
**On failure:** stays on LW-3 with **We couldn't schedule the live class. Try
again.**

---

## LP-01 · Live class page (planned)

**Header:** live class topic, status chip **Planned**. Right: primary **Join
classroom** (video camera icon; enabled from 15 minutes before the start,
greyed with the tooltip **Opens 15 minutes before the live class** until then), and
**⋯** (Reschedule, Cancel live class, Duplicate).

**Facts strip:** **Date** · **Time** · **Course** (with colour dot, links to the
course) · **Repeats** (if part of a series).

**Main column:**
- **Before this live class** card: **Homework** due in the two weeks before, with
  status per student (**Handed in**, **Not handed in**). Empty: **Nothing was due
  before this live class.** with **All homework**.
- **Tabs:** **Lesson plan** · **Notes**.
  - **Lesson plan:** **Learning objectives for this live class** (from the linked
    plan topic, editable, each with a tick-box used later in the report). Below
    it, an empty state with the Kavi mark: **Plan this live class with Kavi.**
    "I'll draft a lesson plan from the topic, the course plan and the last
    live class. You can edit everything." Button **Draft lesson plan** (Kavi
    mark). Or **Write my own** (text link). Once drafted, a rich-text plan with
    👍 / 👎 and **⋯** (Regenerate, Clear).
  - **Notes:** private notes for the tutor (and admins). Line: **Only you and
    admins can see these.**

**Right column:**
- **Activity:** a timeline, newest last: **Live class created**, later **Live class
  started in the classroom**, **Casey joined**, **Casey left**, **Live class
  ended**. Long histories collapse with **Show 12 more**.
- **Tutor** (admins can **Change**).
- **Students:** each with avatar, name, **Remove from this live class** (⋯). Line:
  **Students join from their Kanvise dashboard or the reminder email.**

## LP-02 · Live class page in other statuses

- **Live:** the chip pulses orange, the button reads **Rejoin live class**, and
  the activity timeline updates as people join and leave.
- **Awaiting report:** a banner at the top of the main column: **This live class has
  ended. Write the report so Casey knows what to work on.** Button **Write
  report** (spec 08). The tabs become **Report** · **Lesson plan** · **Notes** ·
  **Recording**.
- **Complete:** the tabs are **Report** · **Session** (attendance, times) ·
  **Lesson plan** · **Notes** · **Recording**. The right column adds **Set after
  this live class: Homework**. The header adds **Share ▾** (Email to students and
  parents, Export as PDF).
- **Cancelled:** a grey banner: **This live class was cancelled on 25 Nov.**, with **Schedule a
  replacement**.

## LP-03 · Reschedule

A small dialog: **Reschedule live class** · **Students will get an email with the
new time.**
- **Starts**, **Ends**, with the old time shown under them in grey: **Was Mon 1
  Dec, 10:00–11:00 AM**.
- For a live class in a series: **This live class only** / **This and following
  live classes**.
- Clash warning as in LW-2.
- Button **Reschedule**. Toast: **Live class moved to Tue 2 Dec, 10:00 AM.**

## LP-04 · Cancel

A small dialog: **Cancel this live class?** · **Casey will get an email saying it's
cancelled.**
- For a series: **This live class only** / **This and following live classes**.
- Optional **Message to students** field.
- Buttons **Keep live class** and **Cancel live class** (red).
- Toast: **Live class cancelled.** with **Undo** for 10 seconds.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|
| Schedule, reschedule, cancel | Yes | Yes, any live class | Their own live classes |
| Join as the tutor | Yes | Only live classes where they are the tutor | Their own live classes |
| Watch a live class | n/a | Yes, as an observer (spec 07) | No |

## Data needed (for the build)

- Live class: course, students attending, tutor, topic, linked plan topic,
  start/end, timezone, series rule, status.
- Activity events (created, started, joined, left, ended, rescheduled,
  cancelled).
- Reminder emails at scheduling and 30 minutes before.
