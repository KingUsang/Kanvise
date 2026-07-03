**Version:** 1.0 | **Prepared by:** Architecture Team | **Date:** June 2026

**Status:** Approved — Do Not Deviate Without Team Sign-Off

---

> ⚠️ Every developer working on this project must read this document before writing a single line of code. Any proposed deviation from these choices must be discussed and approved before implementation.
> 

## Purpose

This document records every technology choice made for the Kanvise platform, the reasoning behind each decision, and the constraints each choice imposes on the development team.

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

Next.js is the correct choice for Kanvise because the platform has both public-facing pages and authenticated dashboard pages with fundamentally different rendering requirements. The public tutorial centre pages (`kanvise.ng/[centre-slug]`) need to be fast, SEO-indexable, and shareable. The authenticated dashboard pages (Admin, Tutor, Student) are client-rendered interactive applications. Next.js handles both within the same codebase.

Vercel is the natural deployment target — zero-configuration deployment, automatic preview environments for every pull request, edge caching for public pages, and built-in CDN.

**Key decisions within Next.js:**

- The App Router is used — not the Pages Router
- Route groups separate the public layer, auth layer, and each role's dashboard
- Server Components handle data fetching for public pages
- Client Components handle all interactive dashboard elements

**Constraints:**

- Developers must correctly distinguish Server Components from Client Components. `useState` and `useEffect` only appear in Client Components
- API calls to Hono always go through Next.js route handlers or directly from Client Components — never from Server Components
- `NEXT_PUBLIC_` prefix only for variables safe to expose to the browser. Never for secrets

---

## 3. Backend — Hono on Node.js

**Decision:** Hono framework running on Node.js, hosted as a persistent server on Scaleway.

**Reasoning:**

Hono is lightweight, fast, and runs natively on Node.js. Its middleware system is clean and composable — essential for enforcing multi-tenancy at the request level.

The critical reason Hono runs as a **persistent server on Scaleway** rather than serverless functions on Vercel is **background jobs**:

- Mock auto-publish requires a scheduled job that flips mock status from draft to published at a set time — impossible on serverless
- Upcoming class notifications require a scheduled job — same constraint

Scaleway also hosts the LiveKit server, meaning Hono and LiveKit share a private network. LiveKit webhook events travel from LiveKit to Hono over this private connection.

**Key decisions:**

- Routes grouped by feature module: auth, schools, programmes, courses, content, payments, attendance, notifications, avatars, storage
- Middleware order: JWT verification → tenant resolution → role authorisation → rate limiting → route handler
- Supabase JS client instantiated once, injected via Hono context — never re-instantiated per request
- Background jobs on node-cron inside the same Hono process for MVP

**Constraints:**

- Hono must **never** be deployed as a serverless function. Always a persistent process managed by PM2
- Long-running operations must be handled asynchronously — never block the request cycle
- Hono is the **only** service that communicates directly with Supabase
- CORS must allow only the Vercel frontend origin. No wildcard origins in production

---

## 4. API Boundary — Next.js Route Handlers vs Hono

Kanvise runs two API layers. Every new endpoint must be placed on the correct side of this boundary before it is built.

**Next.js Route Handlers handle:**

- Auth callbacks and session management (Supabase Auth redirects)
- Public page data fetching (Server Components, cacheable, no auth)
- Paystack webhook receiver at `/api/webhooks/paystack` — forwards to Hono for processing
- File presigned URL requests for simple uploads
- Simple page-level data mutations with no complex business logic

**Hono on Scaleway handles:**

- All background jobs and scheduled tasks (mock auto-publish, class notifications, deadline reminders)
- LiveKit room creation and participant token generation
- LiveKit webhook receiver for attendance logging (private network)
- All payment business logic (Paystack transactions, subaccounts, split payments, subscription billing)
- Complex multi-step business logic (enrolment processing, mock submission auto-grading, assignment validation)
- All operations requiring cross-table writes

**The rule:** If it needs a persistent process, involves payments, or involves LiveKit → Hono. Simple read/write tightly coupled to one page → Next.js route handler. When in doubt → Hono.

---

## 5. Database — Supabase (PostgreSQL)

**Decision:** Supabase as the database host, accessed via the Supabase JS client from the Hono server using the **service role key**.

**Reasoning:**

Supabase provides a fully managed PostgreSQL instance with a clean JS client, automatic connection pooling via PgBouncer, and a database dashboard for development visibility. PostgreSQL is correct for Kanvise because the data model is highly relational.

The Supabase JS client is used **server-side inside Hono with the service role key**. Supabase RLS is bypassed entirely — multi-tenancy is enforced at the application layer in Hono middleware.

**Key decisions:**

- Service role key is server-side only. **Never sent to the frontend. Never.**
- Every tenant-scoped table has a `school_id` column with a foreign key to the schools table
- Connection pooling via Supabase's PgBouncer — use port 6543, not 5432
- Database migrations managed through Supabase's migration system

**Constraints:**

- No developer runs queries without a `school_id` filter on tenant-scoped tables. No exceptions
- Connection string must use port 6543 (pooled) — not 5432 (direct)

---

## 6. File Storage — Cloudflare R2

**Decision:** Cloudflare R2 for all file storage.

**Reasoning:**

Cloudflare R2 is S3-compatible (AWS S3 SDK works with only an endpoint change) and has **zero egress fees** — critical for a platform where Nigerian students download files repeatedly on slow connections. Files are served through Cloudflare's CDN automatically.

**What is stored in R2:**

Class notes, assignment files, student submissions, centre banner images, logos, promo images, tutor photos, avatar assets, video intros.

**Upload flow:**

1. Frontend requests presigned PUT URL from Hono
2. Hono validates file type and size, generates presigned URL
3. Frontend uploads **directly to R2** — file never passes through Hono
4. Frontend notifies Hono with the file key
5. Hono stores the file key in the database record

**File serving:**

- Public files (logos, banners, promos) → served from public R2 bucket via `cdn.kanvise.ng`
- Private files (submissions, attachments) → served via short-lived presigned GET URLs from Hono

**Constraints:**

- File type and size validation happens on Hono **before** presigned URL is generated
- Size limits: notes/assignments 50MB, video intros 500MB, images 10MB
- File key format: `schools/{school_id}/{entity_type}/{uuid}.{ext}`

---

## 7. Live Video — Self-Hosted LiveKit on Scaleway

**Decision:** LiveKit, self-hosted on Scaleway, for all live class functionality.

**Reasoning:**

LiveKit is open-source WebRTC infrastructure. Self-hosting gives Kanvise full control over server location, cost, and data sovereignty — student video never passes through a third-party cloud.

LiveKit shares the Scaleway private network with Hono — attendance webhook events travel over this private connection, fast and secure.

**Integration flow:**

1. Tutor clicks Start Class → Hono creates LiveKit room, generates host token → tutor joins via LiveKit JS SDK
2. Student clicks Join Class → Hono verifies enrolment, generates participant token → student joins room
3. LiveKit sends webhook to Hono on participant join (with timestamp) and leave (with timestamp)
4. Hono records attendance event

**Constraints:**

- LiveKit client SDK must be imported client-side only — not in Server Components
- All LiveKit webhook payloads must be validated using the LiveKit webhook secret
- Avatar images must be publicly accessible URLs — passed to LiveKit as camera-off placeholder

---

## 8. Authentication — Supabase Auth

**Decision:** Supabase Auth for user registration, login, and session management.

**How auth works:**

1. User registers/logs in via Next.js frontend using Supabase JS client (anon key — browser safe)
2. Supabase Auth returns a JWT
3. JWT sent in Authorization header of every Hono request
4. Hono middleware verifies JWT using Supabase JWT secret
5. User's Kanvise profile (role, school_id, user ID) looked up and attached to request context

Custom claims (role, school_id) stored in Supabase Auth metadata — available in JWT without a database lookup per request.

**Constraints:**

- Supabase anon key used **only** for auth on the frontend. All data goes through Hono
- Password reset emails → Supabase Auth built-in. All other emails → Resend

---

## 9. Email — Resend

**Decision:** Resend for all transactional email.

**Reasoning:** Clean SDK, reliable deliverability, React Email support — templates written as React components, compiled to HTML inside Hono. Same language as the rest of the project.

**Emails sent by the system:**

- Welcome email on account creation
- Payment receipt after successful student payment
- Programme/course access confirmation after enrolment
- Upcoming live class reminder
- Assignment deadline reminder
- Mock exam availability notification

**Constraints:**

- All email sending from Hono backend only — frontend never calls Resend directly
- Templates stored as React Email components under `/emails` in the Hono codebase
- Custom sending domain required for production: `noreply@kanvise.ng`

---

## 10. Payment — Paystack

**Decision:** Paystack as the sole payment gateway for MVP.

**Reasoning:** Dominant payment provider in Nigeria. Native support for card, bank transfer, and USSD. Trusted by Nigerian users. Reliable webhook system.

**Two payment flows:**

**Flow 1 — Tutorial centre monthly subscription to Kanvise:** Standard Paystack payment. Kanvise is the merchant.

**Flow 2 — Student payments for programmes/courses:** Students pay the centre's listed price plus a Kanvise service fee. Paystack split payment (subaccounts) handles this automatically at the gateway level — centre's share goes to their subaccount, Kanvise's fee goes to the main account. Kanvise never holds the centre's money.

**Constraints:**

- Each tutorial centre must have a Paystack subaccount created on onboarding — stored in school record
- All Paystack webhooks must be verified using `x-paystack-signature` header
- Payment initiation always server-side in Hono — frontend never calls Paystack directly
- Webhook events to handle: `charge.success`, `charge.failed`, `transfer.success`, `transfer.failed`

---

## 11. Summary Table

| Concern | Technology | Hosted On |
| --- | --- | --- |
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

**No ORM.** The Supabase JS client's query builder is sufficient. Prisma or Drizzle would conflict with Supabase's migration system and add unnecessary complexity at MVP.

**No Redis or separate cache.** Not needed at MVP scale. Vercel edge caching handles public pages. Redis can be added post-MVP if needed.

**No message queue.** node-cron inside Hono is sufficient for MVP. BullMQ with Redis is a post-MVP addition.

**No separate admin panel framework.** Kanvise's Admin dashboard is built in Next.js. An internal Kanvise team tool is post-MVP.

---

*End of Document — Version 1.0*