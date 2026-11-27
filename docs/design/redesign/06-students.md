# 06 · Students

Status: draft for owner review. Builds on `00-decisions.md`, `01-app-shell.md`
and `04-courses-plan-and-diagnostic.md`.

**Who:** tutors and agency admins.
**Goal:** add students quickly (one at a time or a whole list), see everything
about one student in one place, and keep parents in the loop.

## Flow at a glance

```
/students (ST-01 list, ST-02 empty)
  → Add student dialog: ST-03 one student · ST-04 import a list
  → Student page /students/:id (ST-05)
      Summary · Courses · Lessons · Homework and quizzes · Reports · Attendance
  → Edit (ST-06) · Resend invite (ST-07) · Remove (ST-08) · Export (ST-09)
```

---

## ST-01 · Students list

**Header:** **Students** · "The people you teach. Add them here, then put them
on a course." · secondary **Import a list**, primary **Add student**.

**Status tabs (underline):** **All** · **Joined** · **Invited** · **No email**.

**Toolbar:** search **Search by name or email…**, **Filter** (Course, Tutor for
admins), and **⋯** with **Export as CSV**.

**Table:**
| Column | Content |
|---|---|
| Student | Avatar, name; email under it, or a grey **No email** chip |
| Courses | Colour dots and course names, up to 2, then **+1** |
| Next lesson | **Mon 10:00 AM** or **None scheduled** |
| Parent | Parent's name (shown only if the account teaches children or the student has a parent contact) |
| Status | **Joined** (green) · **Invited** (amber, with **3 days ago**) · **No email** (grey) |

Clicking a row opens the student page. No action buttons in rows; actions live
on the student page.

Pagination: 25 per page, with **Showing 1–25 of 61** and arrows. Search,
filters and the page number stay in the URL.

## ST-02 · Empty

- Student icon in a green circle.
- **No students yet**
- "Add the people you teach. You can add one at a time, or bring in a whole list
  from a spreadsheet."
- Primary **Add student**, secondary **Import a list**.

---

## Add student dialog

One dialog with two tabs at the top: **One student** · **Import a list**.

### ST-03 · One student

Subtitle **Add a student and, if you like, put them on a course.**

| Field | Rules | Notes |
|---|---|---|
| First name | Required | |
| Last name | Required | |
| Student's email (optional) | Valid email | Line: **Leave blank if they don't have one. Without an email they can't sign in, but you can still send them their lesson links yourself.** |
| Parent or guardian | Shown open by default if the account teaches children; collapsed under **+ Add a parent** if adults or both | Parent's name, parent's email, phone (optional, for WhatsApp). Line: **Parents get lesson summaries and invoices. They don't get a login.** |
| Who pays? | Shown only when billing is on | **The parent** · **The student** |
| Timezone | Pre-filled with the tutor's timezone, searchable | Line: **Lesson times are shown to them in this timezone.** Important for families abroad. |
| Course (optional) | Dropdown of courses | **Put on a course now** |

**Invite line**, shown above the buttons when an email is given:
**We'll email Casey an invite to set a password and sign in. Lesson emails reach
them once they accept.**

**Buttons:** **Cancel**, primary **Add student**, and a secondary **Add and add
another** (keeps the dialog open, clears the form, keeps the course choice).

**Validation:** **Add a first name.** · **Add a last name.** · **That email
doesn't look right.** · **Casey Davis is already one of your students.**
(with **Open their page**).

**On success:** toast **Student added. Invitation sent to casey@example.com.**
(or **Student added.**). The list updates with the new row highlighted for a
moment. Setup step "Add your students" ticks.

### ST-04 · Import a list

**Step 1 · Upload**
- **Download the template** (CSV with headers: first name, last name, email,
  parent name, parent email, parent phone, timezone).
- A drop area: **Drop a CSV file here, or choose a file.** Accepts `.csv` up to
  2 MB and 500 rows.
- Line: **You can also copy columns from Google Sheets or Excel and paste them
  here.** (A paste area under the drop area.)

**Step 2 · Match columns** (only if the headers don't match the template)
- Each column in the file with a dropdown: **First name**, **Last name**,
  **Email**, **Parent name**, **Parent email**, **Parent phone**, **Timezone**,
  **Don't import**. Kanvise guesses first.

**Step 3 · Check**
- A preview table of the first 20 rows with problems marked in place:
  **Missing last name**, **Email looks wrong**, **Already a student** (will be
  skipped).
- A summary: **58 ready · 2 need fixing · 1 already added.**
- **Fix** opens an inline edit on that row. **Skip rows with problems** is a
  checkbox.
- **Put everyone on a course** (optional dropdown).
- **Send invitations now** checkbox, ticked by default, with the line **58
  students will get an email invitation.**

**Step 4 · Importing**
- A progress bar: **Adding 58 students…**. It can be left; a toast reports
  when done.
- **Done:** **58 students added. 2 skipped.** with **Download the skipped
  rows** and **View students**.
- **Failed partway:** **We added 31 students before something went wrong.**
  with **Try the rest again**. Nothing is added twice.

---

## ST-05 · Student page `/students/:id`

**Header:** avatar, name, and a status chip if not joined (**Invite not
accepted** or **No email**). Right: **⋯** (Resend invite, Remove student) and
primary **Edit**.

**Facts strip:** **Email** · **Timezone** with current local time ("Lagos ·
3:12 PM" or "London · 2:12 PM") · **Parent**.

**Tabs (underline):** **Summary** · **Courses** · **Lessons** · **Homework and
quizzes** · **Summaries** · **Attendance**.

### Summary tab

Left column:
- **Goal:** for example "Ready for the end-of-year exam in June", with
  **Edit**. Empty: **Add a goal so you and Kavi know what you're working
  towards.**
- **Courses:** one card per course: colour dot, name, the plan progress
  (**12 of 32 topics taught**), counts of **Knows it** and **Needs work**, and
  the next topic (**Next: Factorising**). Opens the course plan filtered to this
  student.
- **Latest summary:** the most recent lesson summary (What went well, What to work
  on), with **All summaries ›**.

Right column:
- **Next lesson:** date, time, topic, with **Open**. Empty: **No lesson
  scheduled.** with **Schedule lesson**.
- **Parent or guardian:** name, email, phone, with **Message on WhatsApp**
  (opens a `wa.me` link) and **Edit**. Empty: **+ Add a parent**.
- **At a glance:** Lessons taken, Attendance (for example **11 of 12**),
  Homework handed in on time (**8 of 10**).
- **Kavi suggests:** the student-level suggestions from DB-06, when there are
  any.

### Courses tab

All courses the student is on, with **+ Add to a course**. Removing from a
course is in each card's **⋯** and asks to confirm: **Remove Casey from Algebra
1 Small Group? Their past lessons and reports stay.**

### Lessons tab

Past and upcoming lessons for this student (the lessons table, filtered).

### Homework and quizzes tab

Everything set for this student, with status (**To do**, **Handed in**,
**Marked**, **Late**) and score where marked. Diagnostic results appear here
too, labelled **Diagnostic**.

### Summaries tab

Every lesson summary for this student, newest first, each expandable, with
**Copy** on each.

### Attendance tab

A list of lessons with **Attended**, **Late** (joined more than 10 minutes
after the start), **Left early**, or **Missed**, and the time in the lesson.
Summary at the top: **Attended 11 of 12 lessons this term.**

---

## ST-06 · Edit

A dialog with the ST-03 fields (except Course). Adding an email to a student who
had none shows: **Saving will send Casey an invitation.** Changing an email
on a joined student shows: **Casey will need to confirm the new email.**

## ST-07 · Resend invite

From **⋯**. A toast: **Invitation sent again to casey@example.com.** Disabled for
an hour after sending, with the tooltip **Sent less than an hour ago.**

## ST-08 · Remove

A dialog: **Remove Casey Davis?**
- "Casey will lose access to your courses straight away. Their past lessons,
  reports and work stay in your records."
- Buttons **Cancel**, **Remove student** (red).
- Toast: **Casey Davis removed.**

(Deleting a student's data entirely is a separate privacy request, handled in
Settings, not here.)

## ST-09 · Export

**Export as CSV** downloads all students matching the current filters, with the
template columns plus courses and status. Toast: **Export ready.**

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|
| See students | All | All | Only students on their courses |
| Add, import | Yes | Yes | Yes, added to one of their courses |
| Edit, remove, export | Yes | Yes | No (view only) |

## Emails this flow sends

- **Invitation to the student:** from the tutor, in Kavi's voice, with
  **Accept invitation**, which lets them set a password and sign in.
- **Reminder** after 3 days if not accepted (once).
- **Parent welcome** (when a parent is added): who the tutor is, what they'll
  receive (lesson summaries, later invoices), and that they don't need an account.

## Data needed (for the build)

- Student profile: names, email, timezone, goal, status.
- Parent contact (name, email, phone) and payer flag. A contact, not a user.
- Import job with row-level results (already partly built in Slice 6A).
- Attendance per lesson (already recorded from the classroom).
