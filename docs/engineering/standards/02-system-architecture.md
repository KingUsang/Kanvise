# System architecture and ownership boundaries

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard defines Kanvise's logical components and the authority of each.
Deployment topology may change without moving business ownership across these
boundaries.

## Component ownership

| Component | Authority |
|---|---|
| Next.js web application | Presentation, navigation, public rendering, dashboard session gates, and Supabase Auth browser/callback flows |
| Hono API | Business rules, authorization, validation, application-data access, and external-service orchestration |
| Supabase Auth | Credentials, identity proof, access/refresh sessions, and token issuance; not Kanvise membership or permissions |
| PostgreSQL | Durable application records and transactional invariants |
| Cloudflare R2 | Object bytes; ownership, visibility, and lifecycle metadata remain in PostgreSQL |
| PlugNMeet | Ephemeral live-room media and provider-native classroom features |
| Scheduler/worker | Scheduled, retryable, asynchronous work |
| External providers | Their external delivery facts; Hono translates verified results into Kanvise state |

Current external providers include Paystack for payments, Resend for email,
Deepgram for transcription, and Gemini for generated summaries. Provider
selection is an integration decision and does not transfer Kanvise business
authority out of Hono and PostgreSQL.

## Web and API boundary

The browser communicates with Supabase directly only for authentication and
session operations. Application-data reads and writes go through Hono.

Public pages may call Hono from Next.js Server Components so useful content is
present in the initial HTML. Their caching and revalidation policy must be
explicit.

Authenticated dashboard Server Components perform the session gate and render
the shell. Dashboard business data is fetched in Client Components through the
shared TanStack Query and authenticated-fetch layer. A Server Component must
not fetch dashboard business data or pass an access token into Client
Component props.

Next.js route handlers are permitted for:

- Supabase Auth callbacks and browser-session handoffs;
- frontend health and deployment identity;
- a necessary same-origin ingress or thin proxy; and
- third-party webhooks that require the web application's stable public URL.

They must not query application tables or become a second business API.
Edge-level payload limits or signature checks may be repeated for safety, but
the authoritative business validation and state transition occur once in
Hono.

## Data boundary

Hono is the only application runtime that uses privileged database access.
Privileged credentials never enter browser or Next.js public configuration.
Browser roles must not receive direct application-table access merely to avoid
creating an API endpoint.

PostgreSQL is authoritative for Kanvise state. Multi-record invariants and
state transitions that require atomicity use database transactions or reviewed
database functions invoked by Hono. Exact database-access, RLS, and migration
rules are defined in the database and security standards.

## File boundary

Hono validates identity, authorization, file intent, type, and size before
issuing a short-lived R2 operation. The browser transfers bytes directly to or
from R2. Hono records and authorizes the object key; it does not normally
buffer the file.

Public objects require an explicit public classification. Private objects are
served through short-lived authorized URLs. An R2 path is not authorization.

## Live-class boundary

Hono owns class access, lifecycle rules, and the mapping between Kanvise
records and PlugNMeet rooms. The browser joins PlugNMeet directly only with a
short-lived credential issued after Hono authorization.

PlugNMeet is authoritative for ephemeral media-room events and provider-native
classroom state. Verified webhooks and reconciliation translate relevant facts
into durable PostgreSQL records. Provider callbacks are untrusted until their
signature and replay constraints pass.

## Asynchronous-work boundary

The scheduler/worker is a distinct logical role even while a single deployment
shares the API binary. Exactly one scheduler instance may be enabled until
cross-process claims or distributed locking make concurrent workers safe.

Durable work must be persisted, bounded, idempotent, observable, retryable, and
safe after process restart. In-memory timers and fire-and-forget promises are
allowed only for disposable work whose loss is explicitly acceptable; they
are not queues.

## Ownership rule

Every operation has one authoritative owner. Proxies may transport a request,
and clients may validate for usability, but business rules must not be copied
across Next.js, Hono, jobs, and database functions. When a rule must exist in
multiple enforcement layers, one layer owns its definition and tests prove the
layers agree.
