# Assignment submission notifications

## Status and priority

**Priority: high for independent tutors.** A one-person tutor may not be
watching Kanvise when a student submits work. The tutor needs a prompt,
reliable signal that work is ready to review.

This document covers the missing tutor-facing event only. It does not change
assignment access, submission ownership, or grading permissions.

## Current behaviour

When a student submits an assignment, `POST /assignments/:assignmentId/submit`
verifies the private R2 upload, creates the `submissions` record and returns a
signed download URL. It does **not** notify the assignment tutor.

When a tutor grades work, `PATCH /submissions/:id/review` saves `score`,
`feedback`, `reviewed_at`, and `reviewed_by`, then already sends the student an
idempotent in-app notification, email and (when enabled) web push.

## Proposed delivery contract

Add a `submission_received` notification event. Its recipient is the
assignment's `tutor_id`—not every school admin. This is especially important
for independent tutors, where the tutor is the person expected to act.

The submission route must load `assignments.id`, `title`, `tutor_id`, and
`course_id` before inserting. After a successful insert, it calls:

```text
notifySubmissionReceived({
  submissionId, schoolId, assignmentId, assignmentTitle,
  tutorId, studentName, submittedAt
})
```

Delivery uses the existing notification service:

1. Create one in-app notification, linked to the class-scoped assignment
   review view.
2. Send one idempotent email using `email_deliveries` as the delivery ledger.
3. Send web push only where the tutor has explicitly subscribed and push is
   enabled.

The event must be best-effort: a notification-provider outage cannot turn a
valid student submission into an error. Record a structured server error and
return the saved submission as normal.

## Recipient and edge cases

- Use `assignment.tutor_id`; never infer a recipient from browser input.
- If the assignment has no tutor, save the submission and log the missing
  recipient. This is a configuration defect, not a reason to discard work.
- Never notify a tutor in another `school_id`.
- A repeated submit is already rejected by the submission uniqueness contract;
  the notification must therefore be emitted only after a new insert.
- Reuse the existing idempotency pattern with a key containing the submission
  UUID and recipient, so retried API work cannot email twice.
- Do not include the private R2 object key or the submitted file in email/push.
  The deep link opens the authenticated review workspace, which obtains a fresh
  signed URL.
- For centre accounts, the assigned tutor is the first recipient. Adding an
  opt-in admin copy is a separate product decision and is out of scope here.

## UX copy

In-app title: `New assignment submission`

Body: `{Student name} submitted {Assignment title}.`

Email subject: `New submission for {Assignment title}`

Push: `{Student name} submitted {Assignment title}.`

## Implementation checklist

- Add `submission_received` to notification event types, email templates and
  event-to-template mapping.
- Add `notifySubmissionReceived` in `api/src/notifications/triggers.ts`.
- Call it after the insert in `api/src/routes/assignments.ts`.
- Add unit tests for correct tutor targeting, idempotent retry, no-tutor
  fallback, and tenant isolation.
- Add a staging verification: independent tutor creates an assignment, student
  submits once, tutor receives one in-app notification and one email; push is
  verified separately with an opted-in browser.
