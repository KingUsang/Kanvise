# Product domain and terminology

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This document defines the product concepts and language used by new Kanvise
work. Legacy implementation names do not redefine the product model.

## Approved amendment: redesign wording (2026-11-28)

**Status of this amendment:** Approved by the owner on 28 Nov 2026, with
redesign build step 1 (branch `redesign/01-app-shell`).

**Source:** `docs/design/redesign/00-decisions.md` section 18 (standards and
ledger changes), sections 2 and 13a. Ledger rows: DOM-001, DOM-002, DOM-005
and DOM-007.

**What changes:** user-facing text (UI copy, emails, notifications and
product docs) uses the redesign terms below. Routes, API fields, types,
database tables and columns keep their current names until a separately
approved, migration-safe change renames them. Engineering text may keep the
old terms where it describes internal names.

| Old product term | User-facing term |
|---|---|
| Learner | **Student** |
| Class, Subject, Session | **Course** (one subject, its students and tutors) and **Lesson** (one scheduled sitting of a course) |
| Assignment | **Homework** |
| Quiz | **Quiz** (unchanged) |
| Report written after a lesson | **Lesson summary** |
| Tutoring account | The real account name, "tutoring agency" or "your tutor". "Tutoring account" appears only on the account switcher |

Sections below that still say Learner, Class, Subject, Session or Assignment
describe the engineering model. Map them to the user-facing terms with this
table.

## Customers and account boundary

Kanvise serves two customer types:

- **Independent Tutor:** a tutor operating their own tutoring account.
- **Tutoring Agency:** an account operated by a team of administrators and
  tutors.

Use **tutoring account** when one neutral product or engineering term is
required. Use **tenant** only when discussing data isolation and security. Do
not introduce `tutorial centre`, `tutoring centre`, `school`, `organisation`,
or `tutoring business` into new customer-facing language.

### User-facing copy

Keep "tutoring account" out of customer-facing text. Choose wording by context:

1. Use the real name when the code has it (`school.name`, account name, tutor name).
2. Use "tutoring agency" in agency-only or agency-general contexts: sign-up,
   setup, invitations from an agency, agency-only admin pages.
3. Use "your tutor" in learner-facing text.
4. Use neutral wording ("your learners", "your classes") on owner pages that
   both Independent Tutors and agency Admins see.

Approved amendment (2026-11-28, see the top of this document): in items 3
and 4, read "student-facing", "your students" and "your courses". In the UI,
"tutoring account" appears only on the account switcher, where it literally
means the account.

"Tutoring account" stays only in the account picker and switcher, the
`/account/select` title, API account-context errors (`ACCOUNT_CONTEXT_REQUIRED`,
`ACCOUNT_ACCESS_DENIED`, `ACCOUNT_SELECTION_REQUIRED` and similar), the PWA
manifest, code comments, and engineering docs.

Existing persistence names such as `schools`, `school_id`, and `centre` are
legacy implementation details. They remain until a separately approved,
migration-safe change replaces them.

## People, membership, and capabilities

The product roles are:

- **Admin:** manages a tutoring account and may also teach.
- **Tutor:** teaches within a tutoring account according to their assignments.
- **Learner:** receives tutoring and completes learning activities. Approved
  amendment (2026-11-28): user-facing text calls this role **Student**.
  Internal names such as the `learner` role value may stay.

Teaching is a capability, not a mutually exclusive identity. An Admin can
also have Tutor capability.

A person may participate in more than one tutoring account. Role and access
must be evaluated for the active account membership rather than treated as a
permanent global identity. The active-account selection and authorization
mechanism will be specified in the authentication and tenancy standard.

`super_admin` is not a Kanvise product role. Future internal support tooling
must use separately designed, auditable capabilities rather than tenant role
escalation.

## Teaching structure

- **Class:** the main learning container and learner group.
- **Subject:** an area taught within a Class.
- **Session:** one scheduled teaching occurrence for a Class and Subject.

New product surfaces must use these terms. The persistence model may continue
to use `programme`, `course`, and `live_class` behind an explicit adapter until
their migration is approved.

Approved amendment (2026-11-28): in the UI, Class, Subject and Session are
replaced by **Course** and **Lesson**:

- **Course:** an ongoing teaching relationship with one subject, one or more
  students and one or more tutors. It holds the course plan, lessons,
  homework, quizzes and resources.
- **Lesson:** one scheduled sitting of a course. Every lesson belongs to a
  course.

"Live" is a status, not a noun; the classroom button is **Join classroom**.
New screens may sit on the existing tables first. Persistence renames come
later through approved, migration-safe changes.

Every Class has one of two participation modes:

- **One-to-one:** no more than one active Learner.
- **Group:** may contain multiple active Learners.

New Classes default to One-to-one. A One-to-one Class may become Group. A
Group Class may become One-to-one only when it has at most one active Learner.
Learner-limit enforcement belongs at the authoritative API transaction
boundary initially; the database standard will decide whether an additional
database invariant is justified.

Tutor assignments and Learner membership are separate relationships. A
Session may reference its assigned Tutor and Subject without creating a new,
special tutor–learner relationship entity.

## Learning activities

**Assessments** is the product section containing:

- **Quiz:** simple objective/MCQ work inside a tutoring workspace. It may be
  timed, scheduled, subject-based, or attempt-limited.
- **Assignment:** instruction-based work submitted by a Learner for review.
  Approved amendment (2026-11-28): user-facing text calls this **Homework**.
  Internal names such as `assignments` may stay.

`Mock`, `mock exam`, and `mock examination` are not product concepts. An
exam-preparation or JAMB activity is a Quiz configured for that purpose, not a
separate domain type.

Quizzes are workspace learning activities. They are created inside a tutoring
account and assigned to authenticated Learners through their Classes/Subjects
and current membership. Kanvise does not sell standalone Quizzes, expose a
public Quiz marketplace, or allow anonymous/guest Quiz attempts. Public Quiz
offers, entitlements, orders, checkout, guest sessions and public Quiz URLs are
retired concepts and must not be extended.

Theory/free-text questions, Tutor grading, complex adaptive/multi-subject exam
modes and exam-import complexity are outside the current Quiz baseline. They
may be reconsidered later as explicit product additions; existing code does not
make them approved product behavior.

An Assignment that can be completed without an account is a **share-link
assignment**. `Direct assignment` may remain as an internal legacy name until
it is migrated.

## Naming rule

New UI copy, routes, API contracts, types, tests, and documentation use the
terms in this standard. Under the proposed amendment (2026-11-28), new UI copy
uses the user-facing terms in the table at the top of this document, while
routes, API contracts, types and database names keep the engineering terms. Existing incompatible names must be recorded as
deviations and removed through planned compatibility-safe changes; terminology
cleanup must not silently break persisted data or public links.
