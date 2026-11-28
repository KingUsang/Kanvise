# Kavi: what it does

Written 28 Nov 2026 for everyone on the team. The engineer's brief is in
`engineer-brief.md`. The detailed specs are in `docs/design/redesign/`.

Kavi is the AI assistant inside Kanvise. It helps tutors with the writing and
planning that usually eats their evenings: a course plan, a lesson summary, quiz
questions, homework. It only ever drafts. A tutor reads what Kavi wrote, changes it
if they want, and confirms it. Nothing reaches a student, and no record changes,
until the tutor does that. Students never use Kavi.

## Where a tutor meets Kavi

| When | What Kavi drafts | What the tutor does |
|---|---|---|
| Starting a course | A course plan: modules, topics and objectives | Reviews it, then presses **Use this plan** |
| Tidying a plan | New wording for modules nobody has used yet | Picks **Replace** or **Keep** for each module |
| Before a first lesson | Two multiple-choice questions per topic for the starting check | Edits them, then sends |
| After a check | A suggested order for the next topics | Accepts or ignores it |
| Planning a lesson | A lesson plan that only the tutor sees | Keeps it or writes their own |
| After a lesson | A summary draft, made from the recording or from the tutor's private lesson notes | Edits it, then presses **Complete** |
| Setting homework | A suggested title and instructions | Uses it or ignores it |
| Marking homework | A feedback draft. The mark is always the tutor's | Edits it, then saves |
| Making a quiz | Multiple-choice questions, labelled until the tutor has checked them | Checks each one, then sends |
| On a student's page | An answer to a question such as "How is Casey doing?", with links to what it used, and suggestion cards | Reads it and decides |
| On the dashboard | Extra suggestion cards after the fixed-rule cards, such as a topic that keeps coming up | Presses **Use this** or **Not now** |

That is twelve things in all. Two small pieces support them: a settings screen
(writing style, level names, three on/off switches) and a "your draft is ready"
notification.

### More about the dashboard

The dashboard already has a **Suggestions** area with up to three cards. Today they
come from fixed rules and no AI. For example: "Factorising has been Needs work for
Casey in the last two lessons. Make it the topic of Monday's lesson?" Kavi adds more
cards after those, with a small Kavi mark and a "Kavi's pick" badge, still three in
total. The layout doesn't change. Only the title changes, from **Suggestions** to
**Kavi suggests**. If Kavi fails, its cards simply don't appear and the fixed-rule
cards stay. Nothing happens until the tutor presses **Use this**.

## The three kinds of writing

These are easy to mix up.

| | Who writes it | Who sees it | Does Kavi read it? |
|---|---|---|---|
| **Lesson summary** | The tutor, or Kavi drafts it and the tutor edits. Four parts for students: What we covered, What went well, What to work on, Homework | The student sees it after the tutor presses **Complete** | Kavi **writes** a draft of it |
| **Private lesson notes** | The tutor, for one lesson, jotted in the classroom or on the lesson page. They sit at the bottom of the summary editor as a tutor-only section | Only the tutor, the agency's admins and the other tutors on that course. Never the student | Only to draft **that lesson's summary**, and only when the tutor presses **Draft with Kavi** |
| **Private notes about a student** (the spec calls them *student notes*) | The tutor, about a student overall, on that student's page, for example "gets anxious before tests" | Same people as lesson notes. Never the student | **Never**, for any feature |

## What Kavi never does

- It never changes anything by itself. Nothing is pre-ticked, pre-accepted or
  pre-scored.
- It never reads the private notes about a student.
- It reads private lesson notes only to draft that lesson's summary, on the tutor's
  request.
- It never turns a recording into text unless every student on the lesson consented
  and the recording runs five minutes or more.
- It never mixes one tutoring account's data into another's.

## If Kavi is off or fails

Every screen has a normal way to do the same job by hand: a blank course plan, an
empty summary editor, writing your own quiz questions. Kavi saves time. It is never
the only way. That is also why the screens can be built first and Kavi attached to
them afterwards.

## Not part of Kavi

- The questions Kavi asks during sign-up. They are fixed text with no AI behind them.
- Anything live in the classroom.
- Anything students use.
- Automatic safeguarding flags.
