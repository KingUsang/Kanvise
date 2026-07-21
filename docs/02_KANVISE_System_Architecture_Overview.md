# Kanvise — System Architecture Overview
**Version:** 1.0  
**Prepared by:** Architecture Team  
**Date:** June 2026  
**Status:** Approved — Reference for All Development Decisions

---

## Purpose

This document describes the complete system architecture of the Kanvise platform. It covers every runtime environment, every service, every communication path, and the flow of data through the system for all major operations. Every developer must understand this document before building any feature. The architecture described here is the source of truth — if code is written that contradicts this document, the code is wrong, not the document.

---

## 1. Runtime Environments

Kanvise is distributed across four runtime environments. Each environment has a single responsibility and communicates with others only through defined interfaces.

```
┌─────────────────────────────────────────────────────────────────────┐
│                            VERCEL                                    │
│                                                                      │
│   Next.js Application                                               │
│   ├── Public Pages (SSR/SSG)                                        │
│   │   ├── kanvise.com                    (Marketing / Landing)       │
│   │   ├── kanvise.com/[centre-slug]      (Centre Public Page)        │
│   │   └── kanvise.com/[centre-slug]/[programme-slug] (Programme Page)│
│   │                                                                  │
│   ├── Auth Pages                                                     │
│   │   ├── /auth/login                                               │
│   │   ├── /auth/register                                            │
│   │   └── /auth/reset-password                                      │
│   │                                                                  │
│   ├── Dashboard Pages (CSR — Role Protected)                        │
│   │   ├── /dashboard/**                 (Unified Admin/Tutor)       │
│   │   └── /dashboard/student/**                                     │
│   │                                                                  │
│   └── Next.js Route Handlers                                        │
│       ├── /api/webhooks/paystack        (Payment webhook receiver)  │
│       ├── /api/auth/**                  (Supabase Auth callbacks)   │
│       ├── /api/upload/presign           (R2 presigned URL proxy)    │
│       └── /api/avatar                  (Avatar config save)        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS (REST)
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                          SCALEWAY                                    │
│                                                                      │
│  ┌─────────────────────────────────┐  ┌──────────────────────────┐  │
│  │       Hono API Server           │  │   LiveKit Server         │  │
│  │       Node.js + PM2             │  │   (Self-Hosted)          │  │
│  │                                 │  │                          │  │
│  │  Middleware Stack:              │  │  Handles:                │  │
│  │  JWT Verify → Tenant Resolve   │  │  - WebRTC routing        │  │
│  │  → Role Auth → Rate Limit      │  │  - Video/Audio streams   │  │
│  │  → Route Handler               │  │  - Chat messages         │  │
│  │                                 │  │  - Participant events    │  │
│  │  Modules:                       │◄─┤                          │  │
│  │  - Schools                      │  │  Webhooks sent to Hono   │  │
│  │  - Programmes/Courses           │  │  over private network:   │  │
│  │  - Enrolment                    │  │  - participant_joined    │  │
│  │  - Content (Notes/Assignments)  │  │  - participant_left      │  │
│  │  - Mock Exams                   │  │                          │  │
│  │  - Attendance                   │  └──────────────────────────┘  │
│  │  - Payments                     │                                 │
│  │  - Notifications                │  Private Network (no internet) │
│  │  - Public Pages API             │  LiveKit ←→ Hono               │
│  │                                 │                                 │
│  │  Background Jobs (node-cron):   │                                 │
│  │  - Mock auto-publish            │                                 │
│  │  - Class notifications          │                                 │
│  │  - Deadline reminders           │                                 │
│  └─────────────────────────────────┘                                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
┌─────────────────┐ ┌────────────┐ ┌───────────────────┐
│    SUPABASE     │ │ CLOUDFLARE │ │   EXTERNAL APIS   │
│                 │ │            │ │                   │
│  PostgreSQL DB  │ │  R2 Storage│ │  Paystack         │
│  Supabase Auth  │ │  CDN Edge  │ │  Resend           │
│  Connection     │ │            │ │                   │
│  Pooling        │ │  Stores:   │ │                   │
│                 │ │  - Notes   │ │                   │
│  All data lives │ │  - Uploads │ │                   │
│  here.          │ │  - Images  │ │                   │
│  Accessed only  │ │  - Videos  │ │                   │
│  by Hono via    │ │  - Avatars │ │                   │
│  service key.   │ │            │ │                   │
└─────────────────┘ └────────────┘ └───────────────────┘
```

---

## 2. Communication Paths

Every arrow in the architecture above represents a specific type of communication. This section defines each one.

### 2.1 Browser → Vercel (Next.js)

All user-facing traffic enters through Vercel. The browser never speaks directly to Hono, Supabase, LiveKit, or any other backend service. Vercel is the single entry point for users.

Public pages are served as pre-rendered HTML with JSON data embedded. The browser receives a fully rendered page immediately — no loading state for public content.

Dashboard pages load as client-side React applications. After the initial HTML shell loads, the client fetches data by calling Next.js route handlers or the Hono API directly via fetch.

### 2.2 Next.js Server Components → Hono API

Server Components that render public pages (centre page, programme page) call the Hono API during render on the server. The response is embedded into the HTML before it reaches the browser. This means public page data is always fresh and the browser never makes an additional API call just to load the page.

### 2.3 Next.js Client Components → Hono API

Dashboard interactions (submitting an assignment, creating a mock, scheduling a class) are made from Client Components using fetch. These calls include the user's JWT in the Authorization header. Hono validates the JWT, resolves the tenant, checks the role, and processes the request.

### 2.4 Next.js Route Handlers → Hono API

Some Next.js route handlers act as a proxy to Hono — for example, the Paystack webhook handler receives the webhook on the Next.js side (because it needs to be on the main domain) and then forwards the relevant data to Hono for processing. This keeps business logic out of Next.js route handlers.

### 2.5 Hono → Supabase

Hono is the only service that communicates with Supabase. It uses the Supabase JS client with the service role key. Every query is scoped to a school_id extracted from the authenticated user's context. Supabase is never called directly from the frontend.

### 2.6 Hono → Cloudflare R2

Hono generates presigned URLs for R2. For uploads, it generates a presigned PUT URL and returns it to the caller. For serving private files, it generates a presigned GET URL. Hono never buffers file content — files go directly between the browser and R2.

### 2.7 Hono → LiveKit

When a tutor starts a live class, Hono calls the LiveKit server SDK to create a room and generate an access token. This call goes over the Scaleway private network — fast and secure.

### 2.8 LiveKit → Hono (Attendance Webhooks)

When a participant joins or leaves a LiveKit room, LiveKit sends a webhook to Hono over the private network. Hono processes the event, records the attendance entry, and responds with 200. This is the only direction LiveKit communicates with Hono — LiveKit pushes events, Hono never polls LiveKit for participant state.

### 2.9 Hono → Paystack

Hono calls the Paystack API to initiate payment transactions, create subaccounts for tutorial centres, and verify payment references. All Paystack API calls are server-side only.

### 2.10 Paystack → Next.js (Webhook)

Paystack sends payment event webhooks to `kanvise.com/api/webhooks/paystack`. The Next.js route handler verifies the Paystack signature, then calls the Hono API to process the confirmed payment — granting enrolment access, sending the receipt email, and recording the transaction.

### 2.11 Hono → Resend

All outbound emails are sent from Hono by calling the Resend API. Email templates are React Email components compiled to HTML inside the Hono process.

### 2.12 Browser → Cloudflare R2 (Direct Upload/Download)

After Hono generates a presigned URL, the browser uploads directly to R2 or downloads directly from R2. The file never passes through Hono or Vercel. This keeps the API server lean and eliminates file buffering.

### 2.13 Browser → LiveKit (WebRTC)

Once the browser has a LiveKit access token from Hono, it connects to the LiveKit server directly for the WebRTC session. Video and audio streams flow between the browser and LiveKit — they never touch Hono or Vercel.

---

## 3. The Public Layer

The public layer is the part of Kanvise that is visible without any login. It serves two purposes: marketing Kanvise itself to tutorial centres, and marketing individual tutorial centres to their prospective students.

```
kanvise.com                    → Kanvise marketing page
kanvise.com/[centre-slug]      → Tutorial centre public page
kanvise.com/[centre-slug]/[programme-slug]  → Programme page
kanvise.com/[centre-slug]/[course-slug]     → Standalone course page
```

All public pages are Server Components. They fetch data from Hono during server render. The rendered HTML is cached at Vercel's edge CDN. Cache is invalidated when an Admin updates their school profile or programme details.

Public pages are fully SEO-indexed. Tutorial centres share these links on WhatsApp, Instagram, and Twitter — the pages must load fast and render correctly in link previews.

The public page for a tutorial centre contains: school banner and logo, description, optional video intro (streamed from R2 via Cloudflare CDN), contact details and social links, enrolled student count, tutor cards (name, subject, circular photo — clickable to tutor bio), promotional banners (image, title, links to a programme or course), list of all programmes and standalone courses with prices, and reviews per programme.

No authentication is required to view any public page. The enrolment CTA on a programme page redirects unauthenticated users to the registration flow with the programme pre-selected.

---

## 4. The Authentication Layer

Authentication is handled by Supabase Auth. The flow is:

```
User fills in registration/login form (Next.js)
         │
         ▼
Supabase Auth JS client (browser, anon key)
         │
         ▼
Supabase Auth service validates credentials
         │
         ▼
JWT returned to browser — stored in httpOnly cookie
         │
         ▼
Every API request to Hono includes JWT in Authorization header
         │
         ▼
Hono middleware verifies JWT using Supabase JWT secret
         │
         ▼
User profile (role, school_id, Kanvise user ID) attached to request context
         │
         ▼
Route handler runs with full user context available
```

The JWT contains the user's Supabase Auth ID. The first time Hono sees a JWT, it looks up the user's Kanvise profile from the database and caches the result in the request context. Subsequent middleware in the same request chain uses this cached profile — there is no repeated database lookup per middleware layer.

Role-based routing is enforced at two levels. On the frontend, Next.js middleware checks the user's role from the JWT cookie and redirects to the correct dashboard root if the user tries to access a route outside their role. On the backend, Hono middleware checks the role on the request context before every route handler runs — the frontend check is a UX convenience, the Hono check is the security enforcement.

---

## 5. The Multi-Tenancy Layer

Multi-tenancy is the most critical architectural concern in Kanvise. Every tutorial centre is a completely isolated environment. Data from one school must never be visible to another.

Tenancy is enforced in Hono middleware that runs before every authenticated route handler. The middleware:

1. Extracts the school_id from the authenticated user's profile in the request context.
2. Attaches the school_id to the request context as `ctx.tenant`.
3. Every route handler that accesses school-scoped data must use `ctx.tenant.school_id` in its database queries as a mandatory filter.

No route handler may query a tenant-scoped table without a `school_id` filter. This is a code review requirement — any pull request that queries a tenant-scoped table without the tenant filter must be rejected.

The following tables are tenant-scoped (every query must include school_id): schools, programmes, sub_programmes, courses, sub_courses, enrolments, users (student/tutor profiles), live_classes, attendance_records, notes, assignments, submissions, mock_exams, mock_questions, mock_answers, mock_results, payments, notifications, promos, reviews.

The following tables are not tenant-scoped (platform-level data): kanvise_subscriptions (tutorial centre billing records), platform_users (Kanvise internal team — post-MVP).

---

## 6. Key Request Flows

This section traces the complete path of requests for the most important operations in the system.

### 6.1 Student Enrols in a Programme

```
1. Student lands on programme page (kanvise.com/[centre]/[programme])
   └── Next.js Server Component fetches programme data from Hono
   └── Page renders with price, tutors, courses, reviews, enrol CTA

2. Student clicks Enrol
   └── If not logged in → redirect to /auth/register?redirect=[programme-url]
   └── Student creates account → Supabase Auth creates user → JWT issued

3. After login, student is returned to the programme page
   └── Client calls POST /api/enrolments/initiate (Hono)
   └── Hono verifies JWT, resolves tenant, checks student not already enrolled
   └── Hono calls Paystack API to initialise a transaction
   └── Paystack returns a payment URL with the split payment config applied
   └── Hono returns the payment URL to the client

4. Student is redirected to Paystack payment page
   └── Student completes payment (card / bank transfer / USSD)
   └── Paystack processes payment and splits: centre amount → subaccount, Kanvise fee → main account

5. Paystack sends charge.success webhook to kanvise.com/api/webhooks/paystack
   └── Next.js route handler verifies Paystack signature
   └── Route handler calls POST /internal/payments/confirm (Hono)
   └── Hono verifies the payment reference
   └── Hono creates enrolment record — student now has access to programme and all content inside
   └── Hono calls Resend to send payment receipt email
   └── Hono calls Resend to send access confirmation email with school link

6. Student is redirected to their dashboard
   └── Dashboard shows the newly enrolled programme and its courses
```

### 6.2 Tutor Starts a Live Class

```
1. Tutor opens their dashboard — sees upcoming live class scheduled by Admin
   └── Client calls GET /live-classes/:id (Hono)
   └── Hono verifies JWT, confirms tutor is assigned to this class

2. Tutor clicks Start Class
   └── Client calls POST /live-classes/:id/start (Hono)
   └── Hono calls LiveKit server SDK to create a room with the class ID as room name
   └── Hono generates a host access token for the tutor
   └── Hono updates the live class record: status = live, started_at = now
   └── Hono returns the LiveKit room name and host token to the client

3. Next.js client receives the token and connects to LiveKit using LiveKit JS SDK
   └── Tutor is now in the live classroom — video, audio, chat, participant list active

4. Students see the class status update to Live on their dashboard
   └── Students click Join Class
   └── Client calls POST /live-classes/:id/join (Hono)
   └── Hono verifies JWT, confirms student is enrolled in the relevant course
   └── Hono generates a participant access token for the student
   └── Hono returns the token to the client
   └── Client connects to LiveKit room using the token

5. LiveKit emits participant_joined event
   └── LiveKit sends webhook to Hono (private network): { participant_id, room_name, joined_at }
   └── Hono maps participant_id to student user_id
   └── Hono creates attendance_record: { student_id, live_class_id, joined_at }

6. Student leaves or tutor ends the class
   └── LiveKit emits participant_left: { participant_id, room_name, left_at }
   └── Hono updates attendance_record: { left_at, duration = left_at - joined_at }

7. Tutor clicks End Class
   └── Client calls POST /live-classes/:id/end (Hono)
   └── Hono calls LiveKit SDK to close the room
   └── Hono updates live class record: status = completed, ended_at = now
   └── Attendance records for all participants are now finalised
```

### 6.3 Mock Auto-Publish (Background Job)

```
1. Tutor creates a mock with a scheduled publish time
   └── Client calls POST /mocks (Hono)
   └── Hono saves mock to database: { status: draft, publish_at: [future timestamp] }

2. node-cron job runs every minute on the Hono server
   └── Queries database: SELECT * FROM mock_exams WHERE status = 'draft' AND publish_at <= NOW()
   └── For each mock found:
       └── Updates status to 'published'
       └── Calls Resend to notify enrolled students: new mock available
       └── Logs the publish event

3. Students see the mock appear on their dashboard on their next load
```

### 6.4 Student Submits a Mock Exam

```
1. Student opens a published mock
   └── Client calls GET /mocks/:id (Hono)
   └── Hono verifies student is enrolled in the course this mock belongs to
   └── Hono returns mock data — questions returned WITHOUT correct answers
   └── Timer starts on the client

2. Student answers questions and submits (or timer hits zero — client auto-submits)
   └── Client calls POST /mocks/:id/submit (Hono) with all answers

3. Hono processes the submission:
   └── Fetches correct answers from database (never sent to client)
   └── Compares student MCQ answers against correct answers
   └── Calculates MCQ score: (correct answers / total MCQ questions) × MCQ weight
   └── Stores theory answers for manual tutor review
   └── Creates mock_result record: { student_id, mock_id, mcq_score, theory_answers, submitted_at }
   └── Returns score to client immediately

4. Client displays the score to the student
   └── MCQ score shown instantly
   └── Theory questions marked as pending tutor review
```

### 6.5 File Upload (Notes, Assignments, Images)

```
1. User selects a file in the UI (tutor uploading notes, student submitting assignment)
   └── Client calls POST /storage/presign (Next.js route handler or Hono)
   └── Request includes: file_type, file_size, content_type, target_entity (note / submission / banner)
   └── Hono validates: file type is allowed, size is within limit, user has permission to upload to this entity
   └── Hono generates a presigned PUT URL for R2 with the correct key path
   └── Key format: schools/{school_id}/{entity_type}/{uuid}.{ext}
   └── Returns presigned URL and the file key to the client

2. Client uploads file DIRECTLY to R2 using the presigned URL
   └── No file data passes through Hono or Vercel

3. Upload completes — client notifies Hono
   └── Client calls POST /storage/confirm (Hono) with the file key and entity ID
   └── Hono stores the file key in the relevant database record (note, submission, school profile, etc.)
   └── File is now accessible
```

---

## 7. Background Jobs

Three scheduled jobs run inside the Hono process using node-cron. Each job is described below with its schedule, query, actions, and failure handling.

**Job 1 — Mock Auto-Publish**
Schedule: Every 1 minute.
Query: All mock exams with status = draft and publish_at <= current time.
Actions: Update status to published, send notification emails to enrolled students via Resend.
Failure handling: If the update fails, the job logs the error and retries on the next tick. If email sending fails, the status update is not rolled back — the mock is published and email failure is logged separately.

**Job 2 — Live Class Upcoming Notifications**
Schedule: Every 5 minutes.
Query: All live classes with status = scheduled and start_time between now + 10 minutes and now + 15 minutes that have not yet had a notification sent.
Actions: Send notification email via Resend to all enrolled students in the course. Mark the live class record as notification_sent = true to prevent duplicate sends.
Failure handling: If email sending fails, the notification_sent flag is not set — the job will retry on the next tick.

**Job 3 — Assignment Deadline Reminders**
Schedule: Every 30 minutes.
Query: All assignments with deadline between now + 24 hours and now + 25 hours where the student has not yet submitted.
Actions: Send a reminder email via Resend to each student with a pending submission.
Failure handling: Errors are logged. No retry flag — the reminder will fire again on the next relevant window if the deadline has not passed.

---

## 8. Data Flow — Payments & Revenue

```
Student pays for a programme or course
         │
         ▼
Paystack processes the payment
         │
         ├──► Tutorial centre's share → Tutorial centre Paystack subaccount
         │
         └──► Kanvise's service fee → Kanvise main Paystack account
         │
         ▼
charge.success webhook → kanvise.com/api/webhooks/paystack
         │
         ▼
Hono processes confirmation:
  - Creates enrolment record
  - Unlocks course/programme access for student
  - Sends receipt email (Resend)
  - Sends access confirmation email (Resend)
  - Records payment in payments table
```

Tutorial centre monthly subscription to Kanvise is a separate payment flow — the tutorial centre Admin initiates this from the Subscription & Billing screen. Paystack processes this as a direct charge to Kanvise (no split). Hono receives the webhook, updates the school's subscription status, and records the billing event.

---

## 9. Storage Architecture

All files are stored in Cloudflare R2 in a single bucket with a folder structure that enforces tenant isolation at the storage level.

```
kanvise-storage/
├── schools/
│   └── {school_id}/
│       ├── profile/
│       │   ├── logo.{ext}
│       │   ├── banner.{ext}
│       │   └── video-intro.{ext}
│       ├── promos/
│       │   └── {promo_id}.{ext}
│       ├── notes/
│       │   └── {note_id}.{ext}
│       ├── assignments/
│       │   └── {assignment_id}-attachment.{ext}
│       └── submissions/
│           └── {submission_id}-{student_id}.{ext}
├── avatars/
│   └── {user_id}/
│       └── avatar-config.json
└── tutors/
    └── {tutor_id}/
        └── profile-photo.{ext}
```

Public files (logos, banners, promo images, tutor photos) are served from a public R2 bucket URL through Cloudflare's CDN — no authentication required to view them.

Private files (student submissions, assignment attachments) are served via short-lived presigned GET URLs generated by Hono — these URLs expire after 15 minutes and can only be generated by Hono when the requesting user is authorised to view the file.

---

## 10. Environment Summary

| Environment | Service | Purpose | Access |
|---|---|---|---|
| Vercel | Next.js | Frontend, public pages, auth callbacks, Paystack webhook receiver | Public internet |
| Scaleway | Hono (Node.js) | API server, business logic, background jobs | Public internet (HTTPS) |
| Scaleway | LiveKit | WebRTC live video server | Public internet (WebRTC) + private (webhooks to Hono) |
| Supabase | PostgreSQL | Primary database | Hono only (service key) |
| Supabase | Auth | User authentication and JWT issuance | Browser (anon key) + Hono (service key) |
| Cloudflare | R2 | File storage | Browser (presigned URLs) + Hono (SDK) |
| Cloudflare | CDN | Public file delivery | Public internet |
| Paystack | Payment API | Payment processing and split payments | Hono (API key) |
| Resend | Email API | Transactional email delivery | Hono (API key) |

---

## 11. What Does Not Exist in This Architecture

**No direct frontend-to-database connection.** The browser never calls Supabase directly for data. All data goes through Hono. The Supabase anon key on the frontend is used only for Supabase Auth — not for data queries.

**No shared state between Hono and Next.js.** They are separate services on separate infrastructure. They communicate only through HTTP. There is no shared memory, no shared cache, no shared file system.

**No file processing on the API server.** Files are never uploaded to Hono. All file handling goes directly between the browser and R2 via presigned URLs.

**No polling.** The system is event-driven wherever possible. Attendance is recorded via LiveKit webhooks. Payments are confirmed via Paystack webhooks. Background jobs are time-triggered. No component polls another for state changes.

**No session storage on the server.** Authentication is stateless — JWT-based. Hono does not maintain session state. Every request is independently authenticated by the JWT.

---

*End of Document — Version 1.0*
