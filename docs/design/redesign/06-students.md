# 06 · Students

Status: draft for owner review. Builds on `00-decisions.md`, `01-app-shell.md`
and `04-courses-plan-and-diagnostic.md`.

**Who:** independent tutors and agency admins add and manage students. Agency
tutors see a read-only list of the students on their courses (00 section 14c).
**Goal:** add students quickly (one at a time or a whole list) and see
everything about one student in one place.

## Flow at a glance

```
/students (STU-01 list, STU-02 empty)
  → Add student dialog: STU-03 one student · STU-04 import a list
  → Student page /students/:id (STU-05)
      Summary · Lessons · Homework and quizzes · Summaries · Attendance
  → Private notes (STU-06) · Edit (STU-07) · Resend invite (STU-08)
  → Remove (STU-09) · Export (STU-10) · Delete the student's data (STU-11)
```

---

## STU-01 · Students list

**Header:** **Students** · "The people you teach. Add them here, then put them
on a course." · secondary **Import a list**, primary **Add student**. Agency
tutors see the subtitle "The students on your courses." and no buttons.

**Sample student banner** (only while sample data exists, as in Bobbin): **A
sample student shows how Kanvise works. It's kept out of this list.** with
**Open the sample student ›**.

**Status tabs (underline):** **All** · **Joined** · **Invited** · **No email**.

**Toolbar:** search **Search by name or email…**, **Filter** (Course, Tutor for
admins), and **⋯** with **Export as CSV** (not shown to agency tutors).

**Table:**
| Column | Content |
|---|---|
| Student | Avatar, name; email under it, or a grey **No email** chip |
| Courses | Course swatch (01 SH-15) and course names, up to 2, then **+1** |
| Next lesson | **Mon 10:00 AM** or **None scheduled** |
| Recording | **Consented** (tick icon) or **No consent** (grey). A student without consent stops their lessons being recorded (STU-05 Lesson recording) |
| Status | **Joined** (green tick) · **Invited** (amber, with **3 days ago**) · **No email** (grey) |

Clicking a row opens the student page. No action buttons in rows; actions live
on the student page.

Pagination: 25 per page, with **Showing 1–25 of 61** and arrows. Search,
filters and the page number stay in the URL (16 R-04).

**Loading:** **Loading students…** with a spinner in the table area, as in
Bobbin. **Error:** **We couldn't load your students.** with **Try again**.
**No results:** **No students match "kel".** with **Clear search**.

## STU-02 · Empty

Checked against `05-students/screenshots/page--default.png`.

- Student icon in a tinted circle (the student entity tint, 00 section 11).
- **No students yet**
- "Students are the people you teach. Add one at a time, or bring in a whole
  list from a spreadsheet."
- Primary **Add student**, secondary **Import a list**.
- Agency tutors: **No students on your courses yet.** "An admin adds students
  and puts them on your courses." No buttons.

---

## Add student dialog

One dialog with two tabs at the top: **One student** · **Import a list**. Only
independent tutors and agency admins can open it (00 section 14c).

### STU-03 · One student

Checked against `05-students/screenshots/add-student--step-1.png`. The fields
are Bobbin's minus **Client** (clients are retired), plus an optional phone and
a course.

Subtitle **Add a student and, if you like, put them on a course.**

| Field | Rules | Notes |
|---|---|---|
| First name (optional) | One of the two names is required | Many students go by one name |
| Last name (optional) | One of the two names is required | |
| Email (optional) | Valid email | Line: **Leave blank for a student with no email of their own. Without an email they get no invite and can't sign in. They can still join lessons from the links you send them.** |
| Phone (optional) | Phone number with country code, pre-filled with the account's country code | Line: **Used for the WhatsApp buttons you see, for example to send a join link. Kanvise never messages it on its own.** |
| Timezone | Pre-filled with the tutor's timezone, searchable, with a clear button | Line: **Lesson times are shown to them in this timezone.** |
| Course (optional) | Dropdown of courses with swatches | **Put on a course now** |
| **Recording consent already given** | Checkbox, unticked | Line: **Tick only if the student, or their family for a child, has agreed to lessons being recorded. Leave it unticked if they haven't yet: their lessons won't be recorded until you record consent on their page.** |

Bobbin's checkbox starts ticked. Kanvise starts it unticked, because ticking
it is the tutor saying consent was given, and lessons are recorded only when
every student has consent (00 section 14d).

**Invite line**, shown above the buttons when an email is given (Bobbin's
wording): **We'll email Casey an invite to set a password and sign in. Lesson
emails reach them once they accept.**

**Buttons:** **Cancel**, primary **Add student**, and a secondary **Add and add
another** (keeps the dialog open, clears the form, keeps the course choice).

**Validation:** **Add a first or last name.** · **That email doesn't look
right.** · **That phone number doesn't look right. Include the country code.**
· Duplicate (same email, or same full name with no email):
- independent tutor: **Casey Davis is already one of your students.** with
  **Open their page**;
- agency admin: **Casey Davis is already a student in your agency.** with
  **Open their page**.

Agency tutors can't add students, so they never see this dialog. Where a tutor
would otherwise meet a student who is in the agency but not on their courses
(global search, 01 SH-05), they see **Already in your agency. Ask an admin.**
instead of a link they can't open.

**On success:** toast **Student added.** (Bobbin: "Student created"). The
invite line already said what happens next, so the toast doesn't repeat it.
The list updates with the new row highlighted for a moment. Setup step "Add
your students" ticks (02).

### STU-04 · Import a list

**Step 1 · Upload**
- **Download the template** (CSV with headers: first name, last name, email,
  phone, timezone, recording consent).
- A drop area: **Drop a CSV file here, or choose a file.** Accepts `.csv` up to
  2 MB and 500 rows.
- Line: **You can also copy columns from Google Sheets or Excel and paste them
  here.** (A paste area under the drop area.)

**Step 2 · Match columns** (only if the headers don't match the template)
- Each column in the file with a dropdown: **First name**, **Last name**,
  **Email**, **Phone**, **Timezone**, **Recording consent** (yes / no),
  **Don't import**. Kanvise guesses first.

**Step 3 · Check**
- A preview table of the first 20 rows with problems marked in place:
  **No name**, **Email looks wrong**, **Phone looks wrong**, **Already a
  student** (will be skipped).
- A summary: **58 ready · 2 need fixing · 1 already added.**
- **Fix** opens an inline edit on that row. **Skip rows with problems** is a
  checkbox.
- **Put everyone on a course** (optional dropdown).
- **Send invitations now** checkbox, ticked by default, with the line **58
  students will get an email invitation.**
- Recording consent is only set for rows where the file says yes. A blank cell
  means no consent.

**Step 4 · Importing**
- A progress bar: **Adding 58 students…**. It can be left; a toast reports
  when done.
- **Done:** **58 students added. 2 skipped.** with **Download the skipped
  rows** and **View students**.
- **Failed partway:** **We added 31 students before something went wrong.**
  with **Try the rest again**. Nothing is added twice.

---

## STU-05 · Student page `/students/:id`

Checked against `05-students/screenshots/student-created--detail.png`,
`student--email-invited.png` and `15-tutor-role/screenshots/tutor-student-detail--default.png`.

**Header:** avatar, name, and a status chip if not joined (**Invite not
accepted** or **No email**). Right: **⋯** (Resend invite, Remove student) and
primary **Edit**. Agency tutors see no buttons, as on Bobbin's tutor view.

**Loading:** **Loading summary…** under the tabs (Bobbin's).

**Facts strip:** **Email** · **Timezone** with current local time ("Lagos ·
3:12 PM" or "London · 2:12 PM") · **Phone** (when there is one).

**Tabs (underline):** **Summary** · **Lessons (12)** · **Homework and
quizzes** · **Summaries** · **Attendance**.

Bobbin has Summary, a progress tab, Lessons and Attendance. Kanvise's
**Summaries** tab takes the place of Bobbin's progress tab, and **Homework and
quizzes** is added because Kanvise has both. Courses are a card on the Summary
tab, as in Bobbin's **Linked courses** card, not a tab of their own.

### Summary tab

Left column:
- **Goal:** for example "Ready for the end-of-term test", with
  **Edit**. Empty: **Add a goal so you know what you're working towards.**
- **Courses** (Bobbin's **Linked courses**): one row per course with the course
  swatch, name, tutor under it, the plan progress (**12 of 32 topics
  covered**, 04 Topic status model), counts of **Knows it** and **Needs work**,
  and the next topic (**Next: Factorising**), or **No course plan yet** on the
  right as in Bobbin. A row opens the course plan filtered to this student.
  **+ Add to a course** at the bottom. Removing from a course is in each row's
  **⋯** and asks to confirm: **Remove Casey from Algebra 1 Small Group? Their
  past lessons and summaries stay.** Empty: **Not on a course yet.** with **+
  Add to a course**.
- **Latest summary:** the most recent lesson summary (What went well, What to
  work on), with **All summaries ›**.

Right column:
- **Next lesson:** date, time, topic, with **Open**. Empty: **No lesson
  scheduled.** with **Schedule lesson**.
- **Contact:** the student's email (a mail link, as in Bobbin) and phone, with
  **Message on WhatsApp** (opens a `wa.me` link, only when there is a phone)
  and **Edit**. Empty: **+ Add a phone number**.
- **Lesson recording** (Bobbin's card, adapted):
  - **Can be recorded** with **Consented** (green chip) and the line **Lessons
    with Casey can be recorded. Consent recorded by Alex on 3 Nov.** Button
    **Withdraw consent**.
  - Or **Can be recorded** with **No consent** (grey chip) and the line
    **Lessons with Casey aren't recorded, and nor are group lessons Casey is
    in.** Button **Record consent**.
  - **Casey can watch recordings** with **On** (chip) and **Turn off** (or
    **Off** and **Turn on**). Starts from the account default (12 CFG-L
    **Students can watch recordings**). This replaces Bobbin's **Recordings can
    be shared**, which also covers clients.
  - Agency tutors see the card without buttons.
- **At a glance** (Bobbin's **Activity** card): Lessons completed, Total
  lessons, Attendance (for example **11 of 12**), Homework handed in on time
  (**8 of 10**).
- **Suggestions** (or **Kavi suggests** once Kavi exists): the student-level
  cards from 03 DB-06, when there are any. See the Kavi block below.
- **Ask Kavi about Casey** (once Kavi exists, 00 section 7): one question box,
  placeholder **e.g. How is Casey doing with simultaneous equations?** The
  answer appears under it, tutor-only, with links to the summaries and results
  it used. Suggested questions as chips: **How is Casey doing?** · **What
  should we do next?** · **What keeps coming up?**
- **Private notes** (STU-06): the most recent note, with **All notes** and
  **+ Add a note**.

**Record consent** opens a small dialog: **Record consent for Casey?** · "Only
do this once Casey, or their family for a child, has agreed to lessons being
recorded. Lessons from now on can be recorded." · **Cancel** · **Record
consent**. Toast: **Consent recorded.**

**Withdraw consent** opens: **Withdraw consent for Casey?** · "Lessons with
Casey won't be recorded from now on, including group lessons. Recordings
already made stay until they expire. You can delete them from the lesson's
Session tab." · **Cancel** · **Withdraw consent**. A lesson that is live keeps
recording until it ends; the next start checks again (07 CR-03).

### No email (an edge case)

A student without an email joins lessons through the links the tutor sends
(05 LP-05). They can't sign in, so they can't see homework, quizzes, summaries
or recordings in Kanvise (00 section 14a). The page says so plainly instead of
showing empty tabs:

- Under the header, a grey notice: **Casey has no email, so they join lessons
  from the links you send and can't see homework, quizzes or summaries in
  Kanvise.** with **Add an email to give them homework, quizzes and
  summaries** (opens STU-07 with the email field focused).
- **Homework and quizzes** tab: the same line and button instead of the list.
  Homework can't be set for them; the Set homework dialog (10 HW-01) leaves
  them unticked with **No email** beside their name.
- **Summaries** tab: summaries are still written and kept. Each has **Copy**
  and, when there is a phone, **Send on WhatsApp** (the copied text,
  prefilled).
- WhatsApp buttons here, on the lesson page and in Lesson tools use the
  student's phone. Without a phone they become **Copy message**.

### Lessons tab

Past and upcoming lessons for this student (the lessons table from 05 LL-01,
filtered), with the lesson statuses from 05.

### Homework and quizzes tab

Everything set for this student, with status (**To do**, **Handed in**,
**Marked**, **Late**) and score where marked. Starting check results appear here
too, labelled **Starting check**.

### Summaries tab

Every lesson summary for this student, newest first, each expandable, with
**Copy** on each. Lessons closed with **No summary needed** (08 SM-07) show as
one grey line with the reason.

### Attendance tab

A list of lessons with **Attended**, **Late** (joined more than 10 minutes
after the start), **Left early**, or **Missed**, and the time in the lesson.
Summary at the top: **Attended 11 of 12 lessons this term.** The attendance
rules are in `17-recordings-and-attendance.md`.

---

## STU-06 · Private notes about the student

Notes about the student overall, not tied to one lesson (for example "Gets
anxious before tests; start with an easy win" or "Prefers WhatsApp after
6 pm").

- Opened from the Summary card, as a side panel.
- **+ Add a note:** a text box (up to 2,000 characters) and **Save**. Notes are
  listed newest first with the author and date, e.g. **Alex · 27 Nov**.
- Each note has **Edit** and **Delete** (author or admin). Edited notes show
  **Edited**. **Pin** keeps one note at the top.
- They follow the private notes rule (00 section 16). Line beside the field:
  **Only you, your admins and the course's tutors can see these. Students never
  do.**
- Agency tutors can add notes about students on their courses.

## STU-07 · Edit

Checked against `05-students/screenshots/student--edit-email.png` and
`student--edit-email-filled.png`.

A dialog **Edit student** · "Update this student's details." with the STU-03
fields except Course and the consent checkbox (consent has its own buttons on
the Lesson recording card, so it is never changed by accident). **Save
changes**. Adding an email to a student who had none shows Bobbin's line:
**We'll email Casey an invite to set a password and sign in. Lesson emails
reach them once they accept.** Changing an email on a joined student shows:
**Casey will need to confirm the new email.**

## STU-08 · Resend invite

From **⋯**. A toast: **Invitation sent again to casey@example.com.** Disabled for
an hour after sending, with the tooltip **Sent less than an hour ago.**

## STU-09 · Remove

A dialog: **Remove Casey Davis?**
- "Casey will lose access to your courses straight away. Their past lessons,
  summaries and work stay in your records."
- Buttons **Cancel**, **Remove student** (red).
- Toast: **Casey Davis removed.**

Removing keeps the student's data. Deleting it is STU-11.

## STU-10 · Export

**Export as CSV** downloads all students matching the current filters, with the
template columns plus courses and status. Toast: **Export ready.**

## STU-11 · Deleting a student's data

A privacy request, started from Settings (12 CFG-D **Delete a student's
data**), never from the student page. This section is the rule that dialog
follows.

**What is deleted, straight away:**
- The profile: names, email, phone, timezone, goal, sign-in.
- Private notes about the student (STU-06), and their section of every lesson
  summary. One-to-one summaries are deleted whole.
- Homework and quiz answers, uploaded files, marks, feedback, starting check
  results and topic statuses.
- Recordings of one-to-one lessons.
- Transcripts of every lesson the student was in, and any Kavi drafts made
  from them. Summaries other students received stay, because the tutor wrote
  and confirmed them.
- Their join links, chip messages (07 CR-12) and push subscriptions.

**What is kept:**
- Group lesson recordings, because they belong to the other students too. The
  student's name is removed from the recording's details, attendance and
  Activity, and they appear as **Deleted student**. The confirmation says so:
  **Recordings of group lessons stay for the other students. Casey's name is
  removed from them, but their voice and video stay in the recording until it
  expires.**
- Anonymous counts (lessons held, attendance totals) for the account's own
  numbers.
- A short log line that the data was deleted, by whom and when, with no
  student details.

**Confirmation:** the dialog lists the two groups above with counts
(**12 lessons · 3 recordings deleted · 2 group recordings kept**), offers
**Export Casey's data first**, and requires typing the student's name. It
can't be undone. Copies held by the services Kavi uses are covered in
`20-data-model.md`.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|
| See students | All | All | Only students on their courses (read-only list, standard 03) |
| Add, import | Yes | Yes | No (admins add students) |
| Edit, remove, export | Yes | Yes | No (view only) |
| Record or withdraw recording consent | Yes | Yes | No (sees the state) |
| Write private notes | Yes | Yes | Students on their courses |
| Delete a student's data (STU-11) | Yes | Yes | No |

### Kavi

This covers the two student page features: questions in **Ask Kavi about
Casey**, and the **Kavi suggests** card. Both are tutor-only.

- Input: the student's goal, topic statuses (04 Topic status model), completed
  lesson summaries, homework and quiz results, starting check results and
  attendance, for the courses the asker can see. Private notes may be read
  only because the output is tutor-only (00 section 16); answers and cards
  never quote a note.
- Output: a short plain answer under the question box, with **Based on** links
  to the summaries and results used; and up to three suggestion cards in the
  DB-06 shape, each with a **Kavi's pick** badge and its evidence (**From the
  summaries of 20 and 24 Nov**), after the rule cards.
- Failure state: preparing: **Kavi is looking through Casey's lessons…** (busy
  region, 01 SH-12). Not enough to go on (fewer than two completed lessons):
  **There isn't enough yet. Ask again after a couple of lesson summaries.**,
  and no Kavi cards. Couldn't generate: **Kavi couldn't answer right now.**
  with **Try again**; for the cards, Kavi's cards are simply not shown and the
  rule cards still appear (as in DB-06).
- What the tutor must confirm: answers change nothing. A suggestion changes
  something only when the tutor presses **Use this** on it.
- Without Kavi: the question box is hidden; the Summary tab's cards (Courses,
  Latest summary, At a glance) answer the same questions. The suggestions card
  is titled **Suggestions** and shows only the DB-06 rule cards for this
  student; when no rule applies, it is hidden.

## Emails this flow sends

- **Invitation to the student:** from the tutor, in Kavi's voice, with
  **Accept invitation**, which lets them set a password and sign in.
- **Reminder** after 3 days if not accepted (once).
- Nothing is sent to a student's phone. The full list is in
  `18-notifications.md`.

## Data needed (for the build)

- Student profile: first and last name (at least one), email (optional), phone
  (optional), timezone, goal, status.
- Recording consent per student: state, who recorded or withdrew it and when
  (history kept). Recording visibility per student.
- Import job with row-level results (already partly built in Slice 6A).
- Attendance per lesson (already recorded from the classroom).
- Data deletion job following STU-11, with the kept and deleted counts.

## Checked against Bobbin

- `05-students/screenshots/page--default.png`: header with Import and Add
  student, search, sample student banner, empty state with Add student and
  Import from CSV (STU-01, STU-02).
- `05-students/screenshots/add-student--step-1.png`: First name (optional),
  Last name, Email (optional) with its no-email line, Client, Timezone with a
  clear button, **Recording consent already given** with its untick line
  (STU-03). Client dropped; one name required instead of Bobbin's required
  last name; consent starts unticked.
- `05-students/screenshots/add-student--client-picker-open.png`,
  `add-student--client-selected.png`: the client picker, not copied.
- `05-students/screenshots/student-created--detail.png`: header with **Invite
  not accepted**, Remove and Edit, tabs, Linked courses, Lesson recording card
  (**Can be recorded · Consented**, **Withdraw consent**, **Recordings can be
  shared · Shared**, **Stop sharing**), Activity counts, **Student created**
  toast (STU-05).
- `05-students/screenshots/student--before-email.png`: **Loading summary…**
  under the tabs.
- `05-students/screenshots/student--edit-email.png`, `student--edit-email-filled.png`,
  `student--email-invited.png`: Edit student dialog, invite line, Contact card
  with the email, **Actions ▾** once an invite is pending (STU-07, STU-08).
- `15-tutor-role/screenshots/tutor-student-detail--default.png`: tutor view
  with no Edit or Remove, consent shown without buttons, Lessons count in the
  tab (STU-05, Permissions).
- `06-clients/screenshots/add-client--step-1.png`, `client-created--detail.png`,
  `client-created--populated-list.png`, `page--default.png`: clients are
  retired; only the Contact card idea (email link) is kept, on the student.
