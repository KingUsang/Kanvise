# Kanvise Dashboard UX and Stitch Audit

**Status:** Active implementation guide  
**Stitch source:** `Duplicate of Remix of Kanvise LMS Web App` (`projects/5053904257875503539`)  
**Typography:** Poppins throughout Kanvise

## 1. How to interpret Stitch screen names

- `A:` is an admin-only workflow.
- `T:` is a tutor-only workflow.
- `A/T:` is a shared workflow available to both admins and tutors.
- `S<n>:` is an authoritative student workflow.
- `T<n>:` screens are legacy references and are not implementation targets.

An admin who is assigned to teach has both admin and tutor capabilities. That user receives the union of `A:`, `T:`, and `A/T:` workflows. `A/T:` does not mean “solo tutor”; it means the workflow itself is shared.

Stitch is a visual reference, not the authority for permissions, product language, or data behavior. Actions and copy must be corrected when a generated screen conflicts with the Kanvise operating model. For example, the Stitch tutor dashboard shows “New Programme,” but programme creation is an admin responsibility; the implementation uses “New Assignment” for tutors.

## 2. Authoritative screen-to-route map

| Stitch screen | Capability | Kanvise route | Status |
| --- | --- | --- | --- |
| A: Admin Dashboard | Admin | `/dashboard` | Implemented conditionally |
| A: School Setup & Identity | Admin | `/dashboard/school-setup` | Implemented |
| A: Programmes & Curriculum Management | Admin | `/dashboard/programmes` | Implemented |
| A: Tutor Directory & Invites | Admin | `/dashboard/tutors` | Implemented |
| A: Student Roster & Enrollment | Admin | `/dashboard/students` | Implemented; copy should use “Enrolment” |
| A: Financials & Revenue Tracking | Admin | `/dashboard/payments` | Implemented; some secondary actions remain unwired |
| A/T: Unified Dashboard Home | Shared | `/dashboard` | Implemented conditionally |
| A/T: Class Schedule Manager | Shared | `/dashboard/schedule` | Implemented |
| A/T: Attendance & Participation Reports | Shared | `/dashboard/attendance` | Implemented |
| A/T: Mocks Management Workspace | Shared | `/dashboard/mocks` | Implemented |
| A/T: Comprehensive Mock Builder | Shared | `/dashboard/mocks/builder` | Implemented |
| A/T: Digital Avatar Customisation Hub | Shared | — | Missing route |
| T: Tutor Dashboard | Tutor | `/dashboard` | Implemented conditionally |
| T: Assignment Definition & Tasks | Tutor | `/dashboard/assignments` | Implemented |
| T: Student Submission Review | Tutor | `/dashboard/assignments/[assignmentId]/submissions` | Implemented |
| T: Live Classroom Instruction Hosting | Tutor | `/class/[id]` | Implemented; visual alignment in progress |
| T: Instructional Materials Library | Tutor | — | Missing route |
| T: Mock Examination Results Analysis | Tutor | `/dashboard/mocks/[mockId]/results` | Implemented as a mock-scoped results and theory-grading workspace |
| S3: Student Dashboard | Student | `/dashboard/student` | Implemented with enrolment-scoped Hono data |
| S4: My Classes | Student | `/dashboard/student/classes` | Implemented with enrolment-scoped class sessions |
| S5: Assignments Management | Student | `/dashboard/student/assignments` | Implemented with private submission upload and feedback |
| S6: Mocks Management | Student | `/dashboard/student/mocks` | Implemented through preflight, CBT attempt, submission, and released results |
| S7: Materials Library | Student | `/dashboard/student/materials` | Implemented with entitled-course filtering and signed R2 downloads |
| S8: My Progress Tracking | Student | `/dashboard/student/progress` | Implemented from recorded attendance, assignments, and mock attempts |
| S9: Student Settings | Student | `/dashboard/student/settings` | Implemented with safe profile edits, profile photo upload, and password-reset entry point |

The student dashboard follows Stitch's hierarchy, spacing, colour, desktop sidebar, and mobile navigation direction, but only displays metrics supported by real Kanvise data. Generated countdowns, registration codes, attendance percentages, and scores must not be shown until the corresponding product logic exists.

### Student S3–S9 completion evidence — 23 July 2026

| Workflow | Hono source | Access invariant | UX verification |
| --- | --- | --- | --- |
| S3 Dashboard | `GET /dashboard/student` | Student role, school, and active inherited enrolments | Action-oriented empty/data states; responsive main/aside layout |
| S4 Classes | `GET /live-classes` and protected join/detail routes | Only entitled course IDs; unenrolled details are hidden and joins rejected | All/upcoming/past filters; join appears only for live sessions |
| S5 Assignments | `GET /assignments/me` plus submission/storage routes | Student role, own submission, active course entitlement, verified private R2 object | Pending/submitted/graded/overdue states and responsive submission flow |
| S6 Mocks | Versioned `/students/me/mocks`, `/mocks/:id/preflight`, and `/attempts/*` routes | Student/tenant ownership, active entitlement, immutable version, no answer-key leakage | Responsive CBT runner, flags, autosave/recovery, calculator, timer, submit and results |
| S7 Materials | `GET /notes/me` | Student role, active entitled courses, signed private download, no object-key leakage | Search plus course/type filters; responsive cards and empty state |
| S8 Progress | `GET /dashboard/student/progress` | Student role, own activity, active entitled courses | Recorded-only totals, per-course cards, recent results, honest missing-data state |
| S9 Settings | `GET/PATCH /students/me/settings` and verified public storage routes | Student role, own tenant/profile, allowlisted fields; role/school/email cannot be overwritten | Responsive editable profile, photo progress, in-app feedback, password-reset link |

Verification passed with the complete API test suite (42 files/142 tests), web
component suite (8 files/19 tests), API TypeScript build, explicit web TypeScript
check, targeted ESLint, and the Next.js production build. The Supabase mock lifecycle
was also exercised inside a rollback-only transaction. CSS breakpoints and mobile
navigation cover narrow, tablet, and desktop layouts; a signed-in device/browser
visual regression pass remains a release-environment check rather than a missing
workflow.

## Supabase data-access boundary

The connected development database now has Row Level Security enabled on every
public application table. Browser `anon` and `authenticated` roles have no public
table, sequence, or RPC privileges. Hono remains the application-data boundary and
uses the service role with explicit school, role, and ownership checks.

The browser may use Supabase Auth for sessions, but dashboard business data must
come through the Hono API. New database migrations must preserve this boundary and
new API routes still require application-layer tenancy tests; enabling RLS does not
replace correct Hono authorisation.

## 3. Page audit log

### A/T: Class Schedule Manager — 23 July 2026

The implementation follows the modern Stitch screen's hierarchy: page heading and
actions, scheduling form and calendar in the left column, and live, scheduled, and
completed sessions in the wider right column. It uses the dashboard shell's shared
page padding rather than adding a second outer gutter.

Corrections made during the product and implementation audit:

- Simplified generated terms such as “main roster” and “manage tutor availability”
  into language that describes what the page actually does.
- Kept the page shared: admins see their centre's schedule and can assign an
  eligible tutor; tutors see and schedule only their own assigned classes.
- Corrected the Monday-first calendar offset.
- Included course codes in the API response consumed by the schedule.
- Replaced the decorative export action with a real CSV schedule download.
- Stopped showing admins a Start Class action that the API correctly reserves for
  the assigned tutor.
- Enforced the same tutor ownership rule on class edits at the API boundary.
- Added a visible recoverable error when the schedule API fails, so an outage is
  not presented as an empty timetable.

Follow-up items are deliberately separate from this completed alignment pass:

- Add reschedule and cancel controls to the page using the existing API contracts,
  with confirmation and notification feedback.
- Add explicit date-range selection if centres need more than the current
  day/all-upcoming calendar filter.
- Test narrow-screen table behaviour in a signed-in browser during release QA.

## 4. Capability and navigation rules

Dashboard navigation is configured centrally in `web/src/config/dashboard-navigation.ts`. The same configuration controls:

- sidebar visibility;
- dashboard destination search;
- direct-route UX checks;
- admin, tutor, and shared workflow grouping.

Hiding a sidebar item is not security. Hono route middleware and Supabase RLS remain responsible for authorization. The frontend route check prevents confusing page flashes and raw API errors when someone opens a URL outside their capabilities.

## 5. Authentication claim decision

The JWT fast path is retained, but authorization claims are read from Supabase `app_metadata`, not `user_metadata`.

- `user_profiles` is canonical.
- Trusted server code copies role, school, profile, and Kanvise ID claims into `app_metadata`.
- The API uses those signed claims as its fast path.
- If trusted claims are missing, the API loads the profile from the database.
- After a canonical lookup, the API backfills trusted claims for existing users; those claims become active after token refresh.
- `user_metadata` is reserved for editable presentation fields such as first and last name.

This matches the existing RLS migrations, which already read role and school from `app_metadata`.

## 6. Confirmed UX issues and decisions

### Resolved in the current pass

- Removed hard-coded Plus Jakarta declarations; Poppins is inherited from the root font configuration.
- Removed navigation links to unimplemented Settings and standalone Submissions routes.
- Made dashboard search functional for capability-appropriate destinations.
- Centralised dashboard navigation and access configuration.
- Replaced the tutor’s incorrect “New Programme” action with “New Assignment.”
- Connected admin “New Programme” to the programmes route.
- Added tutor grading items to the dashboard API response.
- Connected grading cards and “View All Submissions” to real assignment routes.
- Corrected the schedule summary so tutors do not see an admin-only count as zero.
- Increased the visibility of the global navigation progress indicator.
- Corrected admin and tutor setup redirects that pointed to nonexistent role-specific dashboard URLs.
- Removed decorative controls that had no behaviour from Financials, Attendance, Programmes, Schedule, and the top bar.
- Replaced the misleading “Add Student” alert with an explanation of the public enrolment flow.
- Replaced raw student and financial API errors with recoverable user-facing messages while retaining console diagnostics.
- Made the tutor participant panel visible by default in live classes, retained circular video PiP, and kept screen sharing disabled.
- Added the real class title and course context to the LiveKit join/start contract so the classroom header no longer exposes an internal room name.
- Return tutors to their dashboard after leaving a classroom.
- Replaced frontend browser alerts with non-blocking in-app notifications for success and error feedback.
- Added server-validated mock publication, real attempt/grading counts, mock-scoped results, theory grading, and non-destructive archiving.
- Interpret scheduled mock publication in the user's local timezone before storing the UTC timestamp.
- Split `/dashboard` into explicit admin, tutor, and combined admin-tutor experiences while retaining one shared route.
- Made mocks a primary dashboard workflow with creation, active-mock, pending-theory, and grading-queue entry points.
- Replaced accounting jargon and raw pending checkouts with “Earnings this month” and the count of successful payments.
- Added a dedicated student shell and dashboard rather than reusing the admin/tutor shell.
- Added `GET /dashboard/student`, which derives accessible courses from direct course, sub-programme, and programme enrolments and returns only tenant-scoped student activity.
- Made the student dashboard action-oriented: next class, outstanding assignments, recent materials/mocks/assignments, and upcoming classes all come from Hono rather than hard-coded examples.
- Implemented the student “My classes” schedule with all/upcoming/past and course filters, truthful live/scheduled/completed states, and a join action that appears only when a class is live.
- Enforced student enrolment on class lists, class details, and LiveKit joins. Programme and sub-programme purchases grant access to their descendant courses; unrelated school classes are not exposed.
- Implemented student assignment filtering, instructions, private resource downloads, Cloudflare R2 submission uploads, submitted/late/graded states, marks, tutor feedback, and own-file downloads.
- Centralised student course access so assignment listing, submission permission, storage presigning, class listing, and LiveKit joins use the same programme → sub-programme → course inheritance rules.
- Persist late-submission status in the database; the earlier API calculated it for the response but failed to save it on the submission row.
- Implemented the student mock list, preflight, immutable attempt runner, server-owned timer, autosave/offline retry, flags, calculator, keyboard controls, submission confirmation, and release-controlled results through Hono.
- Implemented the Materials library as one aggregate Hono request. It resolves programme, sub-programme, and direct-course enrolments server-side, signs private Cloudflare R2 downloads, and never returns storage object keys.
- Implemented Progress using only recorded activity. Attendance, assignment completion, and mock averages remain explicitly unavailable when their denominator is absent instead of inventing percentages.
- Implemented Student Settings with tenant/role-scoped profile reads and an allowlisted update contract. Email, role, school, and student ID cannot be edited there; profile photos use verified public R2 uploads.
- Added responsive layouts and narrow-screen behaviour for every authoritative S3–S9 route.
- Kept onboarding destinations visible but locked until the required centre setup
  is complete, then force-reloaded the dashboard shell after refreshing the trusted
  school claim so stale layout state cannot leave those destinations locked.
- Clarified that the setup action creates a centre only on first use and saves
  changes thereafter; setup errors now appear once as in-app notifications rather
  than being duplicated beside the action.

### Remaining product/UX work

- Decide the information architecture for Avatar Customisation before adding a link.
- Extend dashboard search to records only after a tenant-scoped search API and clear result categories are defined.
- Add a shareable public enrolment link to the student roster once the school slug is available in that route.
- Ensure an admin who teaches sees teaching priorities without overwhelming the admin overview.
- Add consistent route-level loading, empty, forbidden, and recoverable error states.
- Audit mobile behavior against product needs; numbered legacy mobile screens are not authoritative.
- Add notification preferences after a canonical preference model and delivery channels exist.
- Define and validate the mock marketplace pilot before exposing public listings,
  cross-centre licensing, payments, or creator payouts.

## 7. Content standard

Kanvise uses clear Nigerian/British English:

- `centre`, not `center`;
- `enrol`, `enrolled`, and `enrolment`, not `enroll` or `enrollment`;
- `programme` for a structured academic programme;
- `course` for a course within a programme;
- `class` or `session` for a scheduled teaching event;
- sentence case for headings and actions unless a data abbreviation requires otherwise.

Generated Stitch text must be checked for role relevance, grammatical correctness, truthful system behavior, and consistency with these terms before it enters production.
