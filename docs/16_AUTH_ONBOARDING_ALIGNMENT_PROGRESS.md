# Auth & Onboarding Alignment — Progress

**Status:** Backend + frontend flow aligned to docs; tests added. UI redirect/callback
integration tests and a feature-doc wording pass remain.
**Scope:** Registration, email verification callback, first-time school setup, password
reset, tutor invites, and the API route names behind them.
**Related documents:** `05_KANVISE_API_Specification.md`, `06_KANVISE_Auth_Authorisation_Spec.md`,
`08_KANVISE_Feature_Specifications.md`

---

## Commits

- `85b32fd` — fix: align auth/onboarding flow with docs (15 files)
- `0ef923a` — test: cover profile/init role allowlist (3 tests)

These commits are scoped to auth/onboarding only. The parallel mock-engine /
question-bank work in the tree (e.g. `c61e942`) was left untouched.

---

## Done

### Onboarding entry point
- Logged-out students clicking checkout go to `/auth/register` (not `/auth/login`).
- The enrolment `redirect` param is preserved through sign-up, and the login page's
  "Sign Up" link carries it forward too.

### First-time school setup
- Consolidated to a single canonical route `/dashboard/setup`.
- Removed `/dashboard/admin/setup` entirely (and the now-empty `admin/` folder).
- Trimmed the first-time form to name, web address (slug), description, and contact
  email. Richer branding (logo, banner, socials, etc.) stays in `/dashboard/school-setup`.

### Redirects
- Email-verification callback: admin → `/dashboard/setup`, tutor → `/dashboard`,
  student → enrolment redirect or `/dashboard/student`.
- Password reset: admin/tutor → `/dashboard`, student → `/dashboard/student`.

### Callback error handling
- `POST /auth/profile/init` failure now redirects to `/auth/auth-code-error` instead of
  continuing as if onboarding succeeded.

### profile/init hardening
- Added a role allowlist (`admin`, `tutor`, `student`); anything else is rejected with
  400 before any database work.
- Tutor validation stays stateless: the HMAC invite token is verified by signature +
  payload expiry, with no DB lookup.
- Welcome email deep-links students to `/dashboard/student` and everyone else to
  `/dashboard`.

### API route names (realigned to `05_KANVISE_API_Specification.md`)
- `/schools/mine` → `/schools/me` (GET, PATCH)
- `/schools/invites` (POST) → `/schools/me/invite/tutor`
- `/schools/invites` (GET) → `/schools/me/invites`
- `/schools/invites/:id/revoke` → `/schools/me/invites/:id/revoke`
- Updated all frontend callers (`school-setup-form`, `programmes-client`,
  `tutors-client`, `school-setup/page`) and the invites test.

### Copy & branding
- Replaced jargon on the forgot-password and reset-password screens with plain wording
  (removed "System Secured", "elite security", fake "System Operational / vX.Y" footer).
- Login and forgot-password use the Kanvise logo via a shared `AuthLogo` component.

### Docs
- `06_KANVISE_Auth_Authorisation_Spec.md`: updated the invite-token storage note to
  describe the actual model — stateless HMAC token plus a `tutor_invites` row used only
  for admin listing/revocation (not part of cryptographic validation).

### Tests
- `api/src/routes/auth.profile-init.test.ts`: rejects out-of-allowlist role, rejects
  missing role, and still requires an invite token for new tutors.
- Full API source suite: 128 + 3 passing. Web typecheck clean.

---

## Decisions

- **Setup route:** `/dashboard/admin/setup` removed; `/dashboard/setup` is canonical.
- **Invites:** kept stateless per docs at the validation layer. The existing
  `tutor_invites` DB row + list/revoke admin UI was retained (deleting working features
  would be destructive); the auth spec was updated to match. If a fully stateless model
  is preferred, the DB tracking can be removed as a separate change.
- **API names:** renamed code to match the spec rather than editing the spec, since the
  spec already documented `/schools/me...`.

---

## Left to do

- **Redirect / callback integration tests** — student checkout → register with preserved
  redirect; callback role-based redirect targets; password-reset redirect targets. These
  are Next.js server-route/client flows and need a heavier harness than the unit tests.
- **Tutor invite email failure path test** — assert a shareable link is still returned.
- **`08_KANVISE_Feature_Specifications.md`** — wording pass so the feature doc matches the
  final routes and setup fields.
- **Reset-password screen** — still uses the Material Symbols theme rather than `AuthLogo`;
  optional visual consistency pass. Its password rule (12 chars) also differs from register
  (8 chars) — decide on one policy.
- **Optional:** fully stateless invites (remove `tutor_invites` tracking) if that model is
  preferred over the retained admin listing/revocation.
