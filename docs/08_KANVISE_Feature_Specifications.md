# Kanvise — Feature Specifications
**Version:** 1.0  
**Prepared by:** Architecture Team  
**Date:** June 2026  
**Status:** Approved — Implementation Reference for All Features

---

## Purpose

This document provides detailed feature-level specifications for every core feature in the Kanvise MVP. Where the API Specification (Document 05) defines the interface, this document defines the behaviour — the business rules, edge cases, data flows, validation logic, and implementation notes that developers must follow when building each feature.

Each section covers one feature area completely. Developers building a feature must read the relevant section in full before writing any code.

---

## Feature 1 — Authentication & User Management

### 1.1 Registration Validation Rules

**Email:**
- Must be a valid email format
- Must be unique across all Supabase Auth users globally — Supabase enforces this
- Converted to lowercase before storage

**Password:**
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- Enforced by Supabase Auth configuration

**First Name / Last Name:**
- Required, not empty
- Maximum 50 characters each
- Trimmed of leading and trailing whitespace before storage
- No validation on character set — Nigerian names include special characters

**School Slug (Admin only):**
- Lowercase letters, numbers, and hyphens only
- No spaces, no special characters beyond hyphens
- Minimum 3 characters, maximum 50 characters
- Must be globally unique across all schools on Kanvise
- Auto-generated from the school name if not manually entered: `Bright Minds Academy` → `bright-minds-academy`
- If the generated slug is taken, append a number: `bright-minds-academy-2`

### 1.2 Kanvise User ID Generation Rules

Format: `KNV-{ROLE_CODE}-{PADDED_SEQUENCE}`

The sequence is global per role — the 100th student to register on the entire platform gets `KNV-STU-00100` regardless of which school they belong to.

The sequence number is padded to 5 digits. When the sequence exceeds 99999, padding extends automatically — the next ID becomes `KNV-STU-100000`. This must not break any display or storage.

The ID is generated atomically using the `increment_user_sequence` Supabase RPC to prevent duplicate IDs under concurrent registrations.

The ID is immutable once assigned — it cannot be changed, even if the user changes their name or email.

### 1.3 School Creation Rules

An Admin can only create one school. If `POST /schools` is called by an Admin who already has a school, return `409 SCHOOL_ALREADY_EXISTS`.

The school slug is the permanent public identifier. Once set, it cannot be changed — changing it would break all shared links. Admins must be warned of this on the setup screen.

The Paystack subaccount must be created for the school immediately after school creation. If Paystack subaccount creation fails, the school is still created but flagged as `paystack_subaccount_pending`. The Admin is shown a warning banner on their dashboard until the subaccount is resolved. No student payments can be processed until the subaccount is active.

### 1.4 User Removal Rules

When an Admin removes a user from the school:

- The `user_profiles` record is soft-deleted — `is_active` set to false, not physically deleted
- The user can no longer log in to the school dashboard
- All historical data is preserved: attendance records, submissions, mock results, payment records
- The removed user's content (notes, assignments, mocks if a tutor) is preserved — it is not deleted
- The freed slot (if any student/tutor cap applies per tier) becomes available immediately

An Admin cannot remove themselves. The system must prevent this.

### 1.5 Profile Update Rules

Users can update: first name, last name, bio (tutors), profile photo.

Users cannot update: email (must go through Supabase Auth email change flow, post-MVP), role, school_id, kanvise_user_id.

Email changes are out of scope for MVP. The PATCH /auth/me endpoint silently ignores any `email`, `role`, `school_id`, or `kanvise_user_id` fields in the request body.

---

## Feature 2 — Avatar System

### 2.1 Avatar Component Options

The avatar is composed of layered SVG components. Each layer is an independent selection. The frontend renders the avatar by stacking the selected layers in order.

**Layer stack order (bottom to top):**
1. Skin tone base (face and exposed skin)
2. Face shape
3. Hair style (back layer — hair behind the face)
4. Eyes
5. Nose
6. Mouth
7. Hair style (front layer — hair over the face)
8. Outfit
9. Accessory (glasses — overlays the face)
10. Headwear (overlays the hair)

**Skin tone options:** 6 options covering a realistic range from lightest to deepest. Keys: `s1`, `s2`, `s3`, `s4`, `s5`, `s6`.

**Face shape options:** 4 options (oval, round, square, heart). Keys: `f1`, `f2`, `f3`, `f4`.

**Hair style options:** 10 options covering short, medium, long, braids, locs, afro, bald. Keys: `h1` through `h10`. Each hair style has both a back and front layer SVG.

**Hair colour options:** 8 options (black, dark brown, brown, light brown, auburn, blonde, grey, custom colours). Keys: `hc1` through `hc8`. Applied as a colour fill to the hair SVG layers.

**Outfit colour options:** 8 options (navy, white, grey, black, green, burgundy, blue, yellow). Keys: `oc1` through `oc8`.

**Accessory options:** None, round glasses, rectangular glasses, sunglasses. Keys: null, `ac1`, `ac2`, `ac3`.

**Headwear options:** None, cap, beanie, hijab, graduation cap. Keys: null, `hw1`, `hw2`, `hw3`, `hw4`.

### 2.2 Avatar Storage

The avatar is stored as a JSON config object in the `avatar_configs` table — not as a generated image. The frontend renders the avatar on the fly by loading the SVG components for each selected option.

This means:
- Storage is minimal — just a small JSON record
- If avatar options are ever updated (new hair styles added), existing avatars automatically get the updated SVG quality
- Avatar rendering is purely frontend — no image generation service needed

### 2.3 Avatar Rendering Locations

The avatar appears in four places in the application. Each has specific size requirements:

| Location | Size | Shape | When Shown |
|---|---|---|---|
| Dashboard header | 36×36px | Circle with border | Always |
| Profile page | 120×120px | Circle | Always |
| Live classroom (camera off) | 80×80px | Circle | When user's camera is off |
| Participant list | 28×28px | Circle | During live class |

The frontend builds a reusable `<AvatarRenderer />` component that accepts a `size` prop and the avatar config object and handles all four display contexts.

### 2.4 Avatar Builder UX Rules

The avatar builder screen layout: category tabs on the left (or top on mobile), live preview of the avatar on the right (or top on mobile).

Selecting any option updates the preview in real time — no save button needed during customisation. The avatar is only persisted when the user explicitly clicks Save.

All options must be visible without scrolling within each category tab. If options overflow, they scroll within the tab panel, not the whole page.

The default avatar on first registration (before the user has customised it): skin tone `s3`, face shape `f1`, hair style `h1`, hair colour `hc1`, outfit colour `oc1`, no accessory, no headwear. This default must look like a complete, neutral avatar — not a broken or empty placeholder.

Gender-neutral by default — no option in the builder is labelled or categorised by gender.

### 2.5 Avatar in LiveKit

When a student or tutor has their camera off in a live class, their avatar is shown as a video placeholder. The LiveKit room is configured with the avatar as the participant's `metadata` field — a URL to a publicly accessible rendered version of the avatar.

Since the avatar is stored as a config JSON and not an image, the Hono backend must generate a publicly accessible avatar image URL on demand. For MVP, this is a Next.js route that accepts the avatar config as query parameters and returns an SVG:

`kanvise.ng/api/avatar/render?skin=s3&face=f1&hair=h1...`

This rendered SVG URL is passed to LiveKit as the participant's avatar URL when generating the access token.

---

## Feature 3 — Public School Page & Programme Pages

### 3.1 Public Page Data Freshness

Public pages are Server Components rendered on Vercel. They are cached at the edge. Cache must be invalidated when:

- Admin updates school profile (name, bio, logo, banner, video intro, contact info, social links)
- Admin publishes or unpublishes a programme, sub-programme, or course
- Admin creates, updates, or deletes a promo
- A new review is submitted or an Admin toggles review visibility

Cache invalidation is triggered from Hono after any of these operations by calling the Next.js cache revalidation API: `revalidatePath('/[centre-slug]')`.

### 3.2 Enrolled Student Count Display

The enrolled student count shown on the public page is a live count of unique students who have at least one active enrolment within the school. It is not a vanity number — it reflects real enrolments.

For a programme page specifically, the enrolled count is the number of students enrolled in that specific programme (not sub-programmes or courses within it separately).

Student count is only shown if it is greater than zero. If a new school has no enrolments yet, no count is displayed rather than showing "0 students".

### 3.3 Promo Display Rules

Promos are displayed in order of `order_index`. Only promos with `is_active = true` are shown.

Maximum promos displayed on the public page at once: no hard cap for MVP — Admin decides how many to create. A soft UI recommendation of 5 maximum can be communicated in the dashboard.

If a promo's `link_id` points to a programme, sub-programme, or course that has since been deleted or unpublished, the promo image still shows but the link is disabled. The Admin should be notified via a dashboard warning that a promo has a broken link.

### 3.4 Video Intro Rules

Video intro is optional. If not set, no video section appears on the public page — the space is not replaced by a placeholder.

Supported video formats for upload: MP4, MOV, WebM.

Maximum video file size: 500MB (enforced at presign URL generation).

The video is served from Cloudflare R2 via the CDN. It is not embedded from YouTube or Vimeo for MVP — it is a direct R2 upload. Autoplay is disabled. The video has controls and plays only when the student clicks play.

### 3.5 Tutor Card Display Rules

Tutor cards on the school's public page show all tutors who are assigned to at least one published programme or course in the school.

Tutor cards on a specific programme page show only tutors assigned to courses within that programme.

A tutor card shows: circular profile photo (or avatar fallback if no photo), full name, subjects they teach within the context of that page.

Clicking a tutor card opens a modal or side panel with their full bio. If the tutor has no bio, the click does nothing (the card is not interactive without a bio).

### 3.6 Review Display Rules

Reviews are shown per programme, sub-programme, or course — not for the school as a whole. A school's public page shows the average rating and review count per programme in the programme listing, but the full review list is only on the individual programme/course page.

Only reviews with `is_published = true` are shown publicly.

Reviews are ordered most recent first.

The average rating displayed is rounded to one decimal place: 4.7, not 4.73.

A student can only submit one review per programme/sub-programme/course. If they try to submit a second, return `409 ALREADY_REVIEWED`.

Only students who are enrolled in the item being reviewed can submit a review. This is enforced by Hono — not just on the frontend.

---

## Feature 4 — Class Scheduling & Notifications

### 4.1 Scheduling Rules

A live class must be scheduled at least 30 minutes in the future. Scheduling in the past or within the next 30 minutes returns `400 SCHEDULED_TOO_SOON`.

A tutor cannot have two live classes scheduled at the same time within the same school. Hono checks for overlapping scheduled times for the same tutor before creating a new class. Overlap is defined as: the new class's `scheduled_at` falls within the `scheduled_at` to `scheduled_at + duration_minutes` window of any existing class for that tutor. Returns `409 TUTOR_SCHEDULE_CONFLICT`.

A course can have multiple simultaneous live classes scheduled by different tutors — this is permitted.

Duration must be between 15 minutes and 240 minutes (4 hours). Outside this range returns `400 INVALID_DURATION`.

### 4.2 Notification Timing

The pre-class notification background job runs every 5 minutes. It sends notifications to students whose class starts in the 10–15 minute window ahead. This means the actual notification arrives between 10 and 15 minutes before class, not exactly 10 minutes.

Notifications are sent both as in-app notifications (stored in the `notifications` table) and as emails via Resend.

The `notification_sent` flag on the live class record prevents duplicate sends. Once set to true, the job skips that class on all future ticks even if the class is still in the future.

### 4.3 Class Cancellation Rules

Only Admins can cancel a scheduled class. Tutors cannot cancel — they must ask the Admin.

A class that is already `live` or `completed` cannot be cancelled — it can only be ended (if live) or left as completed.

When a class is cancelled, all enrolled students in the relevant course receive an in-app notification and an email informing them of the cancellation.

### 4.4 Rescheduling Rules

Rescheduling is handled via PATCH /live-classes/:id. Only the `scheduled_at`, `duration_minutes`, and `title` fields can be updated. The `course_id` and `tutor_id` cannot be changed after creation — delete and recreate if needed.

A class cannot be rescheduled once it has started (status = live) or completed.

When a class is rescheduled, the `notification_sent` flag is reset to false so notifications are re-sent for the new time.

---

## Feature 5 — Attendance Tracking

### 5.1 Data Source

Attendance data comes exclusively from LiveKit webhook events. Hono never estimates or infers attendance — it only records what LiveKit reports.

LiveKit sends two events per participant session:
- `participant_joined` — when a user connects to the room
- `participant_left` — when a user disconnects from the room

### 5.2 Multiple Join/Leave Events

A student may join and leave a class multiple times in one session (e.g. connectivity drops in Nigeria). Each join creates a new `attendance_records` row. Each leave updates the most recent open row for that student in that class (the row where `left_at` is null).

To calculate total attendance time for a student in a class, sum all `duration_seconds` values for that student for that `live_class_id`.

The attendance dashboard displays total time in session, not individual join/leave events. The raw events are stored but only the aggregate is shown to tutors and admins.

### 5.3 Unclosed Sessions

If a student's connection drops without a clean disconnect (e.g. phone dies, power cut), LiveKit may not send a `participant_left` event. In this case, the attendance record has `left_at = null` indefinitely.

A background cleanup job runs 30 minutes after a live class ends (status changes to `completed`). It finds all attendance records for that class where `left_at` is null and sets `left_at = live_class.ended_at` and calculates `duration_seconds` accordingly.

This ensures all attendance records are closed after a class ends.

### 5.4 Attendance Rate Calculation

Attendance rate for a class = (number of unique students who attended / number of students enrolled in the course) × 100.

A student "attended" if they have at least one attendance record for the class with `duration_seconds > 0` or `joined_at` is set.

Attendance rate is calculated on the fly in the API response — it is not stored in the database.

### 5.5 Student Attendance View

Students can see their own attendance history filtered by course. For each class they attended, they see the class title, date, and their total time in session formatted as `X hr Y min` or `Y min`.

Students cannot see other students' attendance records. The `GET /students/me/attendance` endpoint is scoped to the authenticated student only.

---

## Feature 6 — Notes & Assignments

### 6.1 Notes Upload Rules

**Supported file types:** PDF, DOCX, PPTX, JPG, PNG.

**Maximum file size:** 50MB per file.

**File type validation:** Validated by checking the actual MIME type of the file at presign URL generation time — not just the file extension. A file renamed from `.exe` to `.pdf` must be rejected.

**Upload flow:**
1. Tutor selects file on frontend
2. Frontend calls `POST /storage/presign/upload` with file metadata
3. Hono validates type and size, generates R2 presigned URL
4. Frontend uploads directly to R2
5. Upload completes — frontend calls `POST /courses/:courseId/notes` with the file key
6. Hono creates the note record linked to the course

**Notes organisation:** Notes are listed in reverse chronological order (newest first) within a course. Students can filter by file type. There is no folder structure within a course's notes — all notes are flat.

**Note visibility:** A note is visible to all enrolled students in the course immediately on creation. There is no draft state for notes.

**Note deletion:** Deleting a note removes the database record. The R2 file is not immediately deleted — a cleanup job (post-MVP) handles orphaned R2 files. For MVP, note that deleted notes leave orphaned files in R2. This is acceptable at launch scale.

### 6.2 Assignment Creation Rules

**Deadline validation:** Deadline must be at least 1 hour in the future at the time of creation. Returns `400 DEADLINE_TOO_SOON`.

**Assignment attachment:** The optional attachment file follows the same upload flow as notes. Supported types: PDF, DOCX, PPTX, JPG, PNG. Maximum 50MB.

**Draft state:** Assignments have an `is_published` flag. An assignment is visible to students only when published. Tutors can create an assignment in draft and publish it later.

**Editing after publication:** An assignment's title, description, and attachment can be edited after publication. The deadline can be extended but not shortened if students have already submitted — shortening the deadline after submissions exist returns `400 CANNOT_SHORTEN_DEADLINE_WITH_SUBMISSIONS`.

### 6.3 Submission Rules

**One submission per student:** A student can only submit once per assignment. After submission, the file cannot be replaced. If the student needs to resubmit, they must ask the Tutor to delete the submission — this is an Admin/Tutor action, not self-service for MVP.

**Late submissions:** The system allows late submissions by default — it does not block a student from submitting after the deadline. However, the submission is marked as `is_late = true` (add this column to `submissions` table) and the tutor sees a visual indicator in their inbox. Whether to penalise late submissions is the tutor's decision, not the system's.

**File requirements:** Submission file must be one of: PDF, DOCX, PPTX, JPG, PNG. Maximum 50MB. Same validation as notes.

**Submission confirmation:** After successful submission, the student sees a confirmation screen with a timestamp. An in-app notification is not sent on submission — the confirmation screen is sufficient.

### 6.4 Tutor Review Rules

The submissions inbox shows all submissions for an assignment grouped by: unreviewed first, then reviewed.

A tutor can review a submission by entering a score and optional feedback text. Score is a decimal number with up to 2 decimal places. The maximum score is not enforced by the system — tutors set their own marking scheme. A score of 0 is valid.

Clicking on a submission opens a preview of the submitted file (PDF and images render inline; DOCX and PPTX show a download button).

After grading, the student receives an in-app notification and email: "Your submission for [Assignment Title] has been graded. Score: X."

### 6.5 Deadline Reminder Notification

The background job that runs every 30 minutes checks for assignments where:
- `deadline_at` is between `now + 24 hours` and `now + 25 hours`
- The student has not yet submitted

For each such student, it sends one reminder email via Resend: "Your assignment [title] is due in less than 24 hours."

This fires once per assignment per student. It does not repeat. The job uses the absence of a submission record as the "has not submitted" check.

---

## Feature 7 — Mock Examinations

### 7.1 Mock Creation Rules

A mock can only be created by a tutor who is assigned to the relevant course.

**Draft state:** All mocks are created in draft status. They are invisible to students until published.

**Scheduled publish:** If `publish_at` is set, the mock auto-publishes at that time via the background job. If `publish_at` is null and the tutor clicks Publish, it publishes immediately.

**Minimum question requirement:** A mock must have at least one question before it can be published. Attempting to publish with zero questions returns `400 NO_QUESTIONS`.

**Time limit:** `time_limit_minutes` is optional. If null, students can take as long as they need. If set, the frontend countdown timer auto-submits when it reaches zero.

### 7.2 Question Management Rules

**Question ordering:** Questions have an `order_index` that controls display order. When a new question is added without specifying `order_index`, it is appended at the end (max existing `order_index` + 1).

**Reordering questions:** Reordering is handled by updating `order_index` values. The API accepts a `PATCH /mocks/:mockId/questions/reorder` endpoint with an array of `{ question_id, order_index }` pairs — add this to the API spec.

**MCQ options:** Each MCQ question must have between 2 and 6 options. Exactly one option must have `is_correct = true`. Fewer than 2 options returns `400 MCQ_REQUIRES_MINIMUM_TWO_OPTIONS`. More than one correct option returns `400 MCQ_MUST_HAVE_ONE_CORRECT_OPTION`.

**Theory questions:** Theory questions have no options. The `options` array must be empty or absent for theory questions.

**Mixed question types:** A single mock can contain both MCQ and theory questions in any order.

**Editing after publication:** Once a mock has been published and at least one student has started an attempt, questions and options cannot be edited or deleted. This protects the integrity of ongoing attempts. Attempting to edit a published mock with attempts returns `409 ATTEMPTS_EXIST`.

### 7.3 Auto-Grading Logic

MCQ auto-grading runs in Hono on submission. The logic:

```
For each MCQ answer in the submission:
  1. Look up the question's correct option from mock_question_options
     where is_correct = true
  2. Compare selected_option_id to the correct option's id
  3. If match: mark answer is_correct = true, add question.marks to running score
  4. If no match: mark answer is_correct = false, add 0

Final mcq_score = sum of marks for all correct MCQ answers
correct_mcq_answers = count of answers where is_correct = true
total_mcq_questions = count of MCQ questions in the mock
```

The correct option IDs are fetched from the database inside Hono — they are never sent to the frontend at any point. The frontend only receives option texts and IDs without the `is_correct` field.

Theory questions receive `is_correct = null` on submission. They are stored as `theory_answer_text` in `mock_answers` for the tutor to review later.

### 7.4 Timer Implementation

**Frontend responsibility:** The countdown timer is managed entirely on the frontend. When a student opens a mock, the timer starts from `time_limit_minutes` and counts down. When it reaches zero, the frontend automatically calls `POST /attempts/:attemptId/submit` with whatever answers the student has provided so far.

**Backend protection:** The backend records `started_at` when the attempt is created. On submission, Hono checks: if `time_limit_minutes` is set and `submitted_at - started_at > time_limit_minutes + 2 minutes` (2 minute grace for network latency), the submission is marked as `status = timed_out` rather than `submitted`. The score is still computed — the student does not lose their answers.

**Tab switching:** If a student switches tabs or minimises the browser, the timer continues running. The frontend does not pause the timer on tab blur.

**Page refresh:** If a student refreshes the page during a mock, the frontend calls `GET /mocks/:mockId/attempts/me` to check if an in-progress attempt exists. If it does, the mock resumes from the current state with the remaining time calculated from `started_at`.

### 7.5 Results Display Rules

**For students:** After submission, the student immediately sees:
- Their MCQ score (e.g. 14/20)
- Their MCQ percentage
- Which questions they got right and wrong (green/red indicators)
- Theory answers marked as "Pending tutor review"

The student can navigate away and return to see their results at any time via My Results. Theory question results are updated when the tutor grades them.

**For tutors:** The results table shows all students' attempts for a mock. Columns: student name, MCQ score, MCQ percentage, time taken, submission status, theory review status (pending/complete).

Clicking a student's result opens the detailed breakdown: each question, the student's answer, the correct answer (for MCQ), and the tutor's grade/feedback (for theory).

### 7.6 Theory Answer Grading Rules

A tutor can grade any theory answer from the mock results view. Grading requires a `tutor_score` (decimal, 0 or above) and an optional `tutor_feedback` text.

There is no maximum score enforced — the tutor sets their own marking scheme per question.

When all theory answers in an attempt are graded, the attempt's status is updated to `fully_graded`. The student receives an in-app notification and email: "Your mock results for [Mock Title] have been fully graded."

A theory answer can be re-graded — the `tutor_score` and `tutor_feedback` can be updated after initial grading.

---

## Feature 8 — Payments

### 8.1 Paystack Split Payment Configuration

When a school is created, Hono calls the Paystack API to create a subaccount for the tutorial centre. The subaccount is linked to the tutorial centre's bank account.

**Subaccount creation payload:**
```json
{
  "business_name": "School Name",
  "settlement_bank": "bank_code",
  "account_number": "account_number",
  "percentage_charge": 5
}
```

The `percentage_charge` is the percentage Kanvise takes from each transaction. For MVP this is a fixed platform-level value stored in environment variables: `KANVISE_PLATFORM_FEE_PERCENT=5`.

When a student initiates a payment, the Paystack transaction is created with the subaccount code. Paystack automatically splits the payment: 5% goes to Kanvise's main account, 95% goes to the tutorial centre's subaccount. This split happens at the gateway — Kanvise never holds the tutorial centre's funds.

### 8.2 Payment Amount Calculation

The amount the student pays is the listed price of the programme/sub-programme/course. Kanvise's 5% fee is already included in this price — it is not added on top.

Example: Programme listed at ₦15,000. Student pays ₦15,000. Paystack splits: ₦750 to Kanvise, ₦14,250 to the tutorial centre.

The payment record stores:
- `amount` = 15,000 (total paid by student)
- `kanvise_fee` = 750 (5%)
- `centre_amount` = 14,250 (95%)

**Important:** The fee percentage must be stored on the payment record at the time of payment — not read from the environment variable later. This protects against future fee changes affecting historical records.

### 8.3 Payment Flow — Detailed Steps

```
1. Student clicks Enrol on programme page (authenticated)
2. Frontend calls POST /enrolments/initiate
3. Hono checks student is not already enrolled → 409 if so
4. Hono fetches the item's price from the database
5. Hono creates a pending payment record in the payments table
6. Hono calls Paystack API: initialize transaction
   - amount: price in kobo (price × 100)
   - email: student's email
   - reference: unique generated reference (stored on payment record)
   - subaccount: tutorial centre's Paystack subaccount code
   - bearer: 'subaccount' (centre bears the transaction fees)
7. Paystack returns an authorization_url
8. Hono returns the authorization_url to the frontend
9. Frontend redirects student to Paystack checkout page
10. Student completes payment on Paystack
11. Paystack redirects student back to kanvise.ng/payment/callback?reference=xxx
12. Simultaneously, Paystack sends charge.success webhook to kanvise.ng/api/webhooks/paystack
13. Webhook handler verifies Paystack signature
14. Webhook handler calls POST /internal/payments/confirm with the reference
15. Hono looks up the payment record by reference
16. Hono verifies with Paystack API: GET /transaction/verify/:reference (double-check)
17. Hono updates payment status to 'successful' and sets paid_at
18. Hono creates enrolment record
19. Hono calls Resend: send payment receipt email
20. Hono calls Resend: send access confirmation email
21. The callback page (step 11) calls GET /payments?reference=xxx to check status
22. If status = successful, redirect to dashboard with success toast
```

**Why both webhook and callback:** The webhook is the authoritative confirmation. The callback page cannot trust the URL parameters alone — Paystack's redirect can be triggered by anyone who knows the reference. The callback page polls for the payment status which Hono only updates after webhook verification.

### 8.4 Webhook Idempotency

Paystack may send the same webhook event multiple times. Hono must handle duplicate webhooks without creating duplicate enrolments or sending duplicate emails.

Before processing a `charge.success` event, Hono checks if the payment record already has `status = successful`. If yes, it returns `200` immediately without processing. This is the idempotency guard.

### 8.5 Failed Payments

If the payment fails (student abandons or card declines), Paystack sends a `charge.failed` event. Hono updates the payment record `status = failed`. No enrolment is created.

The student is redirected back to the programme page with a `?payment=failed` query param. The frontend shows an error toast and the Enrol button is still available for them to try again.

A new payment record is created for each payment attempt — the failed record is kept for audit purposes.

### 8.6 Free Access (No Payment)

For MVP, all programmes and courses have a price. There is no free enrolment flow. If a tutorial centre wants to offer free access, the workaround is to set the price to ₦0 — Paystack supports ₦0 transactions for verification purposes.

Post-MVP: a proper free access flag can be added to the programme/course model that bypasses the payment flow entirely.

### 8.7 Payment History Display

**Student view:** Shows all their payments across all tutorial centres: date, item purchased, amount, status (successful/pending/failed). Each row links to the payment receipt.

**Admin view:** Shows all payments received by their school from all students: student name, item purchased, amount, student amount (after Kanvise fee), date. Can filter by date range, student, and status. Shows total revenue summary at the top.

**Payment receipt:** A formatted receipt is sent by email via Resend immediately after successful payment. The receipt includes: transaction reference, student name, school name, item purchased, amount paid, date and time, Kanvise branding. No VAT for MVP.

### 8.8 Subscription Billing

Tutorial centres pay Kanvise a flat monthly fee for platform access. This is a separate payment flow from student payments.

The subscription amount is stored in environment variables: `KANVISE_MONTHLY_SUBSCRIPTION_NGN=XXXXX`. The exact amount is not defined in this document — it is a business decision.

Subscription payment is initiated by the Admin from their Subscription & Billing screen. It is a direct Paystack charge to Kanvise's main account — no subaccount split.

For MVP, subscription renewal is manual — the Admin must initiate payment each month. Automatic recurring billing is post-MVP.

When a subscription expires (`expires_at < now`):
- The Admin sees a prominent warning banner on every dashboard page
- Students and tutors are unaffected — their access continues
- The Admin cannot create new programmes or courses until they renew
- After a 7-day grace period past expiry, the school is flagged as `is_active = false` and all users see a "School subscription expired" page instead of their dashboard

---

## Feature 9 — Notifications

### 9.1 Notification Types and Triggers

| Type | Trigger | Recipients |
|---|---|---|
| `live_class_reminder` | Class starts in 10–15 min | All students enrolled in the course |
| `assignment_deadline` | Assignment deadline in 24–25 hrs, student not submitted | Individual students who have not submitted |
| `mock_published` | Mock auto-published by background job | All students enrolled in the course |
| `payment_confirmed` | Payment webhook confirmed | The paying student |
| `enrolment_confirmed` | Enrolment created after payment | The enrolling student |
| `submission_graded` | Tutor grades a submission | The submitting student |
| `mock_fully_graded` | All theory answers in an attempt graded | The student whose attempt was graded |
| `class_cancelled` | Admin cancels a scheduled class | All students enrolled in the course |

### 9.2 In-App vs Email

All notification types trigger both an in-app notification (stored in `notifications` table) and an email via Resend.

The one exception is `payment_confirmed` and `enrolment_confirmed` — these are combined into a single email (one email, not two). The in-app notifications are still created separately.

### 9.3 Notification Read State

Unread notifications are shown with a visual indicator (dot or badge) in the dashboard header. The unread count updates on every page load.

Clicking any notification marks it as read. The "Mark all as read" button marks all at once.

Notifications are not deleted — they are kept indefinitely so users can scroll back through their history.

### 9.4 Notification Centre UI

The notification centre is a dropdown panel accessible from the dashboard header. It shows the 20 most recent notifications. A "View all" link opens a full notifications page with pagination.

Each notification shows: icon (per type), title, body text, time ago (e.g. "3 hours ago"), read/unread indicator. Clicking the notification navigates to the relevant entity (e.g. clicking a `live_class_reminder` opens the live class page).

---

*End of Document — Version 1.0*
