# QA test plan

Test cases for every flow in `../01-user-flows.md`, tied to spec IDs in
`docs/design/redesign/`. Written 28 Nov 2026 from the redesign specs. Nothing
in the redesign is built yet, so these are written to the spec, not to
running code. Cases marked **(D-nn)** test a proposed decision and must change
if the owner decides otherwise (`../03-decisions-and-open-questions.md`).

## How to use this

- **Priority:** P0 blocks a release. P1 must pass before launch. P2 is checked
  each release but does not block.
- **Level:** where the case is cheapest to automate.
  - **DB**: pgTAP, database rules and permissions.
  - **API**: Vitest, server rules, clocks, tokens.
  - **E2E**: Playwright, real browser. Multi-role cases use two browser contexts.
  - **Device**: real phone, BrowserStack or a physical device.
  - **Manual**: needs a person (real audio, screen reader feel, copy review).
- **Case ID** goes in the test title so a failure leads back here and to the spec.
- Build order matters. Do not run a case before the step that builds it
  (HANDOFF.md, build order).

## Test accounts

| Name | Setup |
|---|---|
| `solo` | Independent tutor, one course, two students (one with email, one without) |
| `agency` | Agency with admin `adm`, tutors `tutA` and `tutB`, an admin who has added themselves as a tutor `adm2` |
| `stuE` | Student with account |
| `stuN` | Student without email |
| `other` | A second agency, for isolation tests |

## Reading the tables

Steps are short. Expected results use the spec's wording where the spec gives
it, in quotes.

---

## AUTH · Sign up, login, recovery (flow 01, 02)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-AUTH-001 | Sign up and verify | Register, open email link | Lands on ONB-01 | P0 | E2E |
| TC-AUTH-002 | Verification link expired | Open an old link | Expired message, resend works (D-01) | P1 | E2E |
| TC-AUTH-003 | Wrong password | Log in with a wrong password | Generic error, no hint whether the email exists | P0 | E2E, API |
| TC-AUTH-004 | Forgot password, unknown email | Submit an email with no account | Same message as a known email, no email sent | P0 | API |
| TC-AUTH-005 | Reset link reused or expired | Use the link twice, then after expiry | "This link has expired", can request again | P1 | API |
| TC-AUTH-006 | Password change email | Reset a password | NTF-113 sent to the account | P1 | API |
| TC-AUTH-007 | Session expiry mid-form | Expire the session while typing | SH-14b dialog, page stays, typed text kept, sign in returns to same page | P1 | E2E |
| TC-AUTH-008 | Two accounts | Sign in as a user in two agencies | SH-07 picker, switching shows a toast | P2 | E2E |
| TC-AUTH-009 | Deep link while signed out | Open a push or email target | Sign in, then land on the target | P1 | E2E |

## ONB · Onboarding and setup (flow 01)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-ONB-001 | Solo happy path | Answer five questions | Saved, SET-01 shows the 5-item solo list | P0 | E2E |
| TC-ONB-002 | Team path | Answer "with a team", ONB-07 | Agency list shown, Tutors and Team in nav | P0 | E2E |
| TC-ONB-003 | Agency name rules | Empty, 1 char, 81 chars | "Add your agency's name." for invalid | P1 | E2E |
| TC-ONB-004 | Skip setup | Press Skip | Defaults applied, setup card stays in sidebar | P1 | E2E |
| TC-ONB-005 | Save fails | Fail the save call | Inline error, Try again, Continue with defaults, then banner linking to Settings | P1 | E2E |
| TC-ONB-006 | Form variant | Use ONB-11 | Same answers saved as chat | P2 | E2E |
| TC-ONB-007 | Reduced motion | Enable reduced motion | Kavi lines appear at once | P2 | E2E |
| TC-ONB-008 | "Yes, I have students" | Choose it | Add student opens on Import tab, no sample banner | P1 | E2E |
| TC-ONB-009 | "Not yet" | Choose it | Sample course created, banner shown | P1 | E2E |
| TC-SET-001 | Steps tick | Finish "Add students" elsewhere | Ticks when `/setup` is shown again, sidebar count live | P1 | E2E |
| TC-SET-002 | Plan step skippable only | Try to skip others | Only Build the plan can be skipped | P2 | E2E |
| TC-SET-003 | Sample never ticks | Use the sample course | No step ticks | P1 | E2E |
| TC-SET-004 | All done | Complete five steps | SET-03, then `/setup` redirects to dashboard | P1 | E2E |
| TC-SET-005 | Disabled with reason | No course yet | "Create a course first." shown as text | P2 | E2E |

## INV · Invitations (flow 03)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-INV-001 | Student accepts | Add student with email, open email, set password | SA-03 Home | P0 | E2E |
| TC-INV-002 | Invitation expired | Use an expired link | "This invitation has expired. Ask {tutor} to send a new one." | P0 | API, E2E |
| TC-INV-003 | Resend | Tutor resends | New link works, old link does not | P0 | API |
| TC-INV-004 | Resend too soon | Resend within 1 hour | Button "Sent less than an hour ago." | P2 | E2E |
| TC-INV-005 | 72-hour reminder | Advance clock | One reminder, never again; a resend restarts the wait | P2 | API |
| TC-INV-006 | No email | Add `stuN` | No invite, join and check links work, no Home | P0 | E2E |
| TC-INV-007 | Add email later | Edit `stuN` | Invitation sent, past summaries appear, past homework does not | P1 | E2E |
| TC-INV-008 | Second tutor invites same student | Invite existing user | "Sign in instead", both tutors on picker | P1 | E2E |
| TC-INV-009 | Tutor invite new user | Accept | Set password, ONB-10, Welcome banner | P0 | E2E |
| TC-INV-010 | Tutor invite existing user | Accept | Signs in, agency added to picker | P1 | E2E |
| TC-INV-011 | Invite rate limit | Send 51 in an hour | Message, values kept | P2 | API |
| TC-INV-012 | Removed before accepting | Revoke then open | Expired message | P1 | API |
| TC-INV-013 | Invited admin (D-03) | Accept | No onboarding, no setup, admin dashboard with Welcome | P1 | E2E |
| TC-INV-014 | Link single use | Use an accepted link again | Not available | P0 | API |
| TC-INV-015 | Email on student's own email as tutor | Add a student's email as a tutor | Refused with message | P1 | API |

## CRS · Courses and plan (flow 04)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-CRS-001 | Create course | Three-step wizard | Course page opens, "Nothing is sent to students" for existing ones | P0 | E2E |
| TC-CRS-002 | Validation | Skip each field | "Add a course name.", "Choose a subject.", "Choose at least one student.", "Choose at least one tutor." | P1 | E2E |
| TC-CRS-003 | Inline add student | Add during CW-2, then abandon | Invitation already sent (documents the spec's behaviour) | P2 | E2E |
| TC-CRS-004 | Trial course | Switch on, no name | Name "Trial: {student}", plan and check cards hidden | P1 | E2E |
| TC-CRS-005 | Trial converts | After trial lesson ends | Turn into full course, or Archive | P1 | E2E |
| TC-CRS-006 | Group message | Add a second student | "This will be a group course." | P2 | E2E |
| TC-CRS-007 | Agency tutor limits | Log in as `tutA` | No New course, only assigned courses, no archive or delete | P0 | E2E, DB |
| TC-CRS-008 | Plan: Draft with Kavi | Under 20 characters | "Write a little more first." | P1 | E2E |
| TC-CRS-009 | Plan: Kavi fails | Fail the call | Try again or Start blank instead | P1 | E2E |
| TC-CRS-010 | Without Kavi | Kavi service off | Every Kavi button hidden, every flow still completes | P0 | E2E |
| TC-CRS-011 | Draft plan flow | Draft, review, use | Draft then Active, never auto-applied | P1 | E2E |
| TC-CRS-012 | Copy plan | None have plans | "None of your courses has a plan yet." | P2 | E2E |
| TC-CRS-013 | Topic statuses | Hand edit beats proposal | Newest hand change wins, replaced choice flagged | P1 | API |
| TC-CRS-014 | Proposals expire | Advance 30 days | Dropped as "Not reviewed" | P2 | API |
| TC-CRS-015 | Archive with future lessons | Archive | "3 lessons are still scheduled. Cancel them and archive?" | P1 | E2E |
| TC-CRS-016 | Delete after lesson | Try to delete | Disabled, "Archive it instead." | P1 | E2E |
| TC-CRS-017 | Several tutors (D-04) | Add a second tutor | Allowed, no "Replaces" wording, each lesson has one tutor | P1 | E2E |
| TC-CRS-018 | Create fails | Fail the call | "We couldn't create the course. Nothing was saved. Try again." | P1 | E2E |
| TC-CRS-019 | Absent student | Absent from lesson | No status change from that summary | P1 | API |
| TC-CRS-020 | New module appears at once | Press + Module | Module shows immediately, cursor in its name | P1 | E2E |
| TC-CRS-021 | Leave while Kavi drafts (D-24) | Close the dialog mid-draft | Draft saves; "Kavi's draft is ready" arrives; or the stay-on-page line shows | P1 | E2E |
| TC-CRS-022 | Remove a topic in use (D-27) | Remove a topic with statuses and links | Dialog states what depends on it; unused topic removes with Undo | P1 | E2E |

## CHK · Starting check (flow 10)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-CHK-001 | Send and take | Send, student answers | Email and card, one question at a time, no score shown | P0 | E2E |
| TC-CHK-002 | Needs 2 questions | Topic with 1 question | Send disabled, "Needs 2 questions" | P1 | E2E |
| TC-CHK-003 | Link expired | After 14 days | "This link has expired. Ask {tutor} for a new one." | P0 | API |
| TC-CHK-004 | Link replaced | Send again | Old link stops at once | P0 | API |
| TC-CHK-005 | Already done | Open after finish | "You've already finished this check. Thanks." | P1 | API |
| TC-CHK-006 | Rate limit | 11 opens in an hour | "Too many tries. Try again in an hour." | P2 | API |
| TC-CHK-007 | Second device | Open on another device mid-check | Resumes from last question with message | P1 | E2E |
| TC-CHK-008 | Scoring rule | 2 right, 2 wrong, mixed, Not sure | Knows it, Needs work, "Not sure yet" | P0 | API |
| TC-CHK-009 | Dependency skip | Miss a topic | Later topics in module "Skipped" unless marked independent | P1 | API |
| TC-CHK-010 | Proposals not applied | Finish check | No status changes until tutor accepts in Review changes | P0 | E2E |
| TC-CHK-011 | Reminder | Press Send a reminder | Email, or WhatsApp button for no-email student | P2 | E2E |
| TC-CHK-012 | Send fails | Fail the send | "Your questions are saved. Try again." then persistent banner | P1 | E2E |
| TC-CHK-013 | No-email student | Send | Copy and WhatsApp links only, no email | P0 | E2E |
| TC-CHK-014 | Token storage | Inspect DB | Token hashed, scoped to one student, no guest record | P0 | DB |

## LSN · Scheduling and calendar (flow 05)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-LSN-001 | Schedule one lesson | Three-step wizard | Lesson Planned, students notified (NTF-201) | P0 | E2E |
| TC-LSN-002 | Series | Weekly, 10 lessons | One email per series, max 52 | P1 | API |
| TC-LSN-003 | Edit one in a series | Change one lesson | Exception; "This and following" splits series | P1 | API |
| TC-LSN-004 | Reschedule with Undo | Move, press Undo | Nothing sent | P0 | E2E, API |
| TC-LSN-005 | Reschedule without Undo | Move, wait out window | One NTF-202 after the window | P0 | API |
| TC-LSN-006 | Move then cancel | Both within window | Only the cancel message is sent | P0 | API |
| TC-LSN-007 | Cancel with Undo | Cancel, Undo in 5 min | Planned again, no email, links work (D-13) | P0 | E2E |
| TC-LSN-008 | Cancel window closes | Wait out window | NTF-204 sent, join links dead | P0 | API |
| TC-LSN-009 | Time zones | Tutor Lagos, student London | Both times shown, emails add student's time | P0 | E2E, API |
| TC-LSN-010 | Daylight saving | Series across a clock change | Amber notice, series keeps tutor-zone wall time | P1 | API |
| TC-LSN-011 | Clash warning | Overlap | Non-blocking warning | P2 | E2E |
| TC-LSN-012 | Validation | Past time, end before start | Messages from spec | P1 | E2E |
| TC-LSN-013 | No course | No courses | "You need a course first." | P1 | E2E |
| TC-LSN-014 | Booked under 30 min ahead | Schedule | No reminder, join email only | P2 | API |
| TC-LSN-015 | Reminder follows move | Move after booking | Old time's reminder not sent, new one is | P1 | API |
| TC-LSN-016 | Drag fails | Fail the move | Block slides back with message | P2 | E2E |
| TC-LSN-017 | Keyboard move | Press M | Reschedule dialog opens | P2 | E2E |
| TC-LSN-018 | Agency tutor, no course | Click a slot | "Ask your admin to add you to a course." | P2 | E2E |
| TC-LSN-019 | No-email student | Reschedule | "Send on WhatsApp" or "Copy message" after the window | P1 | E2E |
| TC-LSN-020 | Phone calendar | 360 px | Agenda and Day only, move via menu | P1 | Device |
| TC-LSN-021 | Join link per student | Open LP-05 | Copy, WhatsApp, Email; Get a new link replaces old at once | P0 | E2E |
| TC-LSN-022 | Remove from this lesson | Remove a student | NTF-206 sent unless lesson ended | P1 | API |

## CLS · Classroom (flow 06)

Real audio and video are checked manually. Automated runs use fake media devices.

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-CLS-001 | Student goes straight in | Tutor starts, student opens link | In the room, no admit step | P0 | E2E |
| TC-CLS-002 | Before classroom opens | Student opens link early | Waiting card with start time | P1 | E2E |
| TC-CLS-003 | Tutor not started | Student waits | Waiting for tutor, tutor gets NTF-211 | P1 | E2E |
| TC-CLS-004 | Running late | 10 minutes pass | Student card says late, tutor push and email (NTF-212) | P1 | API |
| TC-CLS-005 | Auto-end and restart | Everyone leaves | Ends after N minutes, restart within 60 minutes, one attendance record | P0 | E2E, API |
| TC-CLS-006 | Not held | Scheduled end, never started | Not held, tutor notified (D-09), Start anyway until midnight | P0 | API |
| TC-CLS-007 | Not held actions | Reschedule, Mark as cancelled | Planned, or Cancelled with "Let students know" unticked | P1 | E2E |
| TC-CLS-008 | Second device | Open link on a second device | "Join here instead", first device told, tutor notified | P1 | E2E |
| TC-CLS-009 | Admin joins | Admin opens a lesson they do not teach | "Join as an admin?", Lead preselected, attendance not counted as tutor | P0 | E2E |
| TC-CLS-010 | Admin who is also a tutor | Teach own lesson | Counts as Tutor in attendance | P1 | E2E |
| TC-CLS-011 | Recording rules | Recording off, or a student without consent | Not recorded, reason shown to tutor only | P0 | API |
| TC-CLS-012 | Device check | Run CR-10 | Setup row ticks | P2 | E2E |
| TC-CLS-013 | Whiteboard file limit | 11 MB PDF | "This file is over 10 MB. Compress it first..." | P2 | E2E |
| TC-CLS-014 | Student chips | Send each chip | Once each per lesson, tutor sees it, push (NTF-216) | P2 | E2E |
| TC-CLS-015 | Remind | Tutor presses Remind twice in 5 minutes | Second blocked: "Reminded 4:05 PM" | P2 | E2E |
| TC-CLS-016 | Sign-in expiry in class | Expire session | Lesson keeps running, in-place sign-in in Lesson tools | P1 | Manual |
| TC-CLS-017 | Phone as tutor | 360 px | Laptop advice line shown, Tools sheet works | P1 | Device |
| TC-CLS-018 | Real audio and video | Two people, two devices | Audio, video, whiteboard, screen share work | P0 | Manual |
| TC-CLS-019 | Concern | Report a concern | Goes to admins or support, never to the tutor it is about | P0 | API |

## SUM · After the lesson (flow 07)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-SUM-001 | Complete validation | Complete with nothing ticked | Blocked, needs one ticked "What we covered" | P0 | E2E |
| TC-SUM-002 | Student visibility | Complete | Student sees it only after the undo window, bell and push, no email | P0 | E2E, API |
| TC-SUM-003 | Undo | Press Undo | Back to Awaiting summary, proposals withdrawn, no notification | P0 | E2E |
| TC-SUM-004 | No summary needed | Choose it | Complete, nothing sent to students | P1 | E2E |
| TC-SUM-005 | Missed | Nobody joined | Missed offered only then, schedule a replacement | P1 | E2E |
| TC-SUM-006 | Kavi, recording | Draft from a recording | Draft shown, nothing pre-ticked | P1 | E2E |
| TC-SUM-007 | Kavi, short recording | Under 5 minutes | "too short" message, offer notes route | P1 | E2E |
| TC-SUM-008 | Kavi, no notes | No notes, no recording | Draft disabled with the spec message | P1 | E2E |
| TC-SUM-009 | Private notes | Add notes, Preview, Copy, student view, push | Notes appear in none of them | P0 | E2E, API |
| TC-SUM-010 | Reminder at 24 h | Advance clock | One reminder to the tutor, none if completed | P2 | API |
| TC-SUM-011 | Edit after Complete | Edit | Students see change, bell only, once a day | P2 | API |
| TC-SUM-012 | Copy | Press Copy | Text excludes Lesson notes | P1 | E2E |
| TC-SUM-013 | Review changes | After Complete | Nothing preselected, accept disabled at 0 ticked | P0 | E2E |
| TC-SUM-014 | Without Kavi | Service off | Tutor can write and complete | P0 | E2E |

## HW · Homework (flow 08)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-HW-001 | Set homework | Valid form | "Homework set for 3 students." | P0 | E2E |
| TC-HW-002 | Validation | Each field | Spec messages (title, date, past date, no students) | P1 | E2E |
| TC-HW-003 | No-email student | Open students list | Unticked with reason | P0 | E2E |
| TC-HW-004 | Hand in | Photo and text | "Handed in" with time | P0 | E2E |
| TC-HW-005 | Change my work | Before marking | Tutor sees latest version | P1 | E2E |
| TC-HW-006 | Late hand-in (D-06) | After due date | Allowed, flagged Late, message shown | P1 | E2E |
| TC-HW-007 | Closed (D-06) | Tutor closes | New hand-ins blocked, view still works | P1 | E2E |
| TC-HW-008 | Upload fails | Drop the connection | Files kept, retry | P1 | E2E |
| TC-HW-009 | Offline | Type offline | Saved on device, sent when back | P1 | E2E |
| TC-HW-010 | Mark | Save and next | Student notified once, re-save does not notify again | P1 | API |
| TC-HW-011 | Ask to redo | Press it | Redo asked, student can hand in again | P1 | E2E |
| TC-HW-012 | Remind | Press twice in a day | Second blocked | P2 | API |
| TC-HW-013 | Limits | 11 files, 21 MB, .exe | Spec messages, type checked from contents | P1 | API |
| TC-HW-014 | Edit due date | After marking | No notification for marked work | P2 | API |
| TC-HW-015 | Delete | Delete homework | Confirm, hand-ins removed | P1 | E2E |
| TC-HW-016 | Another student's work | Request their hand-in URL | Not available | P0 | DB, API |
| TC-HW-017 | Review changes | After last mark | Sheet opens, Not now keeps card on HW-03 | P1 | E2E |

## QZ · Quizzes (flow 09)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-QZ-001 | Builder validation | Missing answer, one option, no topic | Spec messages on Continue | P0 | E2E |
| TC-QZ-002 | Take a quiz | One attempt | Autosave, resume, finish check lists unanswered | P0 | E2E |
| TC-QZ-003 | One attempt only | Try again | Not allowed | P1 | API |
| TC-QZ-004 | Score setting | "Score only" vs "Score and answers" | Student sees what the tutor chose | P1 | E2E |
| TC-QZ-005 | Edit after start | Change a correct answer | Blocked, "duplicate it and send the copy" | P1 | E2E |
| TC-QZ-006 | Proposal rule | All right, half or fewer, in between, 1 question | Knows it, Needs work, nothing, nothing | P1 | API |
| TC-QZ-007 | Offline | Answer offline | "Your answers are saved and will send when you're back." | P1 | E2E |
| TC-QZ-008 | Kavi questions | Generate | Marked until checked, warning shown | P1 | E2E |
| TC-QZ-009 | After due date (D-07) | Start after due | Allowed, flagged Late | P1 | E2E |
| TC-QZ-010 | Closed (D-07) | Close before start | Cannot start; in-progress can finish | P1 | E2E |
| TC-QZ-011 | No plan | Course without plan | Kavi blocked, Write my own offered | P2 | E2E |
| TC-QZ-012 | Send fails | Fail the send | Saved as draft, "Try again" | P1 | E2E |
| TC-QZ-013 | Correct answers not exposed | Inspect network before submit | Correct answers not in student payload | P0 | API |

## REC · Recordings and attendance

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-REC-001 | States | Ready, Processing, Not recorded, Failed, Deleted | Each shows its spec text | P1 | E2E |
| TC-REC-002 | Student cannot watch | No consent, or setting off | No recording shown, neutral line (D-08) | P0 | API, E2E |
| TC-REC-003 | Retention | Advance past retention | Recording deleted, summary and attendance stay | P1 | API |
| TC-REC-004 | Manual delete | Delete | No undo, transcript removed, summary stays | P1 | E2E |
| TC-REC-005 | Attendance rules | Late over 10 minutes, left early over 10, rejoins | Statuses and "Rejoined 2 times" | P0 | API |
| TC-REC-006 | Restarted room | Restart | One record per person | P0 | API |
| TC-REC-007 | Extra devices | Second device and added device | Not counted as people | P1 | API |
| TC-REC-008 | Deleted student | Delete a student's data | One-to-one recordings deleted; group kept with name removed | P0 | API |
| TC-REC-009 | CSV export | Over 5,000 lines | Prepared in background, link emailed | P2 | API |
| TC-REC-010 | Agency tutor | Open recordings | Own courses only, no export or delete | P0 | E2E, DB |
| TC-REC-011 | Player error | Fail playback | "This recording couldn't play. Try again." | P2 | E2E |
| TC-REC-012 | Failed recording | Force failure | Tutor told (D-09), students not told | P1 | API |

## NTF · Notifications

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-NTF-001 | Held messages | Move, cancel, in window | Only the final state is sent | P0 | API |
| TC-NTF-002 | Undo sends nothing | Undo in window | No message at all | P0 | API |
| TC-NTF-003 | Reminder rules | 30 min and 24 h | Sent once per student per time; skipped for cancelled, Live, moved | P0 | API |
| TC-NTF-004 | Unsubscribe | Click link, not signed in | Switch off, Undo works; essential emails have no link | P1 | E2E |
| TC-NTF-005 | Push permission | Load pages | Browser permission asked only after pressing Turn on | P2 | E2E |
| TC-NTF-006 | Daily summary | Create overdue items | One email at 7 AM only on days with content | P1 | API |
| TC-NTF-007 | No-email student | Any event | Nothing automatic, tutor sees Copy and WhatsApp | P1 | E2E |
| TC-NTF-008 | Bounce | Simulate | "Email to Casey couldn't be delivered." in Activity | P2 | API |
| TC-NTF-009 | Removed person | Remove tutor with held messages | Held messages dropped | P1 | API |
| TC-NTF-010 | Times | Student in a different zone | Email shows account zone plus student's time; bell shows reader's zone | P1 | API |
| TC-NTF-011 | Grouped hand-ins | 3 hand-ins in 30 min | First at once, rest as one push | P2 | API |
| TC-NTF-012 | Bell state | Open list | Read behaviour per spec fix (see decisions, contradiction 3) | P2 | E2E |
| TC-NTF-013 | Tutor alerts (D-09) | Not held, recording failed | Push sent, switchable | P1 | API |
| TC-NTF-014 | Email change (D-10) | Change email | Old address notified | P1 | API |
| TC-NTF-015 | Invite emails | Each type | Correct sender, button, copy, expiry line | P1 | Manual |
| TC-NTF-016 | One message per person | Admin who is also the tutor | One reminder per lesson, not two; daily summary still sent | P1 | API |

## TM · Admin and team (flow 11)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-TM-001 | Add tutor | Valid | Invite sent, row "Invite not accepted" | P0 | E2E |
| TC-TM-002 | Remove tutor with courses | Remove | Reassign step required, button disabled until all set | P0 | E2E |
| TC-TM-003 | Remove effects | Confirm | Access ends, future lessons keep times, students told, summaries move | P0 | API |
| TC-TM-004 | Remove while teaching | Tutor is Live | Blocked with message | P1 | E2E |
| TC-TM-005 | Add me as a tutor | Press it, confirm | No email sent. Admin in Tutors with chip, wizards, reminders. Switch role appears | P0 | E2E |
| TC-TM-006 | Remove own tutor row | Sole tutor on courses | Choose a new tutor first, saved only after, stays admin | P0 | E2E |
| TC-TM-007 | Last admin | Remove them | No Remove shown, API refuses | P0 | API |
| TC-TM-008 | Agency tutor access | Open Tutors, Team | "Not available" page | P0 | E2E, DB |
| TC-TM-009 | Duplicates | Existing email, student email | Messages from spec | P1 | API |
| TC-TM-010 | Discover the Tutor role (D-02) | Open Join as an admin dialog | Line says to switch to your Tutor role; link to Add me as a tutor if not yet one; no "other account" text | P1 | E2E |
| TC-TM-011 | Invite Again | After removal | Courses not restored | P1 | E2E |
| TC-TM-012 | Admin dashboard | `adm` opens dashboard | Admin rows, Mine only toggle, Live now refreshes every 15 s | P1 | E2E |
| TC-TM-013 | Switch to team | Solo in CFG-T | Set up your team, becomes admin | P1 | E2E |
| TC-TM-014 | Team removal | Remove a team member | Their own row has no Remove; teaching admin goes through Reassign | P1 | E2E |
| TC-TM-015 | Decline an invitation (D-23) | Existing user presses Decline | Admin sees "Invite declined"; Invite again works | P1 | E2E |
| TC-TM-016 | Withdrawn and used links | Open a withdrawn link, then an accepted one | "This invitation was withdrawn." and "...already been accepted." | P1 | API |
| TC-TM-017 | Switch role | Admin with both roles switches to Tutor | Tutor screens only (own courses, no Tutors or Team), toast, user card shows Tutor, remembered next sign-in on this device | P0 | E2E |
| TC-TM-018 | Own email in Add tutor | Admin types their own email | Confirm dialog, no invitation email | P1 | E2E |
| TC-TM-019 | Role in permissions | Tutor role calls an admin-only endpoint | Refused, even though the same login is an admin | P0 | API |
| TC-TM-020 | Link in the other role | Admin in Tutor view opens a push about an admin-only item | Switches to Admin with a toast; if the person holds neither, Not available | P1 | E2E |
| TC-TM-021 | Stop teaching | Admin with the Admin chip row presses Stop teaching | Asks for new tutors if sole tutor; stays an admin; never removed from the agency | P0 | E2E |
| TC-TM-022 | Switch to a team and back | Independent tutor switches, adds and removes people, switches back | Dialogs as spec; blocked while others are active; pending invitations withdrawn with a count; courses and students unchanged | P0 | E2E |

## STU · Student app (flow 12)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-STU-001 | Home states | Before open, starting soon, live, none | Button text per spec (Add to calendar, Join, Join now, "No lesson booked yet.") | P0 | E2E |
| TC-STU-002 | Add student | Valid and invalid | Spec messages | P1 | E2E |
| TC-STU-003 | CSV import | 2 MB, 500 rows limits | Errors per spec | P1 | API |
| TC-STU-004 | Delete a student's data | Type the name | Data deleted, confirmation needed | P0 | E2E |
| TC-STU-005 | Export | Export one student | Emailed link works 7 days | P1 | API |
| TC-STU-006 | Needs work hidden | Tutor sets Needs work | Student sees Taught | P0 | E2E |
| TC-STU-007 | Student isolation | Student A opens B's URLs | "Not available" | P0 | DB, API |
| TC-STU-008 | Several tutors (D-05) | Student of two tutors | One Home, grouped by tutor, filter works | P1 | E2E |
| TC-STU-009 | Past lessons | Each ended status | Summary ready, Done, Waiting for summary, Didn't go ahead, Missed, Cancelled | P1 | E2E |
| TC-STU-010 | Lesson with no summary | Open | "{Tutor} hasn't added a summary yet." | P2 | E2E |
| TC-STU-011 | Recording speeds | Play | 1x, 1.25x, 1.5x | P2 | E2E |
| TC-STU-012 | Install PWA | Install on phone | Opens with own shell | P1 | Device |
| TC-STU-013 | Report a concern | From a lesson | Sent, never visible to the tutor | P0 | API |
| TC-STU-014 | Forgot password | Student flow | Works, same generic message | P1 | E2E |
| TC-STU-015 | Offline | Go offline on Home | Banner, queued work syncs later | P1 | E2E |

## SEC · Security and isolation (cross-cutting)

| ID | Scenario | Steps | Expected | Pri | Level |
|---|---|---|---|---|---|
| TC-SEC-001 | Tenant isolation | Agency A user requests agency B ids | Same "Not available" as missing | P0 | DB, API |
| TC-SEC-002 | Role escalation | Tutor calls admin endpoints | Refused | P0 | API |
| TC-SEC-003 | Token handling | Join, check, invite tokens | Stored hashed, expire, revocable, one purpose | P0 | DB, API |
| TC-SEC-004 | Rate limits | Token guessing, login, invites | Limited, no account hints | P0 | API |
| TC-SEC-005 | Input safety | Script in names, topics, notes | Escaped everywhere, including emails | P0 | E2E, API |
| TC-SEC-006 | CSV injection | Name starting with `=` in an export | Neutralised | P1 | API |
| TC-SEC-007 | File type | Rename .exe to .pdf | Rejected from contents | P0 | API |
| TC-SEC-008 | Private notes | All routes | Student and lesson notes never in student payloads or Kavi except the one allowed draft | P0 | API |
| TC-SEC-009 | Secrets | Scan repo and logs | No keys, no tokens in logs | P0 | Static |
| TC-SEC-010 | Consent | Recording and transcript | Only when every student consented | P0 | API |
| TC-SEC-011 | Existence leaks | Open non-existent vs forbidden | Identical responses and timing class | P1 | API |
| TC-SEC-012 | Role narrowing | Request the Tutor view, then call admin-only routes and ask for other tutors' data | Refused; the Tutor view never returns more than the person's own authority, and a person without `can_teach` cannot ask for it | P0 | API |

## X · Phones, devices, networks, accessibility (cross-cutting)

| ID | Scenario | Expected | Pri | Level |
|---|---|---|---|---|
| TC-X-001 | 360, 768, 1280 px screenshots for every role and main screen | No overlap, nothing cut off, one fixed bottom element | P0 | E2E |
| TC-X-002 | Touch targets | At least 44 px | P1 | E2E |
| TC-X-003 | Slow network (3G profile) | Join flow and Home usable, page weight within budget | P0 | Device |
| TC-X-004 | Low-end Android, Chrome | Student Home, join, homework, quiz work | P0 | Device |
| TC-X-005 | iPhone Safari and installed PWA | Same | P0 | Device |
| TC-X-006 | Keyboard only | Every flow completes, focus visible, dialogs trap focus | P1 | E2E |
| TC-X-007 | Screen reader | Onboarding, wizards, quiz, classroom entry | P1 | Manual |
| TC-X-008 | Reduced motion and data saver | No required animation | P2 | E2E |
| TC-X-009 | Colour and contrast | Meets WCAG AA, status never by colour alone | P1 | E2E |
| TC-X-010 | Offline and save states | Saving, Saved, Saved on this device, Couldn't save, conflict banner | P1 | E2E |
| TC-X-011 | Loading, empty and error on every list | Spec states shown | P1 | E2E |
| TC-X-012 | Disabled actions offline | Complete, Send, Join, Start, Schedule, Cancel, Delete disabled with reason | P1 | E2E |
| TC-X-013 | Time zones | Lagos, London, New York, Auckland users; midnight and DST edges | P0 | API |
| TC-X-014 | Browser back and refresh in wizards | No lost or duplicated data | P1 | E2E |

## PAY · Payments (proposal, build later)

| ID | Scenario | Expected | Pri | Level |
|---|---|---|---|---|
| TC-PAY-001 | Redirect does not mark Paid | Invoice stays "Confirming" until a verified event | P0 | API |
| TC-PAY-002 | Bad webhook signature | Rejected, logged | P0 | API |
| TC-PAY-003 | Duplicate webhook | Processed once, same response | P0 | API |
| TC-PAY-004 | Amount or currency mismatch | Held for review, not Paid | P0 | API |
| TC-PAY-005 | Missed webhook | Reconciliation job fixes status | P1 | API |
| TC-PAY-006 | Declined or abandoned | Invoice stays Sent, payer can retry | P0 | E2E |
| TC-PAY-007 | Voided invoice link | "No longer available" | P0 | API |
| TC-PAY-008 | Overdue | Chip, no automatic chase | P1 | API |
| TC-PAY-009 | Mark as paid | Note required, audit entry | P1 | E2E |
| TC-PAY-010 | Refund limits | Over the paid amount refused; partial and full statuses | P0 | API |
| TC-PAY-011 | Dispute | Flag, alerts, evidence, outcomes | P1 | API |
| TC-PAY-012 | Integer money | No floats, subunits only | P0 | Unit |
| TC-PAY-013 | Payout account | Name resolved and confirmed before saving | P1 | E2E |
| TC-PAY-014 | Payer pays Paystack fee (D-21) | Total equals price plus estimated fee; tutor's payout equals the price | P0 | API |
| TC-PAY-015 | Fee rounding | Fee computed in whole subunits, rounded up, never negative | P0 | Unit |
| TC-PAY-016 | No card-fee line for payers abroad | One total shown, no separate surcharge line (pending legal check, OQ-11) | P1 | E2E |
| TC-PAY-017 | Payer region | Changing the payer's region recalculates the fee before sending | P1 | E2E |

## GM · Progress and motivation (proposal, build later)

| ID | Scenario | Expected | Pri | Level |
|---|---|---|---|---|
| TC-GM-001 | On by default (D-20) | A new course shows progress to its students with no setup; when the tutor switches it off, nothing is shown or recorded and past data is kept 30 days | P0 | E2E |
| TC-GM-002 | XP idempotency | Replaying an event gives no extra XP | P0 | API |
| TC-GM-003 | Weekly streak | Week met, week skipped (no lessons), freeze used | P1 | API |
| TC-GM-004 | Tutor-caused misses | Cancelled or not held lessons do not break a streak | P0 | API |
| TC-GM-005 | Privacy | Student and tutor see it; no other student does | P0 | API |
| TC-GM-006 | Shared goal | Group bar only, no names ranked | P1 | E2E |
| TC-GM-007 | Notification limits | At most 1 a day, none to under-18s after 8 PM local | P1 | API |
| TC-GM-008 | Not in summaries | Progress never appears in summary, Copy or emails | P0 | API |
| TC-GM-009 | Reduced motion | Celebration skipped | P2 | E2E |
| TC-GM-010 | Data rules | Export and delete include progress | P1 | API |

---

## Release gates

- **Every P0** passes on staging, on the exact commit that will be released.
- **No skipped P0** without a named owner and a reason in the pull request.
- **Real devices:** TC-X-003 to TC-X-005 and TC-CLS-018 are run by a person for
  each release.
- **Without Kavi:** run the P0 set once with the Kavi service switched off.

## Coverage map

| Flow | Cases |
|---|---|
| 01 Sign up and set up | AUTH, ONB, SET |
| 02 Login and recovery | AUTH |
| 03 Invitations | INV |
| 04 Course and plan | CRS |
| 05 Scheduling | LSN, NTF |
| 06 Lesson day | CLS, REC |
| 07 After the lesson | SUM, REC |
| 08 Homework | HW |
| 09 Quizzes | QZ |
| 10 Starting check | CHK |
| 11 Admin and team | TM |
| 12 Student week | STU |
| Cross-cutting | SEC, X |
| Later | PAY, GM |
