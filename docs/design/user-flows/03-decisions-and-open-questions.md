# Decisions and open questions

Written 28 Nov 2026. The owner approved decisions D-01 to D-21 on 28 Nov (D-20 and D-21 are the owner's own answers). D-22, D-23, D-29, OQ-12 and OQ-13 were agreed on 28 Nov and applied. They are
applied to the redesign specs on this branch, except D-15 (payments), D-16
(progress features), D-20 and D-21, which are written into the proposals in
`04-payments.md` and `05-gamification.md`, and D-11 and D-14, which need no spec change.
**OQ-** items still need the owner.

Spec files changed: `01`, `02`, `03`, `04`, `05`, `07`, `09`, `10`, `11`, `12`, `13`, `16`, `17`, `18`, `19`, `20`, `00`, and the new
`21-sign-in-and-sign-up.md` (with the `AU` ID prefix in the README and the checker).
The spec checker (`history/check.py`) passes.

## Owner answers already given (28 Nov)

- Old data: there are no real users, the database can be cleared, and the move
  from Class to Course is front-end work. The underlying database does not change.
  No migration plan is needed. (I have not touched any database.)
- Payments: design the flow from standard practice. See `04-payments.md`.
- Gamification: design it. See `05-gamification.md`.
- Reports: leave for now.
- Payments: the payer pays Paystack's fee, and Kanvise's own fee is revisited later (D-21).
- Progress features: on by default (D-20).

## Decisions (D-)

| ID | Gap | Decision | Why | Spec to change |
|---|---|---|---|---|
| D-01 | Sign-up, login, forgot-password are not in the specs | Standard flow: sign up, verify email, log in. Forgot password shows the same message whether or not the email has an account. Visual design waits for the Bobbin screenshots | Avoids revealing which emails have accounts | New auth spec |
| D-02 | An admin cannot discover **I teach too** when joining a lesson. CR-09 still says "If you teach this lesson from another account, join from that account instead" (Bobbin's text), but Kanvise has one account per person | Change the CR-09 line (now: switch to your Tutor role, or add yourself as a tutor first, after D-22 and D-29). Places an admin finds it: setup step, Tutors page and empty state | The old line points to another account that does not exist in Kanvise. In Bobbin it means the Switch role menu (atlas 17), so under D-22 the line says to switch role | 07 CR-09 |
| D-03 | Invited admin's first screen is unspecified | Same as an invited tutor: skip onboarding and `/setup`, land on the dashboard in admin view with a Welcome banner pointing to Team and Tutors | Keeps one pattern for everyone invited | 02, 03 |
| D-04 | Spec 19 says both "one tutor per course" ("Replaces Priya Shah") and "several" | A course can have several tutors. Each lesson has exactly one. Remove the "Replaces" wording from TM-03 | 00 section 2 and DM-03 already say one or more tutors | 19 TM-03 |
| D-05 | Student with several tutors: spec 09 groups by tutor in one place and switches by tutor in another | One Home. Courses grouped by tutor, plus a tutor filter. No account switching for students | Simpler for a phone user | 09 SA-07, SA-10 |
| D-06 | Homework Close is undefined, and late hand-ins are allowed | Late hand-ins are allowed and flagged Late until the tutor presses Close. Close stops new hand-ins; students can still view their work. A closed homework can be reopened with Extend due date | Matches common practice and the existing "Late" flag | 10 HW-03, HW-04 |
| D-07 | Quiz after due date or when closed is undefined | A student can still start after the due date, flagged Late, until the tutor closes the quiz. Close blocks new starts; in-progress attempts can still be handed in | Same rule as homework | 11 QZ-05, QZ-06 |
| D-08 | Student has no state for a recording that is not available | Show "No recording for this lesson" with no reason | Does not reveal which students did not consent | 09 SA-05, 17 REC-08 |
| D-09 | Tutors only see "lesson not held" and "recording failed" if they open the right page | Add push for both, on by default, switchable in CFG-N | Real problems should not wait to be found | 18, 12 CFG-N |
| D-10 | Email change notifies only the new address | Also notify the old address | Standard account-takeover protection | 18 NTF-112 |
| D-11 | No quiet hours | Not in this version | Not needed for launch | none |
| D-12 | Student invitation expiry is not stated | 7 days, same as tutor links; the 72-hour reminder stays | One rule | 06, 18 |
| D-13 | After a cancel and Undo, are join links back? | Links stop working only when the 5-minute undo window closes, so Undo restores them | Matches how held messages already work | 05 LP-04, LP-05 |
| D-14 | Old data migration | None needed (owner) | Owner | none |
| D-15 | Payments | Proposal in `04-payments.md` | Owner asked for it | 13 |
| D-16 | Gamification | Proposal in `05-gamification.md`, no leaderboard | Owner asked for it, plus research | new |
| D-20 | Should progress features be on or off for new courses? | **On by default** for every new course (owner, 28 Nov). The tutor can switch it off per course or for the whole account | Most students benefit and it asks the tutor for nothing. Supersedes OQ-08 | `05-gamification.md` |
| D-21 | Who pays Paystack's fee? | **The payer** (owner, 28 Nov). Kanvise's own fee is revisited later | Tutors keep the full price of their lessons | `04-payments.md`, 13 |
| D-22 | How should an admin who teaches, and an independent tutor, work? | **Approved 28 Nov:** one login holds roles (admin, tutor, student) in an organisation. An independent tutor is an organisation of one with both roles and one merged view. An admin who teaches gets **Switch role** (Bobbin's tested behaviour) | Same code for both, the tutor view reused as is, simpler permission checks | `06-account-types.md`, 01, 07, 12, 19 |
| D-23 | Tutor invitations: can the person decline? | **Agreed 28 Nov, applied:** yes, with declined and withdrawn states, as Bobbin has | Cheap, and the admin sees what happened | 19, 21 |
| D-24 | Bobbin's AI plan lets you leave the page while it drafts. Kanvise's dialog did not say | Kavi finishes in the background, saves a Draft and sends **Kavi's draft is ready**. Fallback if the build cannot: ask the tutor to stay on the page for about a minute | Tutors on phones will leave the page | 04 CRS-06, 18 NTF-305 |
| D-25 | Bobbin applies an AI plan at once. Kanvise saves a Draft first | Keep Kanvise's way: **Use this plan** is the tutor's decision | The tutor owns the plan | none |
| D-26 | Bobbin shows why each module sits where it does | Kavi-drafted modules carry a one-line **Why this order**, editable | Helps a tutor judge a draft quickly | 04 CRS-04 |
| D-27 | Removing a module or topic that is in use | Ask first and say what depends on it; unused items go with an Undo toast | Stops accidental loss of statuses and links | 04 CRS-04 |
| D-28 | The screen-by-screen view for independent tutor, agency admin and agency tutor | Written in `07-screens-by-account-type.md`: roles plus one team switch decide every screen | Shows what changes on each screen | `07-screens-by-account-type.md` |
| D-29 | Remove the **I teach too** toggle | **Approved 28 Nov, applied:** **Add me as a tutor** (setup step, Tutors page, or your own email in Add tutor) adds the Tutor role with no email. **Switch role** moves between views | One path instead of two | 19 TM-10, 12 CFG-P, 01 SH-06, 02, 04, 05, 07, 17, 18, 20 |
| D-30 | How is the dual role stored? | One membership per person per account plus an admin-only `can_teach` flag, not two roles. Switch role can only narrow authority | The database already enforces one membership row, and standard 03 treats admin teaching as a capability | `20` DM-01, 00 section 18 |
| D-31 | An admin's own row on the Tutors page | The action is **Stop teaching**, never **Remove from agency** | Avoids removing an admin from the agency by accident | 19 TM-01, TM-10 |
| D-32 | Concerns in a team of one | Exclude the person concerned; if nobody is left, Kanvise support | A concern must never reach the person it is about | 07 CR-13, 18 NTF-218 |
| D-33 | Moving from independent tutor to agency | **No upgrade path (owner, 28 Nov).** The account type is chosen once in onboarding, which says so under the question. Someone who wants an agency creates a separate account. Revisit only if people ask | Fewer screens and rules; nothing to migrate | 02 ONB-02, 12 CFG-T, 19 |
| D-34 | Where is Create another account? | **Owner agreed 28 Nov, applied:** at the bottom of the account switcher (01 SH-07), same login, starts at onboarding (02 ONB-12). Tutors and admins always see the account card chevron. Signing up again with another email is still allowed | A second account without a second login | 01 SH-02, SH-07, 02 ONB-12 |
| D-17 | Settings group names are unclear: YOUR TEACHING covers agency-wide settings and shows for admins who do not teach. Teaching preferences holds team size, audience and subjects | Rename groups: YOU becomes **PERSONAL**, YOUR TEACHING becomes **LESSONS**, ACCOUNT stays. Rename Teaching preferences to **How you teach**. Leave Lessons and classroom, and Data and privacy as they are | The names now say what is inside | 12 Layout, CFG-T |
| D-18 | Business details asks independent tutors for a name and photo twice (CFG-P and CFG-A). "Business" does not fit a tutor, and "Account details" reads like bank details | One shared section called **General** with the **same four fields for everyone**: name, logo (optional), country and currency, timezone. For an independent tutor the name starts as their own name (for example "Alex Thompson Tutoring", as the sidebar already shows) and the logo falls back to their profile photo. Revised on 28 Nov: the earlier version hid fields for independent tutors, which added conditions and lost the tutoring name | One screen, no conditions, nothing asked twice | 12 CFG-A |
| D-19 | Design principle, not a screen: prefer one component with conditions over parallel screens for each account type | Where independent tutors and agencies differ, show or hide fields and rows on the same screen. Build separate screens only when the task is different (for example Tutors and Team pages, which only agencies have). AI makes writing code cheaper, but every extra variant still has to be tested, kept in sync and explained to users | Balances product design with build and maintenance cost | All specs |

## Open questions for the owner (OQ-)

| ID | Question | My recommendation |
|---|---|---|
| OQ-01 | What price do families abroad see? Paystack's support page says cards from anywhere work, a Nigeria-based business is charged and paid in NGN by default, and USD payouts need a Zenith USD account. GBP is not offered | NGN for everyone at first, then USD for payers abroad once a USD account exists. Kanvise holds the Paystack account (owner, 28 Nov), so Kanvise's country sets the rules |
| OQ-02 | Kanvise's own fee (the Paystack fee is paid by the payer, D-21) | Decide later, as the owner said. Show it on its own line when it exists |
| OQ-03 | Payment before the revamp: should the product show any payment step now? | No payment step in the product until the revamp ships. Tutors are paid directly, outside Kanvise |
| OQ-04 | Is there a mascot, or just a profile photo? | Profile photo only |
| OQ-05 | Does an admin who is not also a tutor see "Summaries to write" and "Homework to mark"? Spec 03 only says "admins who teach" | Show the counts as the agency's totals, labelled for admins |
| OQ-06 | What does a tutor see after being removed from an agency but belonging to another one? | They keep the other account; show the account picker |
| OQ-07 | Reports and weekly digests | Parked by the owner |
| OQ-08 | Gamification: turn on by default for new courses, or off? | Answered: on by default (D-20) |
| OQ-09 | Agency settings Bobbin has and Kanvise lacks: an activity log (who changed what), role checkboxes for who can view recordings, and an organization-wide recording-consent default | Add an activity log for agencies later. Keep the single recordings switch and per-student consent for now |
| OQ-10 | A wording pass over every label and message that tutors, students and admins read, with a short glossary of plain terms | Do it before the first screens are built |
| OQ-11 | Fee line on invoices: the fee depends on the card, which is unknown until the payer pays; and UK law bans card surcharges on consumers (since 13 Jan 2018) | Estimate by payer region, built into one total for payers abroad with no separate card-fee line, and have a lawyer check the UK and other countries |
| OQ-12 | Payout bank account: one per organisation, or one per tutor in an agency? | **Agreed 28 Nov, applied in 13 BL-01:** one per organisation. The agency pays its own tutors |
| OQ-13 | Is the chosen role (Admin or Tutor) remembered at the next sign-in? | **Agreed 28 Nov:** yes, per device. Goes into the specs with D-22 |
| OQ-14 | Plan history (view and restore earlier versions of a course plan), as Bobbin's History menu | Later |
| OQ-15 | Is there a limit on Kavi plan drafts per tutor per day, and do we show how many are left? | Decide with the Kavi cost work (20 DM-26) |
| OQ-16 | Keep **Mine only** on the admin dashboard now that Switch role exists? | Keep both for now and revisit after use |
| OQ-17 | How does a signed-in person create a second account? | **Answered 28 Nov (D-34):** a **Create another account** item in the account switcher; signing up again with another email stays possible |

## Contradictions found in the specs

These are small fixes to the spec text. None needs a decision.

1. 07 CR-09 vs 12 CFG-P: see D-02.
2. 19 TM-03 vs TM-06: see D-04.
3. 18 NTF-08 says opening the bell list marks everything read; NTF-09 says
   opening an item marks it read. Pick one (suggest: opening the list marks
   all as seen, opening an item marks it read).
4. 18 NTF-02 numbering runs 1, 2, 4, 3, and the sentence "Kanvise never
   chases" is not true of NTF-304, NTF-212 and NTF-501. Reword to "never chases
   students."
5. 18 NTF-109: the removed team member's email is described as sent
   immediately and also as not sent if removed first.
6. 04 CW-3 says nothing is sent when a course is created, but the inline Add
   student form sends the invitation at once.
7. 05 LW-2 reads "Next" topics, but 04 says scheduling never sets Next.
8. 16-responsive says it covers 01 to 15, and 17, 18, 19 have no rows in R-07.
9. 12 CFG-P says the account menu opens profile; the fix pass says the account
   menu only signs out.
10. DB-03 says the restart window is 60 minutes; 00 section 14e gives no limit.
11. HANDOFF says "two dashboard rows ship one step before the join links they
    need" (v3 note 1): Links to send and Lessons that didn't start (step 4) point
    at join links that arrive in step 5.

## Not decided yet because they depend on build

- Whether the starting check or the dashboard rows ship in a different step than
  HANDOFF says (v3 notes 1 to 5 in SESSION-HANDOFF).
