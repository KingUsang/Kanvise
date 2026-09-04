# Acada — System Architecture Overview

**Version:** 1.0  
**Date:** June 2026  
**Prepared by:** Acada Engineering  

---

## 1. Purpose of This Document

This document describes the complete system architecture of the Acada platform.
It covers how every layer of the system is structured, how the layers communicate,
and how third-party services connect to the core system. Every developer must read
this document before writing any code.

---

## 2. Architecture Style

Acada uses a **layered client-server architecture** with a clear separation between:

- A public-facing frontend (Next.js on Vercel)
- A private API server (Hono on Scaleway)
- A managed database (Supabase PostgreSQL)
- A file storage layer (Cloudflare R2)
- An independently deployed live video server (LiveKit on Scaleway)
- External services (Paystack, Resend)

The system is **multi-tenant** — a single deployment serves all tutorial centres,
with data strictly isolated per centre at the application layer.

---

## 3. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Next.js (Vercel)                         │   │
│   │                                                             │   │
│   │  Public Pages          │  Authenticated App                 │   │
│   │  - Landing page        │  - Admin Dashboard                 │   │
│   │  - Centre public page  │  - Tutor Dashboard                 │   │
│   │  - Programme page      │  - Student Dashboard               │   │
│   │  - Course page         │  - All role-based screens          │   │
│   └────────────┬───────────┴────────────────┬────────────────────┘  │
└────────────────┼────────────────────────────┼──────────────────────┘
                 │ HTTPS REST API              │ HTTPS REST API
                 │                            │
┌────────────────▼────────────────────────────▼──────────────────────┐
│                      API LAYER (Scaleway)                           │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  Hono API (Node.js)                         │   │
│   │                                                             │   │
│   │  Middleware Stack:                                          │   │
│   │  1. Auth (JWT validation)                                   │   │
│   │  2. Tenant Scoping (centre_id extraction + enforcement)     │   │
│   │  3. Role-Based Access Control                               │   │
│   │  4. Request Validation                                      │   │
│   │  5. Error Handling                                          │   │
│   │                                                             │   │
│   │  Route Modules:                                             │   │
│   │  /auth     /centres    /programmes    /courses              │   │
│   │  /content  /payments   /attendance    /notifications        │   │
│   │  /files    /avatars    /webhooks      /admin                │   │
│   │                                                             │   │
│   │  Background Jobs (node-cron):                               │   │
│   │  - Mock auto-publish (every 1 min)                          │   │
│   │  - Class reminders (every 15 min)                           │   │
│   │  - Assignment deadline reminders (daily)                    │   │
│   └──┬──────────┬──────────────┬──────────────────┬────────────┘   │
└──────┼──────────┼──────────────┼──────────────────┼────────────────┘
       │          │              │                  │
       │          │              │                  │
┌──────▼──┐  ┌────▼────┐  ┌─────▼──────┐  ┌───────▼──────────────┐
│Supabase │  │  Cloud  │  │  Paystack  │  │  Resend              │
│PostgreSQL│  │   R2    │  │  (Payments)│  │  (Email)             │
│         │  │(Storage)│  │            │  │                      │
└─────────┘  └─────────┘  └─────┬──────┘  └──────────────────────┘
                                 │ Webhook
                          ┌──────▼──────────────────────────────────┐
                          │         LiveKit (Scaleway)               │
                          │  - Room management                       │
                          │  - Participant tokens                    │
                          │  - Media routing                         │
                          │  - Attendance webhooks → Hono API        │
                          └─────────────────────────────────────────┘
```

---

## 4. Layer-by-Layer Breakdown

### 4.1 Client Layer — Next.js on Vercel

The frontend is a Next.js application using the App Router. It handles two
distinct concerns:

**Public Layer (No Authentication Required)**

These pages are server-side rendered for SEO and performance:
- Acada landing page (`/`)
- Tutorial centre public page (`/[centre-slug]`)
- Programme page (`/[centre-slug]/[programme-slug]`)
- Course page (`/[centre-slug]/[course-slug]`)

Public pages fetch data directly from the Hono API at build time or request
time using Next.js Server Components. No sensitive data or auth tokens are
involved.

**Authenticated App Layer**

After login, users are routed to their role-based dashboard. All authenticated
pages are Client Components that make API calls to the Hono server with a
Bearer token in the Authorization header.

Route protection is enforced at two levels:
- Next.js Middleware — checks for a valid JWT token on every protected route
  before rendering. Redirects to login if missing or expired.
- Hono API — validates the JWT on every API request independently of the
  frontend check.

**Frontend communicates with the backend exclusively via:**
- REST API calls to `api.acada.ng` (the Hono server)
- No direct Supabase calls from the frontend
- No direct R2 calls from the frontend (presigned URLs only, generated by
  the API)

---

### 4.2 API Layer — Hono on Scaleway

The Hono API server is the core of the system. All business logic lives here.
The frontend and LiveKit server communicate with it; nothing else has direct
database access.

**Middleware execution order on every protected request:**

```
Incoming Request
      │
      ▼
┌─────────────┐
│ JWT Validation│  → Reject with 401 if invalid or expired
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Tenant Extraction │  → Extract centre_id from JWT payload
└──────┬───────────┘
       │
       ▼
┌──────────────────────┐
│ Role-Based Access    │  → Reject with 403 if role not permitted for route
│ Control              │
└──────┬───────────────┘
       │
       ▼
┌──────────────────┐
│ Request Validation│  → Reject with 400 if body/params invalid
└──────┬───────────┘
       │
       ▼
┌──────────────┐
│ Route Handler │  → Execute business logic with scoped database access
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Error Handler    │  → Catch and format any unhandled errors
└──────────────────┘
```

**Route modules and their responsibilities:**

| Module | Prefix | Responsibility |
|---|---|---|
| Auth | `/api/v1/auth` | Registration, login, password reset, token refresh |
| Centres | `/api/v1/centres` | School profile, public page data, slug resolution |
| Users | `/api/v1/users` | User management, invitations, profile updates, avatars |
| Programmes | `/api/v1/programmes` | Programme CRUD, sub-programme CRUD |
| Courses | `/api/v1/courses` | Course CRUD, standalone and nested |
| Content | `/api/v1/content` | Notes, assignments, submissions, mocks, results |
| Schedule | `/api/v1/schedule` | Live class scheduling, upcoming classes |
| Attendance | `/api/v1/attendance` | Attendance records, per-student and per-class views |
| Payments | `/api/v1/payments` | Initiation, history, access control checks |
| Webhooks | `/api/v1/webhooks` | Paystack webhooks, LiveKit webhooks |
| Notifications | `/api/v1/notifications` | In-app notification list, mark as read |
| Files | `/api/v1/files` | Presigned URL generation, file registration |
| Admin | `/api/v1/admin` | Acada-level admin operations (not tutorial centre admin) |

**Background jobs running on the same server:**

The Hono server runs `node-cron` jobs in-process. These jobs share the same
Supabase client instance and environment configuration.

---

### 4.3 Database Layer — Supabase PostgreSQL

All application data is stored in a single Supabase PostgreSQL database. The
Supabase JS client is instantiated once in the Hono server and shared across
all route handlers.

**Key architectural decisions:**

- The service role key is used server-side. It bypasses Supabase RLS — tenant
  isolation is enforced entirely by the Hono middleware (see Section 4.2).
- Every table that contains centre-specific data has a `centre_id` column.
  Every query against these tables includes `WHERE centre_id = $1` enforced
  by the middleware-injected tenant context.
- Tables that are not centre-specific (e.g. the centres table itself, the users
  table) use different scoping strategies documented in the Multi-Tenancy
  Architecture document.

The full database schema is documented in: `04_database_schema.md`

---

### 4.4 File Storage Layer — Cloudflare R2

All user-generated files are stored in Cloudflare R2. The Hono API never
receives file binary data — it only generates presigned URLs and registers
file metadata in the database.

**Upload flow:**

```
Client requests presigned URL → Hono API generates URL → Client uploads 
directly to R2 → Client calls Hono API to confirm upload → Hono registers 
file record in database
```

**File access:**

- Private files (notes, submissions, assignment attachments) are served via
  signed URLs with a configurable expiry (default: 1 hour).
- Public files (centre banners, logos, promo images) are served via
  permanent public R2 URLs through Cloudflare CDN.
- Video intros are served via public URLs but can be deleted/replaced by
  the admin.

---

### 4.5 Live Video Layer — LiveKit on Scaleway

LiveKit is deployed as a separate process on the same Scaleway infrastructure
as the Hono API. It operates independently but integrates with the Hono API
at two points:

**Integration Point 1 — Room creation and token generation:**

When a tutor starts a live class:
1. The Hono API calls the LiveKit server admin API to create a room.
2. The room is named using the live class ID from the database.
3. The Hono API generates a LiveKit JWT token for the tutor with host
   permissions and returns it to the frontend.
4. When students join, the Hono API generates a student JWT token with
   participant permissions.

**Integration Point 2 — Attendance webhooks:**

LiveKit is configured to send webhook events to the Hono API:
- `participant_joined` — sent when a participant enters a room. Payload
  includes room name (live class ID), participant identity (user ID), and
  timestamp.
- `participant_left` — sent when a participant leaves. Same payload plus
  duration.

The Hono API processes these webhooks and writes attendance records to the
database.

The full integration contract is documented in: `03b_livekit_integration_contract.md`

---

### 4.6 Payment Layer — Paystack

Paystack handles all financial transactions. Two types of payments flow through
the system:

**Type 1 — Student paying for a programme/course:**
- Tutorial centre has a registered Paystack subaccount.
- Student initiates payment on the programme/course page.
- Acada's percentage cut is automatically split at the gateway level.
- Remainder goes to the tutorial centre's subaccount.
- Paystack sends a `charge.success` webhook to the Hono API.
- Hono API verifies the webhook signature, creates a payment record,
  unlocks the student's access to the programme/course, and triggers a
  receipt email via Resend.

**Type 2 — Tutorial centre paying Acada's monthly subscription:**
- A separate direct payment to Acada's Paystack account.
- Not a split payment — full amount goes to Acada.
- Paystack sends a webhook to confirm.
- Hono API updates the centre's subscription status and expiry date.

---

### 4.7 Email Layer — Resend

Resend handles all outbound emails. The Hono API calls the Resend API
directly — no email queue at MVP.

Emails are triggered by:
- Auth events (welcome, password reset)
- Payment events (receipt, subscription confirmation)
- Scheduling events (class reminder, assignment deadline reminder)
- Content events (new mock published, assignment created)

Email templates are built using React Email and compiled at deploy time.

---

## 5. Multi-Tenancy Architecture Summary

Every tutorial centre is a completely isolated tenant. The isolation strategy:

- Every centre-scoped database table has a `centre_id` UUID column.
- The Hono auth middleware extracts the `centre_id` from the validated JWT
  and attaches it to every request context.
- Every route handler that queries centre-scoped data receives the `centre_id`
  from the request context — it never trusts a `centre_id` from the request
  body or query parameters.
- A separate Hono middleware validates that URL parameters (e.g.
  `/programmes/:programmeId`) belong to the authenticated user's centre
  before processing.

The full tenancy architecture is documented in: `02_multi_tenancy_architecture.md`

---

## 6. Data Flow — Key Scenarios

### 6.1 Student Enrols in a Programme

```
1. Student visits acada.ng/[centre-slug]/[programme-slug] (public, no auth)
2. Next.js fetches programme data from Hono API (public endpoint, no auth)
3. Student clicks Enrol
4. If not logged in → redirect to sign up
5. Student creates account → Supabase Auth issues JWT
6. Hono API creates user record, generates ACA-STU-XXXXX ID
7. Student redirected back to programme page
8. Student clicks Pay → Hono API initiates Paystack transaction
9. Student completes payment on Paystack checkout
10. Paystack sends charge.success webhook to Hono API
11. Hono API verifies webhook signature
12. Hono API creates payment record in database
13. Hono API creates enrolment record — student linked to programme
14. Hono API triggers receipt email via Resend
15. Student redirected to their dashboard with programme access unlocked
```

### 6.2 Tutor Creates and Publishes a Mock

```
1. Tutor logs in → JWT issued
2. Tutor opens Mock Creator
3. Tutor fills in mock details — title, subject, time limit, schedule time
4. Tutor adds questions (MCQ and theory)
5. Frontend sends POST /api/v1/content/mocks with full mock payload
6. Hono API validates JWT, confirms tutor role, confirms course belongs to centre
7. Mock saved to database with status: draft, publish_at: [future timestamp]
8. node-cron job runs every minute
9. At the scheduled time, cron finds the mock, updates status to: published
10. Students enrolled in that course see the mock on their dashboard
11. Notification triggered → email sent via Resend to enrolled students
```

### 6.3 Tutor Starts a Live Class

```
1. Tutor clicks Start Class on a scheduled live class
2. Frontend sends POST /api/v1/schedule/live-classes/:id/start
3. Hono API validates JWT and tutor role
4. Hono API calls LiveKit admin API to create a room named acada-{liveClassId}
5. Hono API generates a LiveKit JWT for the tutor with host permissions
6. Returns LiveKit token and room URL to frontend
7. Frontend connects tutor to LiveKit room
8. Students click Join Class
9. Hono API generates student LiveKit JWT tokens on request
10. Students enter the room
11. LiveKit sends participant_joined webhook to Hono API for each student
12. Hono API records join time for each student
13. Students leave or class ends
14. LiveKit sends participant_left webhook for each student
15. Hono API calculates duration, writes attendance records
16. Tutor ends class → LiveKit room closed
```

---

## 7. Security Architecture Summary

| Concern | Approach |
|---|---|
| API authentication | JWT Bearer token on every protected request |
| Tenant isolation | Middleware-enforced centre_id scoping on all queries |
| File access | Signed URLs for private files, expiry enforced by R2 |
| Webhook verification | Paystack signature header verified on every webhook |
| Secret management | Environment variables, never committed to version control |
| HTTPS | Enforced on all layers — Vercel, Scaleway, Supabase |
| CORS | Configured in Hono to allow only known frontend origins |
| Input validation | Validated in Hono middleware before reaching route handlers |

Full security architecture is documented in: `09_security_architecture.md`

---

## 8. Deployment Architecture

| Component | Platform | Notes |
|---|---|---|
| Next.js frontend | Vercel | Auto-deployed on push to main |
| Hono API | Scaleway VPS | Managed with PM2, auto-restart on crash |
| LiveKit server | Scaleway VPS | Separate process, same or adjacent server |
| Supabase DB | Supabase Cloud | Managed, automatic backups |
| Cloudflare R2 | Cloudflare | Bucket per environment |
| Resend | Resend Cloud | API key per environment |
| Paystack | Paystack Cloud | Test keys for staging, live keys for production |

---

*End of Document 02 — System Architecture Overview*
