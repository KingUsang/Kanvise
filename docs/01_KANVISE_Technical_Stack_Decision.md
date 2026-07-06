# Kanvise — Technical Stack Decision Document
**Version:** 1.0  
**Prepared by:** Architecture Team  
**Date:** June 2026  
**Status:** Approved — Do Not Deviate Without Team Sign-Off

---

## Purpose

This document records every technology choice made for the Kanvise platform, the reasoning behind each decision, and the constraints each choice imposes on the development team. Every developer working on this project must read this document before writing a single line of code. Any proposed deviation from these choices must be discussed and approved before implementation.

---

## 1. Overview of the Stack

Kanvise is split into four runtime environments:

**Vercel** runs the Next.js frontend and serves the application to users.

**Scaleway** runs two persistent Node.js services — the Hono API server and the self-hosted LiveKit server for live classes.

**Supabase** provides the PostgreSQL database.

**Cloudflare R2** stores all uploaded files — notes, assignment submissions, banners, promo images, video intros, avatars.

**Paystack** handles all payment processing — student payments to tutorial centres (with Kanvise split) and Kanvise's monthly subscription billing for tutorial centres.

**Resend** handles all outbound email.

---

## 2. Frontend — Next.js

**Decision:** Next.js (App Router), hosted on Vercel.

**Reasoning:**

Next.js is the correct choice for Kanvise because the platform has both public-facing pages and authenticated dashboard pages that have fundamentally different rendering requirements. The public tutorial centre pages (`kanvise.ng/[centre-slug]`) and programme pages (`kanvise.ng/[centre-slug]/[programme-slug]`) need to be fast, SEO-indexable, and shareable — these are marketing pages that tutorial centres will post on social media and WhatsApp. Server-side rendering and static generation handle this perfectly. The authenticated dashboard pages (Admin, Tutor, Student) are client-rendered interactive applications. Next.js handles both within the same codebase without needing a separate static site generator.

Vercel is the natural deployment target for Next.js — zero-configuration deployment, automatic preview environments for every pull request, edge caching for public pages, and built-in CDN.

**Key decisions within Next.js:**

The App Router is used — not the Pages Router. The App Router's layout system maps cleanly to Kanvise's three distinct dashboard layouts (Admin, Tutor, Student) and the public page layout.

Route groups are used to separate the public layer, the auth layer, and each role's dashboard without affecting the URL structure.

Server Components handle data fetching for public pages. Client Components handle all interactive dashboard elements.

**Constraints this choice imposes:**

Developers must understand the distinction between Server Components and Client Components and apply it correctly. Fetching data in a Server Component and passing it down as props is the default pattern. useState and useEffect only appear in Client Components.

API calls from the frontend to the Hono backend always go through Next.js API route handlers or directly from Client Components — never from Server Components, as the Hono server is on a separate origin.

Environment variables that should not be exposed to the browser must be prefixed correctly — `NEXT_PUBLIC_` only for variables that are safe to expose, never for secrets.

---

## 3. Backend — Hono on Node.js

**Decision:** Hono framework running on Node.js, hosted as a persistent server on Scaleway.

**Reasoning:**

Hono was chosen because it is lightweight, fast, and runs natively on Node.js without the overhead of Express. Its middleware system is clean and composable, which is essential for enforcing multi-tenancy at the request level — every request that touches school-scoped data must pass through a tenant-resolution middleware before any route handler runs.

The critical reason Hono runs as a persistent server on Scaleway rather than as serverless functions on Vercel is background jobs. Two features require persistent server processes:

Mock auto-publish requires a scheduled job that watches for mocks whose scheduled publish time has arrived and flips their status from draft to published. This cannot run on a serverless function because serverless functions only execute in response to a request — they do not run on a timer.

Upcoming class notifications require a scheduled job that checks for live classes starting within a set window and sends notifications to enrolled students. Same constraint applies.

Scaleway also hosts the LiveKit server, which means the Hono API and LiveKit are on the same private network — LiveKit webhook events from session joins and leaves travel from LiveKit to Hono over a private network connection, not over the public internet.

**Key decisions within Hono:**

Every route is grouped by feature module — auth, schools, programmes, courses, content, payments, attendance, notifications, avatars, storage.

Middleware runs in this order on every authenticated request: JWT verification → tenant resolution → role authorisation → rate limiting → route handler.

The Supabase JS client is instantiated once and injected into route handlers via Hono's context system. It is never re-instantiated per request.

Background jobs run on a simple Node.js cron scheduler (node-cron) within the same Hono process for MVP. Post-MVP this will be extracted to a dedicated worker process or a job queue like BullMQ.

**Constraints this choice imposes:**

The Hono server must never be deployed as a serverless function. It must always run as a persistent process with a process manager (PM2) to handle crashes and restarts.

All long-running operations (file processing, sending bulk notifications) must be handled asynchronously and must not block the request-response cycle.

The Hono server is the only service that communicates directly with Supabase. The Next.js frontend never calls Supabase directly — it always goes through the Hono API. This is non-negotiable because it is how we enforce multi-tenancy and authorisation at a single choke point.

CORS must be configured to allow only the Vercel frontend origin. No wildcard CORS origins in production.

---

## 4. API Boundary — Next.js Route Handlers vs Hono

Kanvise runs two API layers. The boundary between them is defined here and must not drift during development. Every new endpoint must be placed on the correct side of this boundary before it is built.

**Next.js Route Handlers on Vercel handle:**

Auth callbacks and session management — Supabase Auth redirects back to the Next.js app after email confirmation and password reset. These callbacks are handled in Next.js route handlers.

Public page data fetching — the tutorial centre public page and programme/course pages are Server Components that fetch data directly. Simple, cacheable, no auth required.

Paystack webhook receiver for student payments — Paystack sends the `charge.success` webhook to a public HTTPS endpoint. This lives on the Next.js app at `/api/webhooks/paystack` because it needs to be a stable public URL on the main domain. On receipt, it calls the Hono backend internally to process the payment confirmation.

File presigned URL requests for simple uploads — when a user needs to upload a profile image or a promo banner, the Next.js route handler requests a presigned R2 URL from Hono and returns it to the client.

Simple page-level data mutations tightly coupled to a single Next.js page — for example, updating a user's avatar configuration where no complex business logic is involved.

**Hono on Scaleway handles:**

All background jobs and scheduled tasks — mock auto-publish, live class notifications, assignment deadline reminders. These require a persistent server process and cannot run on Vercel serverless.

LiveKit room creation and participant token generation — creating a room, issuing host and participant tokens, and managing room state all run in Hono.

LiveKit webhook receiver for attendance — LiveKit sends participant join and leave events to the Hono server over the private Scaleway network. Hono records these as attendance events.

All payment business logic — initiating Paystack transactions, creating and managing Paystack subaccounts for tutorial centres, processing split payment configuration, handling subscription billing for tutorial centres.

Complex multi-step business logic — enrolment processing (checking payment, granting access, sending confirmation email, creating enrolment record), mock submission processing (auto-grading MCQ answers, storing theory responses, computing scores), assignment submission validation.

All operations that require cross-table writes — any action that writes to more than one table in a single logical transaction runs in Hono so the logic stays in one place.

**The rule for any new endpoint:**

If it needs to run on a schedule or persist state between requests, it goes to Hono. If it involves payment processing or LiveKit, it goes to Hono. If it is a simple read or write tightly coupled to one page with no complex business logic, it can be a Next.js route handler. When in doubt, it goes to Hono.

---

## 5. Database — Supabase (PostgreSQL)

**Decision:** Supabase as the database host, accessed via the Supabase JS client from the Hono server using the service role key.

**Reasoning:**

Supabase provides a fully managed PostgreSQL instance with a clean JavaScript client, automatic connection pooling via PgBouncer, and a database dashboard for visibility during development. PostgreSQL is the correct database for Kanvise because the data model is highly relational — schools, programmes, sub-programmes, courses, users, enrolments, assignments, submissions, mocks, questions, answers, attendance records, and payment records all have complex relationships that a relational database handles correctly.

The Supabase JS client is used on the server inside Hono with the service role key. This means Supabase's Row Level Security (RLS) policies are bypassed entirely — we do not rely on Supabase RLS for tenant isolation. Multi-tenancy is enforced at the application layer in Hono middleware. Every database query is scoped to the correct school_id by the middleware before the query runs. This approach gives us full control over access logic and avoids the complexity of maintaining RLS policies alongside application-layer auth.

**Key decisions:**

The service role key is used server-side only. It is never sent to the frontend. Never.

Every table that contains school-scoped data has a `school_id` column with a foreign key to the schools table. The tenant middleware extracts the school_id from the authenticated user's JWT and attaches it to the request context. Every query that runs inside a route handler must use this school_id as a filter.

Connection pooling is handled by Supabase's built-in PgBouncer. The Hono server does not manage its own connection pool.

Database migrations are managed through Supabase's migration system. No raw SQL is run directly against the production database outside of the migration pipeline.

**Constraints this choice imposes:**

No developer runs queries without a school_id filter on tenant-scoped tables. There are no exceptions. If a query needs to run across all schools (e.g. Kanvise admin tooling), it must be explicitly flagged and reviewed.

Supabase's free tier connection limits apply — if the Hono server opens too many concurrent connections, queries will fail. Connection pooling via the Supabase connection string (port 6543, not 5432) must be used.

---

## 6. File Storage — Cloudflare R2

**Decision:** Cloudflare R2 for all file storage.

**Reasoning:**

Cloudflare R2 is S3-compatible, meaning the AWS S3 SDK works with it out of the box with only an endpoint change. It has zero egress fees — files served to users do not incur bandwidth costs, which matters significantly for a platform where students are regularly downloading notes, assignment files, and accessing video intros. This is a major cost advantage over AWS S3 for a Nigerian EdTech platform where students may download the same files repeatedly on slow connections.

Files stored in R2 are served through Cloudflare's CDN automatically, meaning files load quickly for Nigerian users regardless of where they are in the country.

**What is stored in R2:**

Class notes uploaded by tutors (PDF, DOCX, PPT, JPG, PNG), assignment files attached by tutors, student assignment submission files, tutorial centre banner images, tutorial centre logo images, promotional banner images, tutor profile photos, avatar component assets (the SVG or PNG parts that make up each avatar configuration), video intro files uploaded by tutorial centres.

**Upload flow:**

The frontend requests a presigned upload URL from the Hono backend. The Hono backend generates the presigned URL using the R2 SDK and returns it. The frontend uploads the file directly to R2 using the presigned URL — the file never passes through the Hono server. Once the upload is complete, the frontend notifies the Hono backend with the file key. The Hono backend stores the file key in the database record.

This approach keeps the Hono server lean — it never buffers large files in memory.

**File serving:**

Files are served through a Cloudflare R2 public bucket URL or a custom domain (e.g. `cdn.kanvise.ng`). Sensitive files (student submissions, private notes) are served via short-lived presigned download URLs generated by the Hono backend. Public files (centre logos, banner images, promo images) are served from a public R2 bucket directly.

**Constraints this choice imposes:**

File type validation and size limit enforcement must happen on the Hono backend before the presigned URL is generated — not on the client. The client can lie about file types.

Maximum file sizes must be defined per file type. Suggested limits for MVP: notes and assignment files 50MB, video intros 500MB, images 10MB.

File keys in R2 must follow a consistent naming convention that encodes the school_id for organisational clarity: `schools/{school_id}/notes/{file_id}.pdf`, `schools/{school_id}/submissions/{submission_id}.pdf`, etc.

---

## 7. Live Video — Self-Hosted LiveKit on Scaleway

**Decision:** LiveKit, self-hosted on a Scaleway instance, for all live class functionality.

**Reasoning:**

LiveKit is an open-source WebRTC infrastructure server that handles the complexity of peer-to-peer and server-side-forwarded video routing. Self-hosting on Scaleway gives Kanvise full control over the server location, cost structure, and data sovereignty — student video data does not pass through a third-party cloud service.

LiveKit runs on the same Scaleway infrastructure as the Hono API server, meaning they share a private network. The LiveKit webhook events (participant joined, participant left) are sent from LiveKit to the Hono server over this private network — fast, no public internet latency, no external authentication needed for the webhook call beyond a shared secret.

**How LiveKit integrates with Kanvise:**

When a tutor clicks Start Class, the Hono backend creates a LiveKit room using the LiveKit server SDK, generates a tutor access token with host permissions, and returns the token to the frontend. The frontend uses the LiveKit client SDK to join the room with that token.

When a student clicks Join Class, the Hono backend verifies the student is enrolled in the relevant course, generates a student access token with participant permissions, and returns it. The frontend joins the room.

LiveKit sends a webhook to the Hono backend when a participant joins (including their participant identity which maps to their Kanvise user ID) and when they leave (including their time in the room). The Hono backend records this as an attendance event.

**Constraints this choice imposes:**

The LiveKit server must have sufficient CPU and bandwidth for the expected concurrent participants. This is an infrastructure concern that must be monitored and scaled independently of the Hono API server. For MVP, a single Scaleway instance is acceptable. Post-MVP, a dedicated LiveKit instance separate from the Hono server is recommended.

The LiveKit client SDK must be integrated into the Next.js frontend as a client-side only import — it cannot be used in Server Components.

The Hono backend must validate all LiveKit webhook payloads using the LiveKit webhook secret before processing them.

Avatar images must be accessible as public URLs so they can be passed to the LiveKit room as the participant's avatar property, displayed when the camera is off.

---

## 8. Authentication — Supabase Auth

**Decision:** Supabase Auth for user registration, login, and session management.

**Reasoning:**

Since Supabase is already in the stack for the database, using Supabase Auth is the natural choice — it sits in the same project, shares the same dashboard, and integrates with the Supabase JS client without additional setup. It handles email/password auth, password reset flows via email OTP, and JWT generation out of the box.

**How auth works in Kanvise:**

The user registers or logs in through the Next.js frontend using the Supabase JS client (anon key, browser-safe). Supabase Auth returns a JWT. This JWT is sent in the Authorization header of every request to the Hono backend.

The Hono auth middleware verifies the JWT using the Supabase JWT secret. Once verified, the middleware extracts the user's Supabase user ID and uses it to look up the user's Kanvise profile (their role, school_id, and Kanvise user ID like ACA-STU-XXXXX) from the database. This profile is attached to the request context for the route handler to use.

Custom claims (role, school_id) are stored in the user's Supabase Auth metadata so they are available in the JWT without a database lookup on every request.

**Constraints this choice imposes:**

The Supabase anon key is used on the frontend for auth only. All other data operations go through the Hono API using the service role key — never from the frontend directly.

Password reset emails are sent through Supabase Auth's built-in email system for the reset flow. All other platform emails (receipts, notifications, school codes) go through Resend.

---

## 9. Email — Resend

**Decision:** Resend for all transactional email.

**Reasoning:**

Resend is a modern developer-focused email API with a clean SDK, reliable deliverability, and React Email support — meaning email templates can be written as React components and rendered to HTML, keeping the template code in the same codebase and language as the rest of the project.

**Emails the system sends:**

Welcome email on account creation, password reset (handled by Supabase Auth but Resend is used for all other flows), payment receipt after successful student payment, programme/course access confirmation after enrolment (includes the school link), upcoming live class reminder to enrolled students, assignment deadline reminder, mock exam availability notification.

**Constraints this choice imposes:**

All email sending happens from the Hono backend only. The frontend never calls Resend directly.

Email templates must be built as React Email components stored in the Hono codebase under a `/emails` directory.

A custom sending domain must be configured in Resend for production — emails must come from a domain like `noreply@kanvise.ng`, not from a Resend subdomain.

---

## 10. Payment — Paystack

**Decision:** Paystack as the sole payment gateway for MVP.

**Reasoning:**

Paystack is the dominant payment infrastructure provider in Nigeria, with native support for all Nigerian payment methods — card, bank transfer, and USSD. It is deeply familiar to Nigerian users and trusted by them. Its API is well-documented and its webhook system is reliable.

**Two payment flows in Kanvise:**

The first flow is tutorial centre monthly subscription payments to Kanvise. Tutorial centres pay their flat monthly fee to Kanvise directly. This is a standard Paystack payment where Kanvise is the merchant.

The second flow is student payments for programmes and courses. Students pay the tutorial centre's listed price plus an Kanvise service fee on top. Paystack's split payment feature (subaccounts) is used here — the tutorial centre is set up as a Paystack subaccount. When a student pays, Paystack automatically splits the payment: the tutorial centre's amount goes to their subaccount, Kanvise's service fee goes to the main Kanvise Paystack account. This happens at the gateway level — Kanvise never holds the tutorial centre's money.

**Constraints this choice imposes:**

Each tutorial centre must have a Paystack subaccount created for them when they onboard. The Hono backend creates this subaccount via the Paystack API during school setup. The subaccount code is stored in the school's database record.

All Paystack webhook events must be verified using the Paystack webhook signature before processing. The verification uses the Paystack secret key to validate the x-paystack-signature header.

Payment initiation always happens server-side in Hono — the frontend never calls Paystack directly. The frontend receives a payment URL or reference from Hono and redirects the user to Paystack or opens the Paystack inline popup.

Paystack webhook events the system must handle: `charge.success`, `charge.failed`, `transfer.success`, `transfer.failed`.

---

## 11. Summary Table

| Concern | Technology | Hosted On |
|---|---|---|
| Frontend | Next.js (App Router) | Vercel |
| Backend API | Hono (Node.js) | Scaleway |
| Live Video | LiveKit (self-hosted) | Scaleway |
| Database | PostgreSQL via Supabase | Supabase |
| File Storage | Cloudflare R2 | Cloudflare |
| Auth | Supabase Auth | Supabase |
| Email | Resend | Resend (managed) |
| Payments | Paystack | Paystack (managed) |
| Background Jobs | node-cron inside Hono | Scaleway |
| CDN | Cloudflare (R2 + edge) | Cloudflare |

---

## 12. What This Stack Does Not Include (And Why)

**No ORM.** The Supabase JS client provides a query builder that is sufficient for the data access patterns in Kanvise. Introducing Prisma or Drizzle adds a build step, a migration system that conflicts with Supabase's own migration system, and additional complexity. For MVP, the Supabase client is used directly.

**No Redis or separate cache.** Caching is not needed at MVP scale. Supabase connection pooling handles concurrent database requests. If caching becomes necessary post-MVP (e.g. for public programme pages under high traffic), Vercel's built-in edge caching handles the public pages and Redis can be introduced for server-side caching at that point.

**No message queue.** Background jobs run on node-cron inside the Hono process for MVP. A proper job queue (BullMQ with Redis) is a post-MVP addition when job volume and reliability requirements increase.

**No separate admin panel framework.** Kanvise's Admin dashboard is built in Next.js as part of the main application. A separate admin tool for Kanvise's own internal team (to manage tutorial centres, view platform analytics) is post-MVP.

---

*End of Document — Version 1.0*
