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
| `/dashboard/tutors` | Tutors, invitations, subject assignments | Keep as Tutors and Team (agencies) | 19 Tutors and team |
| `/dashboard/assignments`, `/assignments/[id]/submissions` | Assignments and marking | Keep as Homework | 10 Homework |
| `/dashboard/direct-assignments`, `/direct-assignment/[token]` | Share-link assignments for guests | Retire (owner decision: no guest flows) | 10 |
| `/dashboard/mocks`, `/mocks/builder`, `/mocks/[id]/results` | Quizzes, builder, results | Keep as Quizzes, rebuilt with Generate with Kavi | 11 Quizzes |
| `/dashboard/mocks/[id]/offers` | Public and paid quiz offers | Retired already (DOM-009) | none |
| `/dashboard/question-banks` | Question bank | Retire. Kavi generates questions; no bank | 11 |
| `/dashboard/notes` | Materials (notes, files) | Keep as Resources | Resources (new spec, see below) |
| Slides / presentations (API, used in the classroom) | Upload a deck and present it live, with annotations | Retire. Replaced by the PlugNMeet whiteboard, which takes uploaded PDFs and images; slides are saved as PDF first (owner decision, 15 Upload limits) | 07 Classroom |
| `/dashboard/payments` | Student payments and payout details | Later: replaced by Billing | 13 Billing |
| `/dashboard/school-setup` | Account profile, logo, media, slug | Merge into onboarding (name) and Settings (profile, logo) | 02, 12 |
| `/dashboard/settings`, `/dashboard/profile` | Account and personal settings | Keep as Settings and My profile | 12 Settings |
| `/dashboard/more` | Duplicate of sidebar links | Retire. Old links redirect to `/dashboard`. On phones, **More** in the bottom bar opens the full sidebar as a sheet instead | 16 Responsive |
| What's new (no page today) | Product updates | New: the What's new dialog in the help menu, with a **New** badge while unread | 01 Shell (SH-04a) |
| Avatars (API `/avatars/me`) | Avatar builder | Retire. Profile photo upload instead | 12 |
| Promos (API) | Promotional banners on public pages | Later, with public pages | none |
| Push notifications (API, PWA) | Browser push for reminders | Keep: reminders and "student is waiting" alerts | 07, 12 |
| Feedback (API) and "Report a problem" | Feedback messages | Keep as Share feedback | 01 Shell |
| Suggestions (API) | Feature suggestions | Merge into Share feedback | 01 |

## Classroom and lesson pages

| Today | What it does | Redesign | Where |
|---|---|---|---|
| `/class/[id]` | Join the PlugNMeet classroom; preparing state; admin takeover | Keep, rebuilt around Lesson tools | 07 Classroom |
| `/live/[shareToken]` | "Anyone with the link" guest classroom | Retire (owner decision: no guest flows) | 07 |
| `/recording/[shareToken]` | Shared recording link | Retire. Students watch recordings in their app; there are no public share links | 09 Student app |
| Recordings and recaps (API) | Recording processing and AI summaries | Keep: feeds Draft with Kavi | 08 |
| Recorder fleet, provider wake (API) | Infrastructure for the classroom | No UI change | none |

## Student pages

| Today | What it does | Redesign | Where |
|---|---|---|---|
| `/dashboard/student` | Student home | Keep, rebuilt | 09 Student app |
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
starting check sent and finished, recording ready, password and sign-in links.
Each spec lists the emails its flow sends.

## Things this check added to the plan

1. **Resources** needs its own spec (files, folders, sharing to a course, files
   for the classroom whiteboard). Added as spec 15.
2. **Files on the PlugNMeet whiteboard** must be in spec 07 (upload a PDF or
   image, draw on it). Kanvise's own slides presenter is retired.
3. **Push notifications** must be in spec 07 (student waiting) and spec 12
   (notification settings).
4. **Attendance** is no longer a page; it lives on the lesson page and the
   student page. Spec 06 must include the student Attendance tab.
5. **CSV import and export of students** must be in spec 06.
6. **Recordings** are watched in the student app (spec 09). Public recording
   share links are retired.
7. Every student needs a personal join link on the lesson page (Copy, WhatsApp,
   Email), replacing the retired share links.
8. **`/dashboard/more`** is retired; old links redirect to the dashboard, and
   the phone **More** sheet shows the full sidebar (spec 16).
9. **What's new** is a new dialog in the help menu (spec 01, SH-04a).

## Feature-level check (components and API endpoints)

A second pass through every old component and API endpoint on `staging`, looking
for features inside pages, not only the pages themselves.

| Old feature | Today | Redesign |
|---|---|---|
| Lesson recap: view, edit, publish | Session detail | Becomes the lesson summary (spec 08). Complete = publish |
| Public recording share link (`/recording-share-link`, `/recording/[token]`) | Session detail | Retire. Students watch recordings in their app |
| Regenerate a lesson link | Session detail | Keep as **Get a new link** on each student's join link (spec 05) |
| Slides presenter with page sync and annotations (`/slides/*`) | Classroom | Retire (owner decision). Replaced by the PlugNMeet whiteboard, which takes uploaded PDFs and images (slides saved as PDF) and has its own drawing tools (spec 07) |
| Anti-cheat wrapper and exam calculator on quizzes | Student quiz attempt | Not in the first quiz version (starting checks and quizzes, not exams). Later with exam modes |
| Attempt answer queue (saves answers offline) | Student quiz attempt | Kept in spec 11 (answers save as chosen, offline-safe) |
| Subject combination (JAMB-style) | Student settings | Retire with multi-subject exams |
| Question bank import (PDF, document text) | Quiz builder | Retire. Kavi generates questions |
| Mock "random pool" assembly | Quiz builder | Retire |
| Class insights (`/programmes/:id/insights`) | Class workspace, Performance tab | Replaced by quiz results by topic (spec 11) and the student Summary tab. Course-level analytics later |
| Assignment overview (`/courses/assignment-overview`) | Class workspace | Replaced by Homework list (spec 10) |
| Student progress page | Student app | Replaced by the course plan view (spec 09, SA-08) |
| Needs-grading card | Dashboard | Becomes Needs attention (spec 03, DB-05) |
| Avatar builder, promos, payout editing | Settings and dashboard | Retired or later (see the table above) |
| Install prompt, push prompt and settings | Whole app | Kept (spec 09 SA-09, spec 12 CFG-N) |
| Navigation progress bar, unsaved-changes guard | Whole app | Kept as app behaviour (spec 01) |
| Class session composer, timetable | Class workspace | Replaced by the New lesson wizard with repeats (spec 05) |
