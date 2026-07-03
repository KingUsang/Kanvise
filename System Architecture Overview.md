**Version:** 1.0 | **Prepared by:** Architecture Team | **Date:** June 2026

**Status:** Approved — Reference for All Development Decisions

---

> ⚠️ Every developer must understand this document before building any feature. The architecture described here is the source of truth — if code contradicts this document, the code is wrong.
> 

## 1. Runtime Environments

Kanvise is distributed across four runtime environments. Each has a single responsibility and communicates with others only through defined interfaces.

```
┌─────────────────────────────────────────────────────────────────────┐
│                            VERCEL                                    │
│   Next.js Application                                               │
│   ├── Public Pages (SSR/SSG)                                        │
│   │   ├── kanvise.ng                    (Marketing / Landing)       │
│   │   ├── kanvise.ng/[centre-slug]      (Centre Public Page)        │
│   │   └── kanvise.ng/[centre-slug]/[programme-slug]                 │
│   ├── Auth Pages (/login, /register, /reset-password)              │
│   ├── Dashboard Pages (Role Protected)                             │
│   │   ├── /dashboard/admin/**                                       │
│   │   ├── /dashboard/tutor/**                                       │
│   │   └── /dashboard/student/**                                     │
│   └── Next.js Route Handlers                                        │
│       ├── /api/webhooks/paystack        (Payment webhook receiver)  │
│       ├── /api/auth/**                  (Supabase Auth callbacks)   │
│       └── /api/upload/presign           (R2 presigned URL proxy)    │
└──────────────────────────┴────────────────────────────────────────────┘
                           | HTTPS (REST)
┌──────────────────────────▼────────────────────────────────────────────┐
│                          SCALEWAY                                    │
│  ┌───────────────────────────────┐  ┌────────────────────────┐  │
│  │       Hono API Server           │  │   LiveKit Server         │  │
│  │       Node.js + PM2             │  │   (Self-Hosted)          │  │
│  │  Middleware:                    │  │  WebRTC routing          │  │
│  │  JWT → Tenant → Role → Rate   │◄─┤  Video/Audio streams      │  │
│  │  Modules: Schools, Programmes,  │  │  Webhooks to Hono:       │  │
│  │  Courses, Content, Payments,   │  │  participant_joined      │  │
│  │  Attendance, Notifications      │  │  participant_left        │  │
│  │  Background Jobs (node-cron):  │  └────────────────────────┘  │
│  │  Mock auto-publish             │  Private Network (no internet)   │
│  │  Class notifications           │                                    │
│  └───────────────────────────────┘                                    │
└──────────────────────────┴────────────────────────────────────────────┘
           SUPABASE / CLOUDFLARE R2 / PAYSTACK / RESEND
```

---

## 2. Communication Paths

**Browser → Vercel (Next.js)**

All user-facing traffic enters through Vercel. The browser never speaks directly to Hono, Supabase, LiveKit, or any other backend service.

**Next.js Server Components → Hono API**

Server Components rendering public pages call Hono during render on the server. The response is embedded into HTML before reaching the browser — no additional client-side API call needed.

**Next.js Client Components → Hono API**

Dashboard interactions use fetch from Client Components with the user's JWT in the Authorization header.

**Next.js Route Handlers → Hono API**

Some route handlers proxy to Hono — e.g. the Paystack webhook handler receives the event and forwards it to Hono for processing.

**Hono → Supabase**

Hono is the **only** service that communicates with Supabase. Uses service role key. Every query scoped to school_id from middleware context.

**Hono → Cloudflare R2**

Hono generates presigned URLs. Files go directly between browser and R2 — Hono never buffers file content.

**Hono → LiveKit**

Room creation and token generation over Scaleway private network (fast, no public internet).

**LiveKit → Hono (Attendance Webhooks)**

LiveKit pushes participant join/leave events to Hono over the private network. Hono records attendance. Hono never polls LiveKit.

**Hono → Paystack**

All Paystack API calls are server-side only — initiate transactions, create subaccounts, verify references.

**Paystack → Next.js (Webhook)**

Paystack sends `charge.success` to `kanvise.ng/api/webhooks/paystack`. Next.js route handler verifies signature, calls Hono to process.

**Hono → Resend**

All outbound emails sent from Hono via Resend API. React Email templates compiled to HTML inside Hono.

**Browser → Cloudflare R2 (Direct)**

After Hono generates a presigned URL, browser uploads/downloads directly to/from R2. File never passes through Hono or Vercel.

**Browser → LiveKit (WebRTC)**

Once browser has a LiveKit token from Hono, it connects directly to LiveKit for the video session. Streams never touch Hono or Vercel.

---

## 3. The Public Layer

Accessible without any login. Serves two purposes: marketing Kanvise to tutorial centres, and marketing tutorial centres to prospective students.

| URL | Purpose |
| --- | --- |
| `kanvise.ng` | Kanvise marketing page |
| `kanvise.ng/[centre-slug]` | Tutorial centre public storefront |
| `kanvise.ng/[centre-slug]/[programme-slug]` | Programme marketing + enrolment page |
| `kanvise.ng/[centre-slug]/[course-slug]` | Standalone course page (small centres) |

All public pages are Server Components. Data fetched from Hono during server render. Cached at Vercel's edge CDN. Cache invalidated when Admin updates school profile or programme details.

**Public centre page contains:** school banner and logo, description, optional video intro (streamed from R2 via Cloudflare CDN), contact details and social links, enrolled student count, tutor cards (name, subject, circular photo — clickable to bio), promotional banners (image, title, links to programme/course), list of all programmes and standalone courses with prices, reviews per programme.

No auth required to view any public page. Enrolment CTA redirects unauthenticated users to registration with the programme pre-selected.

---

## 4. The Authentication Layer

```
User fills in registration/login form (Next.js)
         ↓
Supabase Auth JS client (browser, anon key)
         ↓
Supabase Auth validates credentials
         ↓
JWT returned — stored in httpOnly cookie
         ↓
Every API request to Hono includes JWT in Authorization header
         ↓
Hono middleware verifies JWT using Supabase JWT secret
         ↓
User profile (role, school_id, Kanvise user ID) attached to request context
         ↓
Route handler runs with full user context
```

Role-based routing enforced at two levels:

- **Frontend:** Next.js middleware checks role from JWT cookie and redirects if wrong route (UX convenience)
- **Backend:** Hono middleware checks role on every request (security enforcement)

---

## 5. Key Request Flows

### Student Enrols in a Programme

1. Student lands on programme page → Server Component fetches data from Hono → page renders with price, tutors, courses, enrol CTA
2. Student clicks Enrol → if not logged in, redirect to `/auth/register?redirect=[programme-url]`
3. After login, client calls `POST /api/enrolments/initiate` (Hono)
4. Hono verifies JWT, checks not already enrolled, calls Paystack to initialise transaction with split payment config
5. Student redirected to Paystack → completes payment (card/bank transfer/USSD)
6. Paystack sends `charge.success` webhook → Next.js route handler → Hono
7. Hono creates enrolment record, grants access, sends receipt email and access confirmation via Resend
8. Student lands on dashboard with newly enrolled programme visible

### Tutor Starts a Live Class

1. Tutor clicks Start Class → `POST /live-classes/:id/start` (Hono)
2. Hono creates LiveKit room, generates host token, updates class status to `live`
3. Frontend connects to LiveKit room using token → tutor is live
4. Students see class status update → click Join → `POST /live-classes/:id/join` (Hono)
5. Hono verifies enrolment, generates participant token → student joins
6. LiveKit sends `participant_joined` webhook to Hono → attendance record created
7. On leave, `participant_left` webhook → Hono calculates duration, finalises attendance
8. Tutor ends class → LiveKit room closed → all records finalised

### Mock Auto-Publish (Background Job)

1. Tutor creates mock with scheduled publish time → saved with `status: draft`
2. node-cron job runs every minute → queries for drafts where `publish_at <= NOW()`
3. For each: update status to `published`, send notification emails to enrolled students via Resend

### Student Submits a Mock Exam

1. Student opens published mock → `GET /mocks/:id` (Hono) → questions returned **without** correct answers
2. Student answers and submits (or timer hits zero → client auto-submits)
3. `POST /mocks/:id/submit` (Hono) with all answers
4. Hono fetches correct answers from DB (never sent to client), auto-grades MCQ, stores theory for manual review
5. Score returned and displayed immediately

### File Upload Flow

1. User selects file → client calls presign endpoint
2. Hono validates type and size, generates presigned R2 PUT URL
3. Client uploads **directly to R2** — no file passes through Hono
4. Client notifies Hono with file key → Hono stores key in DB record

---

## 6. Background Jobs

| Job | Schedule | Query | Actions | Failure Handling |
| --- | --- | --- | --- | --- |
| Mock Auto-Publish | Every 1 min | Drafts where `publish_at <= NOW()` | Set status to published, email enrolled students | Log error, retry next tick |
| Class Notifications | Every 5 min | Classes starting in 10–15 min, not yet notified | Email enrolled students, set `notification_sent = true` | If email fails, flag not set — retries next tick |
| Assignment Deadline Reminders | Every 30 min | Assignments with deadline in 24–25 hours, student has not submitted | Send reminder email per student | Log errors, no retry flag |

---

## 7. Storage Structure (Cloudflare R2)

```
kanvise-storage/
├── schools/
│   └── {school_id}/
│       ├── profile/      (logo, banner, video-intro)
│       ├── promos/       (promo images)
│       ├── notes/        (tutor uploaded notes)
│       ├── assignments/  (assignment attachments)
│       └── submissions/  (student submission files)
├── avatars/
│   └── {user_id}/    (avatar config JSON)
└── tutors/
    └── {tutor_id}/   (profile photo)
```

- **Public files** (logos, banners, promos) → served from public R2 bucket via `cdn.kanvise.ng`
- **Private files** (submissions, attachments) → served via short-lived presigned GET URLs from Hono (expire in 15 min)

---

## 8. Payment & Revenue Flow

```
Student pays for programme/course
         ↓
Paystack processes payment
         ├──► Tutorial centre share → Centre Paystack subaccount
         └──► Kanvise service fee → Kanvise main Paystack account
         ↓
charge.success webhook → kanvise.ng/api/webhooks/paystack
         ↓
Hono processes:
  - Creates enrolment record
  - Unlocks course/programme access
  - Sends receipt email (Resend)
  - Sends access confirmation email (Resend)
  - Records payment in payments table
```

Tutorial centre monthly subscription to Kanvise is a separate direct payment flow — Kanvise is the merchant, no split.

---

## 9. Environment Summary

| Environment | Service | Purpose | Access |
| --- | --- | --- | --- |
| Vercel | Next.js | Frontend, public pages, auth callbacks, Paystack webhook | Public internet |
| Scaleway | Hono (Node.js) | API server, business logic, background jobs | Public internet (HTTPS) |
| Scaleway | LiveKit | WebRTC live video | Public (WebRTC) + private (webhooks) |
| Supabase | PostgreSQL | Primary database | Hono only |
| Supabase | Auth | Authentication and JWT | Browser (anon key) + Hono (service key) |
| Cloudflare | R2 | File storage | Browser (presigned) + Hono (SDK) |
| Cloudflare | CDN | Public file delivery | Public internet |
| Paystack | Payment API | Processing and split payments | Hono (API key) |
| Resend | Email API | Transactional email | Hono (API key) |

---

## 10. What Does Not Exist in This Architecture

**No direct frontend-to-database connection.** Browser never calls Supabase for data. All data goes through Hono.

**No shared state between Hono and Next.js.** Separate services on separate infrastructure. Communication only through HTTP.

**No file processing on the API server.** Files never upload to Hono. Always direct browser → R2 via presigned URLs.

**No polling.** Attendance via LiveKit webhooks. Payments via Paystack webhooks. Background jobs are time-triggered.

**No server-side sessions.** Authentication is stateless — JWT-based. Every request independently authenticated.

---

*End of Document — Version 1.0*