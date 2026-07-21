# Acada — Technical Stack Decision Document

**Version:** 1.0  
**Date:** June 2026  
**Prepared by:** Acada Engineering  

---

## 1. Purpose of This Document

This document records every technology choice made for the Acada platform, the
reasoning behind each decision, and the trade-offs accepted. It is the reference
point for every developer on the project. No technology should be introduced into
the codebase that is not listed here or has not gone through the same decision
process documented below.

---

## 2. System Overview

Acada is a multi-tenant B2B SaaS web platform for Nigerian tutorial centres. The
platform serves three user types — Admins, Tutors, and Students — across a
public-facing marketing layer and a private authenticated application layer. The
system must handle file storage, payment processing, live video coordination,
background job execution, email delivery, and real-time events.

---

## 3. Stack Decisions

### 3.1 Frontend — Next.js

**Decision:** Next.js (App Router)  
**Hosted on:** Vercel  

**Reasoning:**
- Server-side rendering (SSR) is critical for the public-facing pages —
  tutorial centre pages, programme pages, and course pages must be
  indexable by search engines and load fast for students on slow Nigerian
  mobile connections.
- The App Router enables a clean separation between public routes (no auth)
  and protected routes (role-based dashboards).
- Vercel is the natural deployment target — zero-config deployments, automatic
  preview environments, and edge CDN delivery globally.
- The Nigerian user base will predominantly access the platform on mobile
  browsers. Next.js image optimisation and built-in performance tooling
  directly addresses this.

**Trade-offs accepted:**
- Vercel serverless functions cannot run persistent processes. This is why
  the API and background jobs are hosted separately.
- Cold starts on Vercel functions are acceptable for the frontend layer since
  the heavy API work is offloaded to the Scaleway server.

**Key decisions within Next.js:**
- App Router for all routing — no Pages Router.
- Server Components used for data-fetching on public pages.
- Client Components used for interactive dashboard elements.
- Middleware used for auth token validation and route protection at the
  edge.

---

### 3.2 Backend API — Hono on Node.js

**Decision:** Hono framework running on Node.js  
**Hosted on:** Scaleway (persistent server)  

**Reasoning:**
- Hono is lightweight, fast, and has excellent TypeScript support. It is well
  suited to building a structured REST API without the overhead of heavier
  frameworks.
- Running on a persistent Node.js server on Scaleway (rather than serverless)
  is a hard requirement because the system needs:
  - Background job execution (mock auto-publish, scheduled notifications)
  - Persistent WebSocket connections for real-time events
  - LiveKit webhook reception and processing
  - Paystack webhook reception and processing
  - Scheduled cron tasks that cannot be interrupted mid-execution
- Scaleway provides good European infrastructure with competitive pricing,
  acceptable latency to Nigerian users, and straightforward server management.

**Trade-offs accepted:**
- A persistent server requires more operational management than serverless.
  This is acceptable given the background job requirements.
- Horizontal scaling requires load balancer configuration if traffic grows
  significantly. For MVP this is a single server; scaling strategy is a
  post-MVP concern.

**API structure:**
- RESTful API with clearly namespaced routes.
- All routes prefixed with `/api/v1/` for versioning.
- Hono middleware stack handles: authentication, tenant scoping,
  role-based access control, request validation, and error handling —
  in that order, on every protected request.

---

### 3.3 Database — Supabase (PostgreSQL)

**Decision:** Supabase hosted PostgreSQL, accessed via the Supabase JS client  
**Client:** `@supabase/supabase-js` called directly inside Hono route handlers  

**Reasoning:**
- Supabase provides a fully managed PostgreSQL instance with automatic
  backups, connection pooling, and a dashboard for database inspection.
  This removes database infrastructure management from the team at MVP.
- The Supabase JS client is the simplest integration path — no ORM
  configuration, no schema migration tooling to set up beyond Supabase's
  built-in migration system.
- PostgreSQL is the right database for Acada's data model. The system has
  complex relational data — centres, programmes, sub-programmes, courses,
  enrolments, payments, attendance records — that benefits from relational
  structure and JOIN queries.
- Using the service role key server-side (inside Hono, never exposed to
  the client) means we control all data access at the application layer
  rather than relying on Supabase Row Level Security policies.

**Trade-offs accepted:**
- Not using Supabase RLS means tenant isolation is enforced entirely at
  the application layer in Hono middleware. This requires discipline across
  every route handler. The trade-off is accepted because it gives us full
  control and predictable behaviour.
- No ORM means raw SQL or Supabase's query builder for all data access.
  This requires careful query construction but avoids ORM abstraction
  complexity.

**Key decisions:**
- The service role key is stored as a server-side environment variable and
  never sent to the client.
- The anon key is used only for public-facing Supabase operations if any
  exist (currently none planned).
- All queries include a `centre_id` or appropriate tenant scoping column
  as a mandatory filter, enforced by middleware.

---

### 3.4 File Storage — Cloudflare R2

**Decision:** Cloudflare R2  

**Reasoning:**
- R2 is S3-compatible, meaning any S3 SDK can be used to interact with it.
- Zero egress fees. Files served from R2 cost nothing to download, which is
  critical for a platform where students will be downloading notes, assignment
  files, and other materials frequently on metered Nigerian mobile data.
- Cloudflare's global CDN means files are served from edge locations close
  to users, improving download speeds.
- Competitive pricing for storage at Acada's expected volume.

**What is stored in R2:**
- Class notes (PDF, DOCX, PPTX, JPG, PNG)
- Assignment attachments (tutor uploads)
- Student assignment submissions
- Tutorial centre banner images
- Tutorial centre logos
- Programme/course cover images
- Promotional banner images
- Video intros (uploaded by tutorial centres)
- User avatars (rendered avatar images or avatar config JSON)

**File organisation in R2:**
- Bucket structure is per-tenant:
  `acada/{centre_id}/{category}/{file_id}.{ext}`
- Categories: `notes`, `assignments`, `submissions`, `media`, `avatars`
- File IDs are UUIDs generated server-side at upload time.
- Files are served via signed URLs with expiry for private content.
- Public marketing content (banners, logos, promo images) served via
  public R2 URLs through Cloudflare CDN.

**Upload flow:**
- Server generates a presigned upload URL.
- Client uploads directly to R2 using the presigned URL (no file data
  passes through the Hono server).
- On upload completion, client calls the API to confirm and register the
  file record in the database.

---

### 3.5 Email — Resend

**Decision:** Resend  

**Reasoning:**
- Resend has a clean developer API, excellent deliverability, and React Email
  support for building HTML email templates as React components — consistent
  with the Next.js/React frontend stack.
- Simple pricing that scales with volume.
- Reliable deliverability to Nigerian email providers (Gmail, Yahoo — the
  most common among Nigerian students and tutors).

**Emails the system sends:**
- Welcome email on account creation
- Password reset OTP
- Payment receipt after successful student payment
- Live class reminder (before class starts)
- Assignment deadline reminder
- Mock published notification
- New enrolment confirmation

---

### 3.6 Payments — Paystack

**Decision:** Paystack  

**Reasoning:**
- Paystack is the leading payment gateway in Nigeria. It has the highest trust
  recognition among Nigerian users, which directly affects payment conversion.
- Supports all required payment methods: card, bank transfer, and USSD.
- Paystack Subaccounts enable split payment — tutorial centres register their
  bank account as a Paystack subaccount. When a student pays, Acada's
  percentage is automatically deducted and the remainder goes to the tutorial
  centre's subaccount. This means Acada never holds tutorial centre funds.
- Paystack has a clear webhook system for reliable payment event handling.

**Revenue model implementation:**
- Tutorial centres register their bank account as a Paystack subaccount on
  setup.
- Every student payment is a split transaction — Acada's cut is defined as
  a percentage on the subaccount configuration.
- Tutorial centres also pay Acada a flat monthly subscription fee (separate
  transaction, not a split — direct payment to Acada's account).

**Payment methods supported:**
- Card (Visa, Mastercard, Verve)
- Bank transfer
- USSD

---

### 3.7 Live Video — Self-Hosted LiveKit on Scaleway

**Decision:** LiveKit, self-hosted on Scaleway  

**Reasoning:**
- LiveKit is the most capable open-source WebRTC infrastructure available.
  It handles room management, participant tokens, media routing, and
  recording capabilities out of the box.
- Self-hosting on Scaleway gives full control over data residency,
  eliminates per-minute SaaS fees that would scale poorly with tutorial
  centre usage, and allows co-location with the Hono API server for
  low-latency webhook delivery.
- Scaleway's European infrastructure provides acceptable latency for
  Nigerian users — better than US-hosted alternatives.

**Integration with the Acada backend:**
- LiveKit sends webhook events to the Hono API when participants join and
  leave rooms. The Hono API records these events for attendance tracking.
- The Hono API generates LiveKit join tokens when a tutor starts a class
  or a student joins. Tokens are scoped to the specific room and expire
  after the class duration.
- LiveKit rooms are created programmatically by the Hono API when a
  scheduled class starts.

**Note:** The live video feature is developed by a separate developer. The
integration contract (the API endpoints and webhook payloads) is defined in a
separate document: `03b_livekit_integration_contract.md`.

---

### 3.8 Background Jobs & Scheduled Tasks

**Decision:** Node.js `node-cron` running on the Scaleway persistent server,
with a custom job queue for event-driven tasks.  

**Reasoning:**
- Since the Hono API runs on a persistent Node.js server, `node-cron` is
  the simplest way to run scheduled tasks without introducing an external
  queue service at MVP.
- Event-driven jobs (e.g. sending a payment receipt after a Paystack webhook)
  are triggered directly within the webhook handler.

**Scheduled jobs at MVP:**
- **Mock auto-publish:** Runs every minute, checks for mocks with a
  `publish_at` timestamp that has passed and status of `draft`. Updates
  their status to `published`.
- **Live class reminder:** Runs every 15 minutes, checks for classes
  starting within the next 30 minutes, sends reminder emails/notifications
  to enrolled students who have not yet been notified.
- **Assignment deadline reminder:** Runs daily, checks for assignments due
  within 24 hours, notifies students who have not yet submitted.

**Post-MVP consideration:** As scale grows, migrate to a dedicated job queue
system (BullMQ with Redis, or Trigger.dev) for better reliability, retry logic,
and observability.

---

### 3.9 Authentication

**Decision:** Supabase Auth (via Supabase JS client), with JWT validation in
Hono middleware.  

**Reasoning:**
- Supabase Auth is already available as part of the Supabase integration.
  Using it avoids building authentication from scratch.
- JWTs issued by Supabase Auth are validated on every protected API request
  in Hono middleware.
- The JWT payload includes the user's ID, role, and centre ID — used by
  the tenant scoping middleware to enforce data isolation.

**Auth flow:**
- User registers or logs in via Supabase Auth (called from the Next.js
  frontend).
- Supabase Auth returns a JWT.
- The JWT is sent as a Bearer token in the Authorization header on every
  API request to Hono.
- Hono middleware validates the JWT signature, extracts the user context,
  and attaches it to the request object for use in route handlers.
- Role-based access control is enforced by a separate Hono middleware that
  checks the user's role against the route's required role.

---

## 4. Technology Decisions Summary Table

| Layer | Technology | Hosted On |
|---|---|---|
| Frontend | Next.js (App Router) | Vercel |
| Backend API | Hono + Node.js | Scaleway |
| Database | Supabase (PostgreSQL) | Supabase Cloud |
| File Storage | Cloudflare R2 | Cloudflare |
| Email | Resend | Resend Cloud |
| Payments | Paystack | Paystack Cloud |
| Live Video | LiveKit (self-hosted) | Scaleway |
| Auth | Supabase Auth | Supabase Cloud |
| Background Jobs | node-cron | Scaleway |
| CDN | Cloudflare | Cloudflare |

---

## 5. What Is Explicitly Excluded from MVP

The following technologies or approaches were considered and explicitly deferred
to post-MVP:

| Excluded | Reason |
|---|---|
| Native mobile apps | Web-first MVP; React Native planned for Phase 2 |
| Redis / BullMQ | node-cron sufficient for MVP job volume |
| Supabase RLS | Application-layer tenancy chosen for simplicity and control |
| AI marking for theory | Post-MVP feature |
| Analytics service | Post-MVP feature |
| Multiple payment gateways | Paystack only for MVP; Flutterwave considered post-MVP |
| Recording storage pipeline | Live class recording is a nice-to-have post-MVP |

---

## 6. Environment Summary

| Environment | Purpose |
|---|---|
| Local | Individual developer machines |
| Staging | Pre-production testing, connected to test Paystack keys |
| Production | Live system |

Each environment has its own Supabase project, R2 bucket, Resend API key,
and Paystack key set. No environment shares credentials with another.

---

*End of Document 01 — Technical Stack Decision Document*
