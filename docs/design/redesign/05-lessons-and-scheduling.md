# 05 · Lessons and scheduling

Status: draft for owner review. Builds on `00-decisions.md`, `01-app-shell.md`
and `04-courses-plan-and-diagnostic.md`.

**Who:** tutors and agency admins.
**Goal:** put a lesson on the calendar in under a minute, with the right
students and a topic from the course plan, and make it easy to move or cancel.

A lesson is one scheduled sitting of a course. Every lesson belongs to a course;
a trial is just a short course (04 CW-1). All lessons are online, in the
Kanvise classroom.

## Flow at a glance

```
/lessons (LL-01)   /calendar (CAL-01)   Course page › New lesson   Dashboard › Schedule lesson
  → New lesson wizard: LW-1 Course and students → LW-2 Topic and time → LW-3 Review and schedule
  → Lesson page /lessons/:id (LP-01 planned, LP-02 other statuses)
      ↳ Reschedule (LP-03) · Cancel (LP-04) · Join links (LP-05) · Join classroom (spec 07)
```

---

## Lesson statuses

This is the one lesson status model. Specs 03, 06, 07, 08 and 09 use these
names. Every chip is a dot or icon plus the word (01 SH-12), and the colours
follow 01 SH-15.

| Status | Meaning | Set by | Chip |
|---|---|---|---|
| **Planned** | Scheduled, the classroom isn't open to students yet | Scheduling (LW-3), Reschedule | Blue dot |
| **Starting soon** | Derived from the clock: the classroom is open to students (12 CFG-L **Classroom opens**) and the lesson hasn't been started. It stays until the lesson starts or its scheduled end passes | Time | Amber dot |
| **Live** | Started in the classroom and not ended | The tutor or an admin presses **Start lesson** (07) | Green pulsing dot |
| **Not held** | The scheduled end passed and nobody started the lesson | Time | Grey, crossed-circle icon |
| **Awaiting summary** | Ended; the tutor hasn't completed the lesson summary | End lesson, or the automatic end (12 CFG-L) | Neutral, pen icon |
| **Missed** | It was started but no student joined, and the tutor marked it missed | **Mark as missed** (08 SM-06) | Grey, person-off icon |
| **Complete** | Summary completed, or closed with **No summary needed** | Spec 08 | Neutral, tick icon |
| **Cancelled** | Cancelled before it happened | Cancel (LP-04), or **Mark as cancelled** on a Not held lesson | Grey, the topic struck through |

**Transitions** (anything not listed is not allowed):

| From | To | When |
|---|---|---|
| Planned | Starting soon | The classroom opens for students |
| Planned, Starting soon | Live | The tutor or an admin starts it (tutors and admins can start early) |
| Planned, Starting soon, Not held | Planned | Rescheduled to a future time (LP-03) |
| Planned, Starting soon | Cancelled | Cancelled (LP-04) |
| Starting soon | Not held | The scheduled end passes without a start |
| Not held | Live | **Start anyway**, until midnight of that day in the lesson's timezone |
| Not held | Cancelled | **Mark as cancelled** (nobody is told unless the tutor chooses to) |
| Live | Awaiting summary | **End lesson**, or the automatic end after everyone leaves |
| Awaiting summary | Live | **Restart this lesson**, within 60 minutes of an automatic end and before a summary is started (00 section 14e, 07 CR-06) |
| Awaiting summary | Complete | Summary completed, or **No summary needed** (08) |
| Awaiting summary | Missed | **Mark as missed**, offered only when no student joined (08 SM-06) |
| Cancelled | Planned | **Undo** while the undo toast is showing (LP-04); afterwards use **Schedule a replacement** |

Complete and Missed are final. A student who didn't come to a group lesson
that others attended is recorded in attendance (**Missed** for that student,
`17-recordings-and-attendance.md`); the lesson itself goes to Awaiting summary
as normal.

**Dropped from Bobbin, on purpose:** Bobbin's "Pending", the approval status
and "Canceled (chargeable)". Kanvise has no approvals (out of scope) and no
charging (billing is on hold, spec 13), so these would never be used.

---

## LL-01 · Lessons list

Checked against `15-tutor-role/screenshots/tutor-lessons--default.png` and
`tutor-lessons-filter.png`.

**Header:** **Lessons** · "Every lesson across all your courses." · primary
**New lesson**.

**Status tabs (underline):** **All** · **Upcoming** (Planned, Starting soon and
Live) · **Awaiting summary** · **Not held** · **Missed** · **Complete** ·
**Cancelled**. Each shows a count when above 0. On phones the tabs scroll
sideways.

**Toolbar:** **Filter** on the right, a two-level menu as in Bobbin (pick
**Student**, **Course**, **Tutor** for admins, or **Date range**, then values
with a search box and a back arrow). Bobbin's Client facet is not copied.
Active filters show as removable chips under the toolbar. Search **Search
lessons…** on the left.

**Table** (sortable by Lesson, Date, Students, Status, as in Bobbin):
| Column | Content |
|---|---|
| Lesson | Course swatch (01 SH-15), topic, course name under it |
| Date | **27 Nov 2026** and **2:00 AM · 1 hour** |
| Tutor | Avatar and name (admins; tutors see it only on group-taught courses) |
| Students | Avatars and the name, or **2 students** |
| Status | Chip |

Clicking a row opens the lesson. Sorted by date: nearest first on Upcoming,
newest first on the others. Pagination as in 16 R-04.

**Empty (no lessons at all):** lesson icon, **No lessons yet**, "Lessons belong
to a course. Schedule one and your students get their links." and **New
lesson** (or **Create a course** first if there are no courses; agency tutors
see **Your admin hasn't added you to a course yet.**).
**Empty tabs:** Awaiting summary: **No summaries to write.** · Not held:
**Every lesson went ahead.** · others: **No lessons here.**
**Filter with no results:** **No lessons match these filters.** with **Clear
filters**.
**Loading:** five skeleton rows. **Error:** the shared page error (01 SH-09).

---

## New lesson wizard

Checked against `03-lessons/screenshots/new-lesson--step-1.png`,
`new-lesson--step-2-schedule.png`, `new-lesson--step-2-filled.png` and
`new-lesson--step-3-review.png`.

A dialog (SH-10), 448px wide as in Bobbin, three steps with the three-part
segmented bar (current part orange), a round **←** back button bottom left from
step 2, and the primary button bottom right.

### LW-1 · Course and students

Title **Course and students** · subtitle **Pick a course and who's attending.**
(Bobbin: "Course & attendees".)

- **Course:** a dropdown with course swatches. If opened from a course page,
  it's preselected and locked with a small **Change** link. Agency tutors see
  only their courses.
- **Students:** the course's students as checkbox rows, all ticked by default,
  with **1 of 1 selected** and **Clear**, as in Bobbin. Students can be unticked
  for this lesson only (for example someone is away).
- **Tutor** (admins only): one choice from the course's tutors, the first
  preselected. An admin appears here only when they have **I teach too** on (12
  settings and `19-tutors-and-team.md`) and are on the course; otherwise they
  lead a lesson through **Join as an admin?** (07 CR-09).
- No courses yet: the step shows **You need a course first.** with **Create a
  course** (or, for agency tutors, **Ask your admin to add you to a course.**).

**Continue** validates: a course, at least one student, and a tutor for admins.
Errors: **Choose a course.** · **Choose at least one student.** · **Choose a
tutor.**

### LW-2 · Topic and time

Title **Topic and time** · subtitle **What's this lesson about, and when is it?**

**Topic:**
- A field **Lesson topic**, required. Placeholder **e.g. Quadratic equations**
  (Bobbin's).
- Under it, if the course plan is Active: **From the course plan:** up to three
  chips from the student's **Next** topics (04 Topic status model), plus
  **Browse the plan**. Tapping a chip fills the topic and links the lesson to
  that plan topic (shown as a small link icon in the field, with **Unlink**).
  Linking does not change any status.
- For groups where students have different Next topics: a line **Casey's next
  topic is Factorising; Alex's is Indices.**
- No plan: no chips, and the line **Add a course plan to pick topics from it.**

**Time:**
- **Starts** and **Ends** (date-time pickers). Defaults: the next whole hour
  after now (or the slot clicked on the calendar), and the default lesson
  length from 12 CFG-L (set from onboarding). Changing **Starts** moves **Ends**
  with it.
- **Timezone** line under the pickers: **Times in Lagos time (WAT).** with
  **Change** (a searchable zone list). The zone chosen here is the lesson's
  zone (see Timezones and series).
- **Repeat** (a Kanvise addition; Bobbin has none): **Doesn't repeat** ·
  **Every week** · **Every 2 weeks** · **Custom…**. Weekly shows day chips (Mon
  to Sun, the start day preselected) and **Ends** **after 10 lessons** / **on a
  date** (at most 52 lessons in one series).
- **Clash warning** (not blocking), shown inline: **You already have Algebra 1
  Small Group from 10:00 to 11:00 AM.** with **See calendar**. Clashes are
  checked for the tutor and for each student.

**Continue** validates: topic required (**Add a lesson topic.**, Bobbin's
wording), end after start (**The lesson must end after it starts.**), not in
the past (**Choose a time in the future.**).

### LW-3 · Review and schedule

Title **Review and schedule** · subtitle **Check the details before
scheduling.** (Bobbin's.)

A bordered table with **Edit** links, Bobbin's rows plus Kanvise's: Topic (with
**From the course plan** if linked), Course, Tutor, Students, Starts, Ends,
Repeats (**Every Monday, 10 lessons, until 2 Feb**).

**Time zone rows**, when any student's timezone differs from the lesson's:
**Casey: 3:00 PM London time.** And when a student's offset changes inside a
series (daylight saving), an amber notice: **London clocks change on 29 Mar.
From then on this lesson is at 4:00 PM for Casey (it stays 4:00 PM in Lagos).**

A line above the button, worded for who will get what (12 CFG-L reminder
setting):
- all students have an email: **Students get the lesson time and their join
  link by email, and a reminder before it starts.**
- some don't: **Casey gets an email with the time and join link. Alex has no
  email, so copy or WhatsApp Alex's link from the lesson page.**

Button **Schedule lesson** (or **Schedule 10 lessons**).

**On success:** the dialog closes, the lesson page opens (or the calendar
stays, if started there), and a toast says **Lesson scheduled** / **10 lessons
scheduled**. Setup's **Schedule your first lesson** step ticks if not already.
**On failure:** stays on LW-3 with an inline error: **We couldn't schedule the
lesson. Nothing was saved. Try again.**

### Timezones and series

- Every lesson stores its timezone: the zone chosen in LW-2, which defaults to
  the tutor's profile timezone.
- A series repeats in that zone. Each lesson keeps the same local wall time
  there (Mondays 4:00 PM Lagos time), so it doesn't drift for the tutor when
  another country's clocks change. LW-3 warns about such changes for students,
  as above.
- Wherever a time is shown and the viewer's zone differs from the lesson's,
  both are shown: **4:00 PM Lagos · 3:00 PM your time** (students: 09 SA-05).
- Emails use the account's timezone (00 section 19) and add the student's own
  time when it differs: **Monday 4:00 PM (Lagos time), 3:00 PM your time.**
- Editing one lesson of a series makes it an exception; **This and following
  lessons** edits split the series at that lesson.

---

## LP-01 · Lesson page (planned)

Checked against `03-lessons/screenshots/lesson-created--detail.png` and
`lesson-created--join-available.png`.

**Header:** lesson topic, status chip **Planned** (or **Starting soon**). Right:
primary **Join classroom** (video camera icon) and **⋯** (Reschedule, Cancel
lesson, Duplicate).

- **Join classroom** for tutors and admins is always enabled, as in Bobbin.
  Before the classroom opens for students it still goes in; the pre-entry
  screen (07 CR-01) offers **Enter without starting a lesson** and says when students
  can join.
- Students are gated by the **Classroom opens** setting (12 CFG-L). Their
  pages show **Opens at 3:45 PM** until then (09, 07 CR-02). No spec hard-codes
  the number of minutes.
- **Duplicate** opens the New lesson wizard prefilled with the same course,
  students, tutor, topic and length, one week later at the same time. It never
  copies a series.

**Facts strip:** **Date** · **Time** (with both zones when they differ) ·
**Course** (with the course swatch, links to the course) · **Repeats** (if
part of a series).

**Main column:**
- **Before this lesson** card: **Homework** due in the two weeks before, with
  status per student (**Handed in**, **Not handed in**) and **All homework**.
  Empty: **Nothing was due in the two weeks before this lesson.** (Bobbin's.)
- **Tabs:** **Lesson plan** · **Notes**.
  - **Lesson plan:** **Learning objectives for this lesson** (from the linked
    plan topic, editable, each with a tick-box used later in the lesson
    summary). No plan on the course: **This course has no plan yet. Add one on
    the course page, then come back to choose the objectives for this lesson.**
    with **Add a course plan ›** (Bobbin's). Below it, an empty state with the
    Kavi mark: **Plan this lesson with Kavi.** "Kavi drafts a lesson plan from
    the topic, the course plan and the last lesson summary. You can edit
    everything." Button **Draft lesson plan** (Kavi mark), or **Write my own**
    (text link). Once drafted or written, a rich-text plan with 👍 / 👎 (Kavi
    drafts only) and **⋯** (Regenerate, Clear). Failure states are in the Kavi
    block below.
  - **Notes:** private notes (private notes rule, 00 section 16). Line: **Only
    you, your admins and the course's tutors can see these. Students never
    do.** Empty: **No notes yet. Add the first one above.** (Bobbin's.)

**Right column:**
- **Activity:** a timeline grouped by date, newest last: **Lesson created**,
  later **Lesson started**, **Casey joined**, **Casey left**, **Lesson ended**,
  **Rescheduled from Mon 1 Dec**. Long histories collapse with **Show 12 more**.
- **Tutor** (admins can **Change**).
- **Students:** each with avatar, name and their join link (LP-05), plus
  **Let Casey know** (**Running late**, **Starting now**, **Can't make it**)
  and any message the student sent (**Casey: running late · 3:58 PM**), from
  07 CR-12.

### Kavi

- Input: the lesson topic, the linked plan topic and its objectives, the course
  plan around it, the last completed lesson summary's What we covered and What
  to work on, and the default lesson length. Never private notes (00 section
  16).
- Output: a lesson plan (objectives, a timed structure, activities, a short
  check for understanding) in the Lesson plan tab, as in Bobbin's
  `sample-lesson--plan.png`.
- Failure state: preparing: **Kavi is drafting your lesson plan…** (busy
  region, announced once when ready, 01 SH-12). Not enough to go on (a topic of
  one or two words, no plan topic linked and no earlier lesson): **Kavi needs a
  bit more to go on. Link a topic from the course plan or add a sentence about
  what you'll cover.** with **Link a topic** and **Write my own**. Couldn't
  generate: **Kavi couldn't draft a plan right now. Nothing was changed.** with
  **Try again** and **Write my own**. A failed **Regenerate** keeps the current
  plan and says **Couldn't regenerate. Your plan is unchanged.**
- What the tutor must confirm: the draft is visible only to tutors and admins.
  It becomes the lesson plan when the tutor presses **Keep this plan** (or edits
  it). Students never see lesson plans.
- Without Kavi: **Write my own** opens the same editor with a template
  (Objectives, Structure, Activities, Check for understanding); the Draft
  button is hidden.

## LP-02 · Lesson page in other statuses

- **Starting soon:** the chip is amber. Students' join links work from now.
- **Live:** the chip pulses green, the button reads **Rejoin classroom**, and
  the activity timeline updates as people join and leave.
- **Not held:** a grey banner: **This lesson didn't take place. It was due at
  4:00 PM and wasn't started.** with **Reschedule**, **Start anyway** (same day
  only) and **Mark as cancelled**. Choosing **Mark as cancelled** offers **Let
  students know** (unticked).
- **Awaiting summary:** a banner at the top of the main column: **This lesson
  has ended. Write the summary so Casey knows what to work on.** Button **Write
  summary** (spec 08) and a quiet **No summary needed** (08 SM-07). For 60
  minutes after an automatic end the banner also offers **Restart this
  lesson** (07 CR-06). The tabs are **Summary** · **Session** · **Lesson plan**
  · **Notes**, as in Bobbin. When no student joined, the banner is the one in 08
  SM-06.
- **Session tab** (Awaiting summary, Missed and Complete): attendance per
  person (status, joined, left, time in lesson), then the recording and its
  transcript when the lesson was recorded, or **Not recorded**.
- **Missed:** a grey banner **Nobody joined this lesson.** with **Schedule a
  replacement**.
- **Complete:** the same tabs with Summary open. The right column adds **Set
  after this lesson: Homework**. The header adds **Share ▾** (**Copy summary**,
  **Export as PDF**). Nothing is emailed from here.
- **Cancelled:** a grey banner: **This lesson was cancelled on 25 Nov.** with
  **Schedule a replacement**.

## LP-03 · Reschedule

From the lesson's **⋯**, the calendar popover, or drag on the calendar (CAL-07).

A small dialog: **Reschedule lesson**.
- **Starts**, **Ends**, with the old time shown under them in grey: **Was Mon 1
  Dec, 10:00 to 11:00 AM**.
- For a lesson in a series: **This lesson only** / **This and following
  lessons**.
- Clash warning as in LW-2.
- A line worded for who will be told: **Casey will get an email with the new
  time.** For a student without an email: **Alex has no email. You can send the
  new time on WhatsApp after saving.**
- Button **Reschedule**.

**After saving:** toast **Lesson moved to Tue 2 Dec, 10:00 AM.** with **Undo**.
Emails to students are held until the undo window closes (01 SH-08), so an
undone move tells nobody. For each no-email student the lesson page then shows
**Send on WhatsApp** (a prefilled message: **Hi Alex, your lesson has moved to
Tue 2 Dec, 10:00 AM Lagos time. Same link: {link}**) when they have a phone
number, or **Copy message** when they don't.

## LP-04 · Cancel

A small dialog: **Cancel this lesson?**
- A line worded per student: **Casey will get an email saying it's
  cancelled.** · **Alex has no email. You can send them a message on WhatsApp
  after cancelling.** · in groups with both: **If they have an email, we'll let
  them know.**
- For a series: **This lesson only** / **This and following lessons**.
- Optional **Message to students** field (added to the email and the WhatsApp
  message).
- Buttons **Keep lesson** and **Cancel lesson** (red).

**After cancelling:** the lesson shows Cancelled at once and a toast says
**Lesson cancelled.** with **Undo**. The toast stays until it is dismissed, the
person leaves the page, or 5 minutes pass (01 SH-08). Emails are sent only when
the undo window closes; **Undo** within it restores the lesson to Planned and
nobody is told. After the window, **Send on WhatsApp** / **Copy message**
appear for no-email students, as in LP-03 (prefilled: **Hi Alex, today's
lesson at 4:00 PM is cancelled. {message}**).

## LP-05 · Join links

Checked against `03-lessons/screenshots/lesson-created--detail.png` (join link
field with Copy, Email beside the name, "Anyone with this link enters the
classroom as Atlas.").

**On the lesson page,** each student row shows:
- **Join link**: the link in a read-only field with **Copy** (as in Bobbin),
  plus **WhatsApp** (when the student has a phone number; opens WhatsApp with
  **Hi Casey, here's your link for Monday's lesson at 4:00 PM: {link}**) and
  **Email** (when they have an email). WhatsApp is a Kanvise addition.
- Line under the field, Bobbin's honesty in Kanvise words: **Anyone with this
  link joins as Casey, so send it only to Casey.**
- In the row's **⋯**: **Get a new link** (the old one stops working at once) and
  **Remove from this lesson**.

**Rules:**
- One personal link per student per lesson. Students with an account can also
  join from their app without the link.
- One active connection per link. When the link is opened on a second device
  while the first is still in the lesson, the second device asks first, before
  any classroom token is issued: **You're already in this lesson on another
  device.** with **Join here instead** (the other device leaves the lesson and
  sees **You joined from another device.**) and **Cancel**. This avoids the
  classroom silently dropping the first device.
- The tutor gets a notice in Lesson tools (07) when a link is opened on a
  second device: **Casey's link was just opened on another device.** with
  **Get a new link**.
- A link stops working 2 hours after the lesson's scheduled end, when the
  lesson is cancelled, or when a new link is made. Then it shows **This link has
  expired. Ask Mrs Bello for a new one.**
- Links are tokens stored only as a hash and are rate-limited like the check
  link (04 Starting check).

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|
| Schedule, reschedule, cancel | Yes | Yes, any lesson | Lessons on their courses |
| Start and teach as the tutor | Yes | Only lessons where they are the tutor (needs **I teach too**) | Their own lessons |
| Join a lesson they don't teach | n/a | Yes, as an admin (07 CR-09) | No |
| Copy, send or renew join links | Yes | Yes | Their own lessons |

## Data needed (for the build)

- Lesson: course, students attending, tutor, topic, linked plan topic,
  start/end, timezone, series rule and exceptions, status, status history.
- Activity events (created, started, joined, left, ended, rescheduled,
  cancelled, restarted).
- Join link per student per lesson: hashed token, expiry, revoked, active
  connection, opens.
- Held notifications (released when an undo window closes).
- Reminder emails at scheduling and before the lesson (12 CFG-L; the full list
  is in `18-notifications.md`).

---

## Calendar

Checked against every `02-calendar/screenshots/` image (page--default,
calendar-week, calendar-day, calendar-month, and the five filter shots) and
`15-tutor-role/screenshots/tutor-calendar-week.png`.

### CAL-01 · Calendar page

Route `/calendar`.
- **Header:** **Calendar** · "View and plan lessons." (Bobbin's) · primary
  **New lesson**.
- **Toolbar:** **‹** **Today** **›** on the left, then the range as a title:
  **23 Nov to 29 Nov 2026** (week), **27 November 2026** (day), **November
  2026** (month). **Today** is shown greyed when today is already in view, as in
  Bobbin, and still works.
- On the right: **Filter** (CAL-06), then a segmented switch **Day** · **Week**
  · **Month**, each with its icon. The first visit opens **Month** on desktop,
  as Bobbin does (`page--default.png`, `tutor-calendar--default.png`), and
  **Week** on tablets (16 R-07). After that the calendar opens in the view the
  person used last.
- Under the toolbar, small and grey: **Times in Lagos time (WAT).** with
  **Change** (the viewer's profile timezone; changing it here only changes the
  view).
- Today's date is marked in orange (the "location" token, 01 SH-15), where
  Bobbin uses a yellow circle.
- The view, date and filters are kept in the URL, so Back and shared links keep
  them.

### CAL-02 · Week view

- Seven columns (Mon to Sun) with **MON 23** headers; today's number in an
  orange circle.
- A time grid with hour labels (**7 AM**) and half-hour lines. It covers the
  whole day and opens scrolled to 7 AM, or to the earliest lesson that week if
  that is earlier. (In Bobbin's tutor week view a 2:00 AM lesson sits above the
  visible grid with no hint; Kanvise scrolls to it, and shows **1 earlier
  lesson ↑** at the top edge when lessons are out of view.)
- A red "now" line across today's column.
- Lessons are blocks: the course colour as a left bar and a light tint of it,
  the status dot and word (Planned, Starting soon, Live), topic, and students'
  names; short lessons show the topic only. Cancelled lessons show only when the
  Status filter includes them, struck through.
- Overlapping lessons sit side by side in the slot.

### CAL-03 · Day view

- One column with the full day header (**FRIDAY 27 November** with an orange
  **Today** marker, as Bobbin shows it in yellow), the same grid and blocks as
  Week, with room for the course name and tutor (admins).

### CAL-04 · Month view

- A month grid (Mon to Sun) including the days before and after the month in
  grey, as in Bobbin.
- Each day lists lessons as one line: status dot, time and topic, truncated
  (**• 2:00 AM Algebra: Facto…**). The dot is the status colour; the course
  swatch sits before the time.
- More than three lessons: **+2 more**, which opens that day in Day view.
- Clicking a day number opens Day view; clicking a lesson line opens CAL-05.

### CAL-05 · Lesson popover and new lessons

- Clicking a block or line opens a small popover: course swatch and course,
  topic, time (both zones when they differ), students, status chip, and buttons
  **Open lesson**, **Join classroom** (tutors and admins; students' rule in
  LP-01), and **⋯** (Reschedule, Cancel lesson).
- Clicking an empty slot (Week or Day) or an empty part of a day (Month) opens
  the New lesson wizard with that date and time filled in. Pressing and holding
  isn't needed for this; one tap opens it.
- Agency tutors can only create lessons on their own courses; if they have none,
  clicking a slot shows **Ask your admin to add you to a course.**

### CAL-06 · Filters

Copied from Bobbin's two-level menu: **Filter** opens a list of facets
(**Course**, **Student**, **Tutor** for admins, **Status**), each with **›**.
Choosing one shows its values with a search box (**Search by course…**) and a
back arrow, as in `calendar-filter-course.png`. While values load the list
shows **Searching…** (Bobbin's `calendar-filter-tutor.png`); no match shows
**No courses match.**
- **Status** values: Planned, Starting soon, Live, Not held, Awaiting summary,
  Missed, Complete, Cancelled. By default every status except Cancelled is
  shown.
- Bobbin's **Client** facet is not copied (no clients).
- Active filters show as chips under the toolbar (**Course: Algebra 1 ✕**)
  with **Clear all**, and the Filter button shows a count (**Filter · 2**).

### CAL-07 · Moving a lesson

- **Drag (desktop):** dragging a block to another slot shows a ghost with the
  new time. Dropping opens the Reschedule dialog (LP-03) with the new time
  filled in, so the tutor confirms who is told. Dropping onto a clash shows the
  clash warning there. Escape cancels the drag.
- **Menu (everyone):** **Reschedule** in the popover's **⋯** and on the lesson
  page does the same without dragging (01 SH-12).
- **Keyboard:** arrow keys move between lessons in the grid; Enter opens the
  popover; with a lesson focused, **M** starts a move, arrow keys move it by 15
  minutes (up and down) or a day (left and right), Enter opens the Reschedule
  dialog, Escape cancels. The new time is announced ("Monday 11:00 AM").
- **Touch:** no drag on touch screens (it fights scrolling). Tapping a lesson
  opens the popover; **Reschedule** is there.
- Only Planned, Starting soon and Not held lessons can be moved. Others have no
  drag handle and no Reschedule item.
- **Drag failure:** if saving fails, the block slides back to its old time and
  an inline error shows in the dialog: **We couldn't move the lesson. It's still
  on Mon 1 Dec, 10:00 AM. Try again.**

### CAL-08 · Loading, empty, error, no results

- **Loading:** the grid draws at once with **Loading lessons…** and a spinner
  centred in it, as in Bobbin. After 300 ms the spinner is replaced by grey
  skeleton blocks in the week's busy hours (01 SH-09). Changing week keeps the
  old lessons faded until the new ones arrive.
- **Empty week (or day, or month):** the grid stays, with a quiet line in the
  middle: **No lessons this week.** and **New lesson**. Bobbin shows an empty
  grid with no message.
- **Filter with no results:** **No lessons match these filters.** with **Clear
  filters**.
- **Error:** the grid stays empty with **We couldn't load your lessons.** and
  **Try again**. Lessons already shown stay, with a banner above the grid when a
  refresh fails: **Showing lessons from 2 minutes ago.**
- **Offline:** as in 01 SH-13; the calendar shows what it last loaded and
  disables drag and New lesson.

### CAL-09 · Phones and tablets

As in 16 R-07:
- **Phones:** **Agenda** view by default, with **Day** as the alternative; Week
  and Month are hidden. Agenda is a Kanvise addition (Bobbin has only Day, Week
  and Month): a list grouped by day (**Today**, **Tomorrow**, **Mon 1 Dec**),
  each row with time, status dot and word, course swatch, topic and students,
  showing two weeks and loading more with **Show later lessons**. Empty days are
  skipped; an empty fortnight shows **No lessons in the next two weeks.** with
  **New lesson**.
- The toolbar on phones: **‹ Today ›**, the range, and a **Filter** icon
  button; the view switch is **Agenda** · **Day**.
- **Tablets:** Week view, as on desktop.
- New lesson on phones is the round **+** button, the page's one fixed element
  (16 R-10).

## Checked against Bobbin

- `02-calendar/screenshots/page--default.png`, `15-tutor-role/screenshots/tutor-calendar--default.png`:
  Bobbin opens on Month for admins and tutors; Kanvise's first visit matches
  on desktop (CAL-01).
- `02-calendar/screenshots/calendar-week.png`: header
  "Calendar / View and plan lessons", ‹ Today › with Today greyed, range title,
  Filter, Day / Week / Month with icons, 7 AM start, **Loading lessons…**
  centred in the grid (CAL-01, CAL-02, CAL-08).
- `02-calendar/screenshots/calendar-day.png`: day header with a Today marker
  (CAL-03).
- `02-calendar/screenshots/calendar-month.png`: month grid with outside days,
  one-line lesson with dot, time and truncated topic (CAL-04).
- `02-calendar/screenshots/calendar-filter-course.png`, `calendar-filter-status.png`,
  `calendar-filter-student.png`, `calendar-filter-tutor.png`, `calendar-filter-client.png`:
  two-level filter with search and back arrow; Bobbin's status list (Planned,
  Complete, Pending, Canceled, Canceled (chargeable), and its approval and
  write-up statuses) and Client facet, neither copied (CAL-06, Lesson statuses).
- `15-tutor-role/screenshots/tutor-calendar-week.png`: empty-looking week while
  a 2:00 AM lesson sits above the visible grid (CAL-02 scroll rule, CAL-08 empty
  message).
- `15-tutor-role/screenshots/tutor-lessons--default.png`, `tutor-lessons-filter.png`:
  lessons table columns, sortable headers, Planned chip, status tabs and the
  Student / Course / Client / Status filter (LL-01).
- `03-lessons/screenshots/new-lesson--step-1.png`, `new-lesson--step-2-schedule.png`,
  `new-lesson--step-2-filled.png`, `new-lesson--step-3-review.png`: three steps,
  titles, "e.g. Quadratic equations", one-hour default, Bobbin's review rows
  and **Schedule lesson** (LW-1 to LW-3). Repeat, plan chips, timezone and
  clash lines are Kanvise additions.
- `03-lessons/screenshots/lesson-created--detail.png`, `lesson-created--join-available.png`:
  header with Planned chip and an always-enabled **Join classroom**, facts
  strip, Before this lesson, no-plan objectives message, Plan this lesson card,
  Activity, Tutor and Student cards, join link with Copy and the "Anyone with
  this link" line (LP-01, LP-05).
- `03-lessons/screenshots/sample-lesson--plan.png`, `sample-lesson--notes.png`:
  lesson plan shape for the Kavi block; Bobbin's "Internal notes / Only visible
  to admins" replaced by the 00 section 16 line; "No notes yet. Add the first
  one above." copied.
