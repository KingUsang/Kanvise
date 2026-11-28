# 11 · Quizzes

Status: draft for owner review. Builds on `00-decisions.md` (§8, §14c, §17),
`04` (Topic status model, CRS-08), `09`.

**Who:** tutors and agency admins create them; students take them.
**Goal:** a short multiple-choice check of what a student knows, written in a
few minutes, taken on a phone, and marked automatically. Every question is
tied to a course plan topic, so results can feed the course plan once the
tutor accepts them.

Quizzes always belong to a course. There is no question bank: the tutor writes
questions, or Kavi drafts them for the tutor to check. Standalone, public, paid
and guest quizzes stay retired.

**Multiple choice only in this version** (one correct answer per question).
This matches the quiz baseline in ledger DOM-010 (00 section 18). Anything
beyond it is in **Later** at the end of this spec.

The starting check (04, DIAG-D to DIAG-R) is not a quiz. It has its own rules
(two questions per topic, **Not sure**, the dependency rule), its own taker
(04 DIAG-S) and its own link rules. The only thing it shares with this spec is
the question editor in QZ-02, which DIAG-D opens when the tutor writes the
check's questions without Kavi.

## Flow at a glance

```
Course › Quizzes tab › New quiz  (or /quizzes › New quiz)
  → QZ-01 How do you want to start? (Write my own · Generate with Kavi)
  → QZ-02 builder → QZ-03 settings → QZ-04 send
  → Students take it (QZ-05, student app)
  → QZ-06 results → 04 CRS-08 Review changes
```

---

## QZ-01 · Start

A dialog. Title **New quiz** · subtitle **A short multiple-choice check for
Algebra 1 Small Group.** The course is fixed when opened from a course; from
`/quizzes` the first field is **Course** (required).

Two choice cards side by side, **Write my own** first:
- **Write my own:** "Start with an empty quiz and add your questions."
- **Generate with Kavi** (Kavi mark): "Pick topics from the course plan and
  Kavi drafts the questions. You check every one before sending."

**Write my own** opens the builder (QZ-02) with one empty question.

**Generate with Kavi:**
- **Topics:** the course plan as a tick-list (modules expandable). The topics
  taught in the last two lessons are ticked to start with. This is a Kanvise
  default from the lesson record, not a Kavi choice, and it never sets a
  status. If the course has no plan: **This course has no plan yet. Add one on
  the course page, or write your own questions.** with **Write my own** (a quiz
  question must have a topic).
- **How many questions?** **5** (default) · **10** · **15**.
- **Difficulty:** **Easier** · **Mixed** (default) · **Harder**.
- Button **Generate quiz** (Kavi mark). The builder opens and questions appear
  one by one.
- Failure states: see the Kavi block.

## QZ-02 · Builder

Full page. Header: quiz title (editable inline, defaulting to the first topic,
for example **Simultaneous equations check**), **Draft** chip, **Saved**
indicator, primary **Continue**.

- **Left:** the list of questions (drag to reorder), each showing its number,
  the first line of the question, its topic chip, and an amber dot when
  something is missing.
- **Right:** the selected question:
  - **Question** (bold, italic, lists, and an image upload for diagrams; images
    follow the upload limits table in `15-resources.md`);
  - **Options:** 2 to 6, four to start with, one marked **Correct** (radio);
    **+ Add an option**;
  - **Topic:** a course plan topic picker (required, so results can feed the
    plan);
  - **Explanation (optional):** shown to the student after the quiz.
- Every question is worth one mark.
- Per question: **Duplicate**, **Delete**, and **Regenerate** on questions
  Kavi drafted.
- At the bottom of the list: **+ Add a question**, and **Add 5 more with
  Kavi** (only once Kavi exists).
- Questions Kavi drafted carry a small **Kavi** label until the tutor edits or
  ticks **Checked**. The header shows **Check Kavi's questions before sending.
  Kavi can get things wrong.** with 👍 / 👎, while any labelled question is left.

**Validation on Continue:** each question needs text, at least two options, a
correct option and a topic. Problems are marked in the list and the first one
opens: **Choose the correct answer.** · **Add at least two options.** ·
**Choose a topic for this question.**

## QZ-03 · Settings

A side panel over the builder:
- **Students:** the course's students, all ticked. A student without an email
  is listed unticked and can't be ticked, with the line **Casey has no email,
  so can't take quizzes in Kanvise. Add an email on Casey's page.** (00
  section 14a).
- **Due:** optional date-time. **No due date** by default. Line: **Shown in
  each student's timezone.**
- **After they finish, show:** **Score and correct answers** (default) ·
  **Score only**.
- **Shuffle the order of the options** (on). Question order stays as built.

Each student takes the quiz once.

## QZ-04 · Send

**Review** shows the question count, topics covered, students, due date and
what students see after. Button **Send to students**. A line: **Students get a
notification in their app.** Toast: **Quiz sent to 3 students.**

**Save as draft** keeps it on the course's Quizzes tab, unsent.

**If sending fails:** **We couldn't send the quiz. It's saved as a draft. Try
again.** inline in the panel.

## QZ-05 · Taking a quiz (student)

From Home › To do, or the course's Quizzes tab (09 SA-08).
- **Start screen:** title, tutor, number of questions, due date. **Start quiz**.
- **One question per screen** on phones and desktop, with a progress bar and
  **Question 3 of 10**. Options are large tap targets.
- **Next** and **Back**.
- Answers save as soon as they're chosen, so a dropped connection loses
  nothing. Offline: **You're offline. Your answers are saved and will send when
  you're back.**
- **Finish:** a check screen listing unanswered questions (tap one to go back),
  then **Hand in**. Confirmation: **Hand in your quiz? You can't change your
  answers after this.**
- **Result** (per the setting): **You got 7 out of 10**, then (with Score and
  correct answers) each question with their answer, the correct answer and the
  explanation. Students never see topic statuses here; their course plan
  changes only after the tutor accepts changes (04, What students see).

## QZ-06 · Results (tutor)

The quiz page `/quizzes/:id`:
- Header: title, status (**Draft**, **Sent**, **Closed**), **⋯** (Edit wording,
  Close, Duplicate, Delete).
- **Summary:** **3 of 3 done** · average score.
- **By student:** name, score, status (**Not started**, **In progress**,
  **Done**). Tapping opens that student's answers.
- **By topic:** each topic with the share of correct answers across students,
  for example **Elimination: 2 of 6 correct**. Weak topics are highlighted
  amber.
- **Changes to the course plan:** when students finish, Kanvise makes status
  proposals with the quiz rule of the Topic status model (04): **Knows it**
  when a student got every question on the topic right (at least two
  questions), **Needs work** when they got half or fewer right. A card shows
  **4 changes to review** with **Review changes**, which opens 04 CRS-08. Every
  row starts unticked; nothing changes until the tutor accepts it.
- **Suggestion** card (rule-based, titled **Kavi suggests** with a **Kavi's
  pick** badge once Kavi exists): **Most students missed Elimination. Make it
  Next?** with **Make it Next** (the tutor's own change, as on the Next strip)
  and **Not now**.

**Editing a sent quiz:** only wording and explanations (**Edit wording**).
Correct answers, options and topics are locked once anyone has started:
**Students have started this quiz. To change answers, duplicate it and send the
copy.**

## Lists

- **Course › Quizzes tab:** drafts and sent quizzes, **New quiz**.
- **/quizzes:** all quizzes across the courses the person can see, tabs
  **Sent** · **Drafts** · **Closed**, primary **New quiz**.
- Empty: question-mark icon, **No quizzes yet.** "Write a short check, or let
  Kavi draft one from your course plan." **New quiz**. Without Kavi the line is
  "Write a short check of what your students know."

### Kavi

- Input: the ticked topics and their objectives, the course subject, the level
  scheme and reading level (12 CFG-K, CFG-T), the number of questions and the
  difficulty. Never private notes (00 section 16), never student names or
  answers.
- Output: multiple-choice questions (four options, one correct, a topic and a
  short explanation each), shown in the builder with the **Kavi** label.
- Failure state: preparing: **Kavi is writing 5 questions…** with a count and
  **Stop**. Not enough to go on (a topic with no objectives and a one-word
  name): **Kavi couldn't write a question for "Revision". Add an objective or
  write it yourself.** on that topic only. Couldn't generate: **Kavi couldn't
  write this quiz right now. Your choices are kept.** with **Try again** and
  **Write my own instead**. A failed **Regenerate** leaves the question as it
  was: **Couldn't regenerate. The question is unchanged.**
- What the tutor must confirm: checking the questions in the builder and
  pressing **Send to students**. Kavi never marks answers or sets statuses;
  marking is automatic from the correct option, and statuses change only in
  CRS-08.
- Without Kavi: the **Generate with Kavi** card, **Add 5 more with Kavi** and
  **Regenerate** are hidden. **Write my own** is the only start, and the rest
  of the spec works the same.

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor | Student |
|---|---|---|---|---|
| Create, edit, send, close | Yes | Any course in the agency (00 section 14c) | Their courses | No |
| See results | Yes | Any course in the agency | Their courses | Their own |
| Accept course plan changes (CRS-08) | Yes | Yes | Their courses | No |
| Take | No | No | No | Yes, with an account |

## Data needed (for the build)

Tables are in `20-data-model.md`: quizzes DM-13, topic status proposals DM-05.

- Quiz: course, title, status, questions (text, image, options, correct
  option, topic, explanation, Kavi-drafted and checked flags), settings
  (students, due, what to show, shuffle options). Today's versioned mock and
  attempt tables cover much of this; versioning is not used by the UI, and the
  question bank tables are no longer used.
- Attempts (one per student per quiz) with saved answers and score.
- Topic results per student feeding status proposals for CRS-08 (04 Data
  needed).
- Kavi generation from course plan topics (20 DM-23 streaming, DM-28 tables).

## Later

Not in this version (ledger DOM-010 baseline). Each needs an owner decision
before it is designed:
- Short-answer and written questions, and any marking by the tutor or Kavi.
- Time limits and automatic submit.
- More than one attempt.
- Flag for later.
- Marks other than one per question.
- Versions of a sent quiz.
- Import from a file.

## Checked against Bobbin

Bobbin has no quizzes in the atlas, so the quiz screens are Kanvise's own. The
parts that copy Bobbin patterns were checked against:
- `15-tutor-role/screenshots/tutor-course-set-homework.png`: dialog shape,
  title and subtitle line, optional labels, Cancel and primary bottom right
  (QZ-01, QZ-03).
- `15-tutor-role/screenshots/tutor-course-homework-settled.png`: the course
  tab empty state shape (icon, title, one line, one button) used for the
  Quizzes tab.
- `14-settings/screenshots/settings-ai-style-compare.png`: Bobbin labels AI
  output and asks for a choice before use; Kanvise's **Kavi** label and
  **Check Kavi's questions** line follow the same idea.

Final Bobbin pass (FEAT-009):
- `11-report-approvals/screenshots/report-approvals--populated.png`: Bobbin's review queue (list on the left, one item with Previous / Next and Approve); not copied, Kanvise has no approvals, and quiz results open 04 CRS-08 instead.
- `15-tutor-role/screenshots/tutor-course-set-homework.png` (rechecked): Bobbin has no quiz dialog; QZ dialogs follow the homework dialog's field order and Cancel / primary buttons.
