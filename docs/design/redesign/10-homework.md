# 10 · Homework

Status: draft for owner review. Builds on `00-decisions.md`, `04`–`09`.

**Who:** tutors and agency admins set and mark it; students hand it in.
**Goal:** set homework in under a minute, see who's handed in, and mark it with
useful feedback. (This replaces today's Assignments.)

## Flow at a glance

```
Set homework (HW-01) from: course › Homework tab · lesson summary · Lesson tools · /homework
  → Student hands in (HW-04, student app)
  → Tutor marks (HW-05) → student sees the mark and feedback
/homework list (HW-02) · homework page (HW-03)
```

---

## HW-01 · Set homework

A dialog, 560px. Title **Set homework**. Subtitle: **For everyone on Algebra 1
Small Group. Only you and admins see what they hand in.** (or **For Casey on
Algebra 1 Small Group…** when opened for one student).

| Field | Rules | Notes |
|---|---|---|
| Course | Required. Pre-filled and locked when opened from a course, lesson or summary | |
| Students | All the course's students ticked by default | For giving one student extra work |
| Title | Required, 2–120 characters | Placeholder **e.g. Simultaneous equations worksheet** |
| Due | Required. Defaults to the day before the next lesson at 6:00 PM, or 7 days from now if none | A date-time picker. Line under it: **Shown in each student's timezone.** |
| Instructions (optional) | Rich text: bold, italic, lists | Placeholder **What to do, and what to hand in** |
| Files for students (optional) | Up to 10 files, 20 MB each | **Upload files** · **Choose from resources**. Line: **Worksheets, examples, anything students download.** |
| How they hand it in | **Upload files** (default) · **Type an answer** · **Both** | |
| Marking | **Mark out of** a number (default 10) · **Feedback only, no mark** | |
| Linked lesson | Shown read-only when set from a lesson or summary: **Set after: Solving Systems of Linear Equations, 27 Nov** | |

**Kavi:** when set from a lesson summary and Kavi has a suggestion, the dialog
opens filled in from it, with a small **Drafted by Kavi** label on the fields it
filled. The tutor edits anything. A **Draft with Kavi** text button on the
Instructions field writes instructions from the title and the course plan topic.

**Buttons:** **Cancel** · **Set homework**.
A line above them: **Students get a notification in their app.**

**Validation:** **Add a title.** · **Choose a due date.** · **The due date has
already passed.** · **That file is too big. The limit is 20 MB.**

**On success:** toast **Homework set for 2 students.** The homework appears on
the course's Homework tab and in each student's To do.

## HW-02 · Homework list `/homework`

**Header:** **Homework** · "Everything you've set, and what's waiting to be
marked." · primary **Set homework**.

**Tabs (underline):** **To mark** (default when anything is waiting) · **All**
· **Past due**.

**Table:** Title (course dot and name under it) · Due · Handed in (**2 of 3**) ·
To mark (**1**) · Status.

**Empty:** clipboard icon, **No homework yet.** "Set homework from a course or
straight after a lesson." **Set homework**.

## HW-03 · Homework page `/homework/:id`

**Header:** title, status chip (**Open** / **Past due** / **Closed**). Right:
**⋯** (Edit, Extend due date, Close, Delete) and primary **Mark next** (opens
the first unmarked submission).

**Facts strip:** Course · Due · Set after (lesson, if linked) · Marking.

**Main:** instructions and files as students see them.

**Right column, Students:** each student with:
- **Not handed in** (grey), **Handed in · on time** (blue), **Handed in · 1 day
  late** (amber), **Marked · 8/10** (green);
- **Remind** for students who haven't handed in (in-app and push: **Alex is
  waiting for your Simultaneous equations worksheet.**);
- tapping a student opens their submission (HW-05).

**Edit** changes title, instructions, files or due date. Changing the due date
notifies students: **The due date for Simultaneous equations worksheet moved to
Sat.** **Delete** asks: **Delete this homework? Students' submissions will be
deleted too.**

## HW-04 · Handing in (student)

From Home → To do, or Homework in the student app.
- Title, tutor, due date with a countdown (**Due in 2 days**).
- Instructions and files (**Open**, **Download**).
- **Your answer:** depending on the setting, an upload area (**Take a photo** on
  phones, **Choose files**), a text box, or both. Photos of handwritten work
  are the common case, so the camera option comes first on phones.
- **Hand in** (primary). Confirmation: **Hand in your work? You can still change
  it until Alex marks it.** **Cancel** · **Hand in**.
- After handing in: **Handed in · Tue 6:42 PM** with **Change my work**
  (replaces the files or text; the tutor sees the latest version and when it
  changed).
- Late: handing in after the due date is allowed and labelled **Late** for the
  tutor. The student sees **This is past the due date. You can still hand it
  in.**
- Upload failures keep what was chosen and say **That didn't upload. Check your
  connection and try again.** Uploads show progress and survive a weak signal
  by retrying.

## HW-05 · Marking

A full page: the submission on the left, marking on the right. On phones,
stacked.

- **Submission:** files (images open in a viewer with zoom and rotate; PDFs
  inline; others download) and the typed answer. **Handed in Tue 6:42 PM · 1
  day late** at the top.
- **Mark:** **8 / 10** (number field), or hidden for feedback-only homework.
- **Feedback:** a text box. Placeholder **What they did well, and what to fix.**
  **Draft with Kavi** writes feedback from the submission (typed answers and
  readable images), labelled until edited.
- **Covered topics** (optional): the course plan topics this homework checked,
  with **Got it** · **Needs more work**, which update the course plan like a
  lesson summary does.
- **Save and next** (moves to the next unmarked student) · **Save**.
- On save, the student sees the mark and feedback, and gets a notification:
  **Your homework was marked: 8/10.**
- **Ask to redo** (in ⋯): sends it back with the feedback; status becomes
  **Redo requested**, and the student can hand in again.

## Permissions

| Action | Tutor | Agency admin | Student |
|---|---|---|---|
| Set, edit, delete, mark | Their courses | Any course | No |
| See submissions | Their courses | Any course | Their own |
| Hand in | No | No | Yes |

## Data needed (for the build)

- Homework: course, students, title, due, instructions, files, hand-in mode,
  marking mode, linked lesson. (Today's assignments, assignment guard functions
  and submissions cover most of this.)
- Submissions with versions, late flag, mark, feedback, topic outcomes.
- Notifications and push for set, due-date change, remind, marked, redo.
