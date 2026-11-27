# Kanvise redesign: decisions so far

Status: working draft, agreed in conversation with the owner on 27 Nov 2026.
Reference research: the Bobbin AppAtlas on branch `research/bobbin-appatlas`
(`scratch/bobbin-appatlas/`), and Preply Lesson Insights.

This file records what has been decided. The journey specs in this folder
build on it. If a journey spec contradicts this file, this file wins until it
is updated.

## 1. Who Kanvise is for

1. **Independent tutors first:** one-to-one, or small groups.
2. **Tutoring agencies second:** a team of admins and tutors. Same product, with
   team features on top.
3. The tutorial-centre and bootcamp audience (priced multi-subject cohorts,
   gated enrolment pages) is the old audience and is not designed for.

## 2. Core structure

- **Course:** an ongoing teaching relationship. One subject, one or more
  learners, one or more tutors. It holds the course plan, lessons, homework,
  quizzes and resources. Bobbin's definition fits: "a course pairs a student
  with a tutor over time".
- **Lesson:** one scheduled sitting of a course. Created in three steps: who is
  attending, then topic and time, then review.
- Kanvise's old Class → Subject → Session structure is replaced in the UI by
  Course → Lesson. The database can follow later; new screens may sit on the
  existing tables first.

## 3. Course plan (the curriculum)

- The course plan **is** the curriculum for the course. There is one name for
  it: **Course plan**.
- It is built from modules, then topics, then objectives (the specific things a
  learner should be able to do).
- The tutor owns it. Kavi can draft it from a description, but never changes it
  on its own.
- Every learner on a course follows the same course plan.

## 4. Personal plan

- There is no separate "learning plan" page or module.
- Each learner sees the course plan with their own status on each topic:
  **Already knows**, **Gap**, **Covered**, **Up next**.
- For a one-to-one course the course plan and the personal plan are the same
  screen. For a group the topics are shared and the statuses are per learner.
- The diagnostic changes a learner's order, emphasis and starting point. It
  never changes the curriculum itself.

## 5. Diagnostic

- **Purpose:** find what the learner does not know, so the tutor teaches what
  matters. It also sets a starting point, so progress can be shown later by
  re-sending the same check.
- **Optional, always.**
- **Where it appears:**
  1. step 4 of the New course wizard, after the course plan exists
     ("Find out what they know"), with **Send to learners** or **Skip for now**;
  2. a card on the course page while no diagnostic has been sent;
  3. when a learner is added to an existing course.
- Kavi drafts it from the course plan's topics. The tutor previews and edits it
  before sending.
- It stops asking about a topic once the learner has clearly missed it, which
  keeps it short. Full adaptive testing is later.
- **Results:** per topic, knew or didn't know, with the questions and answers as
  proof. Kavi proposes plan changes (mark known topics, put gaps first, suggest
  the first lesson's topic). The tutor accepts, edits or ignores them.
- **Access:** no guest flow. The learner already has an email, so the diagnostic
  email carries a sign-in link (passwordless) that logs them in as themselves
  and opens the test. A learner without an email cannot be sent one; the button
  explains why and offers **Add email**.

## 6. Lesson report (observations)

- The observation is the lesson report, written in plain words with real
  examples. There is no rating or scoring system.
- Sections: **What we covered** (topics, which tick off on the course plan),
  **What went well**, **What to work on** (with examples), **Homework**.
- The tutor writes it, or uses **Draft with Kavi**, which writes it from the
  lesson recording. The tutor edits and confirms it.
- It goes to the learner only after the tutor confirms it. Parents receive it
  later.

## 7. Learner page

- What is called the "learner model" in the adaptive-loop spec is, on screen,
  simply the learner's page: their goal, course plan progress, recent lesson
  reports, and quiz and homework results.
- Kavi can read it to answer questions such as "how is this learner doing?".

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
  a learner or parent, and never changes the course plan, on its own.
- Honest states, never invented output: preparing, not enough to go on,
  couldn't generate.
- Kavi speaks in first person in setup and teaching tips, matching the emails.

## 10. Onboarding and setup

- Kavi opens with two questions: teach alone or with a team, and what they
  teach.
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

## 12. Writing

- Plain, human wording. Every screen says what it does and what happens next.
- Creation and confirmation dialogs state consequences before the user commits.
- Examples and placeholders are general (for example "Algebra 1 Small Group",
  "Solving Systems of Linear Equations"), never tied to a specific exam board.
- "Tutoring account" only where it literally means the account; otherwise the
  real name, "tutoring agency" or "your tutor".

## 13. Billing (designed now, built after the payments hold)

- A "Who pays?" contact on each learner: the learner or a parent. A contact, not
  an account.
- A rate per course: per lesson, monthly, or a prepaid package.
- Invoices built from completed lessons, including "cancelled (chargeable)".
  The tutor reviews and sends.
- The payer gets a link to a simple invoice page and pays through Paystack.
- Statuses: Draft, Sent, Paid, Overdue, Void.

## 14. Out of scope for now

- Safeguarding queues, unlinked sessions, API, webhooks and integrations.
- Report approvals (agency-only, later).
- Public booking page for new learners (later).
- Parent accounts (parents receive emails and links, no login).

## Open items

1. Bobbin login and sign-up screenshots, from the owner.
2. Kavi icon: an SVG drawn for Kanvise, or the owner's own artwork.
