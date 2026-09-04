# Kanvise Email and Notification Implementation Progress

Last updated: 20 July 2026

## How to resume this work

Read this document before continuing the email and notification implementation.
Continue from the first incomplete step, but do not advance a step that is marked
`IN REVIEW` until the user has finished reviewing and explicitly approves it.

## Current status

| Step | Workstream | Status |
| --- | --- | --- |
| 1 | Email foundation and tests | COMPLETE |
| 2 | Initial email templates | COMPLETE |
| 3 | Tutor invitation and idempotent welcome-email integration | COMPLETE |
| 4 | Payment confirmation and combined receipt/access email | COMPLETE |
| 5 | Shared in-app/email notification service and schema migration | COMPLETE |
| 6 | Route-triggered notifications | COMPLETE |
| 7 | Scheduled jobs | COMPLETE |
| 8 | Full testing and staging smoke tests | COMPLETE |
| 9 | Deployment and deliverability work | IN PROGRESS |

Step 4 was approved by the user on 20 July 2026.

## Implementation plan

### 1. Establish the email foundation

- Add `resend`, `@react-email/components`, `@react-email/render`, `node-cron`, and Vitest.
- Create the reusable email module under `api/src/emails`.
- Configure `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `FRONTEND_URL`, and the optional email safety switch.
- Fail clearly for unsafe production configuration while allowing fake transports in tests.

### 2. Implement the initial templates

Create reusable branded components and these templates:

1. Tutor invitation
2. Welcome/account-ready
3. Combined payment receipt and enrolment confirmation
4. Live-class reminder
5. Class cancellation
6. Assignment deadline reminder
7. Submission graded
8. Mock published
9. Mock fully graded

All templates must provide centrally generated subjects, HTML and plain text,
escaped user content, and validated absolute links.

### 3. Deliver the first working email slice

- Send tutor invitations after saving the invite row.
- Return the provider message ID and delivery status.
- Retain the invite and return its shareable URL when email delivery fails.
- Send the welcome email after profile initialization.
- Make profile initialization and welcome delivery idempotent.

### 4. Repair payment confirmation and wire the payment email

- Authenticate the internal endpoint using `KANVISE_INTERNAL_SECRET`.
- Verify the transaction with Paystack.
- Atomically and idempotently mark the payment successful.
- Create exactly one enrolment.
- Create the payment and enrolment in-app notifications once each.
- Send one combined receipt/access email.
- Persist email delivery state and prevent duplicate emails on webhook retries.
- Reject missing or placeholder production secrets.

Status: `COMPLETE`. The user approved this step on 20 July 2026.

### 5. Add notification delivery orchestration

Create one tenant-aware notification service for recipient resolution, in-app
notifications, email rendering and delivery, batching, per-recipient failures,
structured logging, and result summaries. Complete the append-only notification
schema changes without modifying the initial migration.

Status: `COMPLETE`. The shared service resolves explicitly selected or enrolled
recipients within a school, creates idempotent in-app notifications, sends durable
idempotent emails in bounded batches, isolates per-recipient failures, emits
structured logs, and returns a delivery summary.

### 6. Implement route-triggered notifications

Wire the notification service into mock publication, submission grading, complete
mock grading, class cancellation and rescheduling, and payment confirmation.

Status: `COMPLETE`. Immediate mock publication notifies enrolled students;
submission review notifies the submitting student; completing all theory grading
transitions the attempt once and notifies its student; class cancellation notifies
enrolled students; and rescheduling resets the reminder flag. Payment continues to
use its approved combined receipt/access delivery path.

### 7. Implement scheduled jobs

- Mock auto-publication every minute.
- Live-class reminders every five minutes.
- Assignment deadline reminders every thirty minutes.
- Use bounded batches, tenant-scoped queries, overlap protection, idempotency,
  retryable failure handling, structured logs, and graceful shutdown.

Status: `COMPLETE`. The API schedules mock publication every minute, live-class
reminders every five minutes, and assignment deadline reminders every thirty
minutes. Jobs use bounded reads, tenant-scoped delivery, in-process overlap guards,
durable per-recipient idempotency, retryable completion flags, structured summaries,
and shutdown draining.

### 8. Testing and verification

Cover template rendering, configuration failures, provider error normalization,
invite failure behavior, welcome retries, duplicate payment webhooks, reminder
deduplication, tenant isolation, retryable reminder failures, and notification types.
Add a staging smoke-test script for all templates.

Status: `COMPLETE`. Regression coverage includes every listed email, payment,
notification, tenant, retry, and scheduler concern. The staging smoke command
renders all nine templates by default and requires explicit non-production flags
and a recipient before sending real messages.

### 9. Deployment work

- Configure Supabase Auth confirmation and redirect settings.
- Test Gmail and Yahoo delivery, spam placement, links, and mobile rendering.
- Monitor email-send and scheduled-job failures.

Status: `IN PROGRESS`. Code-side liveness, structured failure logging, smoke tooling,
and a deployment checklist are complete. Dashboard/DNS configuration and real Gmail
and Yahoo staging delivery checks require the staging infrastructure and controlled
test inboxes.

## Work implemented so far

### Steps 1 and 2

- Added the React Email and Resend foundation with injectable transports.
- Added all nine branded templates.
- Added typed template inputs and event names.
- Centralized and sanitized subject generation.
- Added central HTML/plain-text rendering and absolute HTTP(S) link validation.

### Step 3

- Tutor invites are retained when email delivery fails.
- Invite responses expose `email_sent`, the provider ID, and the shareable URL.
- Added persistent welcome-email delivery state.
- Added the stable provider key `welcome:<profile-id>`.
- Profile initialization resolves sequential retries and concurrent insert conflicts.
- Failed welcome messages remain retryable; successful messages are not resent.

### Step 4

- Added the documented `POST /internal/payments/confirm` endpoint.
- Corrected the Next.js webhook to call that endpoint.
- Added timing-safe internal-secret and Paystack-signature comparisons.
- Added independent Paystack transaction verification.
- Added a transactional database function for payment, enrolment, and notification effects.
- Added uniqueness protection for enrolments and payment-related notifications.
- Added the combined receipt/access email with persisted delivery state.
- Added provider idempotency key `payment_confirmed:<payment-id>`.
- Made email failures retryable without repeating database effects.
- Added production payment-secret validation.
- Applied the email/payment migrations to the connected Supabase `dev` project.
- Added an explicit RPC permission migration after verification found Supabase had
  granted the payment function to `anon` and `authenticated`; only `service_role`
  can execute it now.

### Step 5

- Added a typed shared notification service under `api/src/notifications`.
- Added tenant-scoped recipient resolution for explicit users and programme,
  sub-programme, or course enrolments.
- Added bounded batching, per-recipient channel failures, structured logging,
  result summaries, and durable email retry/idempotency state.
- Added tests for retries, tenant isolation, missing emails, partial provider
  failures, and bounded concurrency.
- Extended the notification type constraint for submission grading, completed
  mock grading, and class cancellation.
- Enabled RLS on `notifications`; authenticated users can only read their own
  rows and update their own `is_read` column. Notification creation remains
  server-only.

### Step 6

- Wired immediate mock publication to `mock_published` delivery for course
  enrolments.
- Added the documented submission-review endpoint and `submission_graded`
  delivery to the submitting student.
- Added the documented theory-answer grading endpoint, complete-attempt detection,
  and one `mock_fully_graded` delivery per attempt.
- Added scheduled-class cancellation with `class_cancelled` delivery to course
  enrolments.
- Reset `live_classes.notification_sent` whenever a scheduled class is moved.
- Kept notification provider failures isolated from successful route mutations and
  included delivery summaries in route responses.
- Confirmed no additional Step 6 database migration was necessary.

### Step 7

- Added pinned `node-cron` scheduling and lockfile updates.
- Added bounded repositories and runners for mock auto-publication, live-class
  reminders, and assignment deadline reminders.
- Added retryable mock publication notification state so publishing remains
  successful even when delivery must be retried.
- Kept live-class reminder flags unset after partial failures so only failed
  recipients are retried through durable email idempotency.
- Excluded students who already submitted from assignment deadline reminders.
- Added overlap guards, per-item failure isolation, structured job summaries, and
  graceful SIGTERM/SIGINT draining.
- Added `SCHEDULED_JOBS_ENABLED=false` for web-only API processes.

### Step 8

- Added missing required-configuration and generic provider-error tests.
- Added an explicit shared notification-type contract test.
- Added a safe staging smoke command covering all nine templates in HTML and
  plain text, with production sending disabled.
- Repaired the missing ESLint runtime dependency with an exact pinned version.
- Corrected the classroom response type and notes course/relation shape discovered
  during the full web TypeScript check.

### Step 9 — external checks remaining

- Added the documented public `GET /health` liveness endpoint without database or
  provider dependencies.
- Added top-level scheduled-job rejection logging and searchable welcome/payment
  delivery failure events.
- Added `docs/11_EMAIL_NOTIFICATION_DEPLOYMENT_CHECKLIST.md` covering migrations,
  Supabase Auth URLs, Resend DNS, staging inbox checks, monitoring, and scheduler
  deployment.
- Confirmed the connected Supabase project is healthy but is named `dev`; the
  infrastructure plan requires a separate staging project before staging sign-off.
- Real delivery was not attempted because no explicit controlled Gmail/Yahoo smoke
  recipient was provided.

## Migrations added

- `supabase/migrations/20260720000004_email_deliveries.sql`
- `supabase/migrations/20260720000005_confirm_student_payment.sql`
- `supabase/migrations/20260720143823_restrict_confirm_student_payment.sql`
- `supabase/migrations/20260720145358_notification_delivery_schema.sql`
- `supabase/migrations/20260720151750_mock_publication_notification_state.sql`

These migrations have been applied to the connected Supabase `dev` project and
must also be applied to each later deployment environment before its API code.

## Latest verification

- API: 28 tests passed across 9 test files.
- API TypeScript build passed.
- Web TypeScript check passed.
- Web ESLint could not start because the existing installation is missing the
  transitive package `@eslint-community/eslint-utils`.
- Supabase verification confirmed the email delivery table, both idempotency
  indexes, and payment confirmation function exist. The email table has RLS
  enabled, and the payment function is executable only by `service_role`.
- API: 32 tests passed across 10 test files after Step 5.
- API TypeScript build passed after Step 5.
- Supabase verification confirmed all documented notification types, notification
  RLS policies, server-only inserts, and column-limited authenticated updates.
- API: 36 tests passed across 11 test files after Step 6.
- API TypeScript build passed after Step 6.
- Supabase verification confirmed the route relationships and notification
  deduplication index required by Step 6.
- API: 40 tests passed across 12 test files after Step 7.
- API TypeScript build passed after Step 7.
- Supabase verification confirmed the mock publication retry column and bounded
  partial index; security and performance advisors were rerun.
- API: 47 tests passed across 15 test files after Step 8.
- API TypeScript build passed, and all nine templates passed the dry-run smoke command.
- Web TypeScript passed. Lint now starts successfully; the two touched files have
  zero lint errors, while the full pre-existing frontend currently reports 76
  errors and 40 warnings outside the email/notification workstream.
- API: 48 tests passed across 16 test files during Step 9 readiness work.
- API TypeScript build and nine-template dry-run smoke test passed.
- Connected Supabase `dev` project is active and healthy; migrations and advisors
  were rechecked.

## Next action

Create or connect the isolated staging Supabase project, configure its Auth URL
allow-list and Resend DNS/key, then provide controlled Gmail and Yahoo recipients
for the real staging smoke runs. Configure UptimeRobot and Sentry/Slack alerts from
the deployment checklist before marking Step 9 complete.
