# Authentication — responsive

Routes: `/login`, `/signup`, `/auth/forgot-password`, `/auth/set-password`, `/auth/confirm-signup`, `/auth/accept-invite`, `/auth/two-factor-reset`, `/auth/confirm-email-change`, `/activate`, `/oauth/authorize`, `/recording-consent`

Purpose: Map Bobbin's public authentication, invitation, recovery, consent, reauthentication, and first-time organization setup surfaces across desktop (1440×1000), tablet (834×1112), and mobile web (390×844). Every documented state has one screenshot and one machine-readable evidence record per viewport.

## Capture method and evidence boundary

- Public default, notice, referral, invalid-link, and reauthentication redirects were captured from Bobbin's live production frontend.
- Outcomes that require a reusable email token, a two-factor-enabled account, throttling, or a one-time mutation were reproduced with controlled API responses against Bobbin's unmodified production frontend bundle. Their atlas titles and summaries explicitly say `controlled response`.
- Controlled states do not claim that a real invitation, consent, password reset, or two-factor reset occurred.
- First-time setup was rendered in the authorized account by resetting only the setup-completion read model. The checklist and forms are Bobbin's live production UI; no client, tutor, student, course, or lesson was submitted.
- Synthetic addresses and organization/person names are non-deliverable test fixtures. No credential, reusable session, real reset token, or real invitation token is stored here.

## Responsive behavior

At the desktop breakpoint Bobbin uses a split authentication layout: a photographic marketing panel with flow-specific headline, explanation, and bullets occupies the left half; the form occupies the right half. Tablet and mobile remove the marketing panel and center the same form in a single cream column. Tablet retains comfortable paired fields on longer forms, while mobile collapses content into a narrow single-column reading order. Core labels, controls, notices, recovery routes, legal links, and error copy remain consistent across breakpoints.

## Page: Login (`/login`)

Layout: Bobbin logo, welcome heading, email and password fields, password visibility control, primary Log in action, TutorCruncher alternate login, signup link, and legal links. Desktop adds the split marketing hero.

Controls and behavior: Forgot password opens the recovery flow. Show password toggles masking. Successful password verification may transition to a six-digit authenticator challenge. The challenge offers recovery-code entry and a route back to login. Protected `/activate`, `/oauth/authorize`, and `/auth/confirm-email-change` requests redirect unauthenticated users back to Login while retaining a `redirect_url`.

States: default; password visible; invalid credentials; email changed; email reset; signup unavailable; authenticator code; recovery code; invalid authenticator code; protected-route reauthentication.

Session behavior: Bobbin has no distinct signed-out or session-expired page in the observed route bundle. Logout clears the local token and redirects to `/login`; an unauthorized protected route likewise resolves through Login with its intended destination retained where applicable. The resulting Login surface is already captured at every viewport.

## Page: Sign up (`/signup`)

Layout: account form for first name, last name, email, company, country, telephone country code and number, marketing consent, mandatory policy acceptance, Turnstile, and Create account. The submit action remains disabled until required conditions are met.

States: default and invalid referral warning. Successful signup email delivery was not triggered because it would create another live organization/account and send email; the downstream confirmation/password screen is captured independently.

## Page: Password recovery (`/auth/forgot-password`)

Layout: email form and Back to login. `audience=client` changes the headline and guidance from forgotten-password recovery to first-time password setup for recipients of lesson emails.

States: standard recovery, client first-time setup, privacy-preserving success, and rate limiting. The success screen says the link expires after 48 hours and can be used once. Success and throttling use controlled responses and send no email.

## Page: Set password (`/auth/set-password`)

Layout: token-bound password and confirmation fields, password requirements, Set password & log in, and Back to login.

States: missing/invalid link, valid-form presentation, and mismatched-password validation. The valid-form and validation states use a synthetic non-reusable token decoded only by the frontend.

## Page: Confirm signup (`/auth/confirm-signup`)

Layout: new-account password and confirmation fields with Set password & log in.

States: missing/invalid link, valid new-account form, and mismatched-password validation. The valid states use a synthetic non-reusable token and do not submit a signup.

## Page: Accept invitation (`/auth/accept-invite`)

Layout: organization and role-specific invitation decision. Existing accounts see Accept invite and Decline. First-time/unconfirmed accounts must choose and confirm a password before acceptance.

States: invalid link; pending existing-account tutor invitation; pending password-required student invitation; already accepted administrator invitation; declined; withdrawn; expired. Token-gated previews use controlled responses and do not accept or decline a real invitation.

## Page: Two-factor reset (`/auth/two-factor-reset`)

Layout: warning that an administrator requested the reset, Turn off two-factor authentication, and Back to login.

States: invalid link, confirmation, and success. Success uses a controlled response and does not alter any account.

## Page: Recording consent (`/recording-consent`)

Layout: student and organization-specific explanation with a single Give consent action.

States: invalid link, consent request, already given, and success. Token-gated states use controlled responses and do not change real consent.

## Page: First-time organization setup (`/setup`)

Layout: authenticated welcome top bar, five-step progress checklist, walkthrough/video help, demo booking, and plan guidance. The checklist orders client, tutor, student, course, then first lesson.

States: checklist; Add client; Add tutor; Add student; New course; Course & attendees lesson step. All six states are captured at desktop, tablet, and mobile. The forms were opened against a controlled incomplete setup read model and closed without submission.

## Screenshots

`screenshots/` contains 132 captures: 44 states × desktop, tablet, and mobile. `evidence/` contains the corresponding titles, final URLs, visible text, headings, and control inventories. The three capture manifests record public, token-gated, and authenticated-setup provenance.

## Notes

- TutorCruncher login is an external authentication boundary and was not followed into TutorCruncher's product.
- Valid email-change confirmation and valid OAuth consent require an authenticated, purpose-bound token/session combination; their unauthenticated reauthentication boundaries are captured, but synthetic success was not claimed.
- Bobbin's frontend source exposes additional dead-link and already-used copy for some token routes. Only states rendered and evidenced in this corpus are treated as walked.
