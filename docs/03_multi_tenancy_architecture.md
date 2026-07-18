# Acada — Multi-Tenancy Architecture Document

**Version:** 1.0  
**Date:** June 2026  
**Prepared by:** Acada Engineering  

---

## 1. Purpose of This Document

Multi-tenancy is a hard requirement for Acada. Every tutorial centre is a
completely isolated tenant. Data from one centre must never be visible to,
queryable by, or accessible to any user of another centre. This document defines
exactly how that isolation is achieved at every layer of the system, what the
rules are, and what every developer must do to maintain it.

---

## 2. Tenancy Model

Acada uses a **shared database, shared schema** multi-tenancy model.

All tutorial centres share:
- A single Supabase PostgreSQL database
- A single database schema
- A single deployed instance of the Hono API

Isolation is achieved by:
- A `centre_id` UUID column on every centre-scoped table
- Mandatory `centre_id` filtering on every query, enforced by Hono middleware
- JWT-embedded centre context that the API trusts — never the request body

This model was chosen over per-tenant databases or per-tenant schemas because:
- It is simpler to manage at MVP scale
- Supabase does not natively support dynamic schema-per-tenant provisioning
  without significant complexity
- The application-layer enforcement approach gives us full control and
  predictable behaviour
- Adding a new tutorial centre requires no infrastructure changes — just
  a new row in the `centres` table

---

## 3. The centre_id — The Foundation of Isolation

Every tutorial centre in Acada has a unique `centre_id` UUID. This is generated
by the database at the time the centre is created and never changes.

The `centre_id` travels through the system as follows:

```
1. Admin creates a centre
2. Database generates centre_id UUID
3. centre_id stored in the centres table
4. Admin's user record linked to centre_id in the users table
5. Admin logs in → Supabase Auth issues a JWT
6. The JWT payload includes: { userId, role: 'admin', centreId }
7. Every API request carries this JWT in the Authorization header
8. Hono middleware extracts and validates the JWT
9. centreId from the JWT is attached to the request context
10. Every subsequent database query uses this centreId as a filter
```

---

## 4. Database Table Classification

Not all tables need `centre_id`. Tables fall into three categories:

### Category A — Global Tables (No centre_id)

These tables exist at the platform level and are not scoped to any centre.

| Table | Why Global |
|---|---|
| `centres` | Defines each tenant — is the tenancy root |
| `subscription_plans` | Acada-level pricing plans, not centre-specific |

Access to these tables from the API is tightly controlled. Only Acada-level
admin operations can write to `centres`. Read access is scoped by the route.

### Category B — Centre-Scoped Tables (Must have centre_id)

Every row in these tables belongs to exactly one centre. `centre_id` is a
non-nullable foreign key referencing `centres.id`.

| Table | Notes |
|---|---|
| `users` | Every user belongs to a centre |
| `programmes` | Programmes belong to a centre |
| `sub_programmes` | Sub-programmes belong to a centre via programme |
| `courses` | Courses belong to a centre |
| `live_classes` | Live classes belong to a centre via course |
| `notes` | Notes belong to a centre via course |
| `assignments` | Assignments belong to a centre via course |
| `submissions` | Submissions belong to a centre via assignment |
| `mocks` | Mocks belong to a centre via course |
| `mock_questions` | Questions belong to a centre via mock |
| `mock_results` | Results belong to a centre via mock |
| `enrolments` | Enrolments belong to a centre |
| `payments` | Payments belong to a centre |
| `attendance_records` | Attendance belongs to a centre |
| `notifications` | Notifications belong to a centre |
| `promos` | Promos belong to a centre |
| `reviews` | Reviews belong to a centre via programme or course |
| `tutors_courses` | Junction table, scoped via course |

### Category C — Derived Scoping (No direct centre_id but implicitly scoped)

These tables do not have a `centre_id` column but are implicitly scoped because
they can only be accessed through a parent that is scoped.

| Table | Scoped Via |
|---|---|
| `mock_questions` | Always accessed via `mock_id`, which belongs to a centre |
| `submission_files` | Always accessed via `submission_id`, which belongs to a centre |

---

## 5. Hono Middleware — The Enforcement Layer

All tenant isolation enforcement happens in Hono middleware. There are two
middleware functions that work together on every protected request:

### 5.1 Auth Middleware

Runs first on every protected route. Validates the JWT and extracts the user
context.

```typescript
// Pseudocode — actual implementation may vary
const authMiddleware = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { data: user, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Attach user context to request
  c.set('userId', user.id);
  c.set('role', user.user_metadata.role);
  c.set('centreId', user.user_metadata.centreId);

  await next();
};
```

### 5.2 Tenant Scope Middleware

Runs after auth middleware on all centre-scoped routes. Ensures every database
query is pre-filtered to the authenticated user's centre.

```typescript
// Pseudocode
const tenantMiddleware = async (c, next) => {
  const centreId = c.get('centreId');
  
  if (!centreId) {
    return c.json({ error: 'No centre context' }, 403);
  }

  // Attach a scoped query helper to the context
  // Every route handler uses this helper — never raw supabase client
  c.set('db', createScopedClient(supabase, centreId));

  await next();
};
```

### 5.3 Resource Ownership Middleware

Used on routes that access a specific resource by ID (e.g. GET `/programmes/:id`).
Verifies that the requested resource belongs to the authenticated user's centre
before processing.

```typescript
// Pseudocode
const ownershipMiddleware = (tableName: string) => async (c, next) => {
  const centreId = c.get('centreId');
  const resourceId = c.req.param('id');

  const { data } = await supabase
    .from(tableName)
    .select('centre_id')
    .eq('id', resourceId)
    .single();

  if (!data || data.centre_id !== centreId) {
    return c.json({ error: 'Not found' }, 404);
    // Return 404, not 403 — do not reveal that the resource exists
  }

  await next();
};
```

**Critical note:** The resource not found response is always 404, not 403. This
prevents a malicious actor from determining whether a resource exists in another
tenant's account.

---

## 6. The Scoped Database Client

Every route handler accesses the database through a scoped client — not the
raw Supabase client. The scoped client is a wrapper that automatically appends
`centre_id` filtering to every query.

**Rule:** Route handlers must never import or use the raw Supabase client
directly. They must always use `c.get('db')` — the scoped client from the
request context.

```typescript
// Scoped client pseudocode
const createScopedClient = (supabase, centreId) => ({
  from: (table) => supabase.from(table).eq('centre_id', centreId),
  // Additional scoped methods as needed
});
```

**What this means in practice:**

```typescript
// WRONG — never do this in a route handler
const { data } = await supabase.from('programmes').select('*');

// RIGHT — always use the scoped client
const db = c.get('db');
const { data } = await db.from('programmes').select('*');
// Equivalent to: supabase.from('programmes').eq('centre_id', centreId).select('*')
```

---

## 7. Public Routes — Tenancy Without Authentication

Public routes (the centre public page, programme page, course page) are accessed
without authentication. Tenancy is established differently here — by the URL slug
rather than a JWT.

**How it works:**

```
1. Request arrives at GET /api/v1/public/centres/:centreSlug
2. No JWT validation (public route)
3. Hono resolves the centreSlug to a centreId via the centres table
4. If no centre found → 404
5. All subsequent queries in this handler are scoped to the resolved centreId
6. Only publicly visible data is returned — no private data, no user data
   beyond public tutor profiles
```

**What public routes can return:**
- Centre profile (name, logo, banner, description, contact, social links)
- List of programmes and standalone courses
- Programme/course details (name, description, price, what's included)
- Tutors assigned to a programme/course (name, subject, bio — no email)
- Reviews for a programme/course
- Promo banners
- Enrolled student count (number only — no student names or details)

**What public routes must never return:**
- Student data of any kind
- Payment records
- Assignment or mock content
- Any data that requires enrolment to access

---

## 8. File Storage Isolation — Cloudflare R2

Files in R2 are organised per-centre to enforce storage isolation:

```
acada/
  {centre_id}/
    notes/
    assignments/
    submissions/
    media/      (banners, logos, promos, video intros)
    avatars/
```

**Access control on files:**

- Private files (notes, submissions) are served via **signed URLs** generated
  by the Hono API. The API only generates a signed URL if the requesting user
  is enrolled in the course that the file belongs to, or is a tutor/admin of
  the centre that owns the file.
- Public files (banners, logos, promos) are served via permanent public URLs.
  These contain no sensitive information.

**The Hono API validates file ownership before generating signed URLs:**

```
1. Student requests access to a note file
2. API checks: does this file's course belong to a centre the student is enrolled in?
3. If yes → generate signed URL → return to student
4. If no → 404
```

---

## 9. Multi-Tenancy Audit Checklist

Before any route handler is merged to the codebase, it must pass this checklist:

- [ ] Does this route access centre-scoped data?
  - If yes → is it using `c.get('db')` (the scoped client)?
  - If no → document why it is exempt
- [ ] Does this route accept a resource ID in the URL?
  - If yes → is the ownership middleware applied to verify the resource belongs
    to the authenticated centre?
- [ ] Does this route return data?
  - Verify no adjacent centre data could leak through JOINs
  - Verify the response payload contains no data from other centres
- [ ] Is this a public route?
  - Verify it only returns publicly safe fields
  - Verify it resolves tenancy via slug, not user-supplied centreId
- [ ] Does this route write data?
  - Verify the `centre_id` written to the database comes from the JWT context,
    not from the request body

---

## 10. Adding a New Tutorial Centre

When a new tutorial centre signs up, the following happens in order:

```
1. Admin completes registration form
2. Hono API creates a Supabase Auth user for the admin
3. Hono API creates a row in the centres table → database generates centre_id
4. Hono API creates a row in the users table linked to the centre_id
5. Hono API creates a Paystack subaccount for the centre (if payment configured)
6. Hono API sets the JWT custom claims: { role: 'admin', centreId: <new_centre_id> }
7. Centre is live — fully isolated from all other centres from the moment of creation
```

No infrastructure changes are required. No new database, schema, or deployment.
The new centre exists as rows in the shared database, isolated by their unique
`centre_id`.

---

*End of Document 03 — Multi-Tenancy Architecture Document*
