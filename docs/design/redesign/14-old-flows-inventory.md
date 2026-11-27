# 14 · Old flows inventory

Status: draft. A check that the redesign doesn't forget anything Kanvise does
today. Every page and API area on `staging` (27 Nov 2026) is listed with what
happens to it in the redesign.

**Keep:** carried into a new screen. **Merge:** folded into another screen.
**Retire:** removed from the UI (data kept unless stated). **Later:** not in
the first redesign pass.

## Tutor and admin pages

| Today | What it does | Redesign | Where |
|---|---|---|---|
| `/dashboard` | Stat cards, schedule today, grading list | Keep, rebuilt | 03 Dashboard |
| `/dashboard/classes`, `/dashboard/classes/[id]`, `/classes/new`, `/classes/[id]/subjects/new` | Priced Class with Subjects; Class workspace | Merge into Courses. Each Subject becomes a course | 04 Courses |
| `/dashboard/programmes`, `/programmes/[id]`, `/programmes/new` | Older programme screens | Retire (replaced by Courses) | 04 |
| Sub-programmes (API only, hidden in UI) | Legacy hierarchy | Retire | none |
| `/dashboard/schedule`, `/schedule/[id]` | Calendar of sessions; session detail | Keep as Calendar and the lesson page | 05 Lessons |
| `/dashboard/timetable` | Account-wide recurring timetable | Merge into Calendar (repeating lessons) | 05 |
| `/dashboard/teaching` ("Plan and follow up") | Teaching hub: materials, follow-ups | Merge into Dashboard (Needs attention) and the lesson page | 03, 05 |
| `/dashboard/attendance` | Attendance reports | Merge into the lesson page (Session tab) and the student page (Attendance tab) | 05, 06 |
| `/dashboard/students` | Roster, import CSV, export, enrolments | Keep as Students | 06 Students |
| `/dashboard/tutors` | Tutors, invitations, subject assignments | Keep as Tutors (agencies) | 12 Settings / team |
| `/dashboard/assignments`, `/assignments/[id]/submissions` | Assignments and marking | Keep as Homework | 10 Homework |
| `/dashboard/direct-assignments`, `/direct-assignment/[token]` | Share-link assignments for guests | Owner deciding on guests. Default: Retire | 10 |
| `/dashboard/mocks`, `/mocks/builder`, `/mocks/[id]/results` | Quizzes, builder, results | Keep as Quizzes, rebuilt with Generate with Kavi | 11 Quizzes |
| `/dashboard/mocks/[id]/offers` | Public and paid quiz offers | Retired already (DOM-009) | none |
| `/dashboard/question-banks` | Question bank | Retire. Kavi generates questions; no bank | 11 |
| `/dashboard/notes` | Materials (notes, files) | Keep as Resources | Resources (new spec, see below) |
| Slides / presentations (API, used in the classroom) | Upload a deck and present it live, with annotations | Keep, inside the classroom and lesson resources | 07 Classroom |
| `/dashboard/payments` | Student payments and payout details | Later: replaced by Billing | 13 Billing |
| `/dashboard/school-setup` | Account profile, logo, media, slug | Merge into onboarding (name) and Settings (profile, logo) | 02, 12 |
| `/dashboard/settings`, `/dashboard/profile` | Account and personal settings | Keep as Settings and My profile | 12 Settings |
| `/dashboard/more` | Duplicate of sidebar links | Retire | none |
| Avatars (API `/avatars/me`) | Avatar builder | Retire from the main flow. Profile photo upload instead | 12 |
| Promos (API) | Promotional banners on public pages | Later, with public pages | none |
| Push notifications (API, PWA) | Browser push for reminders | Keep: reminders and "student is waiting" alerts | 07, 12 |
| Feedback (API) and "Report a problem" | Feedback reports | Keep as Share feedback | 01 Shell |
| Suggestions (API) | Feature suggestions | Merge into Share feedback | 01 |

## Classroom and lesson pages

| Today | What it does | Redesign | Where |
|---|---|---|---|
| `/class/[id]` | Join the PlugNMeet classroom; preparing state; admin takeover | Keep, rebuilt around Lesson tools | 07 Classroom |
| `/live/[shareToken]` | "Anyone with the link" guest classroom | Owner deciding on guests. Default: Retire | 07 |
| `/recording/[shareToken]` | Shared recording link | Keep for students and parents (signed link) | 08 Lesson report |
| Recordings and recaps (API) | Recording processing and AI summaries | Keep: feeds Draft with Kavi | 08 |
| Recorder fleet, provider wake (API) | Infrastructure for the classroom | No UI change | none |

## Student pages

| Today | What it does | Redesign | Where |
|---|---|---|---|
| `/dashboard/student` | Learner home | Keep, rebuilt | 09 Student app |
| `/dashboard/student/classes`, `/classes/[id]/recording` | Sessions and recordings | Keep as Lessons | 09 |
| `/dashboard/student/assignments` | Assignments | Keep as Homework | 09, 10 |
| `/dashboard/student/mocks`, `/mocks/[id]`, `/attempt/[id]`, `/result/[id]` | Quizzes and attempts | Keep as Quizzes | 09, 11 |
| `/dashboard/student/materials` | Materials | Keep as Resources | 09 |
| `/dashboard/student/progress` | Progress | Keep, rebuilt around the course plan | 09 |
| `/dashboard/student/learn` | Combined learning view | Merge into Home and My courses | 09 |
| `/dashboard/student/settings` | Student settings | Keep | 09 |
| `/dashboard/student/[section]` | Catch-all | Retire | none |

## Sign-in, invitations and accounts

| Today | What it does | Redesign | Where |
|---|---|---|---|
| `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` | Sign in, sign up, password reset | Keep, restyled later (owner deferred) | Auth (later) |
| `/auth/register/student` | Student self sign-up | Retire. Students join by invitation | 06 |
| `/invite`, `/auth/invitation`, `/auth/accept-invitation`, `/auth/complete-invitation`, `/auth/invitation/callback` | Account invitations | Keep, simplified into one invite flow | 06, 12 |
| `/join`, `/auth/complete-tutor-invite` | Old tutor invite (already redirects) | Retire | none |
| `/auth/complete-profile` | Finish profile after Google sign-in | Merge into onboarding | 02 |
| `/account/select`, `/account/setup` | Account picker and first setup | Keep the picker (SH-07). Setup merges into onboarding | 01, 02 |
| `/auth/auth-code-error`, `/auth/service-unavailable` | Error pages | Keep, restyled | Auth (later) |

## Public pages

| Today | What it does | Redesign | Where |
|---|---|---|---|
| `/` landing, waitlist | Marketing and waitlist | Out of scope for the app redesign | none |
| `/[school]`, `/[school]/[programmeSlug]`, `/[school]/course/[slug]` | Public account page and enrolment pages for priced programmes | Retire with the bootcamp model. A public booking page may replace them later | none |
| `/payment/return` | Paystack return page | Later, with Billing | 13 |
| `/mock/[slug]`, `/my-mocks`, `/guest/*` | Retired quiz flows | Already retired | none |
| `/privacy`, `/terms` | Legal pages | Keep (legal review pending) | none |

## Emails (keep, rewritten in Kavi's voice where they're product emails)

Welcome and onboarding sequence, invitations, lesson scheduled, lesson
reminder, lesson cancelled or moved, homework set and marked, quiz published,
diagnostic sent and finished, recording ready, password and sign-in links.
Each spec lists the emails its flow sends.

## Things this check added to the plan

1. **Resources** needs its own spec (files, folders, sharing to a course, slides
   for the classroom). Added as spec 15.
2. **Slides in the classroom** must be in spec 07 (upload, present, annotate).
3. **Push notifications** must be in spec 07 (student waiting) and spec 12
   (notification settings).
4. **Attendance** is no longer a page; it lives on the lesson page and the
   student page. Spec 06 must include the student Attendance tab.
5. **CSV import and export of students** must be in spec 06.
6. **Recording share links** for parents must be in spec 08.
