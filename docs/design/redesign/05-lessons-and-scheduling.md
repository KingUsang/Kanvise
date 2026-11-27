# 05 · Lessons and scheduling

Status: draft for owner review. Builds on `00-decisions.md`, `01-app-shell.md`
and `04-courses-plan-and-diagnostic.md`.

**Who:** tutors and agency admins.
**Goal:** put a lesson on the calendar in under a minute, with the right
students and a topic from the course plan, and make it easy to move or cancel.

A lesson is one scheduled sitting of a course. Every lesson belongs to a
course. All lessons are online, in the Kanvise classroom.

## Lesson statuses

| Status | Meaning | Chip |
|---|---|---|
| Planned | In the future | Blue |
| Live | Started in the classroom and not ended | Orange, pulsing dot |
| Awaiting report | Ended; the tutor hasn't completed the report | Amber |
| Complete | Report done | Green |
| Cancelled | Cancelled and not chargeable | Grey |
| Cancelled (chargeable) | Cancelled late; still billable | Grey with a ₦ mark |

## Flow at a glance

```
/lessons (LS-01)   /calendar (CAL-01)   Course page › New lesson   Dashboard › Schedule lesson
  → New lesson wizard: LW-1 Course and students → LW-2 Topic and time → LW-3 Review
  → Lesson page /lessons/:id (LP-01 planned)
      ↳ Reschedule (LP-03) · Cancel (LP-04) · Join classroom (spec 07)
```

---

## LS-01 · Lessons list

**Header:** **Lessons** · "Every lesson across all your courses." · primary
**New lesson**.

**Status tabs (underline):** **All** · **Planned** · **Awaiting report** ·
**Complete** · **Cancelled**. Each shows a count when above 0.

**Toolbar:** **Filter** (Course, Student, Tutor for admins, Date range) and
search **Search lessons…**.

**Table:**
| Column | Content |
|---|---|
| Lesson | Colour dot, topic, course name under it |
| Date | **Mon 1 Dec** and **10:00 AM · 1 hour** |
| Students | Avatars, **2 students** |
| Tutor | Admins only |
| Status | Chip |

Clicking a row opens the lesson. Sorted by date, nearest first for Planned,
newest first for the others.

**Empty (no lessons at all):** lesson icon, **No lessons yet**, "Lessons belong
to a course. Schedule one and your students get the link." and **New lesson**
(or **Create a course** first if there are no courses).
**Empty tab:** **Nothing awaiting a report.** · **All caught up.**

## CAL-01 · Calendar (summary)

- **Week** view by default, **Day** and **Month** as a segmented switch. Today
  is marked in orange.
- **‹ Today ›** navigation and the date range, for example **23–29 Nov 2026**.
- **Filter** (Course, Student, Tutor for admins, Status).
- Lessons are blocks in their course colour with topic and student names.
  Clicking a block opens a small popover: topic, time, students, status, and
  **Open lesson** / **Join** when it's starting.
- Dragging a block reschedules it (asks to confirm, LP-03). Clicking an empty
  slot opens the New lesson wizard with that date and time filled in.
- Times show in the tutor's timezone, labelled under the header: **Times in
  Lagos time (WAT).**
- Primary action **New lesson**.

---

## New lesson wizard

Dialog (SH-10), 520px, three steps.

### LW-1 · Course and students

Title **Course and students** · subtitle **Pick a course and who's attending.**

- **Course:** a dropdown with colour dots. If opened from a course page, it's
  pre-selected and locked with a small **Change** link.
- **Students:** the course's students, all ticked by default, with
  **1 of 1 selected** and **Clear**. Students can be unticked for this lesson
  only (for example someone is away).
- **Tutor** (admins only): the course tutor pre-selected.
- No courses yet: the step shows **You need a course first.** with **Create a
  course**.

**Continue** validates: a course and at least one student. Errors: **Choose a
course.** · **Choose at least one student.**

### LW-2 · Topic and time

Title **Topic and time** · subtitle **What's this lesson about, and when is it?**

**Topic:**
- A field **Lesson topic**, required. Placeholder **e.g. Solving Systems of
  Linear Equations**.
- Under it, if the course has a plan: **From the course plan:** up to three
  chips from **Up next**, the first marked **Up next**, plus **Browse the
  plan**. Tapping a chip fills the topic and links the lesson to that plan
  topic (shown as a small link icon in the field).
- For groups where students have different Up next topics: a line **Casey's
  next topic is Factorising; Alex's is Indices.**

**Time:**
- **Starts** and **Ends** (date-time pickers). Defaults: the next whole hour
  after now (or the slot clicked on the calendar), one hour long. Changing
  **Starts** moves **Ends** with it.
- **Repeat:** **Doesn't repeat** · **Every week** · **Every 2 weeks** ·
  **Custom…**. Weekly shows day chips (Mon–Sun, the start day pre-selected) and
  **Ends** **after 10 lessons** / **on a date**.
- **Clash warning** (not blocking), shown inline: **You already have Algebra 1
  Small Group from 10:00 to 11:00 AM.** with **See calendar**.

**Continue** validates: topic required (**Add a lesson topic.**), end after
start (**The lesson must end after it starts.**), not in the past
(**Choose a time in the future.**).

### LW-3 · Review and schedule

Title **Review and schedule** · subtitle **Check the details before scheduling.**

Rows with **Edit** links: Topic (with **From the course plan** if linked),
Course, Students, Tutor (admins), Starts, Ends, Repeats (**Every Monday, 10
lessons, until 2 Feb**).

A line above the button: **Students get an email with the lesson time and a
link to join. They'll get a reminder 30 minutes before.**

Button **Schedule lesson** (or **Schedule 10 lessons**).

**On success:** the dialog closes, the lesson page opens (or the calendar
stays, if started there), and a toast says **Lesson scheduled** /
**10 lessons scheduled**. Setup step 4 ticks if not already.
**On failure:** stays on LW-3 with **We couldn't schedule the lesson. Try
again.**

---

## LP-01 · Lesson page (planned)

**Header:** lesson topic, status chip **Planned**. Right: primary **Join
classroom** (video camera icon; enabled from 15 minutes before the start,
greyed with the tooltip **Opens 15 minutes before the lesson** until then), and
**⋯** (Reschedule, Cancel lesson, Duplicate).

**Facts strip:** **Date** · **Time** · **Course** (with colour dot, links to the
course) · **Repeats** (if part of a series).

**Main column:**
- **Before this lesson** card: **Homework** due in the two weeks before, with
  status per student (**Handed in**, **Not handed in**). Empty: **Nothing was due
  before this lesson.** with **All homework**.
- **Tabs:** **Lesson plan** · **Notes**.
  - **Lesson plan:** **Learning objectives for this lesson** (from the linked
    plan topic, editable, each with a tick-box used later in the report). Below
    it, an empty state with the Kavi mark: **Plan this lesson with Kavi.**
    "I'll draft a lesson plan from the topic, the course plan and the last
    lesson. You can edit everything." Button **Draft lesson plan** (Kavi
    mark). Or **Write my own** (text link). Once drafted, a rich-text plan with
    👍 / 👎 and **⋯** (Regenerate, Clear).
  - **Notes:** private notes for the tutor (and admins). Line: **Only you and
    admins can see these.**

**Right column:**
- **Activity:** a timeline, newest last: **Lesson created**, later **Lesson
  started in the classroom**, **Casey joined**, **Casey left**, **Lesson
  ended**. Long histories collapse with **Show 12 more**.
- **Tutor** (admins can **Change**).
- **Students:** each with avatar, name, **Remove from this lesson** (⋯). Line:
  **Students join from their Kanvise dashboard or the reminder email.**

## LP-02 · Lesson page in other statuses

- **Live:** the chip pulses orange, the button reads **Rejoin classroom**, and
  the activity timeline updates as people join and leave.
- **Awaiting report:** a banner at the top of the main column: **This lesson has
  ended. Write the report so Casey knows what to work on.** Button **Write
  report** (spec 08). The tabs become **Report** · **Lesson plan** · **Notes** ·
  **Recording**.
- **Complete:** the tabs are **Report** · **Session** (attendance, times) ·
  **Lesson plan** · **Notes** · **Recording**. The right column adds **Set after
  this lesson: Homework**. The header adds **Share ▾** (Email to students and
  parents, Export as PDF).
- **Cancelled:** a grey banner: **This lesson was cancelled on 25 Nov.** (and
  **It's still chargeable.** for chargeable ones), with **Schedule a
  replacement**.

## LP-03 · Reschedule

A small dialog: **Reschedule lesson** · **Students will get an email with the
new time.**
- **Starts**, **Ends**, with the old time shown under them in grey: **Was Mon 1
  Dec, 10:00–11:00 AM**.
- For a lesson in a series: **This lesson only** / **This and following
  lessons**.
- Clash warning as in LW-2.
- Button **Reschedule**. Toast: **Lesson moved to Tue 2 Dec, 10:00 AM.**

## LP-04 · Cancel

A small dialog: **Cancel this lesson?** · **Casey will get an email saying it's
cancelled.**
- **Still charge for this lesson** checkbox, unticked by default, with the line
  **For late cancellations. It will appear on the next invoice.** (Shown only
  once billing is switched on.)
- For a series: **This lesson only** / **This and following lessons**.
- Optional **Message to students** field.
- Buttons **Keep lesson** and **Cancel lesson** (red).
- Toast: **Lesson cancelled.** with **Undo** for 10 seconds.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|
| Schedule, reschedule, cancel | Yes | Yes, any lesson | Their own lessons |
| Join as the tutor | Yes | Only lessons where they are the tutor | Their own lessons |
| Watch a lesson | n/a | Yes, as an observer (spec 07) | No |

## Data needed (for the build)

- Lesson: course, students attending, tutor, topic, linked plan topic,
  start/end, timezone, series rule, status.
- Activity events (created, started, joined, left, ended, rescheduled,
  cancelled).
- Reminder emails at scheduling and 30 minutes before.
