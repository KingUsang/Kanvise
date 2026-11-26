# Authentication, authorization, and tenancy

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard defines how Kanvise proves identity, resolves current access,
and isolates tutoring accounts. Authentication proves who a person is;
authorization decides what that person may do in one active account.

## Identity and sessions

Supabase Auth owns credentials, identity proof, access tokens, refresh tokens,
and session lifecycle. One Supabase Auth identity maps to one Kanvise person.
Kanvise never handles passwords.

The browser may use the Supabase client for Auth operations only. Server-side
route protection uses verified claims (`getClaims` with asymmetric signing
keys), not an unverified session payload. Browser code may read its current
session only to obtain the bearer token required by Hono.

Access tokens are short-lived credentials, not current authorization records.
`user_metadata` is never used for authorization. `app_metadata` may improve
redirect UX or carry compatibility hints, but Hono must not treat role,
membership, account, active-state, or capability claims there as current
authority.

## JWT verification

Hono verifies each bearer token locally against the Supabase project's
asymmetric JWKS. Verification must validate signature, allowed algorithm,
`kid`, issuer, audience, and expiry.

JWKS caching follows upstream cache guidance and must support refresh on an
unknown key plus operational cache invalidation. Keys must not be cached for
the lifetime of the API process. Normal JWT verification does not call the
Auth server or database.

The supported frontend request wrapper obtains the current access token,
retries once after a token-expired `401`, and performs only one coordinated
refresh. Callers must not refresh before every API request or implement their
own token lifecycle.

Tokens, refresh tokens, authorization headers, invitation tokens, and private
share tokens must never appear in logs, analytics, error bodies, or URLs where
an equivalent secure handoff is available.

## Membership-scoped tenancy

A tutoring account is the tenant isolation boundary. A person may hold
different roles in multiple tutoring accounts. Authorization therefore comes
from an active account membership, not a global role or `school_id` stored on
the person or JWT.

Each protected account request has an explicit account context selected by the
client. The API treats that identifier as a request, never as proof: it loads
the current person and verifies an active membership for that account. If the
person has exactly one eligible membership, the client may select it
automatically. With multiple memberships, the UI provides an account switcher
and may persist the last selection only as a preference.

The exact transport for account context may be a route segment or a standard
request header. It must be uniform, must not be accepted from arbitrary body
fields, and must be included in cache/query keys. Subdomains are not required
for multi-account support.

Public account routes resolve the account from a public slug and permit only
explicitly public data. A public slug never grants write access.

## Fresh authorization

After local JWT verification, every protected Hono request performs one
canonical database resolution of:

- the active Kanvise person;
- the requested active tutoring account;
- the person's active membership and role in that account; and
- the capabilities needed to construct the request context.

This read is the correctness default. It makes membership removal and global
deactivation effective on the next request without waiting for access-token
expiry. Do not add an authorization cache before measurements show the read is
a material bottleneck. Any later cache requires an approved decision,
revocation invalidation, metrics, and a maximum staleness target no greater
than 60 seconds.

Removing access deactivates the relevant membership. Suspending a person
deactivates their global Kanvise identity. Supabase session revocation may be
added for stolen-session response, but it is not a substitute for canonical
membership checks.

## Protected request sequence

Protected routes use the same fail-closed sequence:

1. Verify the JWT and required standard claims.
2. Resolve the current active person from the database.
3. Resolve and verify the active account membership.
4. Attach an immutable authorization context.
5. Enforce the route capability or coarse role gate.
6. Validate and normalize request input.
7. Authorize and query the target resource within the active account.
8. Perform the operation.

Public, webhook, internal-service, onboarding, and pre-account routes must opt
into an explicit alternative policy. A missing policy is not public access.

## Authorization rules

Frontend redirects, hidden navigation, and disabled buttons are usability
controls only. Hono is the enforcement boundary.

Route roles are coarse gates. Resource access must additionally enforce the
relevant relationship: ownership, Tutor assignment, Learner enrolment,
account-wide Admin capability, or another named permission. An Admin may teach
only where the teaching capability and resource relationship allow it.

Every tenant-scoped read, insert, update, delete, join, aggregate, database
function, storage operation, and external-provider mapping must be constrained
by the active account from the verified authorization context. Client-supplied
resource IDs are always checked within that account. Cross-account support
jobs require a separate, auditable service capability; `super_admin` is not a
shortcut.

## Dashboard page access

Carried over from the retired dashboard roles document (`docs/archive/17_DASHBOARD_ROLES_AND_PRIVILEGES.md`),
translated to current terms. Page access is a usability layer; the rules in
"Authorization rules" still decide every read and write.

- Account-wide pages are Admin-only: account setup, Programmes and Courses,
  Tutors, Learners, and Payments.
- Dashboard, Schedule, Attendance, and Quizzes are shared. An Admin sees the
  whole account; a Tutor sees and manages only Courses and Sessions assigned to
  them.
- Notes and Assignments are Tutor capabilities. An Admin gets them only when
  assigned to a Course. An Admin does not become a Tutor because the account
  has no other Tutors; the explicit Course assignment is the source of truth.
- Inside a Class workspace the Tutors view is shown only to an Admin. Assigned
  Tutors get a read-only Learner roster. Invitation, enrolment, and removal
  controls stay Admin-only. Independent Tutor accounts never see a Teaching Team
  surface.
- A new dashboard page must be added to `web/src/config/dashboard-navigation.ts`
  and covered by the relevant Hono authorization tests.

## Invitations and share links

Invitations use high-entropy opaque tokens stored only as hashes. They are
email-bound where applicable, expire, are revocable, and are consumed
atomically once. Replays may return the original successful result only for
the same identity and operation.

Anonymous share links use the same principles: opaque hashed tokens, minimum
scope, expiry where appropriate, revocation, rate limits, and no implicit
account membership. Possession grants only the explicitly named operation.

## Service authentication

Webhooks and internal service calls use separate secrets or asymmetric
credentials from user JWTs. Signatures are verified over the raw payload with
timing-safe comparison. Timestamp/replay controls and idempotent processing are
required where the provider supports retries.

Supabase privileged keys and all provider secrets remain server-only. Browser
configuration contains only publishable values.
