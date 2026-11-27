# 11 · Quizzes

Status: draft for owner review. Builds on `00-decisions.md` (§8), `04`, `09`.

**Who:** tutors and agency admins create them; students take them.
**Goal:** a short check of what a student knows, created in a minute (usually
by Kavi), taken on a phone, and marked automatically. Every question is tied to
a course plan topic, so results update the plan.

Quizzes always belong to a course. There is no question bank: the tutor types
questions or Kavi generates them. Standalone, public, paid and guest quizzes
stay retired. The diagnostic (spec 04) is a special quiz and reuses this
builder.

Question types in this version: **multiple choice** (one correct answer) and
**short answer** (marked by the tutor, with Kavi's help). Theory/essay marking,
timed exam modes and file import are later.

## Flow at a glance

```
Course › Quizzes tab › New quiz  (or /quizzes › New quiz)
  → QZ-01 How do you want to start? (Generate with Kavi · Write my own)
  → QZ-02 builder → QZ-03 settings → QZ-04 send
  → Students take it (QZ-05, student app)
  → QZ-06 results · QZ-07 marking short answers
```

---

## QZ-01 · Start

A dialog. Title **New quiz** · subtitle **A short check of what your students
know.**

Two choice cards:
- **Generate with Kavi** (Kavi mark): "Pick topics from the course plan and I'll
  write the questions. You check them before sending."
- **Write my own:** "Start with an empty quiz."

**Generate with Kavi:**
- **Topics:** the course plan as a tick-list (modules expandable). Pre-ticked:
  the topics taught in the last two lessons. If the course has no plan, a text
  box: **What should the quiz cover?** Placeholder **e.g. Solving simultaneous
  equations by substitution and elimination.**
- **How many questions?** **5** · **10** · **15**.
- **Difficulty:** **Easier** · **Mixed** (default) · **Harder**.
- **Question types:** **Multiple choice only** (default) · **Include short
  answers**.
- Button **Generate quiz** (Kavi mark). Questions stream into the builder.
- Failed: **Kavi couldn't write this quiz right now.** with **Try again** and
  **Write my own instead**.

## QZ-02 · Builder

Full page. Header: quiz title (editable inline, defaulting to the first topic,
e.g. **Linear equations check**), **Draft** chip, **Saved** indicator, primary
**Continue**.

- **Left:** the list of questions (drag to reorder), each showing its number,
  the first line of the question, its topic chip, and a dot when something is
  missing.
- **Right:** the selected question:
  - **Question** (rich text, with an image upload for diagrams);
  - **Type:** **Multiple choice** · **Short answer**;
  - **Multiple choice:** 2–6 options, one marked **Correct** (radio); **+ Add an
    option**;
  - **Short answer:** **Model answer** (shown to the tutor when marking, and to
    the student after marking);
  - **Topic:** a course plan topic picker (required, so results can update the
    plan);
  - **Marks:** default 1;
  - **Explanation (optional):** shown to the student after the quiz.
- Per question: **Regenerate** (Kavi mark, for Kavi questions), **Duplicate**,
  **Delete**.
- At the bottom of the list: **+ Add a question** and **Add 5 more with Kavi**.
- Kavi-written questions carry a small **Kavi** label until edited, and the
  header shows **Check Kavi's questions before sending. It can get things
  wrong.** with 👍 / 👎.

**Validation on Continue:** each question needs text, a topic, and (multiple
choice) a correct option. Problems are marked in the list and the first one is
opened: **Choose the correct answer.** · **Choose a topic for this question.**

## QZ-03 · Settings

A dialog or side panel:
- **Students:** all on the course, ticked.
- **Due:** optional date-time. **No due date** by default.
- **Time limit:** **No limit** (default) · **10 / 20 / 30 / 45 / 60 min**.
- **Attempts:** **1** (default) · **2** · **Unlimited**.
- **After they finish, show:** **Score and correct answers** (default) · **Score
  only** · **Nothing until I've marked it** (forced when there are short
  answers).
- **Shuffle questions** and **Shuffle answer options** (both on).

## QZ-04 · Send

**Review** shows the question count, topics covered, students, due date and
settings. Button **Send to students**. A line: **Students get a notification in
their app.** Toast: **Quiz sent to 3 students.**

**Save as draft** keeps it on the course's Quizzes tab, unsent.

## QZ-05 · Taking a quiz (student)

From Home → To do, or the course's Quizzes tab.
- **Start screen:** title, tutor, number of questions, time limit (if any),
  attempts, due date. **Start quiz**.
- **One question per screen** on phones (a list on desktop is optional later),
  with a progress bar and **Question 3 of 10**. Options are large tap targets.
- **Next** and **Back**; **Flag for later** marks a question to return to.
- Answers save as soon as they're chosen, so a dropped connection loses nothing.
  If offline: **You're offline. Your answers are saved and will send when you're
  back.**
- With a time limit: a timer in the header, a warning at 1 minute, and
  automatic submit at 0 (**Time's up. Your answers have been sent.**).
- **Finish:** a check screen listing unanswered and flagged questions, then
  **Hand in**. Confirmation: **Hand in your quiz? You can't change your answers
  after this.**
- **Result** (per the setting): **You got 7 out of 10**, then each question with
  their answer, the correct answer and the explanation. With short answers:
  **Alex will mark your written answers soon.**

## QZ-06 · Results (tutor)

The quiz page `/quizzes/:id`:
- Header: title, status (**Draft**, **Sent**, **Closed**), **⋯** (Edit, Close,
  Duplicate, Delete).
- **Summary:** **3 of 3 done** · average score · time taken.
- **By student:** name, score, time, status (**Not started**, **In progress**,
  **Done**, **To mark**). Tapping opens that student's answers.
- **By topic:** each topic with the share of correct answers across students,
  for example **Elimination: 2 of 6 correct**. Weak topics are highlighted.
- **Kavi suggests** card when a pattern shows: **"Most students missed
  elimination with negative terms. Cover it next lesson?"** with **Use this**
  (sets it as **Next** on the course plan) and **Not now**.
- Results update the course plan: a topic answered correctly can be marked
  **Knows it**, and a missed one **Needs work**. The tutor confirms with
  **Update course plan** (a summary of the changes first); nothing changes on
  its own.

**Editing a sent quiz:** allowed only for wording and explanations. Changing
correct answers or adding questions after anyone has started asks to create a
new version.

## QZ-07 · Marking short answers

- **To mark** opens a page per question: each student's answer beside the
  model answer.
- **Correct** · **Partly** (half marks) · **Wrong**, plus optional feedback.
- **Draft with Kavi** proposes a mark and feedback for each answer, labelled
  until the tutor confirms.
- **Save and next.** When all are marked, students see their final result and
  get a notification: **Your quiz was marked: 8/10.**

## Lists

- **Course › Quizzes tab:** drafts and sent quizzes, **New quiz**.
- **/quizzes:** all quizzes across courses, tabs **To mark** · **All** ·
  **Drafts**, primary **New quiz**.
- Empty: question-mark icon, **No quizzes yet.** "Kavi can write one from your
  course plan in seconds." **New quiz**.

## Permissions

| Action | Tutor | Agency admin | Student |
|---|---|---|---|
| Create, edit, send, mark | Their courses | Any course | No |
| See results | Their courses | Any course | Their own |
| Take | No | No | Yes |

## Data needed (for the build)

- Quiz: course, questions (type, options, correct answer, model answer, topic,
  marks, explanation), settings, versions. (Today's versioned mock and attempt
  tables cover much of this; the question bank tables are no longer used.)
- Attempts with saved answers, timing and marks.
- Topic-level results feeding the course plan on tutor confirmation.
- Kavi generation from course plan topics or a description.
