# Product domain and terminology

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This document defines the product concepts and language used by new Kanvise
work. Legacy implementation names do not redefine the product model.

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
- **Learner:** receives tutoring and completes learning activities.

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
terms in this standard. Existing incompatible names must be recorded as
deviations and removed through planned compatibility-safe changes; terminology
cleanup must not silently break persisted data or public links.
