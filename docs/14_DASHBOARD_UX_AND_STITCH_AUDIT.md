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
| T: Instructional Materials Library | Tutor | `/dashboard/notes` | Implemented |
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
- Display Course names consistently; the Kanvise Course schema does not define a
  separate Course code.
- Replaced the decorative export action with a real CSV schedule download.
- Stopped showing admins a Start Class action that the API correctly reserves for
  the assigned tutor.
- Enforced the same tutor ownership rule on class edits at the API boundary.
- Added a visible recoverable error when the schedule API fails, so an outage is
  not presented as an empty timetable.
- Replaced the empty scheduled-classes table for a new centre with a balanced,
  instructive first-class state that points back to the scheduling form.

Follow-up items are deliberately separate from this completed alignment pass:

- Add reschedule and cancel controls to the page using the existing API contracts,
  with confirmation and notification feedback.
- Add explicit date-range selection if centres need more than the current
  day/all-upcoming calendar filter.
- Test narrow-screen table behaviour in a signed-in browser during release QA.

### A/T: Attendance & Participation Reports — 23 July 2026

The implementation retains the modern Stitch screen's useful hierarchy: report
heading, programme/class/date filters, summary cards, and a paginated student
attendance table. Poppins, shared dashboard padding, borders, restrained shadows,
and Kanvise colour roles remain consistent with the dashboard shell.

Corrections made during the product, security, and data audit:

- Restricted centre attendance reports to Admin and Tutor roles. A student token
  can no longer request another student's attendance through these endpoints.
- Kept Admin visibility centre-wide and Tutor visibility limited to classes
  assigned to that tutor.
- Changed the single misleading “Date Range” field into real From and Until dates.
- Report only completed classes, avoiding premature Absent labels and incomplete
  percentages while a class is still live.
- Deduplicate multiple LiveKit join records for the same student and class when
  calculating attendance, while summing time across reconnections as required by
  the feature specification.
- Removed the private profile-photo storage key from report responses instead of
  treating it as a browser-loadable URL.
- Scoped programme-to-course filter resolution to the current school.
- Replaced generated terms such as “Session Data Log” and “sessions monitored”
  with class and attendance language tutors use.
- Removed the unsupported positive-trend claim. The card now states that the
  percentage applies to the selected filters.
- Made the at-risk percentage configurable through
  `ATTENDANCE_RISK_THRESHOLD_PERCENT`; the API returns the effective threshold so
  the interface never hard-codes a conflicting value.
- Added visible failure notifications for filter and report API requests.

Stitch's Manual Entry action was not adopted. Kanvise's documented source of truth
is verified LiveKit participation; silently hand-editing those events would make
the report less trustworthy. A future correction workflow would need a reason,
original value, replacement value, actor, and audit history rather than a generic
manual-entry form.

Remaining attendance work:

- Implement the documented cleanup job for attendance rows left open when LiveKit
  does not deliver a participant-left event. Until then, time spent can be
  understated for interrupted connections.
- Add a server-generated full CSV export if centres demonstrate a reporting need;
  exporting only the visible browser page would be misleading.
- Replace blank avatars with signed/public profile-photo URLs only after a
  dedicated safe response contract is defined.

### A/T: Mocks Management Workspace — 23 July 2026

The current page preserves the modern Stitch screen's heading, primary creation
action, status tabs, course filter, compact results table, and purposeful empty
state. The implementation appropriately extends the generated design with archived
mocks, preserved results, theory-grading counts, and links into the completed
versioned CBT workflow.

Corrections made during this pass:

- Removed a second `p-4 md:p-10` page wrapper. The dashboard shell already owns the
  main content gutter, so the old wrapper doubled the padding and visibly diverged
  from Stitch and neighbouring pages.
- Replaced vague “manage and evaluate” copy with the actual tutor journey: create,
  publish, and review results.
- Added a Try Again action to the recoverable API error state.
- Expanded “Qs” to “questions” and replaced “No Course” with the clearer “Course
  unavailable”.

Verified role behaviour:

- Admins list and manage centre mocks.
- Tutors list, create, archive, and review only mocks whose Courses are assigned to
  them; the Hono routes enforce school and Course access.
- Students use the separate answer-safe CBT routes and cannot access this workspace.
- Archiving preserves attempts and results rather than deleting assessment history.

Stitch's two side-by-side “empty state demonstrations” are design examples, not
simultaneous production content. Kanvise correctly renders one state based on real
data. The newer Question Banks workspace remains a separate authoring tool because
forcing reusable banks into this compact management table would weaken both tasks.

### A/T: Comprehensive Mock Builder — 23 July 2026

The implementation keeps Stitch's two-column authoring structure: questions occupy
the wider working area and mock settings remain visible in a narrower sticky panel.
It extends that original design with the completed CBT controls: calculator choice,
attempt allowance, result release, opening/closing times, shuffling, CSV/DOCX
imports, and reusable question-bank selection.

Corrections made during this pass:

- Removed the unnecessary inner `max-w-[1200px]` constraint so the builder uses the
  dashboard shell's established content width and gutters.
- Added a clear first-question state with direct multiple-choice and theory actions;
  a blank builder no longer leads with bulk-import instructions.
- Replaced generated technical language such as “assessment parameters,”
  “construct questions,” “structural block,” and “publishing strategy” with Mock
  settings, add a question, and when students should see it.
- Clarified that a theory marking guide is visible only to tutors.
- Labelled the selector accurately as Course because mocks attach to a Course, not
  directly to a Programme.
- Added guidance when no Course is available or assigned.
- Made the page header actions wrap on narrow screens.
- Surface real API messages when Course loading or mock create/update fails instead
  of silently leaving empty controls or returning a generic failure.
- Kept published versions visibly locked and explained the student-results reason
  in plain language.

The richer builder intentionally goes beyond the older Stitch screen. Removing
calculator, attempt, result-release, import, and bank controls merely to match the
generated image would regress the Nigerian CBT workflow already implemented.

### T: Assignment Definition & Tasks — 23 July 2026

The implementation follows Stitch's split workspace: assignment creation occupies
the wider left card and recent assignments form the right-hand ledger. Admins see
this tutor-capability page only when they teach a Course; pure tutors work only
within assigned Courses.

Corrections made during this pass:

- Removed the “Publish immediately” switch because it did not control the request;
  the explicit Save as Draft and Publish Assignment actions are now the single,
  understandable choice.
- Changed “Target Programme / Course” to Course and added guidance when an admin
  has not created one or a tutor has not been assigned one.
- Replaced a culturally irrelevant Modernism placeholder and technical
  “grading rubric” wording with a familiar school-subject example and plain marking
  instructions.
- Matched attachment copy and browser selection to the real R2 contract: PDF,
  DOCX, PPTX, JPG, and PNG up to 50 MB. ZIP is no longer promised, and size/type
  errors are caught before upload.
- Replaced embedded success/error banners with consistent in-app notifications.
- Added a real loading state and a useful first-assignment empty state.
- Made recent assignment rows open their submissions workspace by pointer or
  keyboard; they no longer only look clickable.
- Expanded the bare submission number into a labelled submission count and replaced
  “Unknown Course” with “Course unavailable”.
- Made footer actions wrap instead of overflowing on narrow screens.

The API already enforces school tenancy and Course assignment for creation,
listing, publishing, editing, deletion, and tutor submission review.

### T: Student Submission Review — 23 July 2026

The implementation matches Stitch's master-detail review structure: a searchable
student submission list sits beside the selected document and grading workspace.
It uses real signed R2 downloads and persists tutor scores and feedback.

Corrections made during this pass:

- Removed private R2 object keys from tutor and student assignment responses. The
  browser now receives only the original filename and an expiring signed download
  URL.
- Display and download the submitted file using its real filename rather than
  parsing an internal storage path or forcing a `.pdf` extension.
- Replaced “Grading & Feedback,” “Final Score,” and “Submit Grade” with shorter,
  clearer review language.
- Improved the no-submission and no-search-result states so tutors know whether
  they are waiting for student work or should change the search.
- Changed the summary into a readable “reviewed out of submitted” statement and
  made saved feedback confirmation explicit.

The API verifies school, assignment, and Course-management access before returning
submissions or accepting a review. Student assignment responses remain limited to
the signed-in student's own submission.

### T: Instructional Materials Library — 23 July 2026

The implementation retains Stitch's practical two-column arrangement: tutors share
a file from the left and manage existing course materials from the wider table.
It is available at `/dashboard/notes`; the earlier audit map incorrectly marked the
implemented route as missing.

Corrections made during this pass:

- Replaced “active cohorts,” “resource details,” and “distributed materials” with
  Course and learning-material language tutors and centre admins can understand.
- Added guidance for a tutor without an assigned Course and disabled sharing until
  a Course is available.
- Validate PDF, DOCX, PPTX, JPG, and PNG files and the 50 MB limit before an R2
  upload begins; this mirrors the API storage contract.
- Stopped converting a failed per-Course request into an empty list. A real API
  failure now has a visible retry state and cannot be mistaken for “no materials”.
- Replaced the browser deletion popup with an accessible in-app confirmation that
  explains the student-facing consequence.
- Added useful first-material and filtered-course empty states.
- Removed private Cloudflare R2 object keys from tutor/admin Course responses.
  Browsers receive only the original filename and an expiring signed download URL,
  matching the existing student aggregate route.

The API restricts tutor creation and Course listing to assigned Courses, restricts
tutor deletion to materials they created, and allows centre admins to manage
materials across their own school.

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
