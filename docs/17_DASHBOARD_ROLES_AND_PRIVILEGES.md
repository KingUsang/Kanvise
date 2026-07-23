# Dashboard roles and privileges

This is the product and engineering contract for the Admin/Tutor dashboard.
Hiding a link is only a usability measure. Hono must enforce the same rule on
every read and write, using the resolved profile and `school_id`.

## Role meanings

- **Admin** runs the tutorial centre: school setup, curriculum, people and
  payments.
- **Tutor** teaches only the Courses assigned to them.
- **Solo tutor** is an Admin who is also assigned to at least one Course. They
  keep Admin controls and also receive Tutor teaching tools.

An Admin does not become a Tutor merely because the centre has no other
tutors. The explicit Course assignment is the source of truth.

## Page access

| Page | Access | Admin privileges | Tutor privileges |
| --- | --- | --- | --- |
| Dashboard | Admin and Tutor | Centre overview; teaching overview when assigned to a Course | Personal teaching overview |
| School Setup | Admin only | Edit the centre identity and public information | None |
| Programmes | Admin only | Create and manage Programmes, Sub-programmes and Courses; set separate-purchase options and prices | None |
| Tutors | Admin only | Invite/remove tutors and assign or reassign Courses | None |
| Students | Admin only | View enrolled students, their access and successful payment history; export the roster | None |
| Payments | Admin only | View successful student payments, payout bank details and Kanvise subscription | None |
| Schedule | Admin and Tutor | View all classes; create/manage classes for the centre | View assigned Courses; create/manage their classes only |
| Attendance | Admin and Tutor | View centre-wide attendance and reports | View attendance for assigned Courses/classes only |
| Mocks | Admin and Tutor | Create/manage centre mocks and view centre-wide results | Create/manage mocks and results only for assigned Courses |
| Question Banks | Admin and Tutor | Manage centre banks and all centre questions | Manage owned questions; use permitted centre banks for assigned Courses |
| Notes | Tutor capability | Available only when the Admin is assigned to a Course; manage notes for assigned Courses | Manage notes for assigned Courses |
| Assignments | Tutor capability | Available only when the Admin is assigned to a Course; manage and grade assigned Courses | Manage and grade assigned Courses |

## Enforcement layers

1. Next.js middleware separates Student routes and rejects Tutor visits to
   Admin-only URLs.
2. Dashboard capabilities control navigation and combined Admin/Tutor pages.
3. Hono is the security boundary. It validates the JWT, resolves the database
   profile, scopes every query by `school_id`, enforces the role, and checks
   Tutor Course assignments for teaching actions.
4. Supabase public tables and RPCs are unavailable to browser `anon` and
   `authenticated` roles. Hono alone accesses application data through
   `service_role`.

When a new dashboard page is added, it must be added to
`web/src/config/dashboard-navigation.ts`, this document, and the relevant Hono
authorization tests.
