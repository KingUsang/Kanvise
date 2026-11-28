# 04 · Courses, the course plan and the starting check

Status: draft for owner review. Builds on `00-decisions.md` (sections 3, 3a, 4,
5, 14c, 16, 17) and `01-app-shell.md`.

**Who:** independent tutors and agency admins create courses. Agency tutors
see and teach the courses an admin gives them (00 section 14c, standard 03).
**Goal:** create a course in three short steps, as in Bobbin, then build its
course plan and, if the tutor wants, find out what the students already know.

A course pairs a student (or a small group) with a tutor over time. It holds
the course plan, lessons, homework, quizzes and resources. A trial is a short
course (CW-1).

## Flow at a glance

```
/courses  (CRS-01 list, CRS-02 empty)
  → New course wizard: CW-1 Name and presentation → CW-2 People → CW-3 Review and create
  → Course page /courses/:id (CRS-03 Summary)
      cards: Build the course plan (CRS-06) → Find out what they know (CRS-07)
      tabs:  Summary · Course plan (CRS-04) · Lessons · Homework · Quizzes · Resources
  → Starting check: DIAG-D send dialog → DIAG-P preview → DIAG-S student takes it
      → DIAG-R tutor reviews → CRS-08 Review changes → statuses on the plan
```

---

## CRS-01 · Courses list

Checked against `04-courses/screenshots/page--default.png` and
`15-tutor-role/screenshots/tutor-courses--default.png`.

**Header:** **Courses** · "A course pairs a student with a tutor over time." ·
primary **New course** (independent tutors and admins only; agency tutors don't
see it).

**Toolbar:** search **Search courses…**, and **Filter** (Student, Tutor for
admins, Subject, Status: Active / Trial / Archived). Bobbin's Client filter is
not copied (no clients).

**Sample course:** above the list, a slim banner **A sample course shows how
Kanvise works. It's kept out of this list.** with **Open the sample course ›**,
as in Bobbin.

**List:** a table, as in Bobbin (which has Course, Tutor and Students
columns), sortable by Course:

| Column | Content |
|---|---|
| Course | The course swatch (a small rounded square in the course colour, 01 SH-15) and the name, for example **Algebra 1 Small Group**, with a **Trial** chip when it is one |
| Subject | For example **Mathematics** |
| Tutor | Admins only: avatar and name |
| Students | Avatars (up to 4, then **+2**) and the name when there is one, as in Bobbin |
| Course plan | **12 of 32 topics covered** with a thin bar, or **No plan yet** |
| Next lesson | **Mon 10:00 AM**, or **None** with a **Schedule** link |

On phones each row becomes a stacked card with the same content (16).
Clicking a row opens the course page. There are no delete buttons on cards;
archiving and deleting live in the course page's **Actions** menu.

**Loading:** three skeleton rows. **Error:** the shared page error (01 SH-09).
**Search or filter with no results:** **No courses match.** with **Clear
filters**.

## CRS-02 · Empty

Copied from Bobbin's empty state.
- Course icon in a tinted circle (the course entity tint, 00 section 11).
- **No courses yet**
- "A course pairs a student with a tutor over time. It holds the course plan and
  everything you schedule, so create one before booking lessons."
- Button **Create a course**.
- Agency tutors see instead: **No courses yet.** "Your admin adds you to
  courses. They'll show up here." and no button.

---

## New course wizard

A dialog (SH-10), 448px wide as in Bobbin, three steps with a three-part
segmented progress bar under the subtitle. The current part is orange (the
"location" token, 01 SH-15). Steps 2 and 3 have a round **←** back button bottom
left; the primary button is bottom right. **✕** closes the wizard; if anything
was typed it asks **Discard this course?** (**Keep editing** / **Discard**).
Focus moves to the step heading on each step (01 SH-12).

### CW-1 · Name and presentation

Title **New course** · subtitle **Name, subject, description and colour.**
(Bobbin: "Name, description, where it runs and colour." Kanvise is online
only, so there is no "where it runs".)

| Field | Rules | Notes |
|---|---|---|
| Course name | Required, 2 to 80 characters | Placeholder **e.g. Algebra 1** (Bobbin's) |
| Subject | Required. A dropdown of the subjects from onboarding first (02 ONB-05), then all others, plus **Add a subject** | Used for the course plan and quizzes |
| Description (optional) | Up to 500 characters | Placeholder **What does this course cover?** (Bobbin's). Shown in About on the course page |
| Colour | 11 swatches in a row, as in Bobbin, from the Kanvise palette; one preselected at random from those no other active course uses | Line: **Used to identify this course at a glance on the calendar and in lists.** |
| **This is a trial** | A switch, off by default | Line when on: **A short course for a first lesson. You can turn it into a full course later.** |

**Continue** validates. Errors (inline, under the field): **Add a course
name.** · **Choose a subject.**

**Trials (decision).** A trial uses this same wizard with the **This is a
trial** switch, rather than a separate "Quick course" shortcut. One path keeps
one set of rules for students, links and permissions, and the wizard is already
three steps. When the switch is on:
- the course name becomes optional; left empty, it is set to **Trial:
  {student's name}** and shown that way on CW-3, where **Edit** can change it;
- the course page shows a **Schedule the trial lesson** card instead of the
  course plan and starting check cards (CRS-06, CRS-07);
- after the trial lesson ends, the course page shows **Turn this into a full
  course** (renames it, clears the trial flag and brings the plan cards back)
  and **Archive trial**.

### CW-2 · People

Title **People** · subtitle **Add students and tutors to the course.**
(Independent tutors see **Add students to the course.**)

- **Students:** a list of checkbox rows, as in Bobbin, nothing ticked at
  first, with **0 of 12 selected** (and **Clear** once something is ticked) on
  the right of the label. Search at the top once there are more than 8
  students.
- **+ Add a student** under the list opens an inline form inside the step with
  the 06 STU-03 fields, rules and lines: first name, last name, email
  (optional), phone (optional), timezone (pre-filled), and **Recording consent
  already given** (unticked, with its line). The Course field is left out,
  because the student goes on this course. Saving creates the student exactly
  as STU-03 does (including the invite line and the invite email), then
  selects them without leaving the wizard. They stay in the students list even
  if the wizard is closed. Validation and duplicate messages are STU-03's.
- Students without an email show a small grey **No email** chip. Tap or focus
  shows: **They can't sign in yet. You'll send them their lesson links
  yourself.**
- **One-to-one default** (02 ONB-04): the list opens with a single-choice
  picker and an **Add another student** link. Choosing a second student shows
  a quiet line: **This will be a group course.**
- **Tutors** (agency admins only): checkbox rows of the agency's tutors with
  **1 of 3 selected**, at least one required, and **+ Add a tutor** (opens the
  Add tutor dialog, 19 TM-03). An admin is listed here only if
  they have turned on **I teach too** (12 CFG-P, 19 TM-10);
  otherwise an admin leads a lesson through **Join as an admin?** (07 CR-09).
  Independent tutors don't see this section; they are the tutor.

**Continue** validates. Errors: **Choose at least one student.** · for admins
**Choose at least one tutor.**

**Billing (not built).** The wizard has no price field. Billing is out of the
build (00 section 14). When it exists, the course price goes in this step,
under the students, as 13 BL-02 says, and on the course page under **Actions ›
Pricing** (20 DM-31).

### CW-3 · Review and create

Title **Review and create** · subtitle **Check the details before creating.**

A bordered table, as in Bobbin, one row per item, each with an **Edit** link
that returns to its step: **Name** (with the course swatch), **Subject**,
**Description**, **Students**, **Tutors** (admins), and **Trial** when on.

Button **Create course**.

**On success:** the dialog closes, the course page opens on Summary with the
**Build the course plan** card (CRS-06) at the top, and a toast says **Course
created** (acknowledgement only, 01 SH-08). Setup ticks **Create a course**.
**On failure:** the dialog stays on CW-3 with everything kept and an inline
error above the button: **We couldn't create the course. Nothing was saved.
Try again.**

The course plan and the starting check are not wizard steps (00 section 3a).
Nothing is sent to students when a course is created.

---

## Course page `/courses/:id`

Checked against `04-courses/screenshots/course-created--detail.png`,
`sample-course--summary-loaded.png` and `15-tutor-role/screenshots/tutor-course-detail--default.png`.

**Header:** course swatch, course name, a **Trial** or **Archived** chip when it
applies. Right: **Actions ▾** (Edit course, Archive course, Delete course) and
primary **New lesson**. Bobbin's menu has Edit course and Delete course;
Kanvise adds Archive, because a course with taught lessons can't be deleted.

- **Edit course** opens CW-1's fields in one dialog (no steps), as in Bobbin
  (`15-tutor-role/screenshots/tutor-course-edit.png`): title **Edit course**,
  subtitle **Name, subject, description and colour.**, the colour line **Used
  to identify this course at a glance on the calendar and in lists.**, and one
  button **Save changes**. Agency tutors see it for their own courses only
  (Permissions); Bobbin's Actions menu also lets them delete, Kanvise doesn't.
- **Archive course** hides it from the list (Status filter: Archived), cancels
  nothing in the past and asks first if future lessons exist: **3 lessons are
  still scheduled. Cancel them and archive?**
- **Delete course** copies Bobbin's confirmation: **Delete course?** "This will
  permanently delete Algebra 1 Small Group and can't be undone. A course can't
  be deleted once any of its lessons has started or been marked complete."
  Buttons **Cancel** and **Delete course** (red). When a lesson has started, the
  menu item is disabled with the reason as text: **Archive it instead. Lessons
  on this course have been taught.**

**Loading:** **Loading course…** with a spinner in the page body, as in Bobbin,
replaced by skeleton cards after 300 ms (01 SH-09).

**Facts strip:** Subject · Tutor · **Next lesson: Mon 10:00 AM**.

**Tabs (underline, orange when active):** **Summary** · **Course plan** ·
**Lessons (6)** · **Homework** · **Quizzes** · **Resources**.

### CRS-03 · Summary tab

Left column, top to bottom:
1. The next card in order, only one at a time: **Build the course plan**
   (CRS-06) while the plan has no topics or is a Draft; then **Find out what
   they know** (CRS-07) while it applies. A trial shows **Schedule the trial
   lesson** instead.
2. A persistent banner when a starting check failed to send (01 SH-08): **The
   starting check wasn't sent to Alex.** with **Send now**. It stays until it is
   sent or dismissed.
3. **About:** the description, with an **Edit** pencil. Empty: **Add a short
   description so students know what this course is for.**
4. **Course plan** card (once the plan is Active): **Course plan** eyebrow,
   **Mathematics · High School** (Bobbin's subject and level), **8 modules · 32
   topics · 96 objectives**, a
   segmented progress bar **12 of 32 topics covered** with the percentage, and
   **Open course plan ›**. In a group course the bar shows the group average
   and the line says **Average across 3 students**.
5. **Latest lessons:** a small table as in Bobbin (Lesson, Date, Tutor for
   admins, Students, Status) with **View all**.
   Empty: **No lessons yet.** with **New lesson**.

Right column:
- **At a glance:** Total lessons, Students, Tutors (Bobbin's three rows).
- **Tutor** card (with **+ Add** for admins). **+ Add** opens Bobbin's
  **Add tutors** dialog (`15-tutor-role/screenshots/tutor-course-add-tutor.png`):
  "Pick tutors from your agency to add to the course.", a picker with **0 of 3
  selected**, **+ Add a tutor** (opens 19 TM-03), **Cancel** and **Add tutors**
  (disabled until one is picked).
- **Students** card: avatar, name, and one status line: **Starting check not
  sent** / **Starting check sent 2 days ago** / **Starting check done · checked
  8 of 32 topics** / **Invite not accepted**. **+ Add** for admins and
  independent tutors opens the add-student picker; ✕ removes a student from
  the course after a confirm.

### CRS-04 · Course plan tab

Checked against `04-courses/screenshots/sample-course--outline.png`.

- **Header card:** **Course plan** eyebrow, title **Mathematics · High
  School** (subject · level, as in Bobbin), **8 modules · 32 topics · 96
  objectives**, the chips **Mathematics** and **High School**, the progress
  bar, 👍 / 👎 while any module is still an unedited Kavi draft, and **⋯**
  (Export, Regenerate untouched modules, Copy plan from another course).
- **Level:** the second part of the title and the second chip are the
  course's level, which is optional. A pencil beside the title edits it: a
  short text box (up to 40 characters, placeholder **e.g. High School**), or a
  dropdown of the account's level names when they are set (12 CFG-K). With no
  level, the title is just the subject (**Mathematics**) with one chip. The
  sample course's level is **High School**, as in Bobbin's sample.
- **Viewing:** a selector **Everyone** (default for groups) or one student.
  For one-to-one courses it shows that student and is fixed.
- **Next** strip: the topics with status **Next** for the selected student,
  in order (up to 5). Each can be removed (**✕**, the topic goes back to no
  status) or reordered: drag by the handle, or **Move up** / **Move down** in
  its **⋯** menu, or arrow keys on the focused handle (01 SH-12). In
  **Everyone** view the strip shows topics that are Next for every student, and
  a line **Casey and Alex have different next topics.** when they differ.
- **Modules:** numbered rows (expandable) as in Bobbin: module name, one-line
  description, a module chip (**Not started**, **In progress** with a half-filled
  circle icon, **Complete** neutral with a tick icon, 01 SH-15), **3 of 6** and a
  six-segment mini bar. A module is Complete when all its topics are covered
  (Taught or Knows it) for the selected student, or for every student in
  Everyone view.
- **Topics** inside a module: name, objectives (expandable checklist), and the
  status chip. Every chip is an icon plus a word (01 SH-12):

| Status | Chip | Means |
|---|---|---|
| (none) | No chip; **Not yet** in grey on focus or hover, for screen readers "No status" | Not taught, not checked |
| **Next** | Arrow-right icon, indigo outline | Planned for an upcoming lesson |
| **Taught** | Single tick icon, neutral fill | Covered in a completed lesson |
| **Needs work** | Circular-arrow icon, amber fill | Checked or taught, and the student needs more on it |
| **Knows it** | Double tick icon, green outline | The student has shown they know it |

  In **Everyone** view each topic row shows one small chip per student
  (initials plus the status icon, the word in its tooltip and accessible name)
  and a count on the right: **2 of 3 covered**.
- **Changing a status by hand:** clicking a chip opens a small menu with the
  five choices and an optional **Why?** line (saved with the change, shown in
  the topic's history). In Everyone view the menu asks **For whom?** (each
  student, or **Everyone**).
- **Reordering modules and topics:** drag by the handle (the moved row slides
  and the others make room), or **Move up** / **Move down** in the row's **⋯**,
  or arrow keys on the focused handle. The new position is announced (01
  SH-12).
- **Editing:** **+ Module** in the header, **+ Topic** at the end of each
  module, **+ Objective** under each topic. Rows edit in place.
- **Export** (in ⋯): **Download as PDF** or **Copy as text** (modules, topics,
  objectives; statuses are not included). Toast: **Plan copied.**
- **Regenerate untouched modules** (in ⋯, Kavi): redrafts only the modules
  where no topic has a status for any student, no lesson is linked to a topic
  and nothing was edited by hand. Topics that already have a status are never
  touched (F-60). It opens a preview, **Kavi redrafted 3 modules. 5 modules
  were kept because they're in use.**, with **Replace** / **Keep** per module,
  nothing preselected.

**Empty plan:** the CRS-06 card in full width.

### Course plan status

A course has one course plan, in one of three states:

| Plan state | How it gets there | What it allows |
|---|---|---|
| **Draft** | A Kavi draft (CRS-06, Draft with Kavi) arrives here. Students don't see it | Edit, delete, **Use this plan** |
| **Active** | **Use this plan** on a Draft; **Start blank** (Active and empty); **Copy plan from another course** (Active, copied) | Students see it (SA-08). Lessons, homework and quizzes link to its topics. Statuses can be set |
| **Archived** | The course is archived | Read only, statuses kept |

How the plan state drives the cards on the course page:
- No plan, or a Draft: **Build the course plan** (CRS-06). With a Draft it
  reads **Your plan is a draft. Review it and press Use this plan.** with
  **Review draft**.
- Active with at least one topic: **Find out what they know** (CRS-07).
- Active with no topics: the Course plan card on Summary reads **Add your first
  topic** with **Open course plan**.
- Setup's **Build the course plan** step (02) ticks when the plan is Active
  and has at least one topic.

### CRS-05 · Other tabs

- **Lessons:** the lessons list (05 LL-01) filtered to this course.
- **Homework**, **Quizzes:** lists filtered to this course with **Set
  homework** and **New quiz**. Specs 10 and 11.
- **Resources:** files attached to this course, **Add resources** (Upload or
  Choose from library). Line: **Students on this course can open these.**

### CRS-06 · Build the course plan card

Checked against `04-courses/screenshots/course-created--detail.png` ("Build a
course plan with AI": Browse plans / Describe your own) and
`15-tutor-role/screenshots/tutor-course-plan-describe.png`.

Shown at the top of Summary (and full width on the empty Course plan tab):
- Title **Build the course plan**.
- "The modules and topics this course will cover. Lessons, summaries, homework
  and quizzes tick them off, so you can see progress."
- Three buttons: **Draft with Kavi** (Kavi mark, primary), **Start blank**,
  **Copy plan from another course**.
- No ✕: the card stays until the plan has a topic. Setup can skip the step;
  the card stays on the course.

**Draft with Kavi** opens a dialog copied from Bobbin's "Describe your own
course plan":
- Title **Describe your course plan** · "Tell Kavi what this course should
  cover and it will draft modules, topics and objectives. Review every module
  before using it with students."
- A text area **What should this course cover?**, prefilled with the subject
  and description as a starting sentence. Placeholder: **e.g. A 10-week course
  for two 14 to 15 year olds who are confident with one-variable equations and
  are moving on to systems, functions and quadratics.**
- Line under it: **Include the level, the main topics and what students should
  be able to do by the end. The more detail, the better the plan.**
- **Cancel** · **Generate plan** (Kavi mark), disabled until there are 20
  characters, with the reason under it: **Write a little more first.**
- **Generating:** modules appear one by one under the text area (numbered
  name, one-line description, topic count), with **Stop**. The region is busy
  for screen readers and announces once: "Kavi's draft is ready" (01 SH-12).
- **Done:** **8 modules · 32 topics · 96 objectives**, the module list,
  **Regenerate**, and **Save as draft**. Saving puts the plan in Draft and opens
  the Course plan tab.
- **Failed** and **not enough to go on**: see the Kavi block below.

**Start blank** makes an empty Active plan, opens the Course plan tab with the
cursor in **Module 1 name**, and shows the hint **Add a module, then its
topics.**

**Copy plan from another course** opens a dialog:
- Title **Copy a course plan** · "Start from a plan you've already built. Topics
  and objectives are copied; nobody's progress is."
- A searchable list of courses the person can see that have a plan (their own;
  for admins, every course in the agency; plus the sample course), each with
  swatch, name, **8 modules · 32 topics**, and **Preview** (module and topic
  list on the right).
- **Copy plan** copies modules, topics and objectives in order. No statuses,
  lessons or links come with it. Toast: **Plan copied from Algebra 1.**
- Empty: **None of your courses has a plan yet.** with **Start blank instead**.
- Bobbin's library of 211 ready-made plans with country and exam-board filters
  is not copied (00 section 13a, no exam-board names); copying your own plans is
  the non-AI starting point instead.

### CRS-07 · Find out what they know card

Shown on Summary once the plan is Active with at least one topic, until a
starting check has been sent to every current student:
- Kavi mark. Title **Find out what they know**.
- "A short starting check shows which topics to start with, and gives you a
  starting point to show progress later."
- **Send a starting check** (opens DIAG-D) and **✕** (hides the card for this
  course; it comes back when a new student joins the course, offering the
  check to that student only).

---

## Topic status model

This is the one definition every spec uses (00 section 4). Specs 06, 08, 09,
10 and 11 refer here instead of restating it.

**One status per student per topic.** Each student on a course has exactly one
status on each topic: none, **Next**, **Taught**, **Needs work** or **Knows
it**. Progress is tracked separately for each course. Statuses live on topics;
objectives are a checklist inside a topic and never set a status on their own.

**Where a status can come from**

| Source | Can set | When |
|---|---|---|
| Tutor by hand (CRS-04 chip menu, Next strip) | Any status, or none | Straight away; the only source that skips CRS-08 |
| Starting check (DIAG-R) | **Knows it** (two correct on the topic), **Needs work** (two wrong or Not sure) | When the tutor accepts the row in CRS-08 |
| Lesson summary Complete (08) | **Taught** for each topic ticked in What we covered; **Knows it** if the tutor chose Got it; **Needs work** if they chose Needs more work | When the tutor accepts the row in CRS-08 |
| Homework marking (10) | **Knows it** (Got it), **Needs work** (Needs more work) | When the tutor accepts the row in CRS-08 |
| Quiz results (11) | **Knows it** when the student got every question on the topic right (at least two), **Needs work** when they got half or fewer right | When the tutor accepts the row in CRS-08 |
| Scheduling (05 LW-2) | **Next** is not set by scheduling; linking a lesson to a topic only shows the link | None |

**Allowed changes.** Any status can move to any other through the sources
above. The usual path is none → Next → Taught → Knows it, with Needs work
in between whenever a check, lesson, homework or quiz shows a gap. Topics
leave **Next** when they become Taught, Needs work or Knows it, or when the
tutor removes them from the Next strip.

**Precedence.**
1. A change the tutor makes by hand wins over everything and is never replaced
   without the tutor seeing it: in CRS-08 a row that would replace a status set
   by hand is marked **Replaces your choice from 3 Dec**.
2. Otherwise the most recent confirmed change wins. "Confirmed" means accepted
   in CRS-08, so nothing changes a status without a person.
3. Two proposals for the same topic and student in one sheet (for example a
   quiz and a summary accepted together) show as one row with the newer
   proposal, and the older one under it in grey.

**Groups and absence.**
- In a group, every change is per student. The Everyone view only summarises.
- A student who was absent from a lesson (no attendance, 17-recordings-and-attendance.md)
  gets no status change from that lesson's summary. The sheet doesn't list
  them.
- A student who joins a course late starts with no statuses, and CRS-07
  offers them a starting check.

**Progress** counts topics, not objectives: **12 of 32 topics covered**, where
covered means **Taught** or **Knows it**. Bobbin counts objectives ("27 of 90
objectives covered"); Kanvise counts topics because statuses live on topics,
and shows the objective count only in the plan header. A group's bar is the
average of its students.

**History.** Every change keeps the source, the person who confirmed it, the
date, and the optional **Why?** line. Hovering or focusing a chip shows the
last change: **Needs work · from the starting check · 26 Nov**.

**What students see (decision, F-37).** Students see their own progress on
each course (00 section 19) with the same words the tutor uses, but not all of
them:
- **Taught**, **Knows it** and **Next** are shown to the student, with the
  same icons.
- **Needs work** is tutor-only. The student sees that topic as **Taught** if it
  was ever taught in a lesson, otherwise with no mark. What to practise reaches
  the student through the lesson summary's **What to work on**, which the tutor
  writes in their own words.
- The progress line is the same: **12 of 32 topics covered**.
Spec 09 SA-08 follows this.

### CRS-08 · Review changes

One pattern for every automated status change (starting check results, lesson
summary Complete, homework marking, quiz results). A side sheet on desktop, a
full-height sheet on phones.

- Title **Review changes to the course plan** · "Nothing changes until you
  accept it."
- One row per student per topic: student avatar (in groups), topic name, the
  current chip → the proposed chip, and the source (**From Casey's starting
  check**). Rows that replace a choice made by hand carry **Replaces your choice
  from 3 Dec**.
- Each row has its own unticked checkbox. Nothing is pre-accepted (00 section
  17). **Select all** is a text button at the top, never a default.
- Buttons **Accept 4 changes** (the count follows the ticks; disabled at 0
  with **Tick the changes you want.** under it) and **Not now** (closes; the
  proposals wait, and the place that opened the sheet shows **4 changes to
  review**).
- After accepting, a toast **Course plan updated.** (no Undo; each change can
  be set back by hand, and the history shows what changed). One exception:
  pressing **Undo** on a summary's **Lesson complete.** toast withdraws every
  proposal from that summary. Accepted rows are set back, waiting rows are
  removed, and completing the summary again proposes fresh rows (08 SM-04).
- Proposals that are not accepted within 30 days are dropped, and the history
  notes **Not reviewed**.

---

## Starting check

Tutors see **Starting check**; students see **check** (00 section 5). It is
optional, always, and only offered once the plan is Active with at least one
topic. It is not a setup step (02).

### DIAG-D · Send a starting check

A standalone dialog, the same one everywhere it is opened: CRS-07, the
student's row on the course page, a student joining the course, and **Send
again** on DIAG-R.

Title **Send a starting check** · subtitle **Find out what each student already
knows before you teach it.**

- **Students:** the course's students who haven't done one, all ticked.
- **Modules to check:** checkboxes, all ticked.
- **Length:**

| Length | Topics checked (at most) | Questions | About |
|---|---|---|---|
| **Quick** | 6 | up to 12 | 10 minutes |
| **Standard** (default) | 12 | up to 24 | 20 minutes |
| **Full** | 24 (every topic in the chosen modules, up to 24) | up to 48 | 35 minutes |

  Under the choice: **Checks 12 of 32 topics.** If the chosen modules have
  fewer topics than the length allows, every topic is checked and the line says
  so: **Checks all 9 topics.**
- **Which topics:** Kanvise picks them in plan order, spread evenly across the
  chosen modules, always starting with each module's first topic (the base the
  later ones build on). **See topics** shows the list, and the tutor can swap any
  topic for another.
- Kavi line: **Kavi will write two questions for each topic. You can edit every
  question before it's sent.** Without Kavi: **Write two questions for each
  topic.** with **Write the questions**, which opens DIAG-P with two empty
  questions under each chosen topic.
- **Preview questions** (opens DIAG-P). **Send** is enabled only once the
  questions exist; until then the button reads **Preview questions** and the
  reason line says **Questions are drafted when you preview.** (without Kavi:
  **Write the questions first.**)
- **Send to** line, per student: **Casey will find it in their Kanvise app and
  by email.** For a student without an email: **Alex has no email. After
  sending, copy Alex's link or send it on WhatsApp.**

**On send:** the dialog shows each no-email student's link with **Copy** and
**WhatsApp** (prefilled: **Hi Alex, here's a short check from Michael before
your first lesson. It takes about {minutes} minutes: {link}**, where
{minutes} is the chosen length's **About** time: 10, 20 or 35), then
**Done**. Toast:
**Starting check sent to 2 students.**
**If sending fails:** an inline error in the dialog, **We couldn't send the
check. Your questions are saved. Try again.** If the dialog is closed after a
failure, the course page shows the persistent banner from CRS-03 (01 SH-08).

### DIAG-P · Preview and edit the starting check

A large dialog over DIAG-D. It is the starting check editor, with or without
Kavi. Without Kavi it opens with two empty questions under each chosen topic;
with Kavi the questions stream in. Each question uses the quiz question card
from 11 QZ-02 in its starting check mode (11 Starting check mode), so the
check is built after spec 11 (HANDOFF build order).
- Header line: **12 topics · 24 questions** (without Kavi: **12 topics · 3 of
  24 questions written**) and 👍 / 👎 (Kavi drafts only).
- Left: the question list grouped by module and topic, two questions per topic.
- Right: the selected question, editable: question text, four options, the
  correct answer, and the topic it checks. **Not sure** is added automatically
  as a fifth option and can't be edited.
- Per question: **Regenerate**, **Remove**. Removing leaves a topic with one
  question; the topic then shows **Needs 2 questions** and DIAG-D's Send stays
  disabled until it has two again (or the topic is removed from the check).
- **+ Add a question** at the end of each topic (for replacing one).
- An empty or unfinished question has an amber dot in the list, and its topic
  counts as **Needs 2 questions** until both are complete (text, four options,
  a correct answer).
- **Done** returns to DIAG-D with **24 questions ready** (or **21 of 24
  questions ready**, with Send still disabled).
- Failure states: see the Kavi block below.

### The rules

**Questions and stopping.**
- Every checked topic gets exactly two multiple-choice questions, asked one
  after the other. Each has four options plus **Not sure**.
- After the two questions on a topic:

| Answers on the topic | Result | Status proposal |
|---|---|---|
| Two correct | **Knew it** | **Knows it** |
| Two wrong or **Not sure** (in any mix) | **Didn't know it** | **Needs work** |
| One correct, one wrong or Not sure | **Not sure yet** | None (status unchanged) |

  A lucky guess on both questions has a chance of about 1 in 16, which is why
  one correct answer is never enough.
- **Dependency rule:** topics in a module are taken to build on the ones before
  them, in plan order. When a topic comes out **Didn't know it**, the later
  checked topics in the same module are skipped and marked **Skipped, builds on
  Factorising**. Skipped topics get no status proposal. The check moves on to
  the next module, so it gets shorter for a student who is further back. In
  DIAG-D a module can be marked **These topics don't build on each other**
  (under **See topics**), which turns the rule off for that module.
- Topics not in the check keep their status. The results always say how many
  were checked: **Checked 8 of 32 topics.**

**Who can take it, and how.**
- A student with an account takes it signed in, from the **Your check** card in
  their app (09) or from the email link, which goes through sign-in.
- A student without an email gets a personal check link. The link carries a
  token scoped to that student and that attempt:
  - a random token, stored only as a hash;
  - it expires 14 days after sending (shown in DIAG-R as **Link expires 10
    Dec**);
  - one active attempt per student per check; the link only opens that
    attempt;
  - re-sending makes a new token and revokes the old one at once;
  - opening is rate-limited (10 opens per hour per link; after that **Too
    many tries. Try again in an hour.**);
  - opening it on a second device resumes the same attempt where it stopped,
    with a notice at the top: **You started this check on another device.
    You're carrying on from question 7.**
  - no guest record is made: answers belong to the existing student. This is
    the ledger exception recorded in 00 section 18 (DOM-009, standard 03, SEC-007).
- Expired or revoked link: **This link has expired. Ask Michael for a new
  one.** Done already: **You've already finished this check. Thanks.**

**Sending again.** **Send again** (on DIAG-R, in **⋯**) opens DIAG-D with the
same questions preselected (they can be edited) and creates a new attempt. The
old result is kept. DIAG-R then shows the attempts side by side, so progress
can be compared.

### DIAG-S · The student takes the check

**Email** (students with an email): subject **Michael has sent you a short
check before your first lesson**. Body: what it is, that it takes about
{minutes} minutes (the chosen length's **About** time, as in DIAG-D), that it
isn't a test they pass or fail, and one button **Start the
check**.

**Check screen** (student app shell, distraction-free):
- Top: course name, a progress bar for the topics, and **Question 3**. No total,
  since skipping can shorten it.
- One question at a time, four options as large buttons, and **Not sure** as
  the fifth, styled as a quieter button, with the line **Choose Not sure rather
  than guessing.**
- **Next** after choosing. No going back.
- When the rules move on to another topic or skip topics, the student sees
  nothing different.
- **Save and finish later** keeps the answers; the app card or the same link
  resumes.

**Done:** **All done, thanks Casey.** "Michael will use this to plan your
lessons." No score and no per-topic result are shown to the student. Their
course plan (SA-08) shows any statuses only after the tutor accepts them, using
the student wording rule in the Topic status model.

### DIAG-R · The tutor reviews the results

Reached from Needs attention (03), the student's row on the course page, or
the notification (`18-notifications.md`).

- Header: **Casey's starting check** · **Algebra 1 Small Group** · **Finished 26
  Nov · 11 minutes**.
- **Summary line:** **Checked 8 of 32 topics: knew 3, didn't know 2, not sure
  yet 1, skipped 2.**
- **By topic:** each checked topic with **Knew it**, **Didn't know it**, **Not
  sure yet** or **Skipped**, and the answers as proof (expand to see each
  question, Casey's answer and the correct one).
- **Proposed changes:** the status proposals, opened with **Review changes**
  (CRS-08), plus a separate **Suggested order** card: **Put Factorising and
  Indices first?** with **Use this order** / **Not now**. Neither is applied
  without the tutor.
- **Schedule the first lesson**, prefilled with the first Needs work topic once
  accepted.
- **⋯:** **Send again**, **Copy link** (no-email students, while the link is
  valid), **Cancel this check** (revokes the link).
- **Not finished yet:** **Casey has answered 7 questions.** "Results appear when
  Casey finishes." with **Send a reminder** (email or WhatsApp).

### Kavi

**Course plan draft (CRS-06)**
- Input: subject, the description and the text area, the account's teaching
  context (02 ONB-03). Never private notes.
- Output: modules, topics and objectives, streamed into the dialog, saved as a
  Draft plan.
- Failure state: preparing: **Kavi is drafting your plan…** with **Stop**. Not
  enough to go on: **Kavi needs a bit more to go on. Add the level and the main
  topics.** (text area stays). Couldn't generate: **Kavi couldn't draft this
  plan right now. What you wrote is kept.** with **Try again** and **Start
  blank instead**.
- What the tutor must confirm: **Use this plan** on the Draft. Nothing reaches
  students before that.
- Without Kavi: **Start blank** or **Copy plan from another course**; the
  Draft with Kavi button is hidden.

**Starting check questions (DIAG-D, DIAG-P)**
- Input: the chosen topics and their objectives, subject and level. Never
  private notes, never student data.
- Output: two multiple-choice questions per topic (four options, one correct),
  shown in DIAG-P.
- Failure state: preparing: **Kavi is writing 24 questions…** with a progress
  count. Not enough to go on (a topic with no objectives and a one-word name):
  **Kavi couldn't write questions for "Revision". Add an objective or write them
  yourself.** on that topic only. Couldn't generate: **Kavi couldn't write the
  questions right now. Your choices are kept.** with **Try again** and **Write
  them myself**. A single **Regenerate** that fails leaves the old question and
  says **Couldn't regenerate. The question is unchanged.**
- What the tutor must confirm: reviewing in DIAG-P and pressing **Send**. Every
  question is shown; nothing is sent without that press.
- Without Kavi: **Write the questions** opens DIAG-P with two empty questions
  per topic; the tutor fills them in, and DIAG-D sends them the same way.

**Result proposals (DIAG-R)**
- Input: the answers and the rules above (the statuses come from the rules,
  not from Kavi). Kavi only suggests the order of the next topics.
- Output: the **Suggested order** card.
- Failure state: if Kavi is unavailable the card is not shown; the status
  proposals still work, as they don't use Kavi.
- What the tutor must confirm: **Use this order**, and each accepted row in
  CRS-08.
- Without Kavi: the status proposals and CRS-08 are the same; there is no
  Suggested order card, and the tutor orders the Next strip by hand.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|
| Create course (and trials) | Yes | Yes | No (admins create courses, standard 03) |
| Edit course and plan | Yes | Yes | Their own courses |
| Archive or delete course | Yes | Yes | No (Bobbin lets tutors delete; Kanvise keeps standard 03) |
| Set topic statuses, accept changes (CRS-08) | Yes | Yes | Their own courses |
| Send a starting check, see results | Yes | Yes | Their own courses |

## Data needed (for the build)

Tables are in `20-data-model.md`: courses DM-03, course plan DM-04, topic status DM-05, starting check DM-11.

- Course: name, subject, description, colour, trial flag, status (Active,
  Archived), tutors, students (maps onto today's programme and subject tables at
  first).
- Course plan: state (Draft, Active, Archived); modules, topics, objectives,
  order; Kavi draft and edited flags; copied-from course.
- Topic status per student per topic: status, source, confirmed by, date, why,
  replaces-manual flag; full history.
- Status proposals (for CRS-08): student, topic, proposed status, source and
  source item, created, accepted or dropped.
- Starting check: topics checked, dependency setting per module, questions
  (two per topic) with topic links; per student attempts, answers, results per
  topic, finished time.
- Check link tokens: hashed token, student, attempt, expiry, revoked, open
  count for rate limiting.

## Checked against Bobbin

- `04-courses/screenshots/page--default.png`: list header and subtitle, search,
  Filter, sample course banner, empty state wording (CRS-01, CRS-02). Bobbin's
  "Export join links" button is not copied (links live on each lesson).
- `15-tutor-role/screenshots/tutor-courses--default.png`: the list is a table
  (Course with colour mark, Tutor, Students) and tutors get no New course
  button. CRS-01 is now a table; the old card grid is gone.
- `04-courses/screenshots/new-course--step-1.png`, `new-course--step-1-filled.png`:
  CW-1 title, placeholders, 11 colour swatches, the colour line, three-part
  progress bar, Continue bottom right.
- `04-courses/screenshots/new-course--step-2-roster.png`, `new-course--step-2-selected.png`:
  CW-2 title "People", "Add students and tutors to the course.", checkbox
  rows, "1 of 1 selected", "Add a student", "Add a tutor", round back arrow.
  Difference: when onboarding said one-to-one (02 ONB-04), Kanvise opens the
  student list as a single-choice picker with **Add another student**;
  Bobbin always shows checkbox rows. The inline add-student form uses the 06
  STU-03 fields, including timezone and recording consent.
- `04-courses/screenshots/new-course--step-3-review.png`: CW-3 bordered review
  table and **Create course**.
- `04-courses/screenshots/course-created--detail.png`: course page header with
  Actions and New lesson, About, At a glance (Total lessons, Students, Tutors),
  Tutor and Student cards with Add, and the post-create plan card (CRS-06).
- `04-courses/screenshots/sample-course--summary.png`: **Loading course…**
  state.
- `04-courses/screenshots/sample-course--summary-loaded.png`, `sample-course--recheck.png`:
  Summary layout, the Course plan card with the segmented progress bar, and
  the Latest lessons table columns.
- `04-courses/screenshots/sample-course--outline.png`: module rows with number,
  chip, "6 of 6" and mini bar (CRS-04). Bobbin's green Complete chip becomes
  neutral with a tick (01 SH-15).
- `04-courses/screenshots/sample-course--lessons.png`: Lessons tab table
  (CRS-05).
- `15-tutor-role/screenshots/tutor-course-plan-describe.png`: Describe your own
  dialog wording (CRS-06).
- `15-tutor-role/screenshots/tutor-course-plan-browse.png`: the template library
  (Country, Subject, Level and Exam board filters) that Copy plan from another
  course replaces.
- `15-tutor-role/screenshots/tutor-course-actions-menu.png`,
  `tutor-course-delete-confirmation.png`: Actions menu (Edit course, Delete
  course) and the delete rule copied into the course page.

Final Bobbin pass (FEAT-009):
- `15-tutor-role/screenshots/tutor-course-edit.png`: Edit course dialog wording and Save changes (CRS-03 Actions).
- `15-tutor-role/screenshots/tutor-course-lessons-tab.png`: course Lessons tab table (Lesson, Date, Tutors, Students, Status) and Latest lessons skeleton.
- `15-tutor-role/screenshots/tutor-courses-filter.png`: Filter facets Student, Tutor, Client (Client not copied).
- `15-tutor-role/screenshots/tutor-course-add-tutor.png`: Add tutors dialog (CRS-03 Tutor card).
