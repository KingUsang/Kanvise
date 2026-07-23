# Kanvise — Authentication & Authorisation Specification
**Version:** 1.0  
**Prepared by:** Architecture Team  
**Date:** June 2026  
**Status:** Approved — Security Critical Document

---

## Purpose

This document defines exactly how authentication and authorisation work across the entire Kanvise platform. It covers every auth flow, the full JWT structure, how sessions are managed on the frontend, how the Hono backend verifies and enforces identity and permissions, and what happens in every failure scenario.

This document must be read alongside Document 03 (Multi-Tenancy Architecture) and Document 05 (API Specification). The three together define the full security model of the platform.

---

## 1. Authentication Stack

Kanvise uses **Supabase Auth** for credential management and JWT issuance. Supabase Auth handles:

- Email and password registration
- Email verification on signup
- Password reset via OTP email
- JWT generation and signing
- Token refresh

The Hono backend does **not** manage credentials. It never sees passwords. It only verifies JWTs that Supabase has already issued.

The Next.js frontend communicates with Supabase Auth using the **Supabase JS client with the anon key**. This is the only operation the anon key is used for. All data operations go through Hono.

---

## 2. The Three User Registration Flows

There are three distinct registration flows in Kanvise. Each results in a different user role and a different school linkage path.

### 2.1 Admin Registration Flow

```
1. Admin visits kanvise.com/auth/register
2. Selects role: Admin
3. Fills in: first name, last name, email, password
4. Supabase Auth creates the user record and sends a verification email
5. Admin clicks the verification link in email
6. Supabase Auth callback fires at kanvise.com/api/auth/callback
7. Next.js callback handler calls Hono: POST /auth/profile/init
   with: { role: "admin", supabase_auth_id, first_name, last_name, email }
8. Hono creates user_profiles record:
   - kanvise_user_id generated: KNV-ADM-XXXXX
   - role = admin
   - school_id = NULL (no school yet)
9. Admin is redirected to `/dashboard/school-setup` to create their school
10. After school creation, school_id is set on the user_profiles record
```

The Admin's `school_id` is null until they complete the school creation step. All Hono requests from an Admin with no school_id are rejected with `403 SCHOOL_NOT_CONFIGURED` except for the `POST /schools` endpoint itself.

### 2.2 Tutor Registration Flow

```
1. Admin generates an invite link from their dashboard
   - Hono creates a signed invite token (HMAC-SHA256, expires in 7 days)
   - Invite URL: kanvise.com/join?token=xxxx
2. Admin shares the link anywhere (WhatsApp, email, social media)
3. Tutor clicks the link
4. Next.js reads the token from the URL and stores it in sessionStorage
5. Tutor is shown the registration form: first name, last name, email, password
6. Supabase Auth creates the user record and sends a verification email
7. Tutor clicks the verification link — Supabase callback fires
8. Next.js callback handler reads the invite token from sessionStorage
9. Calls Hono: POST /auth/profile/init
   with: { role: "tutor", supabase_auth_id, first_name, last_name, email, invite_token: "xxxx" }
10. Hono validates the invite token:
    - Checks signature is valid
    - Checks token has not expired
    - Extracts school_id from token payload
11. Hono creates user_profiles record:
    - kanvise_user_id generated: KNV-TUT-XXXXX
    - role = tutor
    - school_id = extracted from token
12. Tutor is redirected to /dashboard
```

The invite token payload contains:
```json
{
  "school_id": "uuid",
  "created_by": "admin_user_id",
  "issued_at": 1234567890,
  "expires_at": 1234567890
}
```

### 2.3 Student Registration Flow

```
1. Student clicks a shared programme or course link:
   kanvise.com/brightminds/waec-bootcamp
2. Student sees the public programme page
3. Student clicks Enrol / Pay
4. If not logged in — redirected to kanvise.com/auth/register
   with the programme URL stored in a redirect param
5. Student fills in: first name, last name, email, password
   (Role is automatically set to "student" — not selectable on this flow)
6. Supabase Auth creates the user and sends a verification email
7. Student clicks the verification link — Supabase callback fires
8. Next.js callback reads the redirect param (the programme URL)
9. Calls Hono: POST /auth/profile/init
   with: { role: "student", supabase_auth_id, first_name, last_name, email }
10. Hono creates user_profiles record:
    - kanvise_user_id: KNV-STU-XXXXX
    - role = student
    - school_id = NULL initially
11. Student is redirected back to the programme page to complete payment
12. On successful payment, enrolment is created and school_id is set on the student's profile
```

A student's `school_id` is set at the point of first enrolment — when they pay for a programme or course, Hono updates their profile with the school_id of the tutorial centre they just enrolled in.

**Important:** A student can only ever belong to one school. If a student tries to enrol in a programme from a different school than the one already on their profile, the request is rejected with `403 CROSS_SCHOOL_ENROLMENT_NOT_SUPPORTED`. Post-MVP, multi-school student support may be introduced.

---

## 3. Login Flow

```
1. User visits kanvise.com/auth/login
2. Enters email and password
3. Next.js calls Supabase Auth JS client: signInWithPassword()
4. Supabase Auth validates credentials
5. On success: returns a session object containing:
   - access_token (JWT, 1 hour expiry)
   - refresh_token (long-lived, used to get new access tokens)
   - user object (Supabase Auth user data)
6. Next.js stores the session in an httpOnly cookie via Supabase's cookie helper
7. Next.js reads the user's role from their Kanvise profile (via GET /auth/me on Hono)
8. User is redirected to the correct dashboard based on their role:
   - admin  → /dashboard
   - tutor  → /dashboard
   - student → /dashboard/student
```

The role redirect check happens on the Next.js middleware level on every page load — it reads the role from the JWT and enforces the correct dashboard route.

---

## 4. JWT Structure

Supabase Auth issues JWTs signed with the project's JWT secret. The Hono backend verifies these JWTs using the same secret.

**JWT Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**JWT Payload (standard Supabase claims + custom Kanvise claims):**
```json
{
  "iss": "https://[project-ref].supabase.co/auth/v1",
  "sub": "supabase-auth-user-uuid",
  "aud": "authenticated",
  "exp": 1234567890,
  "iat": 1234567890,
  "email": "user@example.com",
  "role": "authenticated",
  "app_metadata": {
    "provider": "email",
    "role": "admin | tutor | student",
    "kanvise_role": "admin | tutor | student",
    "school_id": "uuid | null",
    "kanvise_user_id": "KNV-ADM-00001",
    "profile_id": "uuid"
  },
  "user_metadata": {
    "first_name": "Ada",
    "last_name": "Okafor"
  }
}
```

**Authorisation claims stored in `app_metadata`:**

- `role` / `kanvise_role` — the user's role on Kanvise. Both names are emitted during the compatibility period; `role` also matches the RLS policies.
- `school_id` — the user's school UUID.
- `kanvise_user_id` — the human-readable user ID.
- `profile_id` — the canonical `user_profiles.id` used by API relationships.

Supabase users can edit their own `user_metadata`, so it must never be used to decide a role, tenant, or profile identity. Editable presentation fields such as `first_name` and `last_name` remain in `user_metadata`. The server writes access-control claims to `app_metadata` with the Admin API; signed-in users cannot change that field.

**When app_metadata is populated:**

Hono updates the Supabase Auth user's `app_metadata` immediately after creating the `user_profiles` record in `POST /auth/profile/init`. The next JWT issued after token refresh contains the custom claims. The profile resolution middleware falls back to a database lookup when trusted claims are missing, including existing sessions created before this migration. After a successful canonical lookup, it opportunistically backfills `app_metadata`; the request still succeeds if that backfill is temporarily unavailable.

---

## 5. Token Lifecycle & Refresh Strategy

**Access token expiry:** 1 hour (Supabase default). This is kept short to limit the window of a stolen token.

**Refresh token expiry:** 60 days (Supabase default). Stored in the httpOnly cookie. Used to silently get a new access token.

**Refresh flow on the frontend:**

Supabase Auth JS client handles refresh automatically. When the client detects the access token is within 60 seconds of expiry, it calls Supabase Auth to exchange the refresh token for a new access token. This happens in the background without any action from the user.

Next.js middleware intercepts every server-side request and checks if the token needs to be refreshed using Supabase's `getSession()` helper. If a refresh happens server-side, the updated cookie is set before the response is returned.

**What happens when the refresh token expires:**

The user is logged out automatically. The next request to Hono receives a 401. Next.js middleware catches this on the next page navigation and redirects to `/auth/login` with a `reason=session_expired` query param. The login page reads this param and shows an appropriate message.

**Token revocation:**

Kanvise does not maintain a token blocklist for MVP. Tokens are valid until they expire. If a user needs to be immediately invalidated (e.g. Admin removes a tutor), the practical security window is up to 1 hour until the current access token expires. Post-MVP, a token blocklist backed by Redis can be introduced.

---

## 6. Session Management on the Frontend

Sessions are stored in **httpOnly cookies** set by the Next.js server. This means:

- The access token and refresh token are never accessible to JavaScript running in the browser
- XSS attacks cannot steal the session tokens
- All requests from the browser to the Next.js server automatically include the cookie

**Cookie configuration:**
```
Name: sb-[project-ref]-auth-token
HttpOnly: true
Secure: true (production only)
SameSite: Lax
Path: /
```

**Server-side session access:**

Next.js Server Components and route handlers access the session using the Supabase SSR helper:
```javascript
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { cookies }
)
const { data: { session } } = await supabase.auth.getSession()
```

**Client-side session access:**

Client Components use the Supabase browser client to access the session. The client never reads the httpOnly cookie directly — Supabase's client library handles session state in memory after the initial hydration.

---

## 7. Next.js Middleware — Route Protection

Next.js middleware runs on every request before any page or route handler. It enforces authentication and role-based routing at the edge.

```
Request arrives at Vercel edge
         │
         ▼
Is the path public? (/, /[centre-slug]/*, /auth/*)
    YES → Allow through, no check needed
    NO  ↓
         ▼
Read session from cookie
         │
No session found → Redirect to /auth/login?redirect=[original-path]
         │
Session found ↓
         ▼
Extract kanvise_role from app_metadata (legacy user_metadata fallback for redirects only)
         │
         ▼
Does the role match the route?
/dashboard/** → requires kanvise_role in [admin, tutor] (with internal component-level authorisation)
/dashboard/student/** → requires kanvise_role = student
         │
Role mismatch → Redirect to correct dashboard for their role
Role matches ↓
         ▼
Allow request through to page
```

The middleware is a UX enforcement layer. The actual security enforcement happens on the Hono backend — the middleware prevents a student from even seeing an admin page, but even if they bypassed the middleware, every Hono API call would reject them with 403.

---

## 8. Hono Middleware Stack — Detailed Implementation

Every authenticated Hono route runs through five middleware layers in order. Here is the detailed behaviour of each.

### Layer 1 — JWT Verification Middleware

```javascript
const jwtVerificationMiddleware = async (ctx, next) => {
  const authHeader = ctx.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ctx.json({ error: 'Missing authorisation header', code: 'MISSING_TOKEN' }, 401)
  }

  const token = authHeader.split(' ')[1]

  try {
    // Verify using Supabase JWT secret
    const payload = await verifyJWT(token, process.env.SUPABASE_JWT_SECRET)
    ctx.set('jwt_payload', payload)
    await next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return ctx.json({ error: 'Token has expired', code: 'TOKEN_EXPIRED' }, 401)
    }
    return ctx.json({ error: 'Invalid token', code: 'INVALID_TOKEN' }, 401)
  }
}
```

**What it rejects:**
- Missing Authorization header → 401
- Malformed Bearer token → 401
- Invalid JWT signature → 401
- Expired JWT → 401 with `TOKEN_EXPIRED` code (frontend uses this code to trigger a refresh)

### Layer 2 — Profile Resolution Middleware

```javascript
const profileResolutionMiddleware = async (ctx, next) => {
  const jwtPayload = ctx.get('jwt_payload')
  const supabaseAuthId = jwtPayload.sub

  // Check trusted app_metadata first (fast path — no DB call)
  const { kanvise_role, role, school_id, kanvise_user_id, profile_id } = jwtPayload.app_metadata || {}
  const resolvedRole = kanvise_role || role

  if (resolvedRole && kanvise_user_id && profile_id) {
    // Fast path — metadata is populated
    ctx.set('user', {
      supabase_auth_id: supabaseAuthId,
      id: profile_id,
      role: resolvedRole,
      school_id: school_id,
      kanvise_user_id: kanvise_user_id
    })
    return await next()
  }

  // Slow path — metadata not yet populated, look up from DB
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, role, school_id, kanvise_user_id, first_name, last_name')
    .eq('supabase_auth_id', supabaseAuthId)
    .single()

  if (!profile) {
    return ctx.json({ error: 'User profile not found', code: 'PROFILE_NOT_FOUND' }, 403)
  }

  ctx.set('user', {
    id: profile.id,
    supabase_auth_id: supabaseAuthId,
    role: profile.role,
    school_id: profile.school_id,
    kanvise_user_id: profile.kanvise_user_id
  })

  await next()
}
```

### Layer 3 — Tenant Middleware

```javascript
const tenantMiddleware = async (ctx, next) => {
  const user = ctx.get('user')

  // Admins who have not set up their school yet are allowed through
  // only to POST /schools and GET /auth/me
  const allowedWithoutSchool = [
    'POST /schools',
    'GET /auth/me',
    'PATCH /auth/me'
  ]

  const currentRoute = `${ctx.req.method} ${ctx.req.path}`

  if (!user.school_id && !allowedWithoutSchool.includes(currentRoute)) {
    return ctx.json({
      error: 'School not configured. Complete school setup first.',
      code: 'SCHOOL_NOT_CONFIGURED'
    }, 403)
  }

  await next()
}
```

### Layer 4 — Role Middleware

Routes declare their allowed roles using a helper:

```javascript
const requireRole = (...roles) => async (ctx, next) => {
  const user = ctx.get('user')

  if (!roles.includes(user.role)) {
    return ctx.json({
      error: `This action requires one of: ${roles.join(', ')}`,
      code: 'INSUFFICIENT_ROLE'
    }, 403)
  }

  await next()
}

// Usage on a route:
app.post('/courses', requireRole('admin'), async (ctx) => { ... })
app.post('/courses/:id/notes', requireRole('tutor'), async (ctx) => { ... })
app.get('/courses/:id/notes', requireRole('tutor', 'student'), async (ctx) => { ... })
```

### Layer 5 — Rate Limit Middleware

Rate limiting is applied per authenticated user ID. Limits for MVP:

| Endpoint Category | Limit |
|---|---|
| Auth endpoints (login, register) | 10 requests per minute per IP |
| General API endpoints | 120 requests per minute per user |
| File presign endpoints | 20 requests per minute per user |
| Payment initiation | 5 requests per minute per user |
| Webhook endpoints | No limit (internal or signature-verified) |

Rate limit responses return `429 Too Many Requests` with a `Retry-After` header.

---

## 9. Role-Based Access Control Matrix

The following table defines which roles can perform which actions. This is the authoritative reference. Route implementations must match this matrix exactly.

| Resource | Action | Admin | Tutor | Student |
|---|---|---|---|---|
| **School** | Create | ✓ | ✗ | ✗ |
| **School** | Read own | ✓ | ✓ (limited) | ✓ (public only) |
| **School** | Update | ✓ | ✗ | ✗ |
| **Users** | List all in school | ✓ | ✗ | ✗ |
| **Users** | View own profile | ✓ | ✓ | ✓ |
| **Users** | Update own profile | ✓ | ✓ | ✓ |
| **Users** | Remove from school | ✓ | ✗ | ✗ |
| **Tutors** | Invite | ✓ | ✗ | ✗ |
| **Tutors** | Assign to course | ✓ | ✗ | ✗ |
| **Programmes** | Create/Update/Delete | ✓ | ✗ | ✗ |
| **Programmes** | Publish/Unpublish | ✓ | ✗ | ✗ |
| **Programmes** | Read (dashboard) | ✓ | ✓ | ✗ |
| **Programmes** | Read (public) | ✓ | ✓ | ✓ |
| **Sub-Programmes** | Create/Update/Delete | ✓ | ✗ | ✗ |
| **Courses** | Create/Update/Delete | ✓ | ✗ | ✗ |
| **Courses** | Read (dashboard) | ✓ | ✓ (assigned only) | ✓ (enrolled only) |
| **Live Classes** | Schedule | ✓ | ✓ (assigned courses) | ✗ |
| **Live Classes** | Start/End | ✗ | ✓ (own classes) | ✗ |
| **Live Classes** | Join | ✗ | ✓ | ✓ (enrolled) |
| **Live Classes** | Cancel | ✓ | ✗ | ✗ |
| **Attendance** | View (all students) | ✓ | ✓ (own classes) | ✗ |
| **Attendance** | View (own) | ✗ | ✗ | ✓ |
| **Notes** | Upload | ✗ | ✓ (assigned courses) | ✗ |
| **Notes** | Delete | ✓ | ✓ (own notes) | ✗ |
| **Notes** | Read | ✗ | ✓ | ✓ (enrolled) |
| **Assignments** | Create/Update | ✗ | ✓ (assigned courses) | ✗ |
| **Assignments** | Delete | ✓ | ✓ (own, no submissions) | ✗ |
| **Assignments** | Read | ✗ | ✓ | ✓ (enrolled) |
| **Submissions** | Submit | ✗ | ✗ | ✓ (enrolled) |
| **Submissions** | Read all | ✗ | ✓ (own assignments) | ✗ |
| **Submissions** | Read own | ✗ | ✗ | ✓ |
| **Submissions** | Grade | ✗ | ✓ (own assignments) | ✗ |
| **Mocks** | Create/Update | ✗ | ✓ (assigned courses) | ✗ |
| **Mocks** | Publish | ✗ | ✓ (own mocks) | ✗ |
| **Mocks** | Delete/Archive | ✓ | ✓ (own, no attempts) | ✗ |
| **Mocks** | Read (with answers) | ✗ | ✓ | ✗ |
| **Mock Attempts** | Start/Submit | ✗ | ✗ | ✓ (enrolled) |
| **Mock Results** | View all | ✓ | ✓ (own mocks) | ✗ |
| **Mock Results** | View own | ✗ | ✗ | ✓ |
| **Theory Answers** | Grade | ✗ | ✓ (own mocks) | ✗ |
| **Payments** | View all (school) | ✓ | ✗ | ✗ |
| **Payments** | View own | ✗ | ✗ | ✓ |
| **Promos** | Create/Update/Delete | ✓ | ✗ | ✗ |
| **Reviews** | Create | ✗ | ✗ | ✓ (enrolled only) |
| **Reviews** | Hide/Show | ✓ | ✗ | ✗ |
| **Notifications** | Read own | ✓ | ✓ | ✓ |
| **Subscriptions** | Manage | ✓ | ✗ | ✗ |

---

## 10. Password Reset Flow

```
1. User visits kanvise.com/auth/forgot-password
2. Enters their email address
3. Next.js calls Supabase Auth: resetPasswordForEmail(email, { redirectTo: 'kanvise.com/api/auth/callback?next=/auth/reset-password' })
4. Supabase sends a password reset email containing a one-time link
5. User clicks the link — Supabase callback fires at kanvise.com/api/auth/callback
6. Next.js callback processes the reset token and redirects to /auth/reset-password
7. User enters their new password
8. Next.js calls Supabase Auth: updateUser({ password: newPassword })
9. Supabase Auth updates the password and issues a fresh session
10. User is redirected to their role-appropriate dashboard
```

Password reset links expire after 1 hour (Supabase default). If the link has expired, the user is shown an error and prompted to request a new one.

---

## 11. Invite Token Implementation

The tutor invite token is a signed HMAC-SHA256 token generated by Hono. It is not a JWT — it is a simpler custom token.

**Token generation:**
```javascript
const generateInviteToken = (schoolId, adminUserId) => {
  const payload = {
    school_id: schoolId,
    created_by: adminUserId,
    issued_at: Date.now(),
    expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  }

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', process.env.INVITE_TOKEN_SECRET)
    .update(payloadBase64)
    .digest('base64url')

  return `${payloadBase64}.${signature}`
}
```

**Token validation on Hono:**
```javascript
const validateInviteToken = (token) => {
  const [payloadBase64, signature] = token.split('.')

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.INVITE_TOKEN_SECRET)
    .update(payloadBase64)
    .digest('base64url')

  if (signature !== expectedSignature) {
    throw new Error('INVALID_INVITE_TOKEN')
  }

  const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())

  if (Date.now() > payload.expires_at) {
    throw new Error('INVITE_TOKEN_EXPIRED')
  }

  return payload
}
```

**Invite token storage:** The invite token itself is stateless — profile initialisation validates it purely from its HMAC signature and the expiry inside the payload, with no database lookup. Separately, a `tutor_invites` row is recorded when an Admin generates an invite so the dashboard can list pending/accepted/expired invites and revoke outstanding ones. Revocation and the stored row are an Admin convenience layer; they are not part of the token's cryptographic validation. Changing the `INVITE_TOKEN_SECRET` still invalidates every outstanding token at once.

---

## 12. KanviseUser ID Generation

Every user gets a unique human-readable ID on registration. The format is:

```
KNV-{ROLE_CODE}-{PADDED_NUMBER}

Examples:
KNV-ADM-00001   (Admin)
KNV-TUT-00042   (Tutor)
KNV-STU-00387   (Student)
```

**Role codes:**
- Admin → `ADM`
- Tutor → `TUT`
- Student → `STU`

**Number generation:**

The number is a sequential counter per role, stored in a `kanvise_id_sequences` table:

```sql
CREATE TABLE kanvise_id_sequences (
  role TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);

INSERT INTO kanvise_id_sequences (role, last_value) VALUES
  ('admin', 0),
  ('tutor', 0),
  ('student', 0);
```

On each new user creation, Hono increments the counter atomically:

```javascript
const generateKanviseUserId = async (role) => {
  const roleCode = { admin: 'ADM', tutor: 'TUT', student: 'STU' }[role]

  // Atomic increment to prevent duplicate IDs under concurrent registrations
  const { data } = await supabase.rpc('increment_user_sequence', { p_role: role })
  const number = data.toString().padStart(5, '0')

  return `KNV-${roleCode}-${number}`
}
```

The Supabase RPC function `increment_user_sequence` runs as a single atomic operation to prevent race conditions under concurrent registrations.

---

## 13. Security Considerations

### 13.1 What the Frontend Can Never Do

The Supabase service role key must never appear in frontend or Next.js code. It lives only in Hono's environment on Scaleway.

The Supabase anon key is safe to expose — it is intentionally public. It only allows what Supabase RLS and Auth configurations permit, which for Kanvise is only auth operations.

### 13.2 Cross-Tenant Request Forgery

Because `school_id` is always derived from the authenticated user's profile in Hono middleware — never from the request body — a malicious user cannot craft a request that targets another school's data. Even if they construct a valid JWT (which they cannot, as they do not have the JWT secret), the school_id in their profile in the database is fixed.

### 13.3 Role Escalation

Role is canonical in `user_profiles` and copied to Supabase Auth `app_metadata` by trusted server code for fast JWT-based resolution. It is never read from `user_metadata` for authorisation because users can update that field through Supabase Auth independently of `PATCH /auth/me`. Role-changing operations must update the database and `app_metadata`, then refresh or revoke affected sessions because existing JWTs remain valid until refreshed or expired.

### 13.4 Invite Token Security

Invite tokens are HMAC-signed with a secret known only to the Hono server. A malicious actor cannot forge a valid invite token without the secret. The token expires in 7 days. If an Admin suspects a link has been shared with the wrong person, the practical mitigation at MVP is to change the `INVITE_TOKEN_SECRET` environment variable — this invalidates all outstanding invite tokens. Post-MVP, per-token revocation will be added.

### 13.5 Webhook Security

The Paystack webhook at `kanvise.com/api/webhooks/paystack` verifies the `x-paystack-signature` header using HMAC-SHA512 with the Paystack secret key before processing any payload. Any request that fails signature verification receives a `400` immediately with no processing.

The LiveKit webhook at `api.kanvise.com/webhooks/livekit` is on a private Scaleway network endpoint not exposed to the public internet. It additionally verifies the LiveKit webhook JWT in the `Authorization` header.

### 13.6 Password Requirements

Supabase Auth enforces the following minimum password requirements configured in the Supabase project settings:

- Minimum 8 characters
- At least one uppercase letter
- At least one number

These are enforced at the Supabase Auth layer before Hono is involved.

### 13.7 Email Enumeration Prevention

Supabase Auth does not reveal whether an email address is registered when a password reset is requested. The response is always the same: "If an account exists with this email, a reset link has been sent." This prevents user enumeration attacks.

---

## 14. Environment Variables Required

The following environment variables are required for the auth system to function. These must be configured before any auth flow is tested.

**Hono (Scaleway — never exposed to frontend):**
```
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
INVITE_TOKEN_SECRET=random-256-bit-secret
FRONTEND_URL=https://kanvise.com
CORS_ALLOWED_ORIGINS=https://staging.kanvise.com,https://app.kanvise.com
```

`FRONTEND_URL` is the canonical frontend used for generated links. `CORS_ALLOWED_ORIGINS` is a comma-separated list of additional exact frontend origins allowed to call Hono from a browser. Add new stable subdomains here and restart the API process after changing the value.

**Next.js (Vercel — NEXT_PUBLIC_ prefix for browser-safe vars):**
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.kanvise.com
HONO_INTERNAL_SECRET=shared-secret-for-next-to-hono-internal-calls
```

`HONO_INTERNAL_SECRET` is used by Next.js route handlers when calling internal Hono endpoints (e.g. `POST /internal/payments/confirm`). It is not prefixed with `NEXT_PUBLIC_` — it is a server-side secret that never reaches the browser.

---

## 15. Auth Error Reference

| Error Code | HTTP Status | Cause | Frontend Action |
|---|---|---|---|
| `MISSING_TOKEN` | 401 | No Authorization header | Redirect to login |
| `INVALID_TOKEN` | 401 | Bad JWT signature or format | Redirect to login |
| `TOKEN_EXPIRED` | 401 | JWT past expiry | Attempt silent refresh, retry once, then redirect to login |
| `PROFILE_NOT_FOUND` | 403 | Auth user exists but no Kanvise profile | Show error, contact support |
| `SCHOOL_NOT_CONFIGURED` | 403 | Admin has not created school yet | Redirect to school setup |
| `INSUFFICIENT_ROLE` | 403 | User role cannot perform action | Show permission error |
| `INVALID_INVITE_TOKEN` | 400 | Invite token signature is invalid | Show invalid link error |
| `INVITE_TOKEN_EXPIRED` | 400 | Invite token is past 7 day window | Show expired link, ask Admin for new link |
| `CROSS_SCHOOL_ENROLMENT_NOT_SUPPORTED` | 403 | Student trying to enrol in a second school | Show error explaining current limitation |

---

*End of Document — Version 1.0*
