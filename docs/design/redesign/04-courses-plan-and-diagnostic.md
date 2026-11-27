# 04 · Courses, the course plan and the starting check

Status: draft for owner review. Builds on `00-decisions.md` and `01-app-shell.md`.

**Who:** tutors and agency admins.
**Goal:** set up a course for one or more students in a couple of minutes, give
it a course plan, and optionally find out what the students already know.

A course pairs a student (or a small group) with a tutor over time. It holds
the course plan, lessons, homework, quizzes and resources.

## Flow at a glance

```
/courses  (CRS-01 list, CRS-02 empty)
  → New course wizard
      CW-1 Details → CW-2 Students → CW-3 Course plan → CW-4 Starting check (optional) → CW-5 Review
  → Course page /courses/:id
      Summary · Course plan · Lessons · Homework · Quizzes · Resources
  → Starting check: DIAG-S (student takes it) → DIAG-R (tutor reviews results)
```

---

## CRS-01 · Courses list

**Header:** **Courses** · "A course pairs a student with a tutor over time." ·
primary **New course**.

**Toolbar:** search **Search courses…**, and **Filter** (Tutor for admins,
Subject, Status: Active / Archived).

**List:** one card per course in a two-column grid (one column on phones).

Each card:
- colour dot and course name, for example **Algebra 1 Small Group**;
- subject and level, for example **Mathematics · High School**;
- student avatars (up to 4, then **+2**) and the tutor's name for admins;
- the plan line: **12 of 40 topics taught**, with a thin bar;
- the next lesson: **Next: Mon 10:00 AM · Solving Systems of Linear
  Equations**, or **No lesson scheduled** with a **Schedule** link.

Clicking the card opens the course page. There are no delete buttons on cards;
archiving lives in the course page's Actions menu.

**Sample course:** above the list, a slim banner **A sample course shows how
Kanvise works. It's kept out of this list.** with **Open the sample course ›**.

## CRS-02 · Empty

- Course icon in a purple circle.
- **No courses yet**
- "A course pairs a student with a tutor over time. It holds the course plan and
  everything you schedule, so create one before booking lessons."
- Button **Create a course**.

---

## New course wizard

A dialog (SH-10), 560px wide, five steps with a segmented progress bar. Step 4
is shown only when it can be used (see CW-4).

### CW-1 · Details

Title **New course** · subtitle **Name it, say what it's for and pick a colour.**

| Field | Rules | Notes |
|---|---|---|
| Course name | Required, 2–80 characters | Placeholder **e.g. Algebra 1 Small Group** |
| Subject | Required. A dropdown of the subjects from onboarding, plus **Add a subject** | Feeds Kavi and the course plan |
| Level (optional) | Free text with suggestions | Placeholder **e.g. High School** |
| Goal (optional) | Free text, up to 140 characters | Placeholder **e.g. Ready for the end-of-term test**. Line under it: **Kavi uses this when drafting the course plan and quizzes.** |
| Colour | 12 swatches, one preselected at random | Line: **Used to spot this course on the calendar and in lists.** |

**Continue** validates. Errors: **Add a course name.** · **Choose a subject.**

### CW-2 · Students

Title **Students** · subtitle **Who's on this course?**

- **Students** list with checkboxes, search at the top once there are more than
  8 students. Count on the right: **1 of 12 selected**, with **Clear**.
- **+ Add a student** under the list opens a small inline form inside the step
  (first name, last name, email optional). Saving adds and selects the student without leaving the
  wizard.
- Students without an email show a small grey **No email** chip. Hover or tap:
  **They can't sign in, but you can send them their lesson and starting check links
  yourself.**
- **One-to-one default:** selecting a second student when the account's default
  is one-to-one is allowed, with a quiet line: **This will be a group course.**
- **Agency admins** also see a **Tutor** section with one required choice (and
  **+ Add a tutor**). Independent tutors don't see it; they are the tutor.

**Continue** validates: at least one student. Error: **Choose at least one
student.** For admins also: **Choose a tutor.**

### CW-3 · Course plan

Title **Course plan** · subtitle **What will this course cover?**

Three choices, shown as selectable cards:

| Card | Detail |
|---|---|
| **Draft with Kavi** (Kavi mark) | "Describe the course and I'll draft modules, topics and objectives for you to edit." |
| **Start blank** | "Add your own modules and topics." |
| **Do this later** | "You can add a course plan from the course page." |

**Draft with Kavi chosen:**
- A text area: **What should this course cover?** Placeholder: **e.g. A 10-week
  course for two 14–15 year olds who are confident with one-variable equations
  and are moving on to systems, functions and quadratics.**
- Line under it: **Include the level, the main topics and what students should
  be able to do by the end. The more detail, the better the plan.**
- The subject, level and goal from CW-1 are already used; the text area is
  pre-filled with them as a starting sentence the tutor can edit.
- Button **Generate plan** (Kavi mark). Disabled until there are 20+ characters.
- **Generating:** the area below shows modules streaming in one by one:
  numbered module name, one-line description, and a topic count. A **Stop**
  link appears while it runs.
- **Done:** a compact preview: **8 modules · 32 topics · 96 objectives**, the
  module list, and **Regenerate**, **Edit after creating**. A line:
  **Review every module before using it with students.** 👍 / 👎 buttons on the
  preview.
- **Failed:** **Kavi couldn't draft this plan right now.** with **Try again**
  and **Start blank instead**.

**Start blank chosen:** a one-line field **First module name** (optional) and
the note **You'll add topics on the Course plan tab.**

**Continue** is always available; the plan is optional.

### CW-4 · Find out what they know (optional)

**Shown only when** the course has a plan (Kavi or blank with topics).
Otherwise the wizard goes from CW-3 to
CW-5, and the course page shows the starting check card later (CRS-06).

Title **Find out what they know** · subtitle **A short check before the first
lesson shows where to start.**

- Kavi line: **I'll write a short check from this course plan. It stops asking
  about a topic once a student clearly doesn't know it, so it stays short.**
- **Which modules?** checkboxes, all ticked by default.
- **Length:** **Quick (about 10 questions, 10 minutes)** · **Thorough (about 20
  questions, 20 minutes)**.
- **Send to:** the selected students, all ticked. Students with an email get it
  by email; for the others, Kanvise shows their personal link to copy or send on
  WhatsApp after the course is created.
- Buttons: **Preview questions** (opens DIAG-P), and the two decisions at the
  bottom: **Skip for now** (text button) and **Continue** (primary). The
  starting check is drafted on **Preview** or at creation, and sent only from
  CW-5.

### DIAG-P · Preview and edit the starting check

A large dialog over the wizard.
- Left: the question list grouped by module, each with its topic chip.
- Right: the selected question, editable: question text, four options, the
  correct answer, and the topic it checks.
- Per question: **Regenerate**, **Remove**. At the bottom: **+ Add a question**.
- Header line: **Kavi drafted 12 questions from 4 modules.** and 👍 / 👎.
- **Done** returns to CW-4 with **12 questions ready** shown.

### CW-5 · Review and create

Title **Review and create** · subtitle **Check everything before creating the
course.**

A summary list, each row with an **Edit** link back to its step:
- Name, subject, level, goal, colour swatch;
- Students (avatars and names), tutor for admins;
- Course plan: **8 modules · 32 topics**, **Blank**, or **Not yet**;
- Starting check: **12 questions to 2 students**, or **Not sending**.

Buttons:
- If a starting check is ready: **Create and send starting check** (primary) and
  **Create without sending** (secondary).
- Otherwise: **Create course**.

A line above the buttons when sending: **Casey will get an email with a link to
the check. Alex has no email, so you'll get Alex's link to send yourself. It
takes about 10 minutes.**

**On success:** the dialog closes, the course page opens, and a toast says
**Course created** (or **Course created. Starting check sent to 2 students.**).
**On failure:** the dialog stays on CW-5 with everything kept and an inline
error: **We couldn't create the course. Try again.** If the course was created
but sending failed: the course page opens and a red toast says **Course
created, but the starting check wasn't sent. Send it from the course page.**

---

## Course page `/courses/:id`

**Header:** colour dot, course name, status chip only when archived. Right:
**Actions ▾** (Edit course, Archive course, Delete course) and primary **New
lesson**.

**Facts strip:** Subject · Level · Tutor · **Next lesson: Mon 10:00 AM**.

**Tabs (underline, orange when active):** **Summary** · **Course plan** ·
**Lessons (6)** · **Homework** · **Quizzes** · **Resources**.

### CRS-03 · Summary tab

Left column:
- **About:** the goal and description, with an **Edit** pencil. Empty: **Add a
  short description so students know what this course is for.**
- **Course plan** card: **Mathematics · High School**, **8 modules · 32 topics
  · 96 objectives**, a progress bar **12 of 32 topics taught**, and the link
  **Open course plan ›**. Empty: the CW-3 choices in compact form.
- **Latest lessons:** a small table (Lesson, Date, Status) with **View all**.
  Empty: **No lessons yet.** with **New lesson**.

Right column:
- **At a glance:** Total lessons, Students, Topics taught.
- **Tutor** (with **+ Add** for admins).
- **Students:** each with an avatar, name, and a status line: **Starting check not
  sent** / **Starting check sent 2 days ago** / **Starting check done · 6 of 12** /
  **Invite not accepted**. **+ Add** opens the add-student form.

### CRS-04 · Course plan tab

- **Viewing:** a selector at the top: **Everyone** (default for groups) or one
  student. For one-to-one courses it shows that student and is fixed.
- Header line: **8 modules · 32 topics · 12 taught**, with buttons **Draft with
  Kavi** (when empty), **+ Module**, and **⋯** (Regenerate plan, Export).
- **Next** strip at the top: the next 3 topics for the selected student,
  each removable, with **Reorder** (drag).
- **Modules:** numbered rows (expandable): module name, one-line description, a
  status chip (**Not started**, **In progress**, **Complete**) and **3 of 6**
  topics taught.
- **Topics** inside a module: name, objectives (expandable list), and per
  student status chip:
  - **Knows it** (green outline): from the starting check or set by the tutor;
  - **Needs work** (amber): from the starting check or set by the tutor;
  - **Taught** (green, filled): taught in a lesson;
  - nothing: not yet taught or checked.
  Clicking a chip lets the tutor change it, with a reason line saved as a note.
- Drag to reorder modules and topics; the moved row slides and the others make
  room.
- 👍 / 👎 on Kavi-drafted modules until they've been edited.

**Empty plan:** the three CW-3 choices as cards.

### CRS-05 · Other tabs

- **Lessons:** the lessons list (spec 05) filtered to this course.
- **Homework**, **Quizzes:** lists filtered to this course with **Set
  homework** and **New quiz** (with **Generate with Kavi**). Specs 10 and 11.
- **Resources:** files attached to this course, **Add resources** (Upload or
  Choose from library). Line: **Students on this course can open these.**

### CRS-06 · Starting check card on the course page

Shown on the Summary tab, above About, while no starting check has been sent and
the course has a plan:
- Kavi mark. **Find out what your students already know.**
- "A 10-minute check shows which topics to start with, and gives you a starting
  point to show progress later."
- **Send starting check** (opens CW-4 as a standalone dialog) and ✕ (hides it; it
  comes back when a new student joins the course).

---

## DIAG-S · The student takes the starting check

**Email:** subject **Alex has sent you a short check before your first lesson**.
Body: what it is, that it takes about 10 minutes, that it isn't a test they
pass or fail, and one button **Start the check**.

**The link:** each student has their own link, sent by email or copied by the
tutor (for example into WhatsApp). Opening it identifies the student and opens
the check, with no sign-in. If the link has expired: **This link has expired.
Ask Alex for a new one.**

**Check screen (student app shell, distraction-free):**
- Top: course name, a progress bar, and **Question 3**. No total, since it adapts.
- One question at a time, four options as large buttons. **Not sure** is always
  the fifth option, so students don't guess.
- **Next** after choosing. No going back (each answer shapes the next question).
- After two wrong or "Not sure" answers on the same topic, it moves to the next
  topic. The student sees nothing different; it just moves on.
- **Save and finish later:** answers are kept and the same link resumes.

**Done:** **All done, thanks Casey.** "Alex will use this to plan your lessons."
No score is shown to the student.

## DIAG-R · The tutor reviews the results

Reached from Needs attention, the student's row on the course page, or the
notification email.

- Header: **Casey's starting check** · **Algebra 1 Small Group** · **Finished 26 Nov
  · 11 minutes**.
- **Summary line:** **Knew 6 of 10 topics.**
- **By topic:** each topic with **Knew it**, **Didn't know it** or **Not
  checked**, and the answers as proof (expand to see each question, Casey's
  answer and the correct one).
- **Kavi suggests** card:
  **"Mark 6 topics as Knows it and put Factorising and Indices first. Start
  the first lesson with Factorising?"**
  Buttons **Apply to course plan** and **Not now**. **Apply** updates the
  statuses and Next for Casey, and shows a toast with **Undo**.
- **Schedule the first lesson** button, pre-filled with the first topic that needs work.
- **Send again later** (in **⋯**): re-sends the same check, so progress can be
  compared. The results page then shows both attempts side by side.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor |
|---|---|---|---|
| Create course | Yes | Yes | No (admins create courses) |
| Edit course and plan | Yes | Yes | Their own courses |
| Delete or archive course | Yes | Yes | No (Archive only, own courses) |
| Send starting check | Yes | Yes | Their own courses |

## Data needed (for the build)

- Course (maps onto today's programme and subject tables at first).
- Course plan: modules, topics, objectives, order; Kavi draft flag.
- Per-student topic status with source (starting check, tutor, lesson) and date.
- Starting check: questions with topic links, sends, attempts, answers.
- A personal starting check link per student (also usable without an email).
