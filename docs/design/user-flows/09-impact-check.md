# What D-22 and D-29 could break, and what I did about it

Written 28 Nov 2026, after the owner asked to think about what the change would
break. I checked the database migrations, engineering standard 03
(authorization and tenancy), and the specs. Status: **Fixed** means the spec text
is changed on this branch.

## The one that would have been serious

**The database allows one role per person per account.** The table
`account_memberships` has `UNIQUE (person_id, school_id)` and a single `role`
column. D-22 said "one login holds two roles". Stored as two membership rows, it
would break the constraint. Stored as a list of roles, it would break every query
that expects one row per person (counts, lists, permission checks), and could
show a person twice.

**Fix (applied, 20 DM-01):** keep one membership row. An admin gets a `can_teach`
flag, set by **Add me as a tutor**. Nothing changes for the person: they still see
two views and **Switch role**. The independent tutor's owner is an admin with
`can_teach` on. Standard 03 already says an admin may teach "where the teaching
capability and resource relationship allow it", so this matches it. A sentence is
added to the list of standard changes (00 section 18).

## Full list

| # | What could break | Why it matters | What I did | Status |
|---|---|---|---|---|
| 1 | Two roles on one membership | Database constraint, duplicate rows in lists | One membership plus `can_teach` (DM-01) | Fixed |
| 2 | **Switch role** treated as a security boundary | If the client chooses its role freely, someone could widen their access. If it is only a UI filter, the "tutor view" is not enforced | The client may only ask for a narrower view. Hono checks the person really has it and applies that view's rules, never wider than their own authority. Per-device preference, not stored in the token | Fixed (DM-01, standard 03 note) |
| 3 | `can_teach` quietly granting course access | Standard 03: an admin does not become a tutor just because nobody else teaches; assignment is the source of truth | Unchanged: `can_teach` only lets them be chosen as a tutor. Access comes from being the course's tutor. For independent tutors, the owner is the tutor on every course they create | Already consistent |
| 4 | **Remove** on the admin's own tutor row | The old text "Remove from agency" would have removed the admin from the whole agency | Rows with the **Admin** chip show **Stop teaching**, which only takes away `can_teach`. Leaving the agency stays on the Team page | Fixed (19 TM-01, TM-10) |
| 5 | Links in the wrong role | A push or email about a tutor-side thing, opened while in the Admin view (or the other way round), would hit "Not available" | The link switches to the needed role with a toast, if the person holds it | Fixed (01 SH-06) |
| 6 | An admin who adds themselves never gets a classroom check | Independent tutors have a setup step for it, invited tutors a Welcome banner. This path had neither | The Welcome banner with **Test classroom** shows on the first visit to the Tutor view | Fixed (03 DB-02) |
| 7 | A concern raised in a team of one goes to the person it is about | Rule is that a concern never reaches the person it is about. For an independent tutor it goes to Kanvise support, but after switching to a team the only admin is the tutor | The recipient list excludes the person concerned. If nobody is left, it goes to Kanvise support | Fixed (07 CR-13, 18 NTF-218) |
| 8 | Switching to a team and back | Pending invitations, courses taught by someone else, wrong labels | **Not built.** There is no upgrade path (owner, 28 Nov): the account type is chosen once and a separate account is the answer. Nothing to break | Removed |
| 9 | Notification settings by role | Rows were shown "by role". An admin who teaches would lose or double rows when switching view | Rows follow what the person can do, in both views | Fixed (12 CFG-N) |
| 10 | Duplicate messages | A person who is both admin and tutor could get two reminders for one lesson | One message per person per event. The reminder goes to the lesson's tutor only (already NTF-208). Tests added | Test added |
| 11 | Typing another admin's email in Add tutor | Would send an invitation to someone already in the agency | Same confirm as for yourself, no email | Fixed (19 TM-10) |
| 12 | Two role views and two accounts | A person who is an admin in one agency and a tutor in another could confuse Switch role with the account switcher | Switch role is per account. Different accounts use the account switcher | Fixed (01 SH-06) |
| 13 | Phones | Where does Switch role live? | In the account menu inside the More sheet, which already holds that menu | Fixed (16) |
| 14 | Team-of-one that started as a team | An owner who picked "With a team" at the start and has no colleagues yet still sees Switch role, which does nothing useful | Accepted. An account that started as a team stays a team, so there is no special case to code | Accepted |
| 15 | **Mine only** toggle and Switch role overlap | Two ways for an admin to see their own lessons | Kept both: Mine only filters the dashboard; the Tutor view changes the whole app. Revisit after use (OQ-16) | Open |
| 16 | Payout account and a name change | If an independent tutor becomes an agency and renames, the verified bank name may not match | Billing is not built. When it is, changing the name asks the owner to check the payout account | Noted for spec 13 |
| 17 | Staging data | Existing independent accounts and their owner membership | No real users, the database can be cleared (owner). The team flag is the existing `schools.account_type` (independent or agency). New work is `can_teach` only | Cheap |
| 18 | More tests | Roles times views times routes | Test cases added: TC-SEC-012, TC-TM-020, TC-TM-021, TC-TM-022, TC-NTF-016 | Done |
| 19 | Audit trail | Actions should record which view was used | Add `acted_as` to activity records when the activity log is built (OQ-09) | Noted |

## What is still open

- **OQ-16:** keep **Mine only** next to **Switch role**, or drop one?
  Recommendation: keep both for now.
