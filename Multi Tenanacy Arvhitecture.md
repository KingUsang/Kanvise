**Version:** 1.0 | **Prepared by:** Architecture Team | **Date:** June 2026

**Status:** Approved — Zero Tolerance for Violations

---

> ⚠️ Multi-tenancy is the single most critical architectural requirement in Kanvise. A failure here — where data from one tutorial centre becomes visible to another — is not a bug. It is a fundamental breach of trust. Every pull request touching data access is reviewed against the rules in this document.
> 

## 1. The Multi-Tenancy Model

Kanvise uses a **shared database, shared schema, row-level tenant isolation** model.

One Supabase PostgreSQL database. All tutorial centres share the same tables. Tenant isolation is enforced by a `school_id` column present on every tenant-scoped table. Every query that reads or writes tenant-scoped data must include a `school_id` filter.

**Why this model over alternatives:**

- Separate databases per tenant → different Supabase project per centre, impossible cross-platform queries, massive infrastructure overhead at MVP
- Separate schemas per tenant → complex dynamic schema creation, migration chaos, connection pool issues Supabase doesn't cleanly support
- Shared schema → standard SaaS approach at this scale. Risk mitigated entirely by the middleware and query rules defined here

---

## 2. What a Tenant Is

In Kanvise, **a tenant is a tutorial centre**. The tenant's identifier is the `school_id` — a UUID generated when the Admin creates their school.

Every user (Admin, Tutor, Student) belongs to exactly **one** school. Their `school_id` is stored in their user profile and embedded in their JWT as a custom claim at login.

A user can never belong to more than one school. Two tutorial centres run by the same person = two separate Kanvise accounts.

---

## 3. Tenant Resolution — How school_id Gets Into Every Request

```
Incoming request with JWT in Authorization header
                    ↓
        ┌───────────────────────┐
        │   JWT Verification     │
        │  Verify signature      │
        │  Check expiry          │
        │  Extract sub (user ID) │
        └────────────▼───────────┘
                    ↓
        ┌───────────────────────┐
        │  Profile Resolution    │
        │  Look up user profile  │
        │  from user_profiles    │
        │  using Supabase UID    │
        │  Returns:              │
        │  kanvise_user_id       │
        │  role                 │
        │  school_id            │
        └────────────▼───────────┘
                    ↓
        ctx.user = { id, role, school_id, display_name }
                    ↓
        Role Authorisation → Route Handler
```

**Critical rule:** `ctx.user.school_id` from middleware is the **only** valid source of tenant identity. Route handlers must **never** accept a `school_id` from the request body or query parameters. If a client could pass their own school_id, they could read another school's data.

---

## 4. The Middleware Stack

Every authenticated Hono route runs through this stack in this exact order:

```
app.use('*', jwtVerificationMiddleware)     // 1. Verify JWT signature and expiry
app.use('*', profileResolutionMiddleware)   // 2. Load user profile, attach ctx.user
app.use('*', tenantMiddleware)             // 3. Confirm school_id is present
app.use('*', roleMiddleware)              // 4. Check role against route requirements
app.use('*', rateLimitMiddleware)         // 5. Rate limit per user
// Route handler runs here
```

**jwtVerificationMiddleware** — Verifies JWT. Fails → 401. Request does not proceed.

**profileResolutionMiddleware** — Looks up Kanvise user profile using JWT `sub`. Profile not found → 403.

**tenantMiddleware** — Confirms `ctx.user.school_id` is present and is a valid UUID. Safety net — ensures no request reaches a route handler without a confirmed tenant.

**roleMiddleware** — Each protected route declares allowed roles. If user's role is not in the set → 403. Role declaration lives next to the route handler, not in a separate config file.

---

## 5. Database Query Rules

These rules apply to every database query in the Hono codebase. Mandatory. Non-negotiable.

### Rule 1 — Always filter by school_id on tenant-scoped tables

```jsx
// CORRECT
const { data } = await supabase
  .from('programmes')
  .select('*')
  .eq('school_id', ctx.user.school_id)

// WRONG — returns all programmes from all schools
const { data } = await supabase
  .from('programmes')
  .select('*')
```

### Rule 2 — Never use client-supplied IDs without tenant verification

```jsx
// CORRECT — verifies programme belongs to this school
const { data } = await supabase
  .from('programmes')
  .select('*')
  .eq('id', programmeId)
  .eq('school_id', ctx.user.school_id)
  .single()

// WRONG — could return a programme from any school
const { data } = await supabase
  .from('programmes')
  .select('*')
  .eq('id', programmeId)
  .single()
```

### Rule 3 — Always include school_id on INSERT

```jsx
// CORRECT
await supabase
  .from('programmes')
  .insert({
    name: body.name,
    school_id: ctx.user.school_id  // always from middleware context
  })

// WRONG — school_id from request body can be spoofed
await supabase
  .from('programmes')
  .insert({
    name: body.name,
    school_id: body.school_id  // NEVER do this
  })
```

### Rule 4 — Joins must respect tenant boundaries

When joining tables, all sides of the join must be filtered to the same school.

### Rule 5 — Aggregations must be scoped

Any COUNT, SUM, or aggregate must include the `school_id` filter.

---

## 6. Tenant-Scoped Tables

Every query on these tables must include `.eq('school_id', ctx.user.school_id)`.

| Table | Notes |
| --- | --- |
| schools | Primary tenant anchor (school_id IS the id) |
| user_profiles | Every user belongs to one school |
| programmes |  |
| sub_programmes |  |
| courses |  |
| enrolments | Student access records |
| live_classes |  |
| attendance_records |  |
| notes |  |
| assignments |  |
| submissions |  |
| mock_exams |  |
| mock_questions |  |
| mock_answers | Never returned to client before submission |
| mock_results |  |
| payments | Student payment records |
| notifications |  |
| promos |  |
| reviews |  |
| tutor_course_assignments | Which tutors teach which courses |
| tutor_invites | Pending/accepted/expired/revoked tutor invitations per school |

---

## 7. Platform-Level Tables (Not Tenant-Scoped)

These store Kanvise platform data, not tutorial centre data. No `school_id` filter required.

| Table | Purpose |
| --- | --- |
| kanvise_subscriptions | Monthly billing records for tutorial centres paying Kanvise |
| paystack_subaccounts | Paystack subaccount IDs per school (managed at platform level) |

---

## 8. The Public Layer and Tenancy

Public pages have no JWT. Tenancy is resolved from the URL slug instead:

```jsx
// Public route — no auth middleware
app.get('/public/schools/:slug', async (ctx) => {
  const slug = ctx.req.param('slug')

  // Resolve school from slug
  const { data: school } = await supabase
    .from('schools')
    .select('id, name, ...')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!school) return ctx.json({ error: 'Not found' }, 404)

  // All queries in this handler use school.id — never from query params
  const { data: programmes } = await supabase
    .from('programmes')
    .select('*')
    .eq('school_id', school.id)
    .eq('is_published', true)
})
```

**Two absolute rules for public routes:**

1. The school_id used in queries always comes from the database lookup by slug — never from query parameters or request body
2. **Public routes are read-only without exception.** No write operations through a public route.

---

## 9. Storage Isolation

Tenant isolation in Cloudflare R2 is enforced through the folder structure. Every school's files are stored under `schools/{school_id}/`.

Before generating any presigned GET URL for a private file, Hono extracts the `school_id` from the file key and verifies it matches `ctx.user.school_id`:

```jsx
app.get('/files/:fileKey/download', authMiddleware, async (ctx) => {
  const fileKey = ctx.req.param('fileKey')
  const fileSchoolId = fileKey.split('/')[1] // schools/{school_id}/...

  if (fileSchoolId !== ctx.user.school_id) {
    return ctx.json({ error: 'Forbidden' }, 403)
  }

  const presignedUrl = await generatePresignedGetUrl(fileKey)
  return ctx.json({ url: presignedUrl })
})
```

---

## 10. Role Boundaries Within a Tenant

Tenancy defines which school. Role defines what the user can do within that school.

**Admin** — can read and write everything within their school.

**Tutor** — can read school-level data, write only to entities they are assigned to:

- Upload notes only to courses they teach
- Create assignments only in courses they teach
- View submissions only for their own assignments
- Create mocks only in courses they teach
- View attendance only for their own live classes

**Student** — can read only what they are enrolled in, write only their own work:

- See notes only for enrolled courses
- See assignments only for enrolled courses
- View only their own submissions and results
- Access live classes only for enrolled courses

Tutor assignment to a course must be verified in the route handler. Note the role gate accepts both `'tutor'` and `'admin'` — an admin who also teaches (the solo tutor-admin case) must reach this handler too; the real gate is the assignment check below, not the role check:

```jsx
app.post('/courses/:courseId/notes', authMiddleware, requireRole(['admin', 'tutor']), async (ctx) => {
  const { data: assignment } = await supabase
    .from('tutor_course_assignments')
    .select('id')
    .eq('tutor_id', ctx.user.id)
    .eq('course_id', courseId)
    .eq('school_id', ctx.user.school_id)
    .single()

  if (!assignment) return ctx.json({ error: 'Not assigned to this course' }, 403)
  // Proceed
})
```

This pattern applies to every Tutor-scoped write route (Notes Upload, Assignment Creator, Mock Creator, Live Classroom start) — `requireRole(['admin', 'tutor'])` at the role layer, `tutor_course_assignments` as the real per-course gate.

---

## 11. Tutor Invitation Flow

Unlike Admin (self-service signup) and Student (joins via a shared, public enrolment link), a Tutor never registers on their own initiative. A `user_profiles` row with `role = 'tutor'` is only ever created as the result of an Admin-issued invite being accepted. The `tutor_invites` table (Database_Schema.md, Section 2.10) tracks this end to end.

**Why this needs its own tracked state, unlike Student enrolment:**

A student clicking a public programme link and paying is a self-contained, reversible action — there's nothing sensitive to track beyond the eventual `enrolments` row. A tutor invite grants a not-yet-existing person the future ability to write into the school (upload notes, host classes, grade work) — so an Admin needs to see who's been invited and hasn't joined yet, and needs a way to cancel an invite before it's accepted. Supabase Auth's own `inviteUserByEmail` mechanism creates the unconfirmed account and sends the email, but it does not expose a "rejected" state or a queryable expiry — `tutor_invites` is Kanvise's own tenant-scoped record of that process.

**Flow:**

```
Admin (from Invite Tutor screen) submits invitee email
                    ↓
Hono creates a `tutor_invites` row:
  school_id = ctx.user.school_id   (never client-supplied)
  invited_by = ctx.user.id
  status = 'pending'
  expires_at = now() + 7 days (configurable)
                    ↓
Hono calls supabase.auth.admin.inviteUserByEmail(email, {
  data: { school_id, role: 'tutor' }   ← written to app_metadata, NOT user_metadata
})
                    ↓
Supabase creates an unconfirmed auth.users row and emails the invite link
                    ↓
Hono stores the returned Supabase user id back onto the tutor_invites row
  (supabase_auth_id) — needed later to call deleteUser() on revoke
                    ↓
Invitee clicks the link → sets a password → account confirmed
                    ↓
Hono creates the `user_profiles` row (role='tutor', school_id from app_metadata)
                    ↓
Hono updates the matching tutor_invites row: status = 'accepted', accepted_at = now()
```

**Revocation:** An Admin may revoke a `pending` invite at any time. Hono checks the invite's `supabase_auth_id` is still unconfirmed, calls `deleteUser()` on that Supabase Auth record, and sets the `tutor_invites` row to `status = 'revoked'`. Revocation must never be attempted once `status = 'accepted'` — at that point a real, active tutor account exists and removing access is a separate (deactivation) concern, not invite revocation.

**Expiry:** A background job (Database_Schema.md, Section 7) periodically flips `pending` invites past their `expires_at` to `status = 'expired'`. This does not delete the underlying Supabase Auth record — an expired invite can be re-issued by the Admin as a fresh invite if needed.

**Duplicate-invite rule:** Before inserting a new `tutor_invites` row, Hono checks for an existing `pending` row for the same `(school_id, email)`. If one exists, the Admin is shown the existing pending invite rather than creating a second one.

---

## 12. Enrolment-Based Access Control for Students

Beyond role and tenant, students can only access content for programmes/courses they are enrolled in. Enrolment is created after successful payment.

Every route serving content to students must verify enrolment before returning data.

A student enrolled in a **Programme** automatically has access to all Courses and Sub-programmes inside it. The enrolment check must account for this — a student enrolled at Programme level passes the access check for any course inside that programme without a separate course-level enrolment record.

---

## 13. Violations — What They Are and How to Fix Them

| Violation | Impact | Fix |
| --- | --- | --- |
| Query without school_id filter on tenant-scoped table | Returns data from all schools | Add `.eq('school_id', ctx.user.school_id)` |
| school_id taken from request body or query params | Client can spoof any school | Always use `ctx.user.school_id` from middleware |
| Resource fetched by ID without tenant verification | Resource may belong to another school | Add school_id filter alongside ID filter |
| Write operation in a public route | Unauthenticated data mutation | Move write to an authenticated route |
| Presigned URL generated without tenant check on file key | Any user can download any school's private files | Extract and compare school_id from file key before generating URL |
| Join without scoping all sides to tenant | Related records from another school can be pulled | Add tenant filters to all sides of the join |
| Student can access content without enrolment check | Unpaid student accesses course content | Add enrolment verification before returning content |

---

## 14. Code Review Checklist

Before approving any pull request that touches data access, the reviewer must verify:

- [ ]  Every query on a tenant-scoped table includes `.eq('school_id', ctx.user.school_id)`
- [ ]  Every resource fetched by ID includes both the ID filter and the school_id filter
- [ ]  No INSERT on a tenant-scoped table uses school_id from the request body or query params
- [ ]  All public routes are read-only — no writes, no deletes
- [ ]  Any route serving content to students includes an enrolment check before returning data
- [ ]  Any presigned URL generation for private files includes a tenant verification step
- [ ]  Any `tutor_invites` write (create, revoke, accept) is scoped by `school_id`, and revoke is only attempted while `status = 'pending'`
- [ ]  No query returns data without a school_id filter unless the table is listed in Section 7

---

*End of Document — Version 1.0*