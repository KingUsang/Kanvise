# Kanvise Authentication, Registration, Enrollment & Invitation UX Specification

**Audience:** Codex / implementation agent
**Purpose:** Refactor the existing auth-related screens so they follow coherent user journeys, have clear content for their states, and feel like Kanvise rather than a generic authentication template.
**Brand colors supplied by product:** Primary purple/blue `#2E2877`; primary action orange/brown `#994704`.

---

## Instructions to Codex — read before changing code

Treat this document as the product and UX specification. The supplied Kanvise authentication storyboard is a **visual inventory and styling reference only**; its arrows and sequence contain mistakes. This written specification takes precedence where they conflict.

1. **Inspect the existing application first.** Locate every route listed in this document, shared auth components, Supabase client/auth helpers, invitation and enrollment services, current route guards, redirect handling, design tokens, and tests. Summarize what exists and map the current behavior before editing.
2. **Build on existing behavior.** Reuse the current framework, styling system, component library, validation, API calls, database model, and Supabase setup. Do not replace working authentication or invent new endpoints/schema just to match a mockup.
3. **Do not implement the whole flow as a single giant component.** Reuse shared form controls and authentication primitives, while keeping the user journeys understandable and their contextual content distinct.
4. **Preserve all existing security checks.** A UI state is not proof that an invitation is valid. The server/database/service must validate tokens, expiry, revocation, role/access policy, email restrictions, membership, and permissions. Never grant access based only on a client query parameter.
5. **Preserve context through authentication.** Support existing `intent`, `return_to`, programme/enrollment identifiers, invitation tokens, and supported continuation parameters. Validate continuation destinations; never redirect to arbitrary external URLs. Do not discard context when starting Google OAuth.
6. **Follow the actual product capabilities.** If open enrollment, approval-based enrollment, invitation-only enrollment, or a listed error state is not supported by the current backend, do not fake it in the UI. Keep the design ready for it, but expose only capabilities the application can actually enforce. Report any gap requiring a product/backend decision.
7. **Avoid a route-breaking rewrite.** Keep deep links working. If legacy invitation routes are consolidated, retain compatible handling/redirects and test existing links. Do not delete a route until its callers and links have been checked.
8. **Implement accessible, responsive states—not only the happy-path screenshots.** Every interactive control must work; all loading, validation, error, empty, success, and disabled states must be deliberate.
9. **Work in stages:** audit → implement shared primitives and canonical journeys → update each route → test direct navigation and edge cases → report what changed, what could not be completed, and any assumptions. Do not stop after writing a plan; complete the changes that are supported by the repo.

## 1. Product goals

Kanvise has two distinct registration experiences and one shared sign-in system:

- **Educator account creation:** for independent tutors and tutorial-centre administrators starting their own Kanvise workspace.
- **Student joining:** students come from a programme enrollment link or a personal invitation from an independent tutor or centre administrator. Their role and context should already be known; do not ask them to choose Student/Tutor/Centre on a generic registration form.
- **Shared authentication:** use Google or email/password where account creation or sign-in is needed, while preserving the journey the person started.
- **Account recovery and setup:** explain what happened in human language and always offer a useful next action.

The experience should feel calm, confident, education-focused, and distinctly Kanvise. Do not make each technical route look like a separate product page.

### Product principles

- **Intent before implementation details:** say “Your session has expired,” not “Session resolution failed.”
- **Explain before asking:** show a programme's relevant details before requesting sign-in or account creation.
- **Use known context:** if a student arrives through an invitation, do not ask them to choose their role or reselect their programme.
- **Authentication is not authorization:** successful Google/email authentication does not by itself grant programme or workspace access.
- **One canonical experience, multiple route/state entry points:** technical routes can remain distinct, while shared visual patterns and recovery language stay consistent.
- **No dead ends:** errors should tell the user what happened and how to proceed.
- **Do not collect unnecessary profile information:** make avatar and bio optional unless the application has a genuine requirement.

---

## 2. Canonical user journeys

### Journey A — Educator starts using Kanvise

1. User chooses the educator entry point, such as “Get started” or “Create an educator account.”
2. On `/auth/register`, they select **Independent tutor** or **Tutorial centre**. The centre option requires a centre name; the independent tutor option does not.
3. They choose an authentication method: Google or email/password. Preserve the selected account type during either route.
4. Email/password registration follows the existing email-verification requirement. Google sign-in follows the existing OAuth callback/session flow.
5. After identity is established, create/complete the educator profile and workspace using current backend rules. Do not create duplicate accounts or workspaces on callback retries.
6. Ask for only required setup details. Avatar and bio are optional unless existing product rules say otherwise.
7. Continue to the correct educator/centre destination, or the validated destination the person originally requested.

**Important:** Google does not tell Kanvise whether the person intends to be an independent tutor or centre administrator. The product must preserve the account-type choice through OAuth or ask for it after the callback before finalizing setup. Prefer asking for the account type before starting OAuth, then retain it securely through the supported flow. Do not silently infer a role from the Google profile.

### Journey B — Student joins from a public programme enrollment link

1. Student opens the programme's public landing page.
2. The landing page explains the programme and who runs it. Display available details that actually exist: programme name, tutor/centre, description, subjects, schedule/start date, and price or enrollment conditions if applicable.
3. Student selects **Join programme**.
4. Check the current session.
   - If signed in, proceed to the supported enrollment eligibility/policy check.
   - If not signed in, present Google and email/password options in the context of the programme. Registration must not ask the student to choose Student/Tutor/Centre.
5. After authentication, restore the programme context and re-check authorization/enrollment status.
6. Complete the supported enrollment action: join immediately, submit an approval request, or explain that the programme requires an invitation. Only offer actions that the backend currently supports.
7. Confirm the result and navigate to the programme/class.

If a student opens the public link while already enrolled, do not ask them to enroll again. Show an appropriate **Open programme** action. If enrollment is pending approval, show the actual pending state and do not claim they have joined yet.

### Journey C — Student or staff member accepts a personal invitation

Invitations may be sent by an independent tutor or a tutorial-centre administrator. The invitation itself determines the intended context and allowed role; do not ask the recipient to choose their role.

1. Open `/invite?token=...` and validate the invitation with the current invitation service.
2. If valid and pending, display a contextual invitation preview: inviter, programme/class or centre/workspace, role or invitation purpose, and any relevant non-sensitive details.
3. CTA begins acceptance, but does not grant access before authentication and server-side checks.
4. User chooses Google or email/password as appropriate.
5. Preserve the invitation token/context through auth callback. On return, revalidate the invitation and session.
6. Confirm account email/eligibility and any invitation restrictions. If the signed-in email is not allowed, explain the mismatch and offer a supported way to switch accounts.
7. Accept invitation idempotently (retrying must not create duplicate memberships), then route to the relevant programme or workspace.

**Invitation state handling:** loading, valid/pending, malformed/invalid token, expired, revoked, already accepted, no longer pending, rate-limited/start failure, session missing/expired, session email mismatch, and successful acceptance. Avoid leaking private invitation details for invalid or unauthorized tokens.

### Journey D — Existing user signs in

1. User opens `/auth/login` or is redirected there by a protected destination.
2. Offer Google and email/password. The page may include links to educator registration and student joining/help, but should not force every user to select a role before signing in.
3. Authenticate using the selected provider.
4. Resolve the Kanvise account, membership, and access using existing application rules.
5. Continue to a validated `return_to`/`intent` destination where applicable. Otherwise use the actual role/account state to choose the correct destination.
6. If authentication succeeds but profile/session resolution fails, explain that Kanvise could not finish loading the account and offer retry. Do not mislabel it as incorrect credentials.

### Journey E — Password recovery

1. User chooses **Forgot password?** from email/password sign-in.
2. Enter email and request a recovery code.
3. Enter the six-digit code; allow resend after the actual cooldown and change-email action.
4. Validate the recovery session/token using the current auth implementation.
5. Enter and confirm a new password. Show the actual password rules before or while typing.
6. On success, show confirmation and follow the current secure policy for continuing or signing in again.

A Google-authenticated user who forgot their Google password should be directed to sign in with Google; Kanvise must not imply that its password-reset form can reset a Google password. Avoid account-enumeration leaks: success messaging should follow the security pattern already used by the backend and not reveal whether an arbitrary email has an account.

### Journey F — Complete account setup

After account/session resolution, show only the remaining required profile steps. Optional bio/avatar must be clearly marked optional. Keep the user's role, invitation/enrollment context, and intended destination intact. If there is no valid session, redirect to sign-in with a safe continuation back to setup.

---

## 3. Route responsibilities

Inspect actual route names and routing framework before making changes. These are the current known routes and their intended product responsibilities.

| Route | Intended responsibility |
|---|---|
| `/auth/login` | Shared sign-in with Google and email/password; return-to handling; session/profile resolution states. |
| `/auth/register` | Educator registration only: independent tutor or tutorial-centre administrator. |
| `/auth/register/student` | Contextual student account creation/continuation. It should not be a generic, unconnected student signup page. Preserve compatibility if existing links depend on it. |
| `/auth/forgot-password` | Start password recovery, enter recovery code, resend/change-email states. Use the existing route/state model unless route changes are justified and safe. |
| `/auth/reset-password` | Validate recovery session, choose new password, show success/error. |
| `/auth/auth-code-error` | Shared contextual recovery page for unusable verification/recovery links. Use plain wording and appropriate next action, not raw token/auth terminology. |
| `/auth/service-unavailable` | Temporary service/auth failure with retry and safe navigation options. |
| `/account/setup` | Complete required profile details; optional bio/avatar; continue to role-appropriate destination. |
| `/invite?token=...` | Canonical personal-invitation entry: validate, preview, authenticate, accept, or explain the state. |
| `/auth/invitation/callback?account_invitation_token=...` | Internal OAuth/email handoff. Usually a loading state, not a general-purpose form. Resume the intended invitation flow safely. |
| `/auth/complete-invitation?token=...` | Existing invitation account-completion route. Reuse the canonical invitation language/layout and keep only states required by the current backend. |
| `/auth/accept-invitation` | Legacy student-invitation route. Keep it compatible until existing links/callers are identified and safely migrated. |
| Existing programme landing/enrollment route | Public programme details and Join CTA. Find and reuse the actual route; do not invent a new path without checking the repository. |

Do not expose a raw internal callback route as a normal navigation destination. Do not remove query params before the relevant service has consumed them.

---

## 4. Screen specifications and content

### 4.1 Shared sign-in — `/auth/login`

**Purpose:** Get an existing user into Kanvise with minimal friction.

**Recommended content hierarchy**
- Small Kanvise brand mark.
- Heading: **Welcome back to Kanvise**.
- Supporting line: **Sign in to continue to your learning space.** This copy can be adjusted by context; do not imply every user is a student.
- Primary alternative: **Continue with Google**.
- Divider: **Or continue with email**.
- Email label and input: **Email address**.
- Password label and input: **Password**; show/hide control.
- **Forgot password?** link.
- Main email button: **Sign in**.
- Footer: **New to Kanvise?** link to educator account creation, plus a clearly differentiated student link such as **Joining a programme?** or **Have an invitation?**.

**Behavior and states**
- Idle: all fields usable.
- Submitting: show progress in the active provider/button; disable repeat submission without making the rest of the page jump.
- Invalid credentials: inline and/or form-level message: **We couldn't sign you in with those details. Check your email and password and try again.** Retain the email; do not unnecessarily clear both fields.
- Expired session: contextual banner: **Your session has expired. Sign in to continue.**
- Profile/session resolution failure after successful auth: **You're signed in, but Kanvise couldn't finish loading your account. Try again.** Provide **Try again**; do not claim the password is invalid.
- Service outage: **Kanvise is having trouble connecting right now. Your account hasn't been changed. Try again shortly.** Only claim that the account has not changed if the failed action guarantees that.
- Google cancellation: return to a stable screen with a calm message only if needed; do not present cancellation as a security failure.
- Google error: show safe, actionable message and retry option. Never print raw provider errors/tokens.
- Password show/hide is keyboard accessible and has a programmatic label such as **Show password** / **Hide password**.
- After success, respect validated intent/return destination and account access rules.

### 4.2 Educator registration — `/auth/register`

**Purpose:** Create an account for an independent tutor or tutorial-centre administrator.

**Top content**
- Heading: **Get started with Kanvise**.
- Supporting line: **Set up your space for smarter tutoring.**
- An account-type choice before identity setup:
  - **I teach independently** — “For tutors managing their own students and classes.”
  - **I run a tutorial centre** — “For teams managing tutors, programmes and students.”
- Once selected, present Google and email/password methods. Preserve the selected type if the person switches method or returns from OAuth.
- Fields for the existing registration model: full name (or the currently used first/last name model), email, password. Centre name is required only for the centre path.
- Password show/hide and clear password requirements.
- Main button should say **Create educator account** or **Create workspace**, depending on selected type.
- Footer: **Already have an account? Sign in.** A separate student path should say **Joining a programme?** so students do not choose educator roles.

**Validation and errors**
- Required-field messages attached to fields.
- Invalid email: **Enter a valid email address.**
- Weak password: show unmet requirements clearly; do not rely only on a red border.
- Existing account/email: offer **Sign in** and **Forgot password?** where appropriate. Avoid exposing more account information than the current security policy permits.
- Missing centre name on centre path: **Enter your tutorial centre's name.**
- Duplicate submission: ignore or disable repeated requests while pending.
- Verification required: continue to the verification-code state described below.
- Google registration: ensure account type survives OAuth callback and is revalidated before creating the right workspace. Do not grant admin privileges solely from a client-supplied query string.

**Do not do this:** Do not include a Student/Tutor/Centre selector on the student enrollment/invitation flow. The selector belongs only to educator registration.

### 4.3 Student joins via programme enrollment link

This landing page exists before registration/authentication and should not be hidden behind a login wall.

**Programme landing page content**
- Programme title.
- Tutor or tutorial-centre identity.
- Clear description/outcomes.
- Relevant real data such as subject(s), schedule/start date, delivery format, and price/enrollment conditions if the platform has them.
- Primary CTA: **Join programme**.
- Secondary sign-in route for existing students where useful.
- Avoid fabricated details, fake ratings, made-up seats-left counts, or unsupported claims.

**After clicking Join**
- If signed in and eligible: follow the actual enrollment rule.
- If not signed in: show a contextual join/auth screen, for example:
  - Heading: **Join [Programme name]**.
  - Supporting line: **Sign in or create an account to continue.**
  - **Continue with Google**.
  - Divider **Or continue with email**.
  - Email/password sign-in or a clear create-account branch.
  - A link back to programme details.
- Do not ask students to select a role.
- Preserve the programme identifier and continuation intent through Google OAuth and email verification.
- After auth, re-check enrollment and membership to prevent duplicate enrollment.

**Outcomes**
- Enrollment complete: **You're in!** / **You've joined [Programme name].** CTA: **Open programme**.
- Already enrolled: **You're already part of this programme.** CTA: **Open programme**.
- Approval required, if actually supported: **Your request has been sent. You'll be able to access the programme once it's approved.** Show pending status; do not say enrollment is complete.
- Invitation-only, if actually enforced: explain that the programme requires an invitation and offer a suitable way to contact the tutor/centre or return. Do not silently bypass the rule.
- Unavailable/full/closed programme: explain the actual reason and offer a safe next action.
- API/service failure: **We couldn't complete enrollment right now. Your place hasn't been confirmed. Try again.** Use wording that matches the transaction's actual state.

### 4.4 Personal invitation preview — `/invite?token=...`

**Purpose:** Make the student or staff member confident that the invitation is legitimate and understand what they are accepting.

**Valid pending invitation content**
- Heading appropriate to role, e.g. **You've been invited to join a programme** or **You've been invited to join [Centre name] on Kanvise**.
- Inviter identity: tutor or centre administrator, using available trustworthy data.
- Programme/class/centre/workspace name and relevant details.
- Concise explanation of what acceptance does.
- Main action: **Accept invitation** (or role-appropriate **Join programme** where that's the established term).
- Secondary action: **Sign in to Kanvise** if the user already has an account.
- If invitation is addressed to a specific email, show it clearly only if safe and useful, and explain that the recipient must use the matching account.
- Don't expose private programme details before token validation.

**Invitation states**
- Loading: skeleton/compact progress and **Loading invitation…**; prevent accidental duplicate CTA.
- Invalid token: **This invitation link isn't valid. Check that you copied the full link, or ask the person who invited you to send another.** Do not reveal private invitation data.
- Expired: **This invitation has expired. Ask your tutor or centre administrator for a new one.**
- Revoked/cancelled: **This invitation is no longer available. Contact the person who sent it if you still need access.**
- Already accepted: if current signed-in user has access, **You've already accepted this invitation.** CTA **Open programme/workspace**. Otherwise offer sign-in to the invited account and revalidate.
- Email mismatch: **This invitation was sent to a different email address. Sign in with the invited account to continue.** Provide a supported switch-account action; do not silently accept.
- Authentication session missing/expired: **Your sign-in didn't finish. Open the invitation again to continue.** CTA **Return to invitation**.
- Rate limited or service failure: explain that the invite could not be checked right now and provide **Try again**. Do not label a temporary outage as an invalid invite.
- Successful acceptance: show a short confirmation and CTA to the relevant programme/workspace. Do not force the user to read a separate unnecessary success screen if the interface can safely navigate directly and existing behavior supports it.

### 4.5 Google OAuth callback / invitation callback

These are internal transition states, not ordinary landing pages.

- Display compact Kanvise branding and a focused loading message, e.g. **Finishing sign-in…** or **Getting your invitation ready…**.
- Avoid blank white screens, raw JSON, stack traces, or a generic registration form on this route.
- Validate that required callback parameters exist, consume the auth session using the existing Supabase flow, and restore validated context.
- On missing/expired state or failed auth, route to the appropriate recovery screen with context preserved only if it is safe.
- Prevent an infinite redirect loop. Include a recovery CTA such as **Return to invitation** or **Back to sign in**.
- Never trust a client-side role or redirect query alone to grant permissions or select arbitrary destinations.

### 4.6 Email verification code

Used when the existing registration or recovery process requires it; keep the purpose explicit so users know whether they are verifying a new account or recovering access.

**New account copy**
- Heading: **Check your email**.
- Body: **We sent a 6-digit code to [masked email]. Enter it below to verify your email address.**
- Six-digit input UI that supports typing/pasting a full code, keyboard navigation, screen readers, and mobile numeric keyboards.
- **Verify email** CTA; loading label **Verifying…**.
- **Resend code** disabled until the actual cooldown ends; show a readable countdown only if reliable.
- **Use a different email** action.

**States**
- Incorrect: **That code doesn't match. Check it and try again.**
- Expired: **This code has expired. Request a new one.**
- Resend pending: show progress and prevent repeat sends.
- Verification request failed: **We couldn't verify your email right now. Try again.**
- Success: continue to profile/account setup or the original intent; don't leave the user stuck on the code screen.

Do not require the user to type a code character-by-character if a full code paste can be supported. Avoid auto-submitting unexpectedly before the user has a chance to correct the entry unless current behavior and usability testing strongly support it.

### 4.7 Forgot password — `/auth/forgot-password`

**Step 1: Request code**
- Heading: **Reset your password**.
- Body: **Enter the email associated with your Kanvise account. We'll guide you through resetting your password.**
- Field: **Email address**.
- CTA: **Send recovery code**.
- Link: **Back to sign in**.
- Pending label: **Sending code…**.
- Use security-conscious response text consistent with the backend; don't reveal whether an address exists.

**Step 2: Verify code**
- Heading: **Check your email**.
- Body includes the masked email and says it is a recovery code.
- Six-digit input, **Verify code**, resend cooldown, and **Use a different email**.
- Incorrect/expired/network states use plain language and recovery actions as defined above.
- On successful verification, proceed to `/auth/reset-password` using the actual recovery-session mechanism. Do not rely only on client state to authorize password change.

**Google-account case**
- If the system can reliably identify that a user needs Google sign-in, offer **Try signing in with Google**. Otherwise use neutral text such as **If you usually sign in with Google, return to sign in and choose Continue with Google** without exposing account existence.

### 4.8 Reset password — `/auth/reset-password`

**Initial session check**
- Show a compact **Checking password reset…** loading state.
- If no valid recovery session exists: explain **This password reset link has expired or is no longer valid. Request a new recovery code to continue.** CTA **Request a new code**; secondary **Back to sign in**.

**Form**
- Heading: **Choose a new password**.
- Fields: **New password**, **Confirm new password**.
- Display real password requirements before/while typing; reuse the validation enforced by the backend. Do not invent conflicting rules.
- Show/hide controls for each field.
- Mismatch message: **These passwords don't match yet.**
- CTA: **Update password**; pending label **Updating password…**.
- Error: retain the form where safe, explain the failure, and let the user retry. Do not show raw Supabase/provider errors.
- Success: **Password updated** and **Your password has been changed. You can now sign in to Kanvise.** CTA behavior must match actual secure auth policy—either **Sign in** or a confirmed, valid continuation. Avoid claiming the user is signed in if the session does not prove that.

### 4.9 Auth code/link error — `/auth/auth-code-error`

Use this screen for link/code failures that genuinely cannot be handled inline in the originating flow. Keep it calm and contextual.

- Heading: **This link can’t be used** or a more specific variant if the error is reliably known.
- Supporting copy: **It may have expired, already been used, or been opened after the sign-in session ended.** Don't list a cause that has not been established.
- Main recovery CTA depends on intent: **Return to sign in**, **Request a new code**, or **Return to invitation**.
- Secondary link: **Go to Kanvise** only if that route is safe and helpful.
- Never expose codes, tokens, stack traces, internal error enums, or raw URLs containing secrets.

### 4.10 Service unavailable — `/auth/service-unavailable`

- Heading: **Kanvise is temporarily unavailable**.
- Copy: **We couldn't complete that step right now. Please try again.**
- Main CTA: **Try again**.
- Secondary action returns to the safe origin, sign-in page, or invitation as appropriate.
- Retry should repeat the relevant operation safely; do not repeat an enrollment/acceptance mutation blindly without checking its status.
- Use this only for transient service/auth conditions, not expired or invalid invitations.

### 4.11 Account setup — `/account/setup`

- Heading: **Let's finish setting up your account**.
- Briefly explain why the remaining information is needed.
- Render only fields that remain required by the current data model.
- Name fields should be prefilled from the account/provider when trustworthy and editable when allowed.
- Avatar upload and bio are **Optional** unless the product explicitly requires otherwise.
- CTA: **Save and continue**; pending **Saving…**.
- Validation errors appear by their fields; save errors retain entered data.
- Success continues to the correct role/context destination.
- No valid session: redirect to sign-in and preserve a safe `return_to` back to setup.
- If setup is already complete, don't force the user through it again.

### 4.12 Student registration route — `/auth/register/student`

This should be a **context-aware student account step**, normally entered from a programme's Join action or personal invitation. It should not show the educator role selector.

- Use the programme/invitation title and context when available.
- Heading examples: **Create your account to join [Programme]** or **Create your account to accept the invitation**.
- Offer **Continue with Google** and email/password registration in a consistent order.
- Collect only the required student identity details under the current model.
- Preserve the join/invitation intent through email verification and OAuth.
- If the current product does not support completely standalone student registration, do not invent a public “sign up as a student” route without an enrollment/invitation context.
- If a signed-in account is incompatible under existing account rules, explain the conflict and provide a supported account-switch/sign-in action. Do not silently change an established user's role.

### 4.13 Legacy invitation completion/acceptance routes

`/auth/complete-invitation` and `/auth/accept-invitation` should share the canonical invitation UI and language wherever technically practical.

- Keep support for old emailed links and established callers until safely migrated.
- Translate legacy query/session state to the canonical journey without losing or exposing tokens.
- Do not create two different visual experiences for student invitations just because they enter through different old routes.
- Do not redirect blindly if the route is required to consume a session or invitation token first.
- Test valid, expired, already-used, missing-session, email-mismatch, and successful cases against real current behavior.

---

## 5. Shared component and interaction rules

Create or reuse shared components where they fit the existing architecture. Names below are conceptual; follow repository conventions.

- **Auth layout:** brand mark, content region, optional contextual side panel, responsive stacking.
- **Auth method group:** Google button, divider, email/password fields. Support a context-specific heading without duplicating auth logic.
- **Form field:** visible label, input, optional hint, field error, accessible ID and focus state.
- **Password field:** show/hide control with accessible name; no icon-only control without a label.
- **Code input:** paste-friendly six-digit entry, keyboard and screen reader support.
- **Inline alert/banner:** info, warning, error, and success variants; use semantic color and readable text, not color alone.
- **Loading button:** stable width/height; clear busy state; block duplicate submissions.
- **Invitation/programme summary:** re-usable panel for title, inviter/owner, and verified relevant metadata.
- **Recovery actions:** component or consistent layout for retry, sign in, change email, resend code, and reopen invitation.

Interaction consistency:
- Keep user-entered data on recoverable errors wherever safe.
- Focus the first invalid field or a useful error summary after failed submit.
- Clear stale field-level errors when the associated field is corrected.
- Don't show both a toast and a large duplicate error message for the same event unless there is a clear reason.
- Loading should not shift the entire layout.
- Disable actions only while they genuinely cannot be repeated; communicate cooldowns and pending work.
- Make the back/close action safe: it must not accidentally accept an invitation, enroll a student, or discard an important state without warning.
- Use the platform's existing toast/alert patterns where appropriate.

---

## 6. Visual direction and brand use

The storyboard image is a low-fidelity overview, not a literal screen specification. Preserve its brand colors and overall clarity, but correct the journey order and avoid cramming every possible state into each screen.

### Brand colors

- Primary purple/blue: `#2E2877` — headings, brand mark, navigation/links, focus treatment, selected account-type option, and key identity elements.
- Primary accent orange/brown: `#994704` — main CTAs, invitation action labels, important action states.
- White / near-white / neutral gray surfaces — main form surfaces, dividers, input backgrounds, subtle cards.
- Use semantic success/error/warning colors only where they improve understanding and ensure sufficient contrast. Do not use the two brand colors to imply every kind of status.
- Main CTA text should have sufficient contrast; the orange/brown background with white text should be verified for contrast in the actual UI.

### Avoid generic, lifeless SaaS styling

- Use a distinct Kanvise brand presence, confident typography, thoughtful spacing, and a small number of purposeful education-related visual details.
- A desktop auth screen can use a two-panel composition: a clear form on one side and a purposeful contextual brand panel on the other. The brand panel should support the current journey—for example programme joining, teaching/workspace setup, or account access—not use random stock imagery or generic floating dashboard cards.
- Do not make the decorative side panel more prominent than the task. On invitation pages, the invitation/programme summary is the useful visual anchor.
- Prefer a few strong, useful visual elements over excessive cards, borders, gradients, decorative icons, and tiny text.
- Avoid placing the entire state inventory on one screen. Each viewport should contain only the current step and relevant recovery options.
- Use consistent button height, input height, radius, field spacing, section width, icon style, and error placement.
- Keep language warm, direct, and human; avoid raw engineering vocabulary such as “session resolution,” “callback,” “invalid token,” or “profile fetch.” Those belong in logs, not user-facing copy.

### Layout sizing

Use repository design tokens if they exist. If not, start with the following practical targets and adjust to the existing product design system:

- Form content max width: approximately **420–480 px** for sign-in/registration/recovery.
- Main page content max width: approximately **1120–1200 px** for programme/invitation layouts on desktop.
- Comfortable page gutter: around **32–48 px** on large desktop, **24 px** on tablet, **16–20 px** on mobile.
- Input and primary button height: generally **48–52 px**; interactive targets should meet at least a **44×44 px** practical touch target where possible.
- Space form groups consistently; error text should sit close to the relevant control.
- Don't hardcode pixel heights that clip translated copy, zoomed text, keyboard-open layouts, or longer error messages.

---

## 7. Responsive behavior by viewport

Implement and test actual responsive layouts—not merely scale the desktop layout down.

### Large desktop — 1200 px and above

- Center the experience within a max-width container.
- For sign-in/registration/recovery, use a balanced two-panel layout when it improves clarity: one form panel and one contextual Kanvise/education panel. Keep the actual form within its max width.
- Do not place the form too close to the viewport edge. Maintain clear whitespace and a readable hierarchy.
- Programme/enrollment and invitation previews may use a wider two-column composition: programme/invitation details beside the join/auth action, provided all critical details remain easy to find.
- At 1440 px, don't stretch the inputs across the full screen; constrain reading and form width.

### Tablet — approximately 768–1199 px

- Reduce outer gutters and gaps.
- Keep the form comfortable and centered or use a narrower two-column layout only if each column remains usable.
- Collapse the decorative side panel when it would squeeze the form or make programme details hard to scan.
- Invitation/programme details may appear above the action panel rather than side by side.

### Mobile — below approximately 768 px

- Use a single-column layout; remove the desktop split-panel composition or reduce it to a compact brand header/context summary.
- Keep the Kanvise brand mark visible but compact.
- Display programme/invitation identity before the Join/Accept action, without making the user scroll past a large hero illustration to reach the CTA.
- Make inputs, Google button, primary CTA, and secondary links full-width or naturally easy to tap.
- Keep field labels visible; do not rely on placeholder-only labels.
- Avoid horizontal overflow, clipped helper/error text, side-by-side narrow password inputs, and tiny footer links.
- Ensure code entry fits narrow screens and supports automatic/paste entry without tiny boxes.
- Allow the page to scroll when the mobile keyboard opens. Do not use fixed-height containers that hide the submit button.
- Keep cooldown and resend/change-email controls visible and understandable below the code field.
- Use at least 16 px input text on mobile where needed to avoid browser zoom behavior.
- Respect safe-area padding on devices with notches/home indicators.

### Small mobile — 320–374 px

- Verify long email addresses, centre names, programme titles, validation copy, buttons, and footer links wrap without breaking layout.
- Let cards and buttons grow vertically; do not shrink text to force one-line labels.
- If an account-type selection uses cards, stack them vertically or use a clear compact segmented choice; avoid two narrow cards with truncated descriptions.

### Orientation, zoom, and assistive technology

- Layout must remain usable in portrait and landscape, with browser zoom up to 200%.
- Avoid fixed modal heights that prevent scrolling.
- Maintain visible focus indicators for keyboard navigation.
- Use semantic headings, labels, buttons, links, live regions for asynchronous status, and accessible error association.
- Do not use color as the only signal for selected, invalid, successful, or disabled states.

---

## 8. Design issues in the current storyboard that must be corrected

The existing generated board is useful for coverage but contains sequencing and content problems. Do not reproduce these mistakes:

1. **Google is shown as a separate screen after student registration.** It must be an alternative auth method, not a mandatory subsequent step.
2. **Student registration includes Student/Tutor/Centre selectors.** Remove educator role selection from the student join/invitation flow. The link context establishes that it is a student journey.
3. **The enrollment flow puts “Already signed in” after enrollment completion.** Signed-in status is an early branch, before the enrollment mutation.
4. **Invitation details and acceptance actions are duplicated in confusing order.** Show one validated invitation preview, authenticate if needed, revalidate, accept once, and confirm/continue.
5. **Password reset is in the wrong order.** Recovery code verification must precede setting a new password if that is the current recovery mechanism.
6. **The board tries to show too many states as separate screens without explaining transitions.** Give each route a clear initial state and render state variations contextually; use separate screens only when the task genuinely changes.
7. **Error cards are too generic.** Each failure needs wording and an action appropriate to the failure, not one reusable “Something went wrong” message everywhere.
8. **The same page style is repeated without enough context.** Invitation/programme metadata should be visible where it helps establish why the user is signing in.
9. **Final destinations should be role/context aware.** Student membership should lead to the relevant programme; educator setup should lead to the right workspace. Do not route every success to one generic dashboard.
10. **Avoid using a poster as the interface.** The storyboard is for understanding the system; the actual product UI should show the current task, not dozens of tiny cards.

---

## 9. Security, reliability, and data integrity requirements

- Preserve current Supabase OAuth/session handling and email verification. Inspect current behavior before changing callback/session mechanics.
- Keep invitation tokens out of logs and user-visible error messages. Do not include secrets in analytics events or error tracking payloads.
- Validate tokens and invitation/programme status on the trusted service/backend before access is granted.
- Re-check invitation and enrollment eligibility after OAuth returns; status may have changed while the user was authenticating.
- Enforce invitation email restrictions using the authoritative account email and current verification policy.
- Make invitation acceptance/enrollment idempotent or verify existing membership before retrying a mutation.
- Preserve safe continuation parameters, but reject external/open redirects and unsafe paths.
- Do not trust `role`, `account_type`, `intent`, `return_to`, or similar query parameters alone to grant permissions. Treat them as navigation/context hints only until validated by server-side rules.
- Don't automatically link accounts in a way that weakens identity security. Follow current Supabase/provider configuration and explicit product policy for users who try Google with an email previously used for password auth.
- On auth success + profile lookup failure, distinguish identity authentication from app-account resolution in both code and UI.
- Use generic recovery responses where needed to avoid exposing whether an email has an account.
- If a user cancels Google OAuth, do not create an empty account/workspace or consume an invitation as accepted.

---

## 10. Acceptance criteria

The work is ready for review when all applicable criteria below pass.

### Flow and routing
- [ ] Independent tutors and centre administrators use the educator registration experience; centre name appears only for the centre path.
- [ ] Students coming from programme enrollment links see programme details before authentication.
- [ ] Students invited by an independent tutor or centre administrator see a validated invitation preview before proceeding.
- [ ] Student flows never ask the user to select Student/Tutor/Centre.
- [ ] Login and registration both support Google and email/password according to the current backend capabilities.
- [ ] Google OAuth returns the user to the correct programme, invitation, setup step, or intended destination.
- [ ] Existing signed-in users do not have to reauthenticate unnecessarily, and already-enrolled/accepted users are handled sensibly.
- [ ] Invalid, expired, revoked, already-used, email-mismatched, and temporarily unavailable cases have accurate copy and recovery actions.
- [ ] Password recovery follows the correct code/session sequence and handles expired recovery sessions.
- [ ] Legacy routes and previously sent invitation links continue to work or have a deliberate compatible redirect.

### UI, state, and accessibility
- [ ] Every form has visible labels, useful inline errors, busy states, and duplicate-submit protection.
- [ ] Password visibility toggles work with mouse, touch, and keyboard.
- [ ] Code fields support pasting a complete code and keyboard/screen-reader navigation.
- [ ] Focus moves appropriately after validation failures and asynchronous state changes are announced accessibly.
- [ ] Optional profile fields are marked optional and do not block continuation.
- [ ] No raw provider errors, stack traces, tokens, or internal state names appear in the UI.
- [ ] No horizontal overflow or clipped controls at 320 px, 375 px, tablet widths, and desktop widths.
- [ ] Google and email flows use consistent branding and the supplied colors without compromising contrast.

### Engineering quality
- [ ] Current auth API/service behavior is reused unless a change is justified and tested.
- [ ] No mocked success, fake invitation/programme metadata, invented API endpoints, or bypassed authorization checks.
- [ ] Route guards and return-to handling are tested.
- [ ] Relevant existing tests pass; add/update tests for changed branching logic and state handling.
- [ ] Report the routes/components changed, tests run, known gaps, and any backend/product decision still required.

---

## 11. Recommended implementation order

1. **Audit:** inspect all current routes/components, state flows, Supabase configuration, invitation/enrollment calls, route guards, and tests. Record a concise current-state map.
2. **Define shared visual primitives:** auth layout, form fields, password field, Google button, code input, alert, loading CTA, programme/invitation summary. Reuse existing project components when possible.
3. **Fix shared sign-in and auth continuation:** Google/email alternatives, readable errors, safe redirects, callback handling, and recovery entry.
4. **Fix educator registration:** account type selected before auth; preserve it through both Google and email/password flows.
5. **Fix student enrollment/invitation flows:** ensure the entry context is retained, role selection is omitted, policy checks are enforced, and success lands in the right place.
6. **Fix verification and password recovery:** correct order and recovery states, aligned to the backend's real session/code implementation.
7. **Unify account setup and legacy invitation routes:** keep compatibility without retaining needless duplicate experiences.
8. **Responsive/accessibility pass:** test actual widths and keyboard flows.
9. **Validation:** run existing tests, add route/state regression tests, and manually walk each journey from a fresh session and a returning session.
10. **Report:** summarize what changed, how to test it, and any unresolved backend/product constraints. Do not claim a state is implemented if it is only visually mocked.

## 12. Final product model

**Two registration experiences. One shared sign-in system. Two student entry paths. One canonical invitation acceptance experience. One coherent recovery system.**

- Educators start from `/auth/register` and choose independent tutor or tutorial centre.
- Students arrive through a programme enrollment page or a personal invitation from a tutor/centre administrator.
- Google and email/password are alternative authentication methods, not consecutive screens.
- Authentication preserves intent; authorization determines what the person can actually join or access.
- Every error explains the problem in human language and offers the next safe action.
- The design remains recognizably Kanvise across desktop, tablet, and mobile.
