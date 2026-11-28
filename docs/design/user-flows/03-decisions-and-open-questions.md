# Decisions and open questions

Written 28 Nov 2026. The owner said minor gaps can be settled using good product
judgment, and the hard ones confirmed with them. **D-** items below are my
proposals. They change or fill in the specs, so each needs a quick yes or no
from the owner before the spec text is edited. **OQ-** items need the owner.

## Owner answers already given (28 Nov)

- Old data: there are no real users, the database can be cleared, and the move
  from Class to Course is front-end work. The underlying database does not change.
  No migration plan is needed. (I have not touched any database.)
- Payments: design the flow from standard practice. See `04-payments.md`.
- Gamification: design it. See `05-gamification.md`.
- Reports: leave for now.

## Decisions (D-)

| ID | Gap | Decision | Why | Spec to change |
|---|---|---|---|---|
| D-01 | Sign-up, login, forgot-password are not in the specs | Standard flow: sign up, verify email, log in. Forgot password shows the same message whether or not the email has an account. Visual design waits for the Bobbin screenshots | Avoids revealing which emails have accounts | New auth spec |
| D-02 | An admin cannot discover **I teach too** when joining a lesson. CR-09 still says "If you teach this lesson from another account, join from that account instead" (Bobbin's text), but Kanvise has one account | Change the CR-09 line to: **If you teach this lesson, turn on I teach too in your profile.** with a link to CFG-P. Keep the other three places: setup step, Tutors empty state, profile | The old line sends admins to an account that does not exist here. Spec 12 already says this replaces Bobbin's advice, but 07 was not updated | 07 CR-09 |
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

## Open questions for the owner (OQ-)

| ID | Question | My recommendation |
|---|---|---|
| OQ-01 | Which currency will UK and North American families pay in, since Paystack's documents list NGN, GHS, ZAR, KES and USD? | Accept USD at first and check whether a second provider is needed |
| OQ-02 | Who pays the Kanvise fee and the Paystack fee? | Tutor pays; show it before they turn billing on |
| OQ-03 | Payment before the revamp: should the product show any payment step now? | No payment step in the product until the revamp ships. Tutors are paid directly, outside Kanvise |
| OQ-04 | Is there a mascot, or just a profile photo? | Profile photo only |
| OQ-05 | Does an admin with no I teach too see "Summaries to write" and "Homework to mark"? Spec 03 only says "admins who teach" | Show the counts as the agency's totals, labelled for admins |
| OQ-06 | What does a tutor see after being removed from an agency but belonging to another one? | They keep the other account; show the account picker |
| OQ-07 | Reports and weekly digests | Parked by the owner |
| OQ-08 | Gamification: turn on by default for new courses, or off? | Off, tutor opts in |

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
