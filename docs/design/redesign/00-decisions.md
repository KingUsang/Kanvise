# Kanvise redesign: decisions so far

Status: working draft, agreed in conversation with the owner on 27 Nov 2026.
Reference research: the Bobbin AppAtlas on branch `research/bobbin-appatlas`
(`scratch/bobbin-appatlas/`), and Preply Live class Insights.

This file records what has been decided. The journey specs in this folder
build on it. If a journey spec contradicts this file, this file wins until it
is updated.

## 1. Who Kanvise is for

1. **Independent tutors first:** one-to-one, or small groups.
2. **Tutoring agencies second:** a team of admins and tutors. Same product, with
   team features on top.
3. **Online teaching only.** Every live class happens in the Kanvise classroom.
   There is no in-person live class flow and no in-person recording.
4. The tutorial-centre and bootcamp audience (priced multi-subject cohorts,
   gated enrolment pages) is the old audience and is not designed for.

## 2. Core structure

- **Course:** an ongoing teaching relationship. One subject, one or more
  students, one or more tutors. It holds the course plan, live classes, homework,
  quizzes and resources. Bobbin's definition fits: "a course pairs a student
  with a tutor over time".
- **Live class:** one scheduled sitting of a course. Created in three steps: who is
  attending, then topic and time, then review.
- Kanvise's old Class → Subject → Session structure is replaced in the UI by
  Course → Live class. The database can follow later; new screens may sit on the
  existing tables first.

### Words for the live session

- The scheduled, live online session is a **live class**. Tutors already think in
  terms of creating and joining a live class, and Nigerian tutoring platforms use
  the same words. The person teaching is a tutor, never a "lesson teacher".
- Tutors also teach families abroad, so wording must read naturally in Nigeria,
  the UK and North America. "Live class" works in all three.
- Related words: **New live class**, **Join live class**, **Live now**, **Class
  report** (written after a live class), **Class tools** (the panel in the
  classroom). **Lesson plan** keeps its usual meaning: the plan for one live
  class.

## 3. Course plan (the curriculum)

- The course plan **is** the curriculum for the course. There is one name for
  it: **Course plan**.
- It is built from modules, then topics, then objectives (the specific things a
  student should be able to do).
- The tutor owns it. Kavi can draft it from a description, but never changes it
  on its own.
- Every student on a course follows the same course plan.

## 4. Personal plan

- There is no separate "learning plan" page or module.
- Each student sees the course plan with their own status on each topic:
  **Knows it**, **Needs work**, **Taught**, **Next**.
- For a one-to-one course the course plan and the personal plan are the same
  screen. For a group the topics are shared and the statuses are per student.
- The diagnostic changes a student's order, emphasis and starting point. It
  never changes the curriculum itself.

## 5. Diagnostic

- **Purpose:** find what the student does not know, so the tutor teaches what
  matters. It also sets a starting point, so progress can be shown later by
  re-sending the same check.
- **Optional, always.**
- **Where it appears:**
  1. step 4 of the New course wizard, after the course plan exists
     ("Find out what they know"), with **Send to students** or **Skip for now**;
  2. a card on the course page while no diagnostic has been sent;
  3. when a student is added to an existing course.
- Kavi drafts it from the course plan's topics. The tutor previews and edits it
  before sending.
- It stops asking about a topic once the student has clearly missed it, which
  keeps it short. Full adaptive testing is later.
- **Results:** per topic, knew or didn't know, with the questions and answers as
  proof. Kavi proposes plan changes (mark known topics, put gaps first, suggest
  the first live class's topic). The tutor accepts, edits or ignores them.
- **Access:** no guest flow. The student already has an email, so the diagnostic
  email carries a sign-in link (passwordless) that logs them in as themselves
  and opens the test. A student without an email cannot be sent one; the button
  explains why and offers **Add email**.

## 6. Class report (observations)

- The observation is the class report, written in plain words with real
  examples. There is no rating or scoring system.
- Sections: **What we covered** (topics, which tick off on the course plan),
  **What went well**, **What to work on** (with examples), **Homework**.
- The tutor writes it, or uses **Draft with Kavi**, which writes it from the
  live class recording. The tutor edits and confirms it.
- It goes to the student only after the tutor confirms it. Parents receive it
  later.

## 7. Student page

- What is called the "learner model" in the adaptive-loop spec is, on screen,
  simply the student's page: their goal, course plan progress, recent live class
  reports, and quiz and homework results.
- Kavi can read it to answer questions such as "how is this student doing?".

## 8. Quizzes

- **Create quiz** is the default; the tutor types the questions.
- **Generate with Kavi** sits beside it. There is no question bank.
- Standalone, public, paid and guest quizzes stay retired.

## 9. Kavi

- Kanvise's AI is **Kavi**, already used as the voice of the product emails
  (`api/src/emails/templates/lifecycle.tsx`, `welcome.tsx`).
- One Kavi icon, used only on things Kavi does: **Draft with Kavi**, Kavi's
  summary, Kavi suggests.
- Kavi drafts; the tutor edits and owns the result. Kavi never sends anything to
  a student or parent, and never changes the course plan, on its own.
- Honest states, never invented output: preparing, not enough to go on,
  couldn't generate.
- Kavi speaks in first person in setup and teaching tips, matching the emails.

## 10. Onboarding and setup

- Kavi asks five questions, one per screen, each skippable and changeable later
  in Settings. Every answer must change something in the product:
  1. Do you teach on your own or with a team? (team features and setup steps)
  2. Who do you mostly teach? Children and teens, adults, or both (whether a
     parent is the default payer and contact)
  3. How do you usually teach? One-to-one, small groups, or both (wizard and
     class report defaults)
  4. What do you teach? (Kavi's starting point for course plans and quizzes)
  5. Do you already have students? (setup starts with adding students, or with
     the sample course)
- Kavi's lines appear as if typed, with a typing indicator; answers are tappable
  chips. Plain text appears instantly when the device asks for reduced motion.
- Then a setup checklist that fits the answers. Each step has an icon, a time
  estimate, one line explaining why, and its own button. The next step is
  marked **Next**. Progress also shows in the sidebar. Setup disappears when
  done.
- A sample course lets new users explore before adding real data, kept out of
  real lists.

## 11. Visual identity

- Copy Bobbin's structure, consistency and wording style, not its brand.
- Kanvise keeps its blue and indigo.
- **Orange means "you are here"**, and only that: the active sidebar item's left
  bar, the active tab's underline, the current wizard step, today on the
  calendar.
- Primary buttons are indigo, never orange.
- Underline tabs on every detail page.
- Light sidebar, grouped sections, one icon per entity type, used everywhere
  that entity appears.
- Login and sign-up on desktop: form on one side, image on the other. Pending
  the owner's Bobbin screenshots.

## 12. Motion and interaction

- Animation and interaction are designed in from the start: wizard steps slide,
  progress bars fill, setup steps tick off, course plan topics move when
  reordered, Kavi's drafts stream in, cards and buttons respond to hover and
  press, and loading uses skeletons rather than blank pages.
- Everything respects the device's reduced-motion setting.

## 13. Writing

- Plain, human wording. Every screen says what it does and what happens next.
- Creation and confirmation dialogs state consequences before the user commits.
- Examples and placeholders are general (for example "Algebra 1 Small Group",
  "Solving Systems of Linear Equations"), never tied to a specific exam board.
- Say **Student**, not Learner, in all user-facing text. Routes and database
  names stay as they are. The terminology standard must be updated to match.
- "Tutoring account" only where it literally means the account; otherwise the
  real name, "tutoring agency" or "your tutor".

## 14. Billing (designed now, built after the payments hold)

- A "Who pays?" contact on each student: the student or a parent. A contact, not
  an account.
- A rate per course: per live class, monthly, or a prepaid package.
- Invoices built from completed live classes. The tutor reviews and sends.
- Charging for late cancellations is left out for now.
- The payer gets a link to a simple invoice page and pays through Paystack.
- Statuses: Draft, Sent, Paid, Overdue, Void.

## 15. Out of scope for now

- Safeguarding queues, unlinked sessions, API, webhooks and integrations.
- Report approvals (agency-only, later).
- Public booking page for new students (later).
- Parent accounts (parents receive emails and links, no login).
- In-person live classes and in-person recording.

## Open items

Both deferred by the owner; neither blocks the journey specs.

1. Bobbin login and sign-up screenshots, from the owner.
2. Kavi icon.
