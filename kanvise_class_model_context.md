# Kanvise class-first model (context doc)

Paste this into any chat, doc, or ticket when you need the same context.

## Decision summary

- The thing tutors create, teach, and sell is a **Class**. Tutors already call it that, so there is no Programme/Bundle layer.
- A **Subject** lives inside a class. A class has one or more subjects.
- A **Session** is one occurrence of a subject's teaching (a live meeting).
- **Single subject** and **several subjects** is a choice at class creation. It sets the starting state only. It is not two class types. Subjects can be added later.
- Subject is a **filter inside the class**, never an extra click-through level.
- Naming research: Nigerian tutors have no single word for a bundle of classes ("lesson", "course", "programme", "plan" are all used). Avoiding a new word sidesteps the problem.

## Objects

| Object | Meaning | Notes |
|---|---|---|
| Organisation | A tutorial centre, or a solo tutor (a centre of one) | One permissions model for both |
| Class | The persistent teaching group the tutor creates and sells | Has learners, schedule, assessments, materials, performance |
| Subject | What is taught inside a class | Optional `tutor_id` per subject (needed for centres) |
| Session | One occurrence of a subject's teaching | Belongs to a subject, which belongs to a class |
| Learner enrolment | Which learners are in which subjects of a class | Default is all subjects. Needed because JAMB learners take different subject combinations |
| Assessment | Mock, test, or assignment, belongs to the class | Has one or more sections |
| Section | A part of an assessment, tied to exactly one subject | A single-subject test has one section. A PDF mock splits into sections on import |
| Calendar | Global time view across all classes | Not a class tab |

## Navigation

Global sidebar (independent tutor): Dashboard, Classes, Calendar, Students, Payments.

Class workspace (same for single and multi-subject): Overview, Schedule, Assessments, Materials, Learners, Performance.

Subject UI rules:
- The Classes list shows classes only, never subjects as items.
- Multi-subject class: a chip row under the class title (All subjects, English, Maths, ...). The selected chip filters Schedule, Assessments, Materials, Learners, and Performance. Overview shows subject cards as shortcuts.
- Single-subject class: no chips, no dropdown, no mention of subjects.
- "Session" is not a class tab. Sessions live under Schedule. Clicking one opens session details (Start live class, Attendance, Participants, Chat, Recording, Engagement).
- "Classwork" is not used (Google Classroom term). "Assessments" replaces it.
- Timetable concepts: Schedule is per class, Calendar is global. Add a centre-wide Timetable grid later only if centres need it.

## Roles and dashboards

| | Independent tutor | Centre tutor | Centre admin |
|---|---|---|---|
| Dashboard | Own | Scoped to subjects they teach | Centre-wide |
| Classes | All own | Classes where they teach a subject | All |
| Calendar | Own | Own sessions | Centre-wide |
| Students | All own | Only learners in their subjects | All |
| Payments | Yes | Hidden by default | Yes |
| Tutors | n/a | n/a | Manage tutors |

- Independent tutors are an organisation of one: admin and tutor permissions together.
- Ask once at onboarding "Who do you teach? Individual students / Groups / A tutorial centre" to set the default home. One-on-one tutors get a Students-first home. Group tutors and centres get a Classes-first home.
- Centre tutor dashboard order: Next up (with Start class), This week, Needs attention, My classes (with their subject badge), Recent results for their subject.
- A centre tutor never sees sessions, scores, or learners from subjects they don't teach.

## Create class flow

1. Class name.
2. "What will you teach?" One subject / Several subjects.
3. Pick the subject (one) or tick subjects (several). Offer presets such as JAMB science.
4. Then add learners, schedule, pricing, tutors.

## Assessment PDF import

Tutor uploads one complete paper (PDF or Word). Kanvise extracts questions, detects subjects, finds answer options and keys, and maps them into sections. The tutor reviews and corrects before publishing. Manual build is the alternative path.

## Open decisions

1. Can a learner buy one subject out of a multi-subject class? If yes, each subject needs its own price. Recommendation: class-level pricing only for v1.
2. Does the subject filter persist when switching tabs? Recommendation: yes, reset when leaving the class.
3. Grouping parallel classes (JAMB 2027 Morning/Evening/Weekend). Recommendation: treat as separate classes for now and add grouping or a duplicate-class action later.
4. Selling two existing classes together. Rare for v1, since a tutor can create a multi-subject class instead.
5. Next-term reruns: a duplicate-class action or an intake label, later.

## Schema sketch

```
organisations(id, name, type)
classes(id, org_id, name, created_by)
subjects(id, class_id, name, tutor_id NULL)
class_learners(id, class_id, learner_id)
subject_enrolments(subject_id, learner_id)
sessions(id, subject_id, starts_at, ends_at, recurrence_rule NULL, status)
assessments(id, class_id, title, type)           -- mock | test | assignment
assessment_sections(id, assessment_id, subject_id, position)
questions(id, section_id, ...)
```
