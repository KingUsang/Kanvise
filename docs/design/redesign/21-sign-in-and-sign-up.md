# 21 · Sign up, sign in and password reset

Status: draft for owner review. Builds on `00-decisions.md` (§14a), `02-onboarding-and-setup.md`,
`09-student-app.md` (SA-01), `18-notifications.md` (NTF-113, NTF-114) and `01-app-shell.md`
(SH-14b).

**Who:** everyone. Tutors and admins sign up; students are invited and never sign up
themselves (00 §14a).
**Goal:** get in with as few steps as possible, and never reveal whether an email has an
account.

**Look and layout:** waiting for the owner's Bobbin screenshots. This file fixes the
flow and the words only. The current screens stay until then.

## Flow at a glance

```
Sign up (tutor or admin) → AU-02 Check your email → link → 02 ONB-01
Sign in → AU-03 → dashboard (or /setup until done), or student Home (09 SA-03)
Forgot password → AU-04 → email (NTF-114) → AU-05 → AU-03
Session runs out → 01 SH-14b → back to the same page
```

## AU-01 · Sign up (tutors and admins)

- Title **Create your Kanvise account**. Fields: **Name**, **Email**,
  **Password** (8+ characters, show/hide eye). Button **Create account**. A line
  under it: **Already have an account? Sign in.**
- Errors, inline: **Add your name.** · **Enter a valid email.** · **Use at least 8
  characters.** An email that already has an account says **Check your email.**
  and sends the same message as AU-02 with a sign-in link, so nobody can tell
  which emails exist.

## AU-02 · Check your email

- **Check your email.** "We've sent a link to casey@example.com. Open it to
  finish creating your account." Buttons **Open email app** (on phones) and
  **Resend email** (once a minute).
- An expired link says **This link has expired.** with **Send a new link**.

## AU-03 · Sign in

- Title **Welcome back**. Fields **Email**, **Password**. Button **Sign in**. Links
  **Forgot password?** and, for tutors, **New here? Create an account.**
- A wrong email or password says **That email or password isn't right.** It never
  says which one.
- After five wrong tries in a few minutes: **Too many tries. Try again in a few
  minutes, or reset your password.**
- A person with more than one account sees the account picker next (01 SH-07).
- Where they land: tutors and admins with setup unfinished go to `/setup`, otherwise
  the dashboard. Students go to Home. A link they came from (email, push) opens
  after sign-in.

## AU-04 · Forgot password

- Title **Reset your password**. Field **Email**. Button **Send reset link**.
- Always the same answer, whether or not the email has an account: **If an account
  exists for that email, we've sent a link.**
- The email is NTF-114.

## AU-05 · Set a new password

- From the emailed link. Title **Choose a new password**. Field **New password**
  (8+ characters, show/hide eye). Button **Save password**.
- Done: **Password changed.** with **Sign in**. NTF-113 confirms by email.
- An expired or used link: **This link has expired.** with **Send a new link**.

## AU-07 · Invitation page (tutors and team members)

From the emailed link (19 TM-11, 18 NTF-104, NTF-105).
- Title **Science Students Academy invited you to teach on Kanvise.** (or **to join
  the team**). A person who already uses Kanvise signs in first, then sees
  **Accept** and **Decline**. A new person chooses a password (8+ characters) and
  presses **Accept and create account**; **Decline** is a quiet link under it.
- After **Accept**: a tutor goes to ONB-10, an admin to the dashboard.
- After **Decline**: **You've declined this invitation.** The admin sees **Invite
  declined** (19 TM-01).
- Link problems: **This invite has expired. Ask Science Students Academy to send
  a new one.** · **This invitation was withdrawn.** · **This invitation has already
  been accepted.** with **Sign in**.

## AU-06 · Signed out while working

The dialog and rules are 01 SH-14b: the page stays, typed text is kept on the
device, and signing in returns to the same page.

## Students

Students do not use AU-01. They arrive by invitation (09 SA-01), sign in with AU-03 and
reset with AU-04 and AU-05. A student invited by a second tutor follows **Sign in
instead** (09 SA-01).

## Checked against Bobbin

Not yet. The sign-in and sign-up screenshots are the owner's to supply.
