# 10 · Homework

Status: draft for owner review. Builds on `00-decisions.md` (§8, §14a, §14c,
§16, §17), `04` (Topic status model, CRS-08), `05`, `07`, `08`, `09`, `15`.

**Who:** tutors and agency admins set and mark it; students hand it in.
**Goal:** set homework in under a minute, see who's handed in, and mark it with
useful feedback. (This replaces today's Assignments.)

## Flow at a glance

```
Set homework (HW-01) from: course › Homework tab · lesson summary (08 SM-03)
                           · Lesson tools (07 CR-03) · /homework
  → Student hands in (HW-04, student app)
  → Tutor marks (HW-05) → student sees the mark and feedback
                        → 04 CRS-08 Review changes (topic outcomes)
/homework list (HW-02) · homework page (HW-03)
```

---

## HW-01 · Set homework

Checked against `15-tutor-role/screenshots/tutor-course-set-homework.png`.

A dialog, 560px (a side sheet over the room when opened from Lesson tools, 07
CR-03). It follows Bobbin's set-homework dialog: the same title, subtitle line,
four main fields in the same order, and **Cancel** · **Set homework** bottom
right. Kanvise adds a students line and a collapsed **More options** row,
because Kanvise can set work for one student and choose how work is handed in.

**Title** **Set homework**.
**Subtitle** (who it is for, and who sees the work):
- Agency: **For everyone on Algebra 1 Small Group. Only the course's tutors and
  your admins see what they hand in.**
- Independent tutor: **For everyone on Algebra 1 Small Group. Only you see what
  they hand in.**
- For one student: **For Casey on Algebra 1 Small Group.** followed by the same
  second sentence.

Who sees hand-ins, decided: the tutors on the course and the agency's admins
(admins see homework for every course in their agency, 00 section 14c). This
is the same group that can read private notes (00 section 16), so tutors never
have to remember two different rules. Students never see each other's work.

| Field | Rules | Notes |
|---|---|---|
| Course | Required. Fixed when opened from a course, lesson or summary; otherwise a picker at the top | |
| Students | A line under the subtitle: **3 students · Change**. **Change** opens checkbox rows of the course's students, all ticked | For giving one student extra work. A student without an email is unticked, can't be ticked, and shows **No email** beside the name with the line **Alex can't get homework in Kanvise without an email.** (00 section 14a, 06 No email) |
| Title | Required, 2 to 120 characters | Placeholder **e.g. Simultaneous equations worksheet** |
| Due | Required. Defaults to the day before the next lesson at 6:00 PM, or 7 days from now at 6:00 PM if none is booked | A date-time picker. Line under it: **Shown in each student's timezone.** |
| Instructions (optional) | Bold, italic, lists, undo, redo (Bobbin's toolbar) | Placeholder **What to do, and what to hand in** |
| Files for students (optional) | Up to 10 files, each within the upload limits table in `15-resources.md` | Line: **Worksheets, examples, anything students download from the homework.** Buttons **Upload files** · **Choose from resources** |
| More options (collapsed) | Shows its current values: **Hand in: files or typed answer · Marked out of 10** | Opens the two fields below |
| How they hand it in | **Files or a typed answer** (default) · **Files only** · **Typed answer only** | |
| Marking | **Mark out of** a number (default 10) · **Feedback only, no mark** | |
| Linked lesson | Read-only when set from a lesson or summary: **Set after: Solving Systems of Linear Equations, 27 Nov** | |

**From a Kavi suggestion:** when the tutor presses **Use this** on a homework
suggestion (08 SM-01 or the dashboard, 03 DB-06), the dialog opens with the
title and instructions filled in from it and a small **From Kavi's
suggestion** label at the top, which disappears once the tutor edits a field.
Nothing is set until the tutor presses **Set homework**.

**Buttons:** **Cancel** · **Set homework**.
A line above them: **Students get a notification in their app.**

**Validation:** **Add a title.** · **Choose a due date.** · **The due date has
already passed.** · file errors from the upload limits table (for example
**That file is too big. The limit is 20 MB.**) · **Choose at least one
student.**

**On success:** toast **Homework set for 3 students.** The homework appears on
the course's Homework tab and in each student's To do (09 SA-03).

## HW-02 · Homework list `/homework` and the course's Homework tab

**Header:** **Homework** · "Everything you've set, and what's waiting to be
marked." · primary **Set homework**.

**Tabs (underline):** **To mark** (default when anything is waiting) · **All**
· **Past due**.

**Table:** Title (course swatch and name under it) · Due · Handed in (**2 of
3**) · To mark (**1**) · Status.

Agency admins see homework for every course in the agency, with a **Tutor**
filter; agency tutors see their courses.

**Empty** (as Bobbin's course Homework tab): clipboard icon, **No homework set
yet.** "Set homework and your students hand in their work here, instead of by
email or WhatsApp." **Set homework**.

## HW-03 · Homework page `/homework/:id`

**Header:** title, status chip (**Open** / **Past due** / **Closed**). Right:
**⋯** (Edit, Extend due date, Close, Delete) and primary **Mark next** (opens
the first unmarked hand-in).

**Facts strip:** Course · Due · Set after (lesson, if linked) · Marking.

**Main:** instructions and files as students see them.

**Right column, Students:** each student with:
- **Not handed in** (grey), **Handed in · on time** (blue), **Handed in · 1 day
  late** (amber), **Marked · 8/10** (neutral with a tick, 01 SH-15),
  **Redo asked** (amber);
- **Remind** for students who haven't handed in (in-app and push: **Michael is
  waiting for your Simultaneous equations worksheet.**), once a day at most;
- tapping a student opens their hand-in (HW-05).

**Changes to review:** when marking has made topic proposals that are not yet
accepted, a card shows **3 changes to review** with **Review changes** (04
CRS-08).

**Edit** changes title, instructions, files or due date. Changing the due date
notifies students: **The due date for Simultaneous equations worksheet moved to
Sat.** **Delete** asks: **Delete this homework? Students' hand-ins will be
deleted too.** with **Cancel** · **Delete** (red).

## HW-04 · Handing in (student)

From Home › To do, or Homework in the student app (09 SA-06).
- Title, tutor, due date with a countdown (**Due in 2 days**).
- Instructions and files (**Open**, **Download**).
- **Your answer:** depending on the setting, an upload area (**Take a photo**
  first on phones, then **Choose files**), a text box, or both. Photos of
  handwritten work are the common case. Photos are resized on the phone before
  upload, and every file follows the hand-in row of the upload limits table
  (`15-resources.md`).
- **Hand in** (primary). Confirmation: **Hand in your work? You can still change
  it until Michael marks it.** **Cancel** · **Hand in**.
- After handing in: **Handed in · Tue 6:42 PM** with **Change my work**
  (replaces the files or text; the tutor sees the latest version and when it
  changed).
- Late: handing in after the due date is allowed and labelled **Late** for the
  tutor. The student sees **This is past the due date. You can still hand it
  in.**
- Upload failures keep what was chosen and say **That didn't upload. Check your
  connection and try again.** Uploads show progress and retry on a weak signal.

## HW-05 · Marking

A full page: the hand-in on the left, marking on the right. On phones,
stacked.

- **Hand-in:** files (images open in a viewer with zoom and rotate; PDFs
  inline; others download) and the typed answer. **Handed in Tue 6:42 PM · 1
  day late** at the top.
- **Mark:** **_ / 10** (an empty number field; it is never filled in for the
  tutor), or hidden for feedback-only homework.
- **Feedback:** a text box. Placeholder **What they did well, and what to fix.**
- **Draft feedback with Kavi** (text button, shown only once Kavi exists and
  only when the tutor presses it): Kavi's draft appears in a separate box
  under the feedback field, with a **Kavi's pick** badge, **Use this** (copies
  it into the feedback box, where the tutor can edit it) and **Discard**. The
  draft never goes into the feedback box on its own and never suggests a mark.
- **Topics this checked** (optional): the course plan topics linked to this
  homework (from the linked lesson, or chosen here with **+ Add a topic**).
  Each topic has two choices, neither selected to start with: **Got it** ·
  **Needs more work**. They map to the Topic status model (04): **Got it**
  proposes **Knows it**, **Needs more work** proposes **Needs work**. Leaving
  both unselected proposes nothing.
- **Save and next** (moves to the next unmarked student) · **Save**.
- On save, the student sees the mark and feedback, and gets a notification:
  **Your homework was marked: 8/10.**
- **Course plan changes:** each topic choice becomes a proposal. After the last
  **Save and next** (or after **Save** when it is the only one), the **Review
  changes to the course plan** sheet (04 CRS-08) opens with one unticked row
  per student per topic (**Elimination: Taught → Knows it · From Simultaneous
  equations worksheet**). **Not now** leaves **3 changes to review** on HW-03.
- **Ask to redo** (in **⋯**): sends it back with the feedback; status becomes
  **Redo asked**, and the student can hand in again.

### Kavi

- Input: for homework suggestions, the lesson summary draft and the lesson's
  topics (see 08's Kavi block). For feedback drafts, only when the tutor
  presses **Draft feedback with Kavi**: the homework title and instructions,
  the student's typed answer and the images they handed in, and the linked
  topics, and only while **Kavi can read handed-in work** is on (12 CFG-K).
  Never private notes (00 section 16), never other students' work. Images of
  work leave Kanvise for this (named in 12 CFG-K, Where your data goes; what
  Google keeps is in 20 DM-26).
- Output: a homework suggestion (title and instructions) that **Use this**
  copies into HW-01; a feedback draft in its own box in HW-05 with a **Kavi's
  pick** badge.
- Failure state: preparing: **Kavi is reading Casey's work…** with **Stop**.
  Not enough to go on (a blurred photo, an empty answer): **Kavi couldn't read
  this work clearly. Write the feedback yourself.** Couldn't generate:
  **Kavi couldn't draft feedback right now. Nothing you wrote was changed.**
  with **Try again**.
- What the tutor must confirm: **Set homework** in HW-01 for a suggestion;
  **Use this**, then **Save**, for feedback. Kavi never enters a mark, never
  chooses Got it or Needs more work, and never accepts a course plan change.
- Without Kavi: HW-01 is filled in by hand (no suggestion label), and HW-05
  has no **Draft feedback with Kavi** button. Marking, feedback and CRS-08
  work the same.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor | Student |
|---|---|---|---|---|
| Set, edit, delete, mark | Yes | Any course in the agency (00 section 14c) | Their courses | No |
| See hand-ins | Yes | Any course in the agency | Their courses | Their own |
| Accept course plan changes (CRS-08) | Yes | Yes | Their courses | No |
| Hand in | No | No | No | Yes, with an account |

## Data needed (for the build)

Tables are in `20-data-model.md`: homework and hand-ins DM-12, topic status proposals DM-05.

- Homework: course, students, title, due, instructions, files, hand-in mode,
  marking mode, linked lesson, linked topics, from-suggestion flag. (Today's
  assignments, assignment guard functions and submissions cover most of this.)
- Hand-ins with versions, late flag, mark, feedback, Kavi draft (kept apart
  from the feedback, with used or discarded), topic choices.
- Status proposals for CRS-08 (04 Data needed).
- Upload counting against the limits in `15-resources.md`.
- Notifications and push for set, due-date change, remind, marked, redo
  (`18-notifications.md`).

## Checked against Bobbin

- `15-tutor-role/screenshots/tutor-course-set-homework.png`: HW-01 title,
  subtitle ("For everyone on Atlas Research Course. Only you and admins see
  what they hand in."), Title placeholder, Due field with calendar icon,
  Instructions (optional) with bold, italic, lists, undo and redo, Files for
  students (optional) with **Upload files** and **Choose from resources**,
  Cancel and Set homework. Kanvise adds the students line and More options.
  The visibility line names the course's tutors for agencies (decided above).
- `15-tutor-role/screenshots/tutor-course-homework-settled.png`: Homework tab
  empty state (clipboard icon, **No homework set yet**, one line, **Set
  homework**). "messaging apps" becomes "WhatsApp".
- `15-tutor-role/screenshots/tutor-course-homework-tab.png`: course tabs
  (Summary, Lessons, Resources, Homework) and the table style used for HW-02.
- `03-lessons/screenshots/lesson-created--join-available.png`: the **Before
  this lesson · Homework** card on the lesson page ("Nothing was due in the two
  weeks before this lesson."), which 09 SA-05 copies for students.
- Bobbin's hand-in and marking screens are not in the atlas; HW-04 and HW-05
  are Kanvise's own.

Final Bobbin pass (FEAT-009):
- `15-tutor-role/screenshots/tutor-course-resources-tab.png` and `15-tutor-role/screenshots/tutor-course-lessons-tab.png`: course tabs Summary, Lessons, Resources, Homework; Kanvise adds Course plan and Quizzes.
- `15-tutor-role/screenshots/tutor-lesson-detail--default.png`: Set after this lesson card, "No homework was set in the two weeks after this lesson." with All homework.
