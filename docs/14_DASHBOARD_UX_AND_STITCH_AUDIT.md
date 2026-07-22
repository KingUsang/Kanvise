# Kanvise Dashboard UX and Stitch Audit

**Status:** Active implementation guide  
**Stitch source:** `Duplicate of Remix of Kanvise LMS Web App` (`projects/5053904257875503539`)  
**Typography:** Poppins throughout Kanvise

## 1. How to interpret Stitch screen names

- `A:` is an admin-only workflow.
- `T:` is a tutor-only workflow.
- `A/T:` is a shared workflow available to both admins and tutors.
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

Student screens and `/dashboard/student` are outside the current implementation phase and excluded from this audit.

## 3. Capability and navigation rules

Dashboard navigation is configured centrally in `web/src/config/dashboard-navigation.ts`. The same configuration controls:

- sidebar visibility;
- dashboard destination search;
- direct-route UX checks;
- admin, tutor, and shared workflow grouping.

Hiding a sidebar item is not security. Hono route middleware and Supabase RLS remain responsible for authorization. The frontend route check prevents confusing page flashes and raw API errors when someone opens a URL outside their capabilities.

## 4. Authentication claim decision

The JWT fast path is retained, but authorization claims are read from Supabase `app_metadata`, not `user_metadata`.

- `user_profiles` is canonical.
- Trusted server code copies role, school, profile, and Kanvise ID claims into `app_metadata`.
- The API uses those signed claims as its fast path.
- If trusted claims are missing, the API loads the profile from the database.
- After a canonical lookup, the API backfills trusted claims for existing users; those claims become active after token refresh.
- `user_metadata` is reserved for editable presentation fields such as first and last name.

This matches the existing RLS migrations, which already read role and school from `app_metadata`.

## 5. Confirmed UX issues and decisions

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

### Remaining product/UX work

- Decide the information architecture for Materials and Avatar Customisation before adding links.
- Extend dashboard search to records only after a tenant-scoped search API and clear result categories are defined.
- Add a shareable public enrolment link to the student roster once the school slug is available in that route.
- Ensure an admin who teaches sees teaching priorities without overwhelming the admin overview.
- Add consistent route-level loading, empty, forbidden, and recoverable error states.
- Audit mobile behavior against product needs; numbered legacy mobile screens are not authoritative.

## 6. Content standard

Kanvise uses clear Nigerian/British English:

- `centre`, not `center`;
- `enrol`, `enrolled`, and `enrolment`, not `enroll` or `enrollment`;
- `programme` for a structured academic programme;
- `course` for a course within a programme;
- `class` or `session` for a scheduled teaching event;
- sentence case for headings and actions unless a data abbreviation requires otherwise.

Generated Stitch text must be checked for role relevance, grammatical correctness, truthful system behavior, and consistency with these terms before it enters production.
