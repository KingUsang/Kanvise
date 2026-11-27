# Kanvise redesign: decisions

Status: working draft. First agreed with the owner on 27 Nov 2026; revised on
27 Nov 2026 after the critic review, with the owner's settled decisions.
Reference research: the Bobbin AppAtlas on branch `research/bobbin-appatlas`
(`scratch/bobbin-appatlas/`, including its screenshots), and Preply Lesson
Insights.

This file records what has been decided. The journey specs in this folder
build on it. If a journey spec contradicts this file, this file wins until it
is updated. Where a decision changes an Approved engineering standard or a
ledger entry, the change is listed in "Standards and ledger changes required"
below.

## 1. Who Kanvise is for

1. **Independent tutors first:** one-to-one, or small groups.
2. **Tutoring agencies second:** a team of admins and tutors. Same product, with
   team features on top.
3. **Online teaching only.** Every lesson happens in the Kanvise classroom.
   There is no in-person lesson flow and no in-person recording.
4. The tutorial-centre and bootcamp audience (priced multi-subject cohorts,
   gated enrolment pages) is the old audience and is not designed for.

## 2. Core structure

- **Course:** an ongoing teaching relationship. One subject, one or more
  students, one or more tutors. It holds the course plan, lessons, homework,
  quizzes and resources. Bobbin's definition fits: "a course pairs a student
  with a tutor over time".
- **Lesson:** one scheduled sitting of a course. Created in three steps: who is
  attending, then topic and time, then review.
- **Every lesson belongs to a course**, as in Bobbin. A trial is a short
  course. There are no one-off lessons and no lessons without a course.
- Kanvise's old Class → Subject → Session structure is replaced in the UI by
  Course → Lesson. The database can follow later; new screens may sit on the
  existing tables first.

### Words for the teaching session

- One scheduled online session is a **lesson**. That is what families book and
  pay for in one-to-one tutoring, in Nigeria (Tuteria, "lesson teachers") and in
  the UK (Tutorful, Sherpa, GoStudent), and what Bobbin and Preply use.
- **Live** is a status, not a noun: **Live now** on the dashboard, a **Live**
  chip on the lesson. The classroom is the place: **Join classroom**.
- Tutors also teach families abroad, so wording must read naturally in Nigeria,
  the UK and North America.
- Related words: **New lesson**, **Lesson summary** (written after a lesson),
  **Lesson tools** (the panel in the classroom), **Lesson plan** (the plan for
  one lesson), "₦5,000 per lesson".

## 3. Course plan (the curriculum)

- The course plan **is** the curriculum for the course. There is one name for
  it: **Course plan**.
- It is built from modules, then topics, then objectives (the specific things a
  student should be able to do).
- The tutor owns it. Kavi can draft it from a description, but never changes it
  on its own. Without Kavi the tutor starts blank or uses **Copy plan from
  another course**.
- Every student on a course follows the same course plan.

### 3a. Creating a course

- The **New course** wizard copies Bobbin's three steps: **Name and
  presentation** (name, subject, description, colour), **People** (students
  and tutors), **Review**.
- The course plan and the starting check are not wizard steps. After the course
  is created, its page shows two cards: **Build the course plan** (Draft with
  Kavi, Start blank, or **Copy plan from another course**) and, once the plan
  has at least one topic, **Send a starting check**.
- Only independent tutors and agency admins create courses (section 14c).

## 4. Personal plan

- There is no separate "learning plan" page or module.
- Each student sees the course plan with their own status on each topic:
  **Knows it**, **Needs work**, **Taught**, **Next**.
- For a one-to-one course the course plan and the personal plan are the same
  screen. For a group the topics are shared and the statuses are per student.
- Progress is tracked separately for each course. Students see their own
  progress.
- The starting check changes a student's order, emphasis and starting point. It
  never changes the curriculum itself.
- The full status model (who can set each status, which source wins, how groups
  and absences work) is written once, in spec 04. Every other spec refers to it.

## 5. Starting check

- **Name:** tutors see **Starting check**. Students see **check** ("Alex sent
  you a short check"). The word "diagnostic" is not used in the UI.
- **Purpose:** find what the student does not know, so the tutor teaches what
  matters. It also sets a starting point, so progress can be shown later by
  re-sending the same check.
- **Optional, always.** It is offered only once the course plan has at least
  one topic: as a card on the course page, and when a student is added to an
  existing course.
- Kavi drafts it from the course plan's topics. The tutor previews, edits and
  sends it. Without Kavi, the tutor writes the questions in the quiz builder
  (spec 11), one or more per topic.
- Multiple choice only, like every quiz in this version (section 8).
- It stops asking about a topic once the student has clearly missed it, which
  keeps it short. The exact length, how many topics it covers, and how many
  answers a topic needs before it counts are written in spec 04. The results
  always say which topics were checked and which were not.
- **Results:** per topic, with the questions and answers as proof. They become
  per-student topic statuses only after the tutor reviews them. Kavi may propose
  plan changes (mark known topics, put gaps first, suggest the first lesson's
  topic); the tutor accepts, edits or ignores each one.
- It can be re-sent later to show progress.
- **Access:** a student with an account takes it signed in. Each student also
  gets a personal check link that the tutor can copy, send on WhatsApp, or
  email. The link carries a student-scoped token (stored hashed, expiring,
  revocable, one student only), so no guest record is created. The token rules
  are in spec 04.

## 6. Lesson summary

- Called **Lesson summary** (as in Bobbin, Preply and today's Kanvise "recap").
  On the lesson page the tab is **Summary**; on the student page the tab is
  **Summaries**. A finished lesson's tabs follow Bobbin: **Summary**,
  **Session**, **Lesson plan**, **Notes**.
- Nothing is emailed for now. Students see the summary, the recording and any
  homework in their own app. The tutor can **Copy** the summary to share it
  anywhere (for example WhatsApp).
- Written in plain words with real examples. There is no rating or scoring
  system.
- Sections: **What we covered** (topics, which tick off on the course plan),
  **What went well**, **What to work on** (with examples), **Homework**, and
  **Private notes** (tutor side only; see "One rule for private notes").
- The tutor writes it, or uses **Draft with Kavi**, which drafts it from the
  lesson recording or from the tutor's notes. The tutor edits and completes it.
- The student sees it only after the tutor completes it.
- **No summary needed** closes a lesson without a summary (for example a
  lesson that was cut short), with an optional reason. Nothing is shown to the
  student.

## 7. Student page

- What is called the "learner model" in the adaptive-loop spec is, on screen,
  simply the student's page: their goal (free text), course plan progress per
  course, recent lesson summaries, and quiz and homework results.
- There is no self-confidence rating.
- Kavi can read it to answer questions such as "how is this student doing?",
  within the private notes rule.

## 8. Homework and quizzes

**Homework**
- **Homework is set by the tutor** (or an agency admin): from the course's
  Homework tab, from the lesson summary, or from Lesson tools in the classroom.
- Kavi can only suggest homework. **Use this** pre-fills the form; the tutor
  still edits and sets it.

**Quizzes**
- Quizzes always belong to a course and are tied to course plan topics.
- **Write my own** comes first; **Generate with Kavi** sits beside it.
- **Multiple choice only** in this version (one correct answer). There is no
  question bank.
- Standalone, public, paid and guest quizzes stay retired.

**Both:** Kavi never pre-ticks, pre-accepts or pre-scores anything (section 17).

## 9. Kavi

- Kanvise's AI is **Kavi**, already used as the voice of the product emails
  (`api/src/emails/templates/lifecycle.tsx`, `welcome.tsx`).
- One Kavi icon, used only on things Kavi does: **Draft with Kavi**, Kavi's
  summary, Kavi suggests.
- Kavi drafts; the tutor edits and owns the result. Kavi never sends anything to
  a student, and never changes the course plan, on its own.
- Honest states, never invented output: preparing, not enough to go on,
  couldn't generate.
- Kavi speaks in first person in setup, in plain adult language. No jokes or
  filler replies.
- How every spec describes Kavi, and the rules all of them follow, are in
  "Kavi in every spec" (section 17). Kavi is built last; every screen must work
  without it first.

## 10. Onboarding and setup

- Kavi asks five questions, one per screen, each skippable and changeable later
  in Settings. The questions and replies are scripted text that appears as if
  typed; there is no AI call, so onboarding works before Kavi exists. Every
  answer changes something in the product:
  1. Do you teach on your own or with a team? (team features and setup steps)
  2. Who do you mostly teach? Children and teens, adults, or both (the default
     lesson length, 45 minutes for children and teens and an hour otherwise,
     and the reading level of what Kavi writes for students)
  3. How do you usually teach? One-to-one, small groups, or both (wizard and
     lesson summary defaults)
  4. What do you teach? (Kavi's starting point for course plans and quizzes)
  5. Do you already have students? (setup starts with adding students, or with
     the sample course)
- Kavi's lines appear with a typing indicator; answers are tappable chips.
  Plain text appears instantly when the device asks for reduced motion.
- Then a setup checklist at `/setup` that fits the answers. Each step has an
  icon, a time estimate, one line explaining why, and its own button. The next
  step is marked **Next**. Progress also shows in the sidebar. Setup disappears
  when done.
- A sample course lets new users explore before adding real data, kept out of
  real lists.

## 11. Visual identity

- Copy Bobbin's structure, consistency and wording style, not its brand.
- Kanvise keeps its blue and indigo. Primary buttons are indigo, never orange.
- **Orange means "you are here"**, and only that: the active sidebar item's left
  bar, the active tab's underline, the current wizard step, today on the
  calendar. It needs its own named token ("location"; see the standards table).
- **Lesson time colours:** a blue dot means scheduled, green means live, amber
  means starting soon. These are never orange.
- Light, full-height sidebar with grouped sections. One icon and one tint per
  entity type, used everywhere that entity appears.
- Underline tabs on every detail page. This is a Kanvise choice; Bobbin uses
  pill-style tabs.
- Card radius, page gutters and page title sizes follow standard 07 (see the
  standards table).
- Login and sign-up on desktop: form on one side, image on the other. Pending
  the owner's Bobbin screenshots.

### 11a. Phones

- A bottom bar replaces the sidebar: **Today** (the dashboard), **Calendar**,
  **Lessons**, **Students**, **More**.
- **More** opens the full sidebar as a sheet, with the same groups and icons as
  desktop. There is no hamburger menu.
- Spec 16 wins on phone behaviour.

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
  "Solving Systems of Linear Equations", "Ready for the end-of-term test"),
  never tied to a specific exam board or school calendar.
- Say **Student**, not Learner, in all user-facing text. Routes and database
  names stay as they are. Standard 01 must be updated to match (see the
  standards table).
- "Tutoring account" only on the account switcher, where it literally means the
  account; everywhere else use the real name, "tutoring agency" or "your tutor".

### 13a. Words we don't use

These words do not appear in UI copy, emails or specs (except where a spec
describes the old feature being removed). Routes and database names may keep
them.

| Don't use | Use instead |
|---|---|
| `learner` | **Student** |
| `live class` | **Lesson**. "Live" is only a status; the button is **Join classroom** |
| `report` (for what a tutor writes after a lesson) | **Lesson summary**; the **Summary** tab on a lesson; **Summaries** on a student. ("Report a concern" in the classroom is a different thing and keeps its name.) |
| `observer` | **admin** (the dialog is **Join as an admin?**) |
| `parent`, `guardian` | Nothing. Kanvise has students and, for billing only, an "other contact" |
| `diagnostic` | **Starting check** (tutors), **check** (students) |
| `tutoring account` | The real name, "tutoring agency" or "your tutor" (account switcher excepted) |
| `waiting room` | Nothing. Before a lesson starts, students see a "waiting for your tutor" screen |
| `class`, `session`, `assignment` | **Lesson**, **lesson**, **Homework** |
| Exam-board names and dates | General placeholders, for example "end-of-term test" |

Kavi's lines never joke or praise for nothing ("Nice.", "Got it!"). They say
what happens next.

## 14. Billing (a proposal, on hold)

Billing is a proposal only, built after the payments hold (spec 13).

- A **Who pays?** choice on each student: **the student** or an **other
  contact** (name, email, phone). A contact, not an account. An other contact
  receives nothing automatically; they only get invoices the tutor sends.
- A rate per course: per lesson, monthly, or a prepaid package.
- Invoices built from completed lessons. The tutor reviews and sends.
- Charging for late cancellations is left out for now.
- The payer gets a link to a simple invoice page and pays through Paystack.
- Statuses: Draft, Sent, Paid, Overdue, Void.

## 14a. Students, access and links

- Students get **password accounts by invitation**, as in Bobbin. The tutor or
  admin adds the student; the student gets an email to set a password and sign
  in to their account (lessons, summaries, homework, quizzes, recordings).
  There is no student self sign-up.
- **Email is the normal case.** A student's email is optional, as in Bobbin,
  but most students will have one.
- A student without an email is a minor edge case: they get their lessons
  through join links only. They cannot see homework, quizzes, summaries or
  recordings in Kanvise until an email is added. The tutor can still Copy a
  summary and send it on WhatsApp.
- A student may have an optional **phone number**, used only for the WhatsApp
  buttons the tutor sees. Kanvise never messages it on its own.
- Every student has their **own join link** for each lesson, shown on the
  lesson page with **Copy**, **WhatsApp** and **Email**. Opening it puts that
  student into the lesson as themselves, so attendance stays accurate.
- There is no waiting room. Once the tutor has started the lesson, a student's
  link takes them straight in.
- No guest flows: share-link assignments and "Anyone with the link" lessons are
  retired.

## 14b. Admins in a tutor's lesson

- As in Bobbin: an admin who joins a lesson they don't teach is first asked
  **Join as an admin?** ("your attendance won't count toward the tutor's").
- The admin has moderator rights in the room. They can start and lead the
  lesson, shown as **Admin, leads the room**, and it never counts as the tutor
  attending. This settles DEV-ACC-004. Spec 07 has the details.

## 14c. Permissions

- **Independent tutors** can do everything in their own account.
- **Agency admins** create courses, add students and invite tutors. They see
  homework and quizzes for every course in their agency.
- **Agency tutors** cannot create courses or add students. They see and teach
  only the courses an admin gives them, and get a read-only list of the
  students on those courses (as standard 03 says).
- Students see only their own lessons, work and progress.

## 14d. Recording consent

- Copy Bobbin's consent checkbox on the student: **Recording consent already
  given**, with a line explaining it.
- A lesson is recorded only when every student in it has consent recorded.
  Otherwise it runs without a recording, and Kavi can only draft the summary
  from the tutor's notes.
- Everyone sees that a lesson is being recorded when they join.

## 14e. Classroom

- The room itself is PlugNMeet. Kanvise owns everything around it: pre-entry,
  the **Lesson tools** panel, ending the lesson and what comes after, the
  device check, and alerts.
- Lesson tools includes **Set homework**, **Add a device** (as in Bobbin),
  **Let {student} know** chips for quick messages, and **Report a concern**.
- After an automatic end (for example a power cut emptied the room), the tutor
  can restart the lesson.
- Kanvise's own slides presenter is retired. Files are shown on the PlugNMeet
  whiteboard, which accepts uploaded PDFs and slides up to 10 MB each today.

## 15. Retired and out of scope

**Retired** (removed from the product; data kept unless stated):

- Priced classes and programmes, and their public enrolment pages.
- Guest flows and share links: share-link assignments, "Anyone with the link" lessons, guest quiz attempts.
- Public recording share links (retired; students watch recordings in their app).
- The question bank and mock-exam PDF import (retired; Kavi generates questions).
- The avatar builder (retired; a profile photo upload replaces it).
- The More page, `/dashboard/more` (retired; on phones the More sheet shows the sidebar).
- Student self sign-up (retired; students join by invitation).
- Parents, entirely (retired): no parent fields, columns, contacts, emails or accounts.
- Kanvise's slides presenter (retired; replaced by the PlugNMeet whiteboard).
- Standalone, public and paid quizzes (retired already, DOM-009).

**Out of scope for now:**

- Safeguarding queues, unlinked sessions, API, webhooks and integrations.
- Report approvals (agency-only, later). Without it, a completed summary reaches
  the student straight away, with no agency review.
- Public booking page for new students (later).
- In-person lessons and in-person recording.

## 16. One rule for private notes

Private notes (on a lesson, on a lesson summary, or on a student) follow one
rule everywhere:

- They are visible **only** to the tutor who wrote them, the admins of the
  agency, and the other tutors on the same course.
- They are **never** visible to students.
- They are **never** sent to Kavi as input for anything a student will see
  (lesson summaries, homework, quizzes, checks). Kavi may use them only for
  tutor-only suggestions.

Every spec refers to this rule ("private notes rule, 00 section 16") instead of
writing its own version. The line shown beside a notes field is: **Only you,
your admins and the course's tutors can see these. Students never do.**

## 17. Kavi in every spec

Every feature spec that uses Kavi has a short `### Kavi` subsection in this
shape:

```
### Kavi
- Input: what Kavi reads (never private notes for student-facing output).
- Output: what Kavi drafts, and where it appears.
- Failure state: the honest copy shown when Kavi is preparing, has not enough
  to go on, or couldn't generate.
- What the tutor must confirm: the exact action that turns the draft into
  something real.
- Without Kavi: how the same screen works with no AI at all.
```

Rules for every spec:

- Kavi drafts only. A person confirms everything that reaches a student or
  changes a course plan.
- Kavi never pre-ticks, pre-accepts or pre-scores anything. Suggestions start
  unticked and unscored, carry a **Kavi's pick** badge, and are accepted one by
  one.
- Every screen works before Kavi exists. The **Without Kavi** line is a
  working, designed path, not an error message.
- Kavi is built last. Its service (inputs, limits, cost, failure handling) is
  described in spec 20.

## 18. Standards and ledger changes required

The redesign changes some Approved standards
(`docs/engineering/standards/`) and decision ledger entries
(`docs/engineering/DECISION_LEDGER.md`). Each row says whether the standard
is amended or the spec changes to match it. Amendments must be approved before
the matching build ticket starts.

| Standard or ledger entry | Current text (quote) | Redesign position | Action |
|---|---|---|---|
| Standard 01 terms; ledger DOM-002 | `Learner: receives tutoring and completes learning activities.` | **Student** in all user-facing text; internal names may stay | Amend standard |
| Standard 01 hierarchy; ledger DOM-005 | `Class: the main learning container`, `Subject: an area taught within a Class`, `Session: one scheduled teaching occurrence` | **Course → Lesson** in the UI; persistence renames later | Amend standard |
| Standard 01 assessments; ledger DOM-007 | `Assignment: instruction-based work submitted by a Learner for review.` | Called **Homework** | Amend standard |
| Standard 01; ledger DOM-001 | `the neutral boundary is a tutoring account` | UI says the real name or "tutoring agency"; "tutoring account" only on the account switcher | Amend standard (UI wording only) |
| Ledger DOM-008 | `Guest-capable standalone assignments are called share-link assignments.` | Share-link assignments are retired | Amend ledger (mark retired) |
| Ledger DOM-010 | `The current Quiz baseline is simple objective/MCQ only; ... adaptive/multi-subject exam modes ... are deferred.` | Quizzes and the starting check are multiple choice only (specs now match). The starting check's per-topic stop rule (stop a topic after clear misses) is a fixed rule, not an adaptive exam mode | Amend ledger: record the stop rule as an exception |
| Ledger DOM-009; standard 03 "Invitations and share links"; ledger SEC-007 | `guest Quiz attempts are retired`; tokens are `opaque hashed tokens, minimum scope` | The starting check link carries a student-scoped token for an existing student: hashed, expiring, revocable, no guest record | Amend ledger: record the exception; spec 04 states the token rules |
| Standard 03 "Dashboard page access" | `Account-wide pages are Admin-only: ... Programmes and Courses, Tutors, Learners`; `Assigned Tutors get a read-only Learner roster.` | Kept: agency tutors cannot create courses or add students; admins do | Change spec (done in 04 and 06) |
| Standard 03 "Dashboard page access" | `Notes and Assignments are Tutor capabilities. An Admin gets them only when assigned to a Course.` | Admins see homework and quizzes for every course in their agency, and private notes under the private notes rule | Amend standard |
| Standard 03 "Membership-scoped tenancy" | `not a global role or school_id stored on the person or JWT` | Remove the remaining `school_id` claim | No change to the standard; build ticket removes the claim |
| Standard 07 "Semantic visual language"; ledger UI-003 | `Brand indigo is for primary actions, selected navigation, links` | Selected navigation and active tabs use orange "you are here"; indigo stays for primary actions and links | Amend standard: add a named "location" orange token |
| Standard 07 radius tiers | `8px controls, 12px normal cards/panels, and 16px for large dialogs` | Use the standard's tiers (specs said 16px cards, 20px dialogs) | Change spec (01) |
| Standard 07 gutters; ledger UI-007 | `16px on narrow screens and 40px at desktop`; `The dashboard shell owns page gutters` | Use the standard's gutters; the shell owns them (specs said 32px, 24px, 16px) | Change spec (01) |
| Standard 07 page title | `24px mobile / 30px desktop page title` | Use the standard's sizes (specs said 24px everywhere) | Change spec (01) |
| Ledger INT-006 | `risk-based quarantine` for uploads | No virus scan for now; upload limits instead (section 19) | Amend ledger: record the deferral |

## 19. Smaller defaults accepted by the owner

- Uploads: 5 GB of storage per account and 200 uploads per day. No virus scan
  for now.
- Whiteboard files: up to 10 MB each (PlugNMeet's limit today).
- Every email has an unsubscribe link. Times in emails use the account's
  timezone.
- Invitations: at most 50 per hour per account.
- Remove the `school_id` claim.
- Students see their own progress. Progress is tracked separately per course.
- No self-confidence rating. A student's goal is free text.
- Reminders go to tutors (spec 18 lists each notification).

## Open items

Both deferred by the owner; neither blocks the journey specs.

1. Bobbin login and sign-up screenshots, from the owner.
2. Kavi icon.
