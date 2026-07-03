## **Kanvise — Multi-Tenancy Architecture** 

## **Version:** 1.0 

**Prepared by:** Architecture Team 

**Date:** June 2026 

**Status:** Approved — Zero Tolerance for Violations 

## **Purpose** 

This document de�nes exactly how multi-tenancy is implemented across every layer of the Kanvise platform. Multi-tenancy is the single most critical architectural requirement in the system. A failure here — where data from one tutorial centre becomes visible to another — is not a bug. It is a fundamental breach of trust that would make the platform unusable. 

Every developer must read this document in full. Every pull request that touches database queries, API routes, or storage operations will be reviewed against the rules de�ned here. Any code that violates these rules must be rejected regardless of how small or harmless the violation appears. 

## **1. The Multi-Tenancy Model** 

## Kanvise uses a **shared database, shared schema, row-level tenant isolation** model. 

There is one Supabase PostgreSQL database. All tutorial centres share this single database and the same set of tables. Tenant isolation is enforced by a `school_id` column present on every tenantscoped table. Every query that reads or writes tenant-scoped data must include a `school_id` �lter. 

This model was chosen over separate databases per tenant and separate schemas per tenant for the following reasons: 

Separate databases per tenant would require a different Supabase project per tutorial centre, making cross-platform queries impossible and dramatically increasing infrastructure management overhead at MVP scale. 

Separate schemas per tenant would require dynamic schema creation per centre, complex migration management across hundreds of schemas, and connection pool management that Supabase's standard con�guration does not support cleanly. 

The shared schema model is the standard approach for SaaS at Kanvise's scale. The risk — cross-tenant data leakage — is mitigated entirely by the middleware and query patterns de�ned in this document. The risk of getting those wrong is lower than the operational risk of managing per-tenant infrastructure at MVP. 

## **2. What a Tenant Is** 

In Kanvise, a **tenant is a tutorial centre** . Every tutorial centre that signs up and creates a school on Kanvise is a tenant. The tenant's identi�er is the `school_id` — a UUID generated when the Admin creates their school. 

Every user (Admin, Tutor, Student) belongs to exactly one school. Their `school_id` is stored in their user pro�le record and embedded in their JWT as a custom claim at login time. 

A user can never belong to more than one school. If a person runs two tutorial centres, they must create two separate Kanvise accounts — one per school. 

The one exception to single-school membership is the Kanvise platform team (post-MVP internal admin tooling) — platform users can query across all schools for support and billing purposes. This is not implemented in MVP and is explicitly out of scope. 

## **3. Tenant Resolution — How school_id Gets Into Every** 

## **Request** 

Tenant resolution is the process of identifying which school a request belongs to. It happens in Hono middleware before any route handler runs. 

```
Incoming request with JWT in Authorization header
                    │
                    ▼
        ┌───────────────────────┐
        │   JWT Verification    │
        │                       │
        │  Verify signature     │
        │  Check expiry         │
        │  Extract sub (user ID)│
        └───────────┬───────────┘
                    │
                    ▼
```

```
        ┌───────────────────────┐
        │   Profile Resolution  │
        │                       │
        │  Look up user profile │
        │  from database using  │
        │  Supabase Auth user ID│
        │                       │
        │  Returns:             │
        │  - kanvise_user_id    │
        │  - role               │
        │  - school_id          │
        │  - display_name       │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Context Attachment  │
        │                       │
        │  ctx.user = {         │
        │    id,                │
        │    role,              │
        │    school_id,         │
        │    display_name       │
        │  }                    │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │   Role Authorisation  │
        │                       │
        │  Check route is       │
        │  accessible by this   │
        │  role                 │
        └───────────┬───────────┘
                    │
                    ▼
             Route Handler
        (ctx.user.school_id is
         available and trusted)
```

The `ctx.user.school_id` attached by middleware is the authoritative school identi�er for the entire request. Route handlers must never accept a `school_id` from the request body or query 

parameters as the source of tenant identity. The school_id always comes from `ctx.user.school_id` — never from what the client sends. 

This is one of the most important rules in the system. If a client could pass their own school_id in a request body and have the server use it, a malicious user could craft requests that read another school's data. The middleware-derived school_id closes this attack vector entirely. 

## **4. The Middleware Stack** 

Every authenticated Hono route runs through this exact middleware stack in this exact order. No exceptions. 

```
// Middleware execution order — do not reorder
```

```
app.use('*', jwtVerificationMiddleware)      // 1. Verify JWT signature a
app.use('*', profileResolutionMiddleware)    // 2. Load user profile, att
app.use('*', tenantMiddleware)              // 3. Confirm school_id is pr
app.use('*', roleMiddleware)               // 4. Check role against route
app.use('*', rateLimitMiddleware)          // 5. Rate limit per user
// Route handler runs here
```

## **jwtVeri�cationMiddleware** 

Reads the Authorization header, extracts the Bearer token, veri�es the JWT signature using the Supabase JWT secret. If veri�cation fails for any reason — invalid signature, expired token, malformed token — the middleware returns a 401 immediately. The request does not proceed. 

## **pro�leResolutionMiddleware** 

Uses the veri�ed JWT's `sub` claim (Supabase Auth user ID) to query the `user_profiles` table for the user's Kanvise pro�le. If no pro�le is found — which should never happen for a valid user but could indicate a partially created account — the middleware returns a 403. The resolved pro�le is attached to `ctx.user` . 

## **tenantMiddleware** 

Con�rms that `ctx.user.school_id` is present and is a valid UUID. If it is missing or invalid, the middleware returns a 403. This middleware exists as a safety net — pro�leResolutionMiddleware should 

always populate school_id, but this check ensures no request ever reaches a route handler without a con�rmed tenant. 

## **roleMiddleware** 

Each protected route declares the roles that may access it. The role middleware compares 

`ctx.user.role` against the route's declared roles. If the user's role is not in the allowed set, the middleware returns a 403. Route-level role declarations are de�ned alongside the route handler, not in a separate con�guration �le, so the permission is always visible next to the code it protects. 

## **5. Database Query Rules** 

These rules apply to every database query in the Hono codebase. They are mandatory and nonnegotiable. 

## **Rule 1 — Always �lter by school_id on tenant-scoped tables** 

Every SELECT, INSERT, UPDATE, and DELETE on a tenant-scoped table must include the school_id from `ctx.user.school_id` . 

```
// CORRECT
const { data } =await supabase
  .from('programmes')
'*'
  .select()
  .eq('school_id', ctx.user.school_id)
```

```
// WRONG — no tenant filter, returns all programmes from all schools
const { data } =await supabase
```

```
  .from('programmes')
'*'
  .select()
```

## **Rule 2 — Never use client-supplied IDs without tenant veri�cation** 

When a client requests a speci�c resource by ID (e.g. GET /programmes/:id), the query must include both the resource ID and the school_id. This prevents a user from accessing a resource that belongs to another school by guessing its ID. 

```
// CORRECT — verifies the programme belongs to this school
const { data } =await supabase
```

```
  .from('programmes')
```

```
'*'
  .select()
  .eq('id', programmeId)
  .eq('school_id', ctx.user.school_id)
  .single()
```

```
// WRONG — fetches programme by ID alone, could belong to any school
const { data } =await supabase
  .from('programmes')
'*'
  .select()
  .eq('id', programmeId)
  .single()
```

## **Rule 3 — Always include school_id on INSERT** 

When creating any record in a tenant-scoped table, the school_id must always be set from `ctx.user.school_id` , never from the request body. 

```
// CORRECT
await supabase
  .from('programmes')
  .insert({
name: body.name,
description: body.description,
school_id: ctx.user.school_id  // always from middleware context
  })
// WRONG — school_id taken from request body, can be spoofed
await supabase
  .from('programmes')
  .insert({
name: body.name,
description: body.description,
school_id: body.school_id  // NEVER do this
  })
```

## **Rule 4 — Joins must respect tenant boundaries** 

When joining tables, ensure the join condition includes the school_id where relevant. Do not join across tenant boundaries. 

```
// CORRECT — both tables filtered to the same school
const { data } =await supabase
  .from('courses')
  .select(`
    *,
    programmes!inner(name, school_id)
  `)
  .eq('school_id', ctx.user.school_id)
  .eq('programmes.school_id', ctx.user.school_id)
// WRONG — courses filtered but programme join could pull from another sc
const { data } =await supabase
  .from('courses')
  .select(`*, programmes(name)`)
  .eq('school_id', ctx.user.school_id)
```

## **Rule 5 — Aggregations must be scoped** 

Any query that counts, sums, or aggregates data must be scoped to the tenant. 

```
// CORRECT — counts only students in this school
const { count } =await supabase
  .from('enrolments')
'*'
  .select(, { count:'exact', head:true })
  .eq('school_id', ctx.user.school_id)
// WRONG — counts all enrolments across all schools
const { count } =await supabase
  .from('enrolments')
'*'
  .select(, { count:'exact', head:true })
```

## **6. Tenant-Scoped Tables** 

The following tables contain school data and every query must include a `school_id` �lter. 

|**Table**|**school_id Column**|**Notes**|
|---|---|---|
|schools|id (schools IS the tenant<br>table)|Primary tenant anchor|
|user_pro�les|school_id|Every user belongs to one school|



|**Table**|**school_id Column**|**Notes**|
|---|---|---|
|programmes|school_id||
|sub_programmes|school_id|Derived from programme but independently<br>scoped|
|courses|school_id||
|enrolments|school_id|Student→programme/course access<br>records|
|live_classes|school_id||
|attendance_records|school_id||
|notes|school_id||
|assignments|school_id||
|submissions|school_id||
|mock_exams|school_id||
|mock_questions|school_id||
|mock_answers|school_id|Student answers — never returned before<br>submission|
|mock_results|school_id||
|payments|school_id|Student payment records|
|noti�cations|school_id||
|promos|school_id||
|reviews|school_id||
|tutor_course_assignments|school_id|Which tutors teach which courses|



## **7. Platform-Level Tables (Not Tenant-Scoped)** 

The following tables are not scoped to a school. They store platform-level data that belongs to Kanvise itself, not to a tutorial centre. 

|**Table**|**Purpose**|
|---|---|
|kanvise_subscriptions|Monthly subscription billing records for tutorial centres|
|paystack_subaccounts|Paystack subaccount IDs per school — linked to school by school_id but<br>managed at platform level|



Note: `paystack_subaccounts` does reference a `school_id` as a foreign key but it is managed by 

platform-level processes, not by school-scoped route handlers. 

## **8. The Public Layer and Tenancy** 

The public pages (centre page, programme page, course page) are accessed without authentication. There is no JWT and therefore no middleware-derived school_id. Tenancy in the public layer is resolved differently: 

The school is identi�ed by its slug in the URL — `kanvise.ng/[centre-slug]` . The Hono public API resolves the school from the slug: 

```
// Public route — no auth middleware
app.get('/public/schools/:slug', async (ctx) => {
const slug = ctx.req.param('slug')
```

```
// Resolve school from slug — slug is a public identifier
const { data: school } =await supabase
```

```
    .from('schools')
```

```
    .select('id, name, description, logo_url, banner_url, ...')
```

```
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
```

```
if (!school) return ctx.json({ error:'Not found' }, 404)
```

```
// All subsequent queries in this handler use school.id as the tenant
const { data: programmes } =await supabase
```

```
    .from('programmes')
'*'
    .select()
    .eq('school_id', school.id)
    .eq('is_published', true)
```

```
// ... rest of handler
})
```

The critical rule for public routes: the school_id used for all queries within a public route handler must always come from the database lookup by slug — never from query parameters or request body. The slug is a read-only public identi�er. It cannot be used to modify data. 

Public routes are read-only without exception. No public route may perform a write operation. Any attempt to write data through a public route is a security violation. 

## **9. Storage Isolation** 

Tenant isolation in Cloud�are R2 is enforced through the folder structure. Every �le belonging to a school is stored under a path that begins with `schools/{school_id}/` . This means: 

A student from School A whose `school_id` is `abc123` cannot construct a URL to a �le from School B whose `school_id` is `xyz789` because the path `schools/xyz789/notes/somefile.pdf` is not derivable from anything School A's users can see. 

For private �les (submissions, assignment attachments), presigned URLs are the only access mechanism. The Hono route that generates a presigned GET URL veri�es that the requesting user's `school_id` matches the `school_id` in the �le's storage key before generating the URL. If they do not match, the request is rejected with a 403. 

```
// CORRECT presigned URL generation with tenant check
app.get('/files/:fileKey/download', authMiddleware, async (ctx) => {
const fileKey = ctx.req.param('fileKey')
```

```
// Extract school_id from the file key
const keyParts = fileKey.split('/')
const fileSchoolId = keyParts[1] // schools/{school_id}/...
// Verify it matches the requesting user's school
if (fileSchoolId !== ctx.user.school_id) {
return ctx.json({ error:'Forbidden' }, 403)
  }
// Generate presigned URL only after tenant verification
const presignedUrl =awaitgeneratePresignedGetUrl(fileKey)
return ctx.json({ url: presignedUrl })
})
```

## **10. Role Boundaries Within a Tenant** 

Tenancy de�nes which school a user belongs to. Within a school, roles de�ne what a user can do. These two concepts layer on top of each other. 

```
School A (Tenant)
│
```

```
├── Admin — can read and write everything within School A
│
├── Tutor — can read school-level data, write only to entities they are
assigned to
```

```
│   └── Can only upload notes to courses they teach
│   └── Can only create assignments in courses they teach
│   └── Can only view submissions for their own assignments
│   └── Can only create mocks in courses they teach
│   └── Can only view attendance for their own live classes
│
└── Student — can read only what they are enrolled in, write only their
own work
    └── Can only see notes for courses they are enrolled in
    └── Can only see assignments for courses they are enrolled in
    └── Can only view their own submissions and results
    └── Can only access live classes for courses they are enrolled in
```

Role enforcement happens in route handlers after the tenant middleware has con�rmed the school_id. The tenant middleware ensures the user is in the right school. The role check ensures they have the right permissions within that school. 

For Tutor-level restrictions (e.g. a tutor can only upload notes to courses they teach), the route handler must verify the tutor is assigned to the relevant course before processing the request: 

```
// Example — tutor uploads a note to a course
app.post('/courses/:courseId/notes', authMiddleware, requireRole('tutor')
const courseId = ctx.req.param('courseId')
```

```
// Verify tutor is assigned to this course within this school
const { data: assignment } =await supabase
    .from('tutor_course_assignments')
    .select('id')
    .eq('tutor_id', ctx.user.id)
    .eq('course_id', courseId)
    .eq('school_id', ctx.user.school_id)
    .single()
if (!assignment) {
return ctx.json({ error:'You are not assigned to this course' }, 403
  }
```

```
// Proceed with note upload
```

```
})
```

## **11. Enrolment-Based Access Control for Students** 

Students have an additional access layer beyond role and tenant. A student can only access content for programmes and courses they are enrolled in. Enrolment is created when a student successfully pays for a programme or course. 

Every route that serves content to students must verify enrolment before returning data. 

```
// Example — student accesses notes for a course
app.get('/courses/:courseId/notes', authMiddleware, requireRole('student'
const courseId = ctx.req.param('courseId')
```

```
// Verify student is enrolled in this course (directly or via a program
const { data: enrolment } =await supabase
    .from('enrolments')
    .select('id')
    .eq('student_id', ctx.user.id)
    .eq('school_id', ctx.user.school_id)
    .or(`course_id.eq.${courseId},programme_id.in.(
      select programme_id from courses where id = '${courseId}'
    )`)
    .single()
if (!enrolment) {
return ctx.json({ error:'You are not enrolled in this course' }, 403
  }
// Return notes
const { data: notes } =await supabase
    .from('notes')
'*'
    .select()
    .eq('course_id', courseId)
    .eq('school_id', ctx.user.school_id)
return ctx.json({ notes })
})
```

A student enrolled in a Programme automatically has access to all Courses and Sub-programmes within 

that Programme. The enrolment check must account for this — a student enrolled at the Programme 

level should pass the access check for any course inside that programme without requiring a separate course-level enrolment record. 

## **12. Violations and What to Do** 

The following are all violations of the multi-tenancy architecture. If any of these are found in the codebase, they must be treated as critical bugs and �xed before the code is merged. 

## **Violation 1 — Query without school_id �lter on a tenant-scoped table.** 

The query will return data from all schools. Reject the pull request. Fix the query. 

## **Violation 2 — school_id taken from request body or query parameters.** 

The client can send any school_id. Fix by always using `ctx.user.school_id` from middleware. 

## **Violation 3 — Resource fetched by ID without tenant veri�cation.** 

The resource may belong to another school. Fix by adding `.eq('school_id',` 

`ctx.user.school_id)` to the query alongside the ID �lter. 

## **Violation 4 — Write operation in a public route.** 

Public routes are read-only. Move the write to an authenticated route. 

## **Violation 5 — Presigned URL generated without verifying the �le's school_id matches the requester's** 

## **school_id.** 

A user from any school could download another school's private �les. Fix by extracting and comparing school_id from the �le key before generating the URL. 

## **Violation 6 — Joining tables without scoping the join to the tenant.** 

A join could pull in related records from another school. Fix by adding tenant �lters to all sides of the join. 

## **Violation 7 — Student can access content without an enrolment check.** 

A student who has not paid could access a school's content. Fix by adding the enrolment veri�cation 

before returning any course content. 

## **13. Code Review Checklist for Multi-Tenancy** 

Before approving any pull request that touches data access, the reviewer must verify: 

Every query on a tenant-scoped table includes `.eq('school_id', ctx.user.school_id)` . 

Every resource fetched by ID includes both the ID �lter and the school_id �lter. 

No INSERT on a tenant-scoped table uses a school_id from the request body or query parameters. 

All public routes are read-only — no writes, no deletes. 

Any route serving content to students includes an enrolment check before returning data. 

Any presigned URL generation for private �les includes a tenant veri�cation step. 

No query returns data without a school_id �lter unless the table is explicitly listed in Section 7 (platform-level tables). 

_End of Document — Version 1.0_ 

