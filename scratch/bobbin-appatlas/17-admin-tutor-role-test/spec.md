# Administrator + tutor dual-role verification

Routes: `/tutors`, `/`, `/auth/me/switch-role`

Purpose: Verify, with the live test organization and the existing administrator identity, how Bobbin grants a tutor role and whether the person must use role switching to enter the tutor workspace.

## Live result

Entering the existing administrator email in **Tutors → Add tutor** does not follow the ordinary new-user invitation path. Bobbin first resolves the existing identity and changes the form to an explicit safeguard:

> Emmanuel Usang is already an admin here. Add them as a tutor too? They keep their own name.

The confirmation action becomes **Add Emmanuel Usang as a tutor**. Confirming it created the tutor with HTTP 201 and displayed **Tutor created**. No mailbox acceptance was required.

The following clean login returned two memberships for the same organization and identity: `administrator` and `tutor`. The account menu exposed **SWITCH ROLE — Admin / Tutor**. Selecting Tutor called `/auth/me/switch-role` successfully (HTTP 200), returned to the dashboard, and changed the active shell to **Tutor · Science Students Academy**. Selecting Admin called the same endpoint successfully and restored the administrator shell.

## Practical role difference observed on the same identity

Tutor mode removed Clients, Tutors, Team, Report approvals, Safeguarding, Unlinked sessions, and organization settings from the navigation. It retained Dashboard, Calendar, Lessons, Courses, Students, Recordings, Resources, and personal Settings. Its dashboard showed the teaching schedule and reports-to-write queue.

Admin mode restored the organization-wide people, review, safeguarding, session-linking, and organization-settings surfaces.

## Answer

Bobbin does not require a second account or email acceptance when an existing administrator is added as a tutor in the same organization. It does require the user to select **Tutor** under **Switch role** to activate the tutor workspace and tutor navigation. The switch is reversible and uses the same login.

## Evidence

- `admin-tutors--same-email-form-filled.png` — ordinary form before identity resolution.
- `admin-tutors--same-email-confirmation.png` — explicit existing-admin safeguard.
- `admin-tutors--same-email-submit-result.png` — successful creation/loading state and toast.
- `admin-tutors--same-identity-linked.png` — same identity listed as tutor.
- `admin-account-menu--after-tutor-link.png` — Admin/Tutor role switch exposed.
- `dual-role--tutor-mode-live.png` — tutor shell and teaching dashboard.
- `dual-role--tutor-menu-live.png` — Tutor active in the role menu.
- `dual-role--admin-restored-live.png` — restored admin shell.

Credentials and session tokens were accepted only through the test harness's standard input and were not written to this section.
