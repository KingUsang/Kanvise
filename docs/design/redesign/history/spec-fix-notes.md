> Archived copy, kept for history. Paths under `/projects/sandbox/` refer to the old sandbox and may not exist. The specs in the parent folder are current and win over anything here. The state IDs here use the old LS- and ST- numbering; `../README.md` maps them to the current IDs.

# Spec fix notes

- Task: task-redesign-spec-fix (fix the Kanvise redesign specs against the critic review and the owner's decisions, checked against the real Bobbin screenshots)
- Repo: `/projects/sandbox/kanvise-design` (worktree of KingUsang/Kanvise)
- Branch: `design/redesign-spec`
- Start SHA: `d07dee2`
- Critic review: `/projects/sandbox/critic-review.md` (76 findings)
- Checker: `python3 /projects/sandbox/.spec-check/check.py /projects/sandbox/kanvise-design/docs/design/redesign`
- Screenshot index: `/projects/sandbox/.spec-check/screenshots-index.md`

## Findings

| Finding | Severity | Fix (spec and IDs) or reason declined | Feature | Status |
| --- | --- | --- | --- | --- |
| F-01 | Blocker | 06 STU-05 'No email (an edge case)': notice under the header, 'Add an email to give them homework, quizzes and summaries', homework and quizzes tab replaced by the line, summaries kept with Copy and Send on WhatsApp, WhatsApp uses the student phone; STU-03 email line says they join from links. Option (c) chosen per 00 section 14a. 09 'what a no-email student can do' is FEAT-006. FEAT-006: 09 SA-02a 'Students without an email' (join links only, nothing in Kanvise until an email is added, homework and quizzes can't be set, 10 HW-01 and 11 QZ-03 leave them unticked). Review v1 (issue 15): the no-email Homework and quizzes tab now shows starting check results (rows to DIAG-R, waiting check with Copy link) above the Add an email line (06). | FEAT-005 (06), FEAT-006 (09), FEAT-006 (09, 10, 11), review v1 | done |
| F-02 | Blocker | 06 STU-03 'Recording consent already given' checkbox (unticked, see mismatches), STU-04 consent column, STU-05 Lesson recording card (Consented / No consent, Record consent, Withdraw consent, Casey can watch recordings), STU-01 Recording column; 07 CR-01/CR-03/CR-04 record only when every student has consent, 'This lesson won't be recorded: Casey hasn't consented.'; 12 CFG-L Record lessons line made consent-gated; 08 Kavi drafts from the recording only with consent. Processor names in Kavi settings are FEAT-006/FEAT-008 (12 CFG-K, 20). FEAT-006: 12 CFG-K 'Where your data goes' names Deepgram (lesson audio, consented recordings only) and Google Gemini (transcript text, Notes for Kavi, plan topics, typed answers and images of work on request); what they keep is left to 20-data-model.md (FEAT-008). FEAT-008: 20 DM-26 states what Deepgram (mip_opt_out, retained only for processing) and Gemini paid tier (55-day abuse logs, no training) keep; 12 CFG-K gets a one-line summary and the Gemini row now includes summaries and statuses; consent gate enforced in DM-24. | FEAT-005 (06, 07, 08, 12 CFG-L), FEAT-006 (12), FEAT-008 (20, 12) | done |
| F-03 | Blocker | Parent fields, Parent column, parent card, CSV parent columns and payer flag removed from 06 (STU-01, STU-03, STU-04, STU-05, Data needed); optional student phone added instead. "and parents" removed from 05 LP-02 Share and 04 CRS-03 About. ONB-03 now sets default lesson length and Kavi reading level (02, 12 CFG-T, CFG-L, 05 LW-2). SET-01 step 1 line rewritten. 00 sections 9, 14, 15 rewritten; 13 BL-03 uses "Other contact" who receives nothing automatically; 08 line removed. | FEAT-002 | done |
| F-04 | Blocker | 04 'Topic status model': one status per student per topic (none, Next, Taught, Needs work, Knows it); sources table (tutor by hand, starting check, summary Complete, homework, quiz) with what each can set; allowed changes; precedence (by hand wins and is flagged 'Replaces your choice'; otherwise most recent confirmed change); objectives never set status; absent students get no change; Everyone view = per-student chips + '2 of 3 covered'; progress counts topics ('12 of 32 topics covered', covered = Taught or Knows it); history. Course plan status Draft / Active / Archived and how it drives the CRS-06/CRS-07 cards. 06 and 09 progress lines aligned. 08/10/11 must point at it (FEAT-005/006). | FEAT-004 | done |
| F-05 | Blocker | 05 'Lesson statuses': one table (Planned, Starting soon derived amber, Live, Not held, Awaiting summary, Missed, Complete, Cancelled) with set-by and chip, plus a transitions table; Bobbin's Pending, approval and chargeable statuses dropped with the reason. LL-01 tabs All, Upcoming, Awaiting summary, Not held, Missed, Complete, Cancelled; CAL-06 status filter lists them. | FEAT-004 | done |
| F-06 | Blocker | Teaching tip row deleted from 03 DB-02 and the banner sketch; 00 section 14a says there is no waiting room. | FEAT-002 | done |
| F-07 | Blocker | 00 section 18 "Standards and ledger changes required": rows for standard 01 (DOM-001, DOM-002, DOM-005, DOM-007), DOM-008, DOM-010, DOM-009/SEC-007, standard 03 (page access kept, admin homework/quiz access amended, school_id), standard 07 (UI-003 location token, radius, gutters UI-007, title), INT-006. Spec side: 04 and 06 permissions now say agency tutors cannot create courses or add students. | FEAT-002 | done |
| F-08 | Major | 04: plan and check are post-create cards. CRS-06 Build the course plan (Draft with Kavi / Start blank / Copy plan); CRS-07 Find out what they know shown only when the plan is Active with at least one topic; DIAG-D is the one standalone send dialog used everywhere (02 no longer opens a wizard step; the check is not a setup step). | FEAT-004 | done |
| F-09 | Major | 04 'The rules': two questions per checked topic, two correct = Knows it, two wrong/Not sure = Needs work, one each = Not sure yet (no change); lengths Quick 6 topics/12 q/10 min, Standard 12/24/20, Full up to 24/48/35; topic picking in plan order spread across modules; dependency rule skips later topics in the module after a miss (switchable per module); results say 'Checked 8 of 32 topics'. 1 in 16 lucky-guess note. | FEAT-004 | done |
| F-10 | Major | 04 'Who can take it, and how': account holders take it signed in; no-email students get a student- and attempt-scoped token (hashed, 14-day expiry, one active attempt, revoked on re-send, 10 opens/hour, second device resumes with a notice, no guest record), referencing the 00 section 18 ledger row. Re-send creates a new attempt and keeps the old result. Review v1 (issues 3, 11): the manual path is DIAG-P itself (Write the questions opens two empty questions per topic), using the new 11 'Starting check mode' of the QZ-02 question card (four options, fixed Not sure, two per topic, no topic picker); 00 section 5 says two per topic. DIAG-D WhatsApp text and DIAG-S email use {minutes} from the chosen length. | FEAT-004, review v1 | done |
| F-11 | Major | 05 LP-01: Join classroom always enabled for tutors and admins (as Bobbin); students gated by 12 CFG-L 'Classroom opens'. Hard-coded 15 minutes removed from 05, 07 CR-01 (Too early row replaced) and CR-02, 09 SA-02 table; 12 CFG-L line says it gates students only. Only 01 SH-15 mentions the setting's default. | FEAT-004 | done |
| F-12 | Major | Wording (FEAT-002) plus behaviour: 07 CR-09 Lead (is_admin true, 'Admin, leads the room', full Lesson tools, present and screen share) and Watch (is_admin false, visible 'Admin watching', read-only tools, can switch with Lead the room); permissions table has Admin Lead and Admin Watch columns; never counted as tutor attendance. Review v1 (issue 9): Lead is now always preselected (00 section 14b, 07 CR-09); Watch is offered only when the tutor is in the lesson and is listed as HANDOFF owner confirmation 7. | FEAT-002 (wording), FEAT-005 (behaviour), review v1 | done |
| F-13 | Major | Every "report" replaced: 02 SET-01, 03 DB-02/DB-03 table, 05 status table, LL-01 empty tab, LP-01, LP-02 (tabs now Summary, Session, Lesson plan, Notes as in Bobbin; recording and transcript in Session), 06 flow and STU-05/STU-09, 07 CR-03/CR-07/CR-08, 14. Banned-words table in 00 section 13a. | FEAT-002 | done |
| F-14 | Major | 05 LW-3, LP-03, LP-04 conditional wording and WhatsApp (FEAT-004); 06 STU-03 optional student phone with WhatsApp line, STU-05 Contact and No email WhatsApp actions; 07 CR-03 Students WhatsApp/Email only when present; CR-12 chips fall back to Send on WhatsApp / Copy message. | FEAT-004 (05), FEAT-005 (06, 07) | done |
| F-15 | Major | 05 LP-03 and LP-04: Undo toast follows 01 SH-08 (stays until dismissed, page left or 5 minutes); student emails are held until the undo window closes; Undo restores Planned and nobody is told. | FEAT-003 (rule), FEAT-004 (05) | done |
| F-16 | Major | 04: the CW-5 red toast is gone (the check is no longer sent from the wizard). A send failure is inline in DIAG-D and, after closing, a persistent course-page banner 'The starting check wasn't sent to Alex.' with Send now (CRS-03). | FEAT-003 (rule), FEAT-004 (04) | done |
| F-17 | Major | 07 CR-06 Restart this lesson for 60 minutes after an automatic end (same attendance and recording), offered on CR-01, 05 LP-02 banner and 03 DB-03 row; 05 transition reworded; 12 CFG-L End lessons automatically is now 5/10/15/30 minutes. Review v1 (issue 8): restart drops any Kavi transcript or draft from the shorter recording (07 CR-06, 08 SM-02 'Lesson restarted' row, 20 DM-24 recording version in the dedupe keys and DM-09 version column). | FEAT-005, review v1 | done |
| F-18 | Major | 05 'Timezones and series': lesson stores its zone (LW-2 Times in ... with Change); series repeat at the same wall time in that zone; LW-3 daylight-saving notice per student; both times shown when zones differ; emails use the account timezone plus the student's time; series exceptions and splits. | FEAT-004 | done |
| F-19 | Major | 04 CW-1 trial switch (FEAT-004); 08 SM-07 No summary needed with optional reason chips (00 section 6), closes as Complete without notifying, stops the reminder; SM-04 extra 'Complete this lesson?' confirm removed in favour of Preview and an Undo toast; 05 LP-02 banner offers it. | FEAT-004 (trial), FEAT-005 (summary) | done |
| F-20 | Major | 08 SM-01: only the tutor's own classroom ticks start ticked ('Ticked in the lesson'); Kavi's covered topics are unticked with a Kavi's pick badge and reason; validation ignores unticked picks; Got it / Needs more work never set by Kavi. Homework and quiz parts (10 HW-05, 11 QZ-07) are FEAT-006. FEAT-006: 10 HW-05 mark field is empty and never filled; Draft feedback with Kavi only on request, into a separate box with a Kavi's pick badge, Use this / Discard; Got it / Needs more work start unselected and map to Knows it / Needs work through 04 CRS-08 (unticked rows). 11: QZ-07 Kavi marking removed with short answers (Later list); quiz status proposals go through CRS-08. 12 CFG-K lists images of handed-in work as data that leaves Kanvise. FEAT-008: 20 DM-25 makes drafts-only, never pre-tick/pre-accept/pre-score an enforced rule (the API rejects confirms carrying unselected Kavi picks); DM-30 lists every Kavi feature with its confirm action and Without Kavi path; every Kavi block in 02-19 cross-checked. | FEAT-005 (08), FEAT-006 (10, 11), FEAT-006 (10, 11, 12), FEAT-008 (20) | done |
| F-21 | Major | 08 SM-01 Draft with Kavi bar has two equal cards (From the recording, From your notes with a Notes for Kavi box and Use my lesson notes); 5-minute minimum recording; no promised drafting time in 07 CR-07 or 08 SM-02. Cost note per lesson belongs in 20 (FEAT-008). FEAT-008: 20 DM-24 recording to transcript to summary draft on durable_jobs with the consent gate and 5 minute (300 s) minimum checked at run time; no turnaround promised, time to draft recorded per lesson; DM-27 Kavi cost per lesson method with a worked example (60 min recorded lesson about $0.27, notes route about $0.01, prices to confirm before launch) and the accuracy test (Nigerian English, children's voices, two speakers, low bitrate) before launch, recording route stays off if it fails. | FEAT-005 (08, 07), FEAT-008 (cost), FEAT-008 (20) | done |
| F-22 | Major | 07 CR-03 item 7 and Spikes before build: per-student Quick check results subject to the voted_poll spike; fallback class totals only, and the summary gets totals ('Quick check: 3 of 4 chose the right answer'). | FEAT-005 | done |
| F-23 | Major | 07 Spikes before build 'Start without reload' (room created on entry, students gated by Kanvise, starting must keep mic, camera and whiteboard); fallback hides 'Enter without starting a lesson'. Bobbin's own panel says 'Starting reloads the classroom.' (tutor-classroom-popup.png). | FEAT-005 | done |
| F-24 | Major | 07 'Supported tutor device' (laptop or desktop; phone as second device), CR-14 Add a device (Bobbin's OTHER DEVICES pattern, QR code, joins as 'Alex (phone)' muted), phone spike row with fallback. | FEAT-005 | done |
| F-25 | Major | 19 TM-01 Tutors list (/tutors), TM-02 empty/loading/error, TM-03 Add tutor, TM-04 tutor page (Summary, Lessons, Summaries, Attendance), TM-05 Edit, TM-07 Team (/team), TM-08 Add team member, TM-09 Remove from team. 12 CFG-TM is now a pointer to 19 and the Team row left the settings list; 14 /dashboard/tutors row points to 19; 02 SET-01, 04 CW-2, 05 LW-1 point to TM-03/TM-10. Nav part done in FEAT-003 (01 SH-02). | FEAT-003 (nav), FEAT-007 (pages) | done |
| F-26 | Major | New 17-recordings-and-attendance.md: Attendance rules (Attended, Late, Left early, Missed, Tutor didn't join, admin Lead/Watch rows, Deleted student), REC-01 list, REC-02 expanded attendance with consent reason, REC-03 Filter, REC-04 player, REC-05 Export CSV, REC-06 delete recording and retention, REC-07 loading/empty/no results/error, REC-08 student view. No In person tab (online only), no share links. README row added. | FEAT-007 | done |
| F-27 | Major | 05 Calendar: CAL-01 page, CAL-02 Week, CAL-03 Day, CAL-04 Month, CAL-05 popover and new lessons, CAL-06 filters, CAL-07 moving (drag with confirm, menu Reschedule, keyboard M + arrows, no drag on touch, failure), CAL-08 loading/empty/no results/error/offline, CAL-09 phones (Agenda, a Kanvise addition) and tablets, aligned with 16 R-07 and R-10. | FEAT-004 | done |
| F-28 | Major | IDs renamed (see "ID renames" below): 05 LS-01 to LL-01, 08 LS- to SM-, 06 ST- to STU- (sequential in file order), 12 ST- to CFG-, 14 reference updated. CR-07b reference removed from 07 (points to CR-03). Checker: 0 duplicates, 0 collisions, 0 undefined. | FEAT-002 | done |
| F-29 | Major | 14: recording share link is Retire in both tables (students watch in the app, spec 09); slides presenter is Retire in both tables, replaced by the PlugNMeet whiteboard; closing list items 1, 2 and 6 rewritten; 00 section 15 retired list matches. | FEAT-002 | done |
| F-30 | Major | 02 SET-01: both lists written in full, 5 steps each with Done-when column. Independent: Add your students, Create a course, Build the course plan (only skippable step), Schedule your first lesson, Check your classroom. Admin: Add a tutor, Add your students, Create a course, Build the course plan, Schedule the first lesson. Starting check removed from setup (00 section 5). Device check stored server-side per person and device when CR-10 finishes (Data needed). Checked against Bobbin's 5-row setup card. | FEAT-003 | done |
| F-31 | Major | 02: ONB-08 fake 'building your setup' wait removed (answers save and /setup opens at once). Lines scripted, no LLM call; each line capped at 1 second, tappable early, instant on reduced motion and on save-data/slow devices. Taps counted (7). ONB-11 plain form alternative. Kept one question per screen (00 section 10). | FEAT-003 | done |
| F-32 | Major | 03 DB-05 admin rows (FEAT-003) plus 18 NTF-06 Daily summary for admins (summaries overdue by tutor, lessons that didn't start, hand-ins waiting over 3 days; only on days with something; CFG-N row 'Daily summary for admins'). Weekly round-up dropped. | FEAT-003 (dashboard), FEAT-007 (digest) | done |
| F-33 | Major | 07 CR-12 Let {student} know: tutor chips Running late (5/10/15), Starting now, Can't make it; student chips Running late, Can't make it, Need another time; pushed to the tutor (CR-11 rows), on lesson Activity and Lesson tools; 05 LP-01 Students card and 03 DB-03 rows carry them. 09 lesson page and Home card wording is FEAT-006. FEAT-006: 09 SA-03 Next lesson card and SA-05 lesson page carry the student chips Running late, Can't make it, Need another time (24 hours before until the end, once each, Sent 4:02 PM). | FEAT-005 (07, 05, 03), FEAT-006 (09), FEAT-006 (09) | done |
| F-34 | Major | Rule in 00 section 16; standard line applied in 05 LP-01 (FEAT-004), 06 STU-06, 07 CR-03 Notes, 08 SM-01 Private notes; 08 Kavi never reads private notes unless the tutor copies text into Notes for Kavi; 06 Kavi may read notes only for tutor-only answers and never quotes them. 10 HW-01 'Only you and admins see what they hand in' is a different thing (hand-ins), left for FEAT-006. Review v1 (issues 1, 2): 00 section 16 rewritten to the v1 rule (never sent to Kavi for any output), so 00 no longer contradicts section 17; 06 Kavi block and 20 DM-10, DM-25 no longer call section 16 looser; HANDOFF item 6 updated. 08 SM-01 Use my lesson notes now has a permanent warning line and a highlight on copied text, and is HANDOFF owner confirmation 8. | FEAT-002 (rule), FEAT-004/005 (apply), review v1 | done |
| F-35 | Major | 19 TM-06: removing a tutor who teaches courses has a required Reassign step (one New tutor per course, Remove and reassign disabled until all chosen, blocked while teaching). 03 DB-05 'Lessons without a tutor' now only appears if access ended outside that flow and opens the same step. | FEAT-003 (dashboard row), FEAT-007 (team) | done |
| F-36 | Major | 04 CW-2 and 05 LW-1 list admins only with I teach too (FEAT-004); 12 CFG-P holds the toggle (FEAT-006); 19 TM-10 owns its effects (tutor lists, reminders, overdue summaries, attendance as Tutor) and the handover when turning it off; TM-02 empty state offers it; 02 SET-01 counts it. | FEAT-004, FEAT-006, FEAT-007 | done |
| F-37 | Major | Decided in 04 Topic status model: students see Taught, Knows it and Next with the tutor's words; Needs work is tutor-only (shown as Taught if taught, else unmarked); no second vocabulary. 09 SA-08 and 00 section 4 updated to match. FEAT-006 verified 09 SA-08 follows the 04 rule (Needs work tutor-only, statuses only after CRS-08, per course). | FEAT-004, FEAT-006 (09) | done |
| F-38 | Major | 05 LP-05 Join links: one personal link per student per lesson; one active connection per link with a 'Join here instead' prompt before any classroom token is issued; tutor notice in Lesson tools; expiry 2 hours after the scheduled end, on cancel or renewal; hashed and rate-limited; Copy (Bobbin) plus WhatsApp and Email; Bobbin's 'Anyone with this link' honesty line kept. 07 CR-05 wording is FEAT-005. FEAT-005 done: 07 CR-05 'Reconnecting and second devices' uses the same 'Join here instead' prompt as 05 LP-05 (checked in FEAT-009). Review v1 (issue 6): 05 LP-05 and 20 DM-07: once a lesson starts (including Start anyway on a Not held lesson) every link is valid until 2 hours after the actual end, and a time-expired link works again; restart moves the time again. 05 transition table notes it. | FEAT-004 (05), FEAT-005 (07), FEAT-009, review v1 | done |
| F-39 | Major | 11 rewritten: multiple choice only (DOM-010 baseline), Write my own first with Generate with Kavi beside it, no question bank, every question tied to a topic, results feed 04 CRS-08 with the 04 quiz rule. Short answers, Kavi and tutor marking, time limits, attempts, flag for later, marks per question, versions and import moved to a 'Later' list. The starting check is no longer said to reuse the builder: it keeps its own taker and rules in 04 (DIAG-S); only the question editor is shared. Admins see quizzes for every agency course. | FEAT-006 | done |
| F-40 | Major | 15 'Upload limits' table: types (PDF, Word, PowerPoint, PNG, JPG, checked from contents), library and homework files 20 MB, whiteboard 10 MB PDF and images only, PowerPoint 'save it as a PDF first' copy, hand-ins (10 files, 20 MB, photos resized), no video in v1 (Bobbin accepts none), 5 GB storage, 200 uploads a day per account plus 50 hand-in files per student, CSV import, no virus scan (INT-006 deferral). Present only for PDFs and images within the whiteboard limit (15 RS-05, 07 CR-03). 07, 09 and 10 point to the table; 00 section 14e and 14 inventory rows now say slides are saved as PDF. | FEAT-006 (15, 07, 09, 10, 00, 14) | done |
| F-41 | Major | 00 section 18 rows; 01 SH-01 now uses standard 07: radius 8/12/16, gutters 16px below 1024px and 40px desktop owned by the shell, 32px section spacing; SH-03 title 24px phone / 30px desktop; SH-10 dialogs 16px; SH-15 names the orange 'location' token and its uses. 00 section 18 rows marked done. | FEAT-002 (rows), FEAT-003 (01 edits) | done |
| F-42 | Major | 04 CRS-04 status chips each have an icon plus a word (none, Next arrow, Taught tick, Needs work circular arrow, Knows it double tick); module chips likewise; every drag (Next strip, modules, topics, calendar) has Move up/down or Reschedule menu and keyboard alternatives. | FEAT-003 (rules), FEAT-004 (04 chips) | done |
| F-43 | Major | 07 Room settings: cameras off on entry for everyone, no setting; 12 CFG-L Students' cameras option removed. FEAT-006 verified 12 CFG-L: cameras off on entry, no option to change it. | FEAT-005, FEAT-006 (12) | done |
| F-44 | Major | New 20-data-model.md DM-01..DM-20 (people, invitations, courses, course plan, topic status with history and proposals, lessons and series with anchor timezone, join links, attendance, recordings and consent history, lesson summaries with private notes rule and the live_class_recaps fold-in, starting check, homework, quizzes, settings, notifications and unsubscribe tokens, chip messages and concerns, devices, resources, client-only offline queue, retired tables) mapped to real staging tables; every feature spec's Data needed now points to its DM- sections. Kavi service section (quota, cost, feedback store) is FEAT-008. FEAT-008: Kavi service DM-21 to DM-30 (one service with provider interfaces, versioned templates, zod check with one retry, SSE short drafts, durable jobs, safety rules, provider retention, no hard cap in early access with per-request cost and an outlier alert, 👍/👎 with Why not? stored per template version); tables kavi_requests, kavi_drafts, kavi_feedback, kavi_usage, lesson_transcripts; live_class_recaps fold-in (DM-29); live_class_quick_checks reused for Quick check (DM-06); pilot transcript tables retired (DM-20). | FEAT-007, FEAT-008 (Kavi service) | done |
| F-45 | Major | 04 CRS-06 'Copy plan from another course' (own courses, all agency courses for admins, and the sample course; copies modules, topics, objectives, never statuses). Bobbin's 211-template library with exam-board filters is not copied (no exam-board names). | FEAT-004 | done |
| F-46 | Major | 01 SH-13 'Saving and offline': Saving…, Saved (server-confirmed only), Saved on this device, Couldn't save + Retry; IndexedDB queue per person/account, latest per field, ordered; retry 10s/30s/60s then 2 min; conflict banner Keep mine / Use the newer version; offline banner; Complete, Send, Join classroom, Start lesson, Schedule, Cancel, Delete, Draft with Kavi disabled offline with a text reason; sign-out guard (SH-06). 16 R-08 refers to it. | FEAT-003 | done |
| F-47 | Major | 04 Kavi blocks give preparing / not enough to go on / couldn't generate copy for the plan draft and the check questions (DIAG-P, including a failed single Regenerate); 05 LP-01 Kavi block does the same for the lesson plan draft. | FEAT-003 (shared states), FEAT-004 (Kavi failures) | done |
| F-48 | Major | 18 NTF-01 is the single matrix (Event, Recipient, Channel, Default, Setting) covering invitations sent/accepted, tutor removed, course reassigned, scheduled/rescheduled/series changed/cancelled (held, NTF-03), reminders (NTF-02 interpretation of 'reminders go to tutors'), lesson started (no email), Remind, CR-11 alerts, CR-12 chips both ways, concerns, summary completed (held, not emailed) and edited, summary still to write, recording ready/failed, homework set/due change/remind/handed in/marked/redo, overdue (nothing automatic), quiz set/finished, starting check sent/reminder/finished, daily admin summary; Weekly round-up dropped. NTF-04 email rules (account timezone plus student time, unsubscribe on switchable emails only, bounces), NTF-05 no-email students. 12 CFG-N rows match the matrix; 07 CR-11, 08 SM-04, 09 SA-09 point to NTF-01. Review v1 (issue 12): NTF-01 adds the opt-in Missed note (08 SM-06 Let Casey know) and the opt-in Let students know after Mark as cancelled (05 LP-02). 00 section 19 points to NTF-02's reading. | FEAT-006 (09, 12), FEAT-007 (18), review v1 | done |
| F-49 | Major | 04 wizard is Bobbin's three steps (CW-1 Name and presentation with subject, CW-2 People, CW-3 Review and create); plan and check moved to post-create cards; level and goal left out of the wizard. Review v1 (issue 15): CW-2 inline add-student form now uses every STU-03 field (timezone, recording consent unticked) except Course, and creates the student as STU-03 does. The one-to-one single picker is listed as a Bobbin difference in 04 and below. | FEAT-004, review v1 | done |
| F-50 | Major | 07 CR-03 item 6 Set homework opens 10 HW-01 as a side sheet with Set after: this lesson; 08 SM-01 Homework shows homework set in the classroom; CR-08 refers to it. | FEAT-005 | done |
| F-51 | Major | 06 STU-11 Deleting a student's data: deleted (profile, notes, their summary sections, one-to-one summaries, work, statuses, one-to-one recordings, all transcripts and Kavi drafts, links, chip messages) vs kept (group recordings with the name removed and a plain warning that voice and video stay, anonymous counts, a log line); 12 CFG-D points to it. Third-party copies referenced to 20-data-model.md (FEAT-008). FEAT-006: 12 CFG-D deletion points to 06 STU-11 and to the services named in CFG-K; adds Bobbin's per-student export. FEAT-008: 06 STU-11 and 20 DM-25/DM-26: transcripts and their drafts deleted with the recording or the student; Deepgram holds nothing after processing; Google's 55-day abuse logs can't be deleted early and the privacy policy says so. | FEAT-005 (06, 12), FEAT-008 (processors), FEAT-006 (12), FEAT-008 (06, 20) | done |
| F-52 | Minor | 01 SH-15 colour rule: blue dot scheduled, amber starting soon, green live; help 'new' dot is blue (information); orange only for location; Complete is neutral with a tick; course colour is a rounded swatch, not a dot. 03 DB-03 follows it. 05 status table must follow (FEAT-004). Review v1 (issues 5, 14): 03 DB-03 Planned rows show Join (secondary style) beside Planned, as in tutor-dashboard--default.png and 05 LP-01; Prepare removed; Not held uses 05's definition; Missed row added. | FEAT-003, review v1 | done |
| F-53 | Minor | 01 SH-02 PEOPLE group (Students; Tutors and Team for agency admins) as in Bobbin. Phone tab 'Today' with the phone top bar title 'Today' (01 SH-16, 16 R-02, 00 11a); desktop sidebar keeps 'Dashboard' as Bobbin. Setup is a sidebar item and card on desktop, a card on Today and in More on phones. Account menu matches Bobbin (My profile, Sign out). | FEAT-003 | done |
| F-54 | Minor | 16 R-07 phone dashboard order now equals 03 (setup card, banner, Today, Needs attention, This week, Suggestions); 'Next lesson card' dropped (Today's first row is the next lesson). | FEAT-003 | done |
| F-55 | Minor | 16 R-04: one list pattern, pagination with 25 per page, page/filters/search/sort in the URL, scroll restored on Back, no infinite scroll or Load more. R-08 updated. | FEAT-003 | done |
| F-56 | Minor | 16 R-10: at most one fixed bottom element besides the bottom bar, stacking order gesture area, bottom bar, page element (+ or action bar), toasts, sheets; bottom bar hides with the keyboard. R-03, R-07 and R-09 refer to it; 01 SH-08 toasts sit above it. | FEAT-003 | done |
| F-57 | Minor | 02 'What each answer changes' table names the effect of every answer. ONB-04 sets the New course People step (single picker + Add another student, multi-select with group placeholder, or no hint); ONB-05 sets Subject suggestions; ONB-06 sets import tab vs sample course. 12 CFG-T lines updated. Review v1 (issue 13): 00 section 10 item 3 now matches 02 (only the People step). | FEAT-002 (ONB-03), FEAT-003 (rest), review v1 | done |
| F-58 | Minor | 03 DB-05 'Links to send' row (only when > 0): no-email students with a lesson in the next 7 days whose link nobody has copied/sent; goes to the lesson's join links. | FEAT-003 | done |
| F-59 | Minor | 03 DB-08 states the deviation: Live now is admin-only, because a tutor's own live lesson is already the Live row with Join; Bobbin gives tutors Live view. DB-09 Live lessons page copies Bobbin's page (refresh line, empty state, Dashboard link). | FEAT-003 | done |
| F-60 | Minor | Defined: 05 LP-01 Duplicate (same details, one week later, never a series); 04 Export (PDF or copy as text, no statuses), Next strip reorder (drag, Move up/down, keys), 'Regenerate untouched modules' (never touches topics with a status, linked lessons or hand edits; per-module Replace/Keep). Course Delete follows Bobbin's rule (not once a lesson has started); Archive added. | FEAT-004 | done |
| F-61 | Minor | 06 STU-03: agency tutors can't add students, so the duplicate message for them lives where they meet agency students (global search, 01 SH-05): 'Already in your agency. Ask an admin.'; admins see 'already a student in your agency'. 01 SH-05 itself not edited. | FEAT-005 | done |
| F-62 | Minor | 06 STU-03: First name (optional) and Last name (optional), one required ('Add a first or last name.'); import flags 'No name'. | FEAT-005 | done |
| F-63 | Minor | 12 CFG-A: the public address / slug setting is removed, with a line saying public pages are retired. | FEAT-006 | done |
| F-64 | Minor | 12 CFG-K: Writing style is Bobbin's Detailed / Structured (default) / Concise with an In use box, Compare styles dialog (Side by side / One at a time, Use Structured) and 'only affects what Kavi writes from now on'; one English default in British spelling (no US English); optional level names None / JSS and SS / Year / Grade used for course levels and Kavi wording. Sample names across other specs (for example 'Algebra 1') are not changed here. FEAT-009: one general sample set chosen from Bobbin's own sample data (Algebra 1 Small Group, Alex Thompson, Casey Davis, Michael Chen, Science Students Academy) and written into 00 section 13; 'Bello Tutors' replaced in 18 and 19; 12 CFG-K no longer says sample names follow level names (SS2 / Year 9 appear only as level-name examples). No 'Year 9 Maths' course names remain. Review v1 (issue 10): F-64 was not finished at FEAT-009. Now done: 'Alex' as the tutor replaced with Michael in 02, 03, 07, 08, 09, 10, 18; 'Mrs Bello' (tutor uses) with Michael in 04, 05, and the admin with Chidi Okafor (new in 00 section 13, since Bobbin's sample admin is only 'Admin User') in 07, 17; 'Alex Bello' with Michael Chen in 18; 'Bello Tutors' with Science Students Academy in 19; 'Mathematics · High School' with 'Mathematics · Algebra 1' in 04; 'Mr Alex' with 'Mr Chen' in 12. 00 section 13 now says Casey has an email and Alex doesn't, and no-email lines in 03, 06, 10, 11 name Alex. Review v2 (issue 2): the 'Mathematics · Algebra 1' rename was wrong and is reverted. Bobbin's `sample-course--outline.png` shows 'Mathematics · High School' with Mathematics and High School chips, which is a general level. 04 CRS-03 and CRS-04 say 'Mathematics · High School' again, CRS-04 adds the two chips and an optional course level (short text, or the CFG-K level names when set; 12 CFG-K and 20 DM-03 courses.level match), and 00 section 13 now limits only local level names such as SS2 or Year 9. | FEAT-006 (12), FEAT-009, review v1, review v2 | done |
| F-65 | Minor | "live class" search synonym dropped from 00 (not added to SH-05). Banned word in 00 section 13a. | FEAT-002 | done |
| F-66 | Minor | 07 CR-09: no hidden watchers (is_hidden false for both modes); Watch shown as 'Mrs Bello (Admin watching)' to everyone, tutor sees 'Mrs Bello is watching.', students see it in the Kanvise bar; spike row for the name label. | FEAT-005 | done |
| F-67 | Minor | 07 CR-13 Report a concern: Lesson tools link and students' Kanvise bar; dialog with What happened, Send to agency admins or Kanvise support (solo tutors: Kanvise support), emergency line; email only; not shown to the person it is about. Student app entry point is FEAT-006 (09). FEAT-006 done: 09 has Report a concern on every lesson page and in Me > Help (checked in FEAT-009). | FEAT-005 (07), FEAT-006 (09), FEAT-009 | done |
| F-68 | Minor | 14: added /dashboard/more (Retire, redirect to /dashboard, phone More sheet) and the What's new dialog (new, SH-04a); closing list items 8 and 9 added. | FEAT-002 | done |
| F-69 | Minor | 04 CRS-08 pattern (FEAT-004); 08 SM-04 Complete opens CRS-08 with unticked rows per student per ticked topic (Got it = Knows it, Needs more work = Needs work, ticked only = Taught), Not now leaves '3 changes to review'; edits after completing create new rows. 10 and 11 callers are FEAT-006. FEAT-006 done: 10 HW-05 and 11 results open 04 CRS-08 with unticked rows (checked in FEAT-009). Review v2 (issue 3): Undo on the Lesson complete toast withdraws every proposal from that summary (accepted rows set back, waiting rows removed), and completing again proposes fresh rows, so no topic is proposed twice (08 SM-04, 04 CRS-08, 20 DM-05 withdrawn state). | FEAT-004 (pattern), FEAT-005 (08), FEAT-006 (10, 11), FEAT-009, review v2 | done |
| F-70 | Minor | "diagnostic" replaced by "starting check" in tutor copy (02, 03, 04, 06, 11, 12, 16, README, 14) and "check" for students (09 SA-03, flow). Jokey lines removed: ONB-02 replies, ONB-08 line, SA-03 "Nothing to do right now. Nice." 00 section 5 and 13a set the names. DIAG- IDs and the 04 file name kept. | FEAT-002 | done |
| F-71 | Minor | "end-of-year exam in June" replaced by "end-of-term test" in 04 CW-1 and 06 STU-05; 00 section 13 example added. | FEAT-002 | done |
| F-72 | Minor | 01 SH-16 and 07 CR-01: on phones the classroom opens in the same tab with Back to lesson; desktop keeps a new tab. 16 R-02 and R-07 match. | FEAT-003 | done |
| F-73 | Minor | 01 SH-02 item 6: collapse/expand is a real button (aria-expanded), Tab + Enter/Space, same on tablet rail; tooltips on hover and focus; labels are accessible names. 16 R-02 tablet line matches. | FEAT-003 | done |
| F-74 | Minor | 02 ONB-10: invited agency tutors get no questions or checklist (as in Bobbin) and inherit the agency's answers; Welcome banner offers Test classroom. Permissions and Data needed updated. | FEAT-003 | done |
| F-75 | Minor | 02 SET-01: video, help guide and sample course content listed as content dependencies (to be copied into HANDOFF by FEAT-009); video card falls back to a still image and help link until the video exists. FEAT-009: HANDOFF 'Content dependencies' lists the setup video, help guide, sample course, Kavi icon and login and sign-up screens. | FEAT-003 (02), FEAT-009 (HANDOFF), FEAT-009 | done |
| F-76 | Minor | README: 15 now before 16; 06 no longer says parents; 04 and 07 descriptions reworded. HANDOFF and the README HANDOFF row left for FEAT-009. FEAT-009: README lists HANDOFF and 00-20 in order with accurate descriptions (12 says team moved to 19, file name kept), the state-ID prefix legend, the stable-ID rule and the retired prefixes; HANDOFF rewritten (current state, owner confirmations, launch blockers, content dependencies, build order with Kavi last, PR screenshot rules; stale open items about the slides presenter, confidence rating and smaller defaults removed because 00 decides them). Review v2 (issues 1, 4): HANDOFF build order puts dashboard and setup back at step 2 as a slice that grows with each step (which dashboard rows, banners, suggestions and /setup rows ship in which step), keeps courses and lessons together, then classroom, summary, homework and quizzes, starting check, notification preferences, Kavi last; three deliberate changes from the briefed order are listed for the owner. | FEAT-002 (partial), FEAT-009, FEAT-009, review v2 | done |

## ID renames

| Spec | Old ID | New ID |
| --- | --- | --- |
| 05 | LS-01 | LL-01 |
| 08 | LS-01 | SM-01 |
| 08 | LS-02 | SM-02 |
| 08 | LS-03 | SM-03 |
| 08 | LS-04 | SM-04 |
| 08 | LS-05 | SM-05 |
| 08 | LS-06 | SM-06 |
| 06 | ST-01 | STU-01 |
| 06 | ST-02 | STU-02 |
| 06 | ST-03 | STU-03 |
| 06 | ST-04 | STU-04 |
| 06 | ST-05 | STU-05 |
| 06 | ST-10 | STU-06 (private notes, renumbered to file order) |
| 06 | ST-06 | STU-07 |
| 06 | ST-07 | STU-08 |
| 06 | ST-08 | STU-09 |
| 06 | ST-09 | STU-10 |
| 12 | ST-P | CFG-P |
| 12 | ST-S | CFG-S |
| 12 | ST-N | CFG-N (also referenced in 14) |
| 12 | ST-T | CFG-T |
| 12 | ST-L | CFG-L |
| 12 | ST-K | CFG-K |
| 12 | ST-A | CFG-A (section renamed "Business details") |
| 12 | ST-TM | CFG-TM (moves to spec 19 as TM- in FEAT-007) |
| 12 | ST-D | CFG-D |
| 07 | CR-07b (never defined) | removed; the text now points to CR-03 |

## Bobbin screenshots checked per spec

### 00 Decisions

- `03-lessons/screenshots/classroom--join-dialog.png`: "Join as an admin?" copy and "Join as admin" button (00 section 14b, 07 CR-09).
- `05-students/screenshots/add-student--step-1.png`: "Recording consent already given" checkbox (00 section 14d). Bobbin has no student phone field; the optional phone is an owner decision.
- `atlas/shots/03-lessons_sample-insights--recheck.png`: finished lesson tabs Summary, Session, Lesson plan, Notes (00 section 6).

### 01 App shell

- `00-recon/screenshots/post-login.png`: admin sidebar order (Setup above Dashboard, setup card "0/5 completed", PEOPLE group with Students, Clients, Tutors, Team). SH-02 copies the PEOPLE group (without Clients).
- `15-tutor-role/screenshots/tutor-dashboard--default.png`: tutor sidebar has no Setup and PEOPLE holds Students only; SH-02 matches.
- `01-dashboard/screenshots/page--default.png`: loading shows the sidebar and a thin progress line at the top; SH-09 adds that line.
- `01-dashboard/screenshots/dashboard-account-menu.png`: account menu is name, email, My profile, Sign out; SH-06 matches. The help icon's dot is yellow in Bobbin; Kanvise uses blue (SH-15).
- `01-dashboard/screenshots/dashboard-help-updates.png` and `15-tutor-role/screenshots/tutor-whats-new.png`: help menu items and What's new layout (Read earlier divider, See the full changelog); SH-04 and SH-04a match.
- `01-dashboard/screenshots/dashboard-global-search.png` and `15-tutor-role/screenshots/tutor-global-search--results.png`: Browse by type, grouped results with highlighted match and lesson status chip, footer keys; SH-05 matches.
- `atlas/kanvise/admin_dashboard.png`, `atlas/kanvise/admin_dashboard_more.png`: current Kanvise sidebar and More page being replaced.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-account-menu.png` (FEAT-009): tutor menu has only Sign out; SH-06 keeps My profile for every role and says so.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-help-updates--open.png` (FEAT-009): tutor help menu matches SH-04.

### 02 Onboarding and setup

- `00-recon/screenshots/post-login.png` and `atlas/s2/00-recon_post-login.png`: Bobbin's setup card, 5 rows (Add a client, Add a tutor, Add a student, Create a course, Schedule your first lesson), each with time chip, Next chip, reason line, button; "0/5 completed". SET-01 copies the row layout and keeps 5 steps in both lists.
- `00-recon/screenshots/setup--post-test-data.png`: after setup the Setup item is gone and the dashboard shows the sample course banner; SET-03 matches.
- `01-dashboard/screenshots/dashboard-help-updates.png`: sample course banner and Delete demo data.
- `15-tutor-role/screenshots/tutor-dashboard--default.png`: invited tutor has no setup; ONB-10 matches.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-help-updates--open.png` (FEAT-009): Help guide link used by /setup.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-mobile-app-learn-more.png` (FEAT-009): Bobbin mobile app dialog, not copied.

### 03 Dashboard

- `15-tutor-role/screenshots/tutor-dashboard--default.png`: layout copied (greeting, date, Today with count, Live view and Open calendar links, This week day strip and list, Needs attention on the right with rows kept at 0 and "all caught up").
- `15-tutor-role/screenshots/tutor-live-view.png`: Live lessons page wording, refresh line and empty state copied into DB-09.
- `00-recon/screenshots/setup--post-test-data.png`, `01-dashboard/screenshots/dashboard-help-updates.png`, `01-dashboard/screenshots/dashboard-account-menu.png`: admin dashboard (sample course banner, classroom tip card, Today row with Join and Planned together, Needs attention counts, help, sales and mobile app cards).
- `01-dashboard/screenshots/page--default.png`: loading state.
- `atlas/kanvise/admin_dashboard.png`, `atlas/kanvise/tutor_dashboard.png`: current Kanvise stat cards being replaced.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-account-menu.png` (FEAT-009): tutor dashboard Today row (Join + Planned), This week, Needs attention at 0.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-mobile-app-learn-more.png` (FEAT-009): mobile app card dialog, not copied.
- `15-tutor-role/screenshots/tutor-dashboard--default.png` (review v1, reopened): Today row shows a yellow Join beside the Planned chip. DB-03 now shows Join on Planned rows (secondary style), replacing Prepare.

### 04 Courses, plan and diagnostic

- `04-courses/screenshots/page--default.png`: list header, subtitle, search, Filter, sample banner, empty state copied (CRS-01, CRS-02).
- `15-tutor-role/screenshots/tutor-courses--default.png`: Bobbin's list is a table (Course, Tutor, Students) and tutors have no New course; CRS-01 changed from a card grid to a table.
- `04-courses/screenshots/new-course--step-1.png`, `new-course--step-1-filled.png`, `new-course--step-2-roster.png`, `new-course--step-2-selected.png`, `new-course--step-3-review.png`: three steps, titles and subtitles, 11 swatches, colour line, segmented bar, round back arrow, nothing preselected in People, bordered review table, Create course (CW-1 to CW-3).
- `04-courses/screenshots/course-created--detail.png`, `15-tutor-role/screenshots/tutor-course-actions-menu.png`, `tutor-course-delete-confirmation.png`: course page cards, Actions (Edit, Delete), Bobbin's delete rule copied, post-create plan card (CRS-06).
- `04-courses/screenshots/sample-course--summary.png` (Loading course...), `sample-course--summary-loaded.png`, `sample-course--recheck.png`, `sample-course--outline.png`, `sample-course--lessons.png`: Summary layout, plan card and bar, module rows, Lessons table.
- `15-tutor-role/screenshots/tutor-course-plan-describe.png`, `tutor-course-plan-browse.png`: Describe your own dialog copied; template library replaced by Copy plan from another course.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-course-edit.png` (FEAT-009): Edit course dialog wording and Save changes added to CRS-03.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-course-lessons-tab.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-courses-filter.png` (FEAT-009): Lessons tab table, Latest lessons skeleton, Filter facets.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-course-add-tutor.png` (FEAT-009): Add tutors dialog added to the CRS-03 Tutor card.
- `15-tutor-role/screenshots/tutor-course-add-student-create.png` (review v1): Bobbin's add-student from a course has first name, last name, email, client, timezone and the recording consent checkbox. CW-2's inline form now uses every STU-03 field (timezone, consent unticked) except Course.

### 05 Lessons and scheduling

- `atlas/shots/03-lessons_sample-insights--recheck.png` and `03-lessons/screenshots/sample-lesson--session.png`: tabs Summary, Session, Lesson plan, Notes; Session holds attendance (status, joined, left, time in lesson) and the transcript with "Not recorded" when there is none. LP-02 now matches; the Recording tab is gone. Share menu: Bobbin "Email to clients" not copied (nothing is emailed); Kanvise has Copy summary and Export as PDF.

- `02-calendar/screenshots/` all nine (page--default, calendar-week, calendar-day, calendar-month, five filter shots) and `15-tutor-role/screenshots/tutor-calendar--default.png`, `tutor-calendar-week.png`: CAL-01 to CAL-08 (Month first visit as Bobbin, Today greyed, two-level filter with Searching..., Loading lessons... in the grid, empty week, off-screen early lesson).
- `15-tutor-role/screenshots/tutor-lessons--default.png`, `tutor-lessons-filter.png`: LL-01 table, sorting, tabs and filter.
- `03-lessons/screenshots/new-lesson--step-1.png`, `new-lesson--step-2-schedule.png`, `new-lesson--step-2-filled.png`, `new-lesson--step-3-review.png`: LW-1 to LW-3 wording and layout.
- `03-lessons/screenshots/lesson-created--detail.png`, `lesson-created--join-available.png`, `sample-lesson--plan.png`, `sample-lesson--notes.png`: LP-01 layout, always-enabled Join classroom, no-plan objectives message, join link card (LP-05), notes empty state.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-new-lesson--step-2.png` (FEAT-009): "Topic & schedule"; Kanvise keeps "Topic and time" (noted in 05).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-lesson-detail--default.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-lesson-detail-after-live.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/lesson-ended--recheck.png` (FEAT-009): "No insights" banner with End lesson, cards on the right.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/sample-session--recheck.png` (FEAT-009): transcript card (Session transcript, Search transcript, Download) copied into LP-02 Session tab.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-lessons-status-all.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-lessons-status-canceled-chargeable.png` (FEAT-009): status tabs, filter chip, Clear all, "No lessons match these filters."

### 06 Students

- `05-students/screenshots/page--default.png`: header buttons, sample student banner, empty state (STU-01, STU-02).
- `05-students/screenshots/add-student--step-1.png`: First name (optional), Last name, Email (optional) line, Client, Timezone, Recording consent already given and its untick line (STU-03).
- `05-students/screenshots/add-student--client-picker-open.png`, `add-student--client-selected.png`: client picker (not copied).
- `05-students/screenshots/student-created--detail.png`: header, tabs, Linked courses, Lesson recording card, Activity, Student created toast (STU-05).
- `05-students/screenshots/student--before-email.png`: Loading summary... (STU-05).
- `05-students/screenshots/student--edit-email.png`, `student--edit-email-filled.png`, `student--email-invited.png`: Edit student dialog, invite line, Contact card, Actions menu (STU-07, STU-08).
- `15-tutor-role/screenshots/tutor-student-detail--default.png`: tutor view without Edit, Remove or consent buttons; Lessons (1) tab count.
- `06-clients/screenshots/add-client--step-1.png`, `client-created--detail.png`, `client-created--populated-list.png`, `page--default.png`: clients retired; Contact card idea kept.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-students--default.png` (FEAT-009): tutor list, no buttons, Lessons completed column.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-student-attendance.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-student-progress-reports.png` (FEAT-009): tutor student page (Linked courses "No course plan yet", read-only Lesson recording, Activity).

### 07 Classroom

- `03-lessons/screenshots/classroom--join-dialog.png`: CR-09 dialog wording copied.
- `03-lessons/screenshots/classroom--lesson-ended.png`, `15-tutor-role/screenshots/tutor-classroom-ended.png`: start card and 'Enter without starting a lesson' (CR-01).
- `15-tutor-role/screenshots/tutor-classroom-popup.png`, `tutor-classroom-before-start-retry.png`, `atlas/s2/15-tutor-role_tutor-classroom-room--default.png`: No lesson running, Start, 'Starting reloads the classroom.', Other devices, Alerts (CR-03, F-23 spike).
- `03-lessons/screenshots/classroom--live.png`: first-visit welcome dialog (CR-03).
- `03-lessons/screenshots/classroom--live-onboarding-dismissed.png`, `classroom--invite-open.png`, `15-tutor-role/screenshots/tutor-classroom-live--started.png`: panel order, Invite rows, Add a device, 'This session is being recorded.' (CR-03, CR-14).
- `03-lessons/screenshots/classroom--end-lesson-confirmation.png`: inline end confirmation (CR-06).
- `atlas/s2/15-tutor-role_tutor-classroom-live--started.png`, `15-tutor-role_tutor-classroom-end-confirmation.png`, `15-tutor-role_tutor-classroom-ended.png`, `15-tutor-role_tutor-classroom-popup.png`: same states.
- `12-safeguarding/screenshots/safeguarding-open.png`: automatic transcript flags (not copied; CR-13 instead).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/classroom--joined.png` (FEAT-009): start card wording matches CR-01.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/classroom--tutor-invite-emailed.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-classroom-live--media-ready.png` (FEAT-009): Lesson tools panel and pre-join media check.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-classroom-entered.png` (FEAT-009): "Loading the classroom..." added as CR-01 Loading row.
- `03-lessons/screenshots/classroom--join-dialog.png` (review v1): Bobbin's Join as an admin? has one way in (Cancel, Join as admin). CR-09 now preselects Lead, so the default path matches Bobbin and the owner's moderator decision; Watch is an extra choice only when the tutor is in the room.

### 08 Lesson summary

- `03-lessons/screenshots/sample-insights--recheck.png`: tabs, Lesson summary card with Share, Objectives covered '27 of 90 on the plan · 3 here' (SM-05).
- `03-lessons/screenshots/sample-insights--share-open.png`: Export as PDF, Email to clients (only Export kept, plus Copy summary).
- `03-lessons/screenshots/lesson-ended--insights-status.png`: 'AI insights coming soon' placeholder (Kanvise uses the Awaiting summary banner).
- `15-tutor-role/screenshots/tutor-lesson-final-report.png`: 'No insights · This lesson was completed without insights.' (SM-07 empty state), Set after this lesson card.
- `15-tutor-role/screenshots/tutor-lesson-finalized.png`, `tutor-lessons-status-awaiting-report.png`: Awaiting approval status and tab (approvals deliberately excluded).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/lesson-ended--recheck.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/sample-lesson--loaded.png` (FEAT-009): Bobbin Summary tab with AI performance rows; Kanvise keeps tutor-written sections.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/sample-session--recheck.png` (FEAT-009): transcript on the Session tab.

### 09 Student app

- No Bobbin student app screens exist in the atlas. Checked instead against: `03-lessons/screenshots/lesson-created--join-available.png` (per-student join link, 'Before this lesson · Homework' card copied into SA-05), `15-tutor-role/screenshots/tutor-course-set-homework.png` (hand-in visibility), `01-dashboard/screenshots/dashboard-mobile-app.png` (greeting then upcoming lessons), `atlas/kanvise/learner_dashboard_student.png` (today's portal: seven-item sidebar, Subjects count, Recent updates feed and 'Report a problem' link, all replaced).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/classroom--joined.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-lesson-detail--default.png` (FEAT-009): start card and the join link honesty line.

### 10 Homework

- `15-tutor-role/screenshots/tutor-course-set-homework.png`: HW-01 title, subtitle, Title, Due, Instructions toolbar, Files for students with Upload files and Choose from resources, Cancel and Set homework. Kanvise adds a students line and a collapsed More options row.
- `15-tutor-role/screenshots/tutor-course-homework-settled.png`: empty Homework tab wording (HW-02).
- `15-tutor-role/screenshots/tutor-course-homework-tab.png`: course tabs and table style.
- `03-lessons/screenshots/lesson-created--join-available.png`: Before this lesson · Homework card.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-course-resources-tab.png` (FEAT-009): course tabs.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-lesson-detail--default.png` (FEAT-009): Set after this lesson card wording.

### 11 Quizzes

- Bobbin has no quizzes. Dialog and empty-state patterns checked against `15-tutor-role/screenshots/tutor-course-set-homework.png` and `tutor-course-homework-settled.png`; the Kavi label idea against `14-settings/screenshots/settings-ai-style-compare.png`.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/11-report-approvals/screenshots/report-approvals--populated.png` (FEAT-009): review queue, not copied (no approvals).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-course-set-homework.png` (FEAT-009, rechecked): dialog pattern quizzes follow.

### 12 Settings and team

- All 28 `14-settings/screenshots/*` opened. Changes they drove: search shows a results card with a count and breadcrumb per row (`settings-search-recording.png`); Jump to lists the cards in the current section (`settings-jump-to.png`); cards with Show details, toggles autosave and forms use Save changes (`page--default.png`, `15-tutor-role/screenshots/tutor-profile--default.png`); skeleton loading (`billing--entry.png`); Writing style copies Detailed / Structured / Concise with In use, Compare styles, Side by side / One at a time and Use Structured (`settings-ai-content-style--full.png`, `settings-ai-content-style.png`, `settings-ai-style-compare.png`); account timezone row (`settings-general--full.png`, `settings-general-timezone-options.png`, with friendlier city names); per-student export (`settings-data-export--full.png`); Recordings card with Apply to existing recordings (`settings-lessons--full.png`, `settings-lessons-reorder.png`, `settings-lessons-reset-confirmation.png`).
- Not copied, checked: `settings-emails--full.png`, `settings-emails.png` (account-wide client emails), `settings-safeguarding--full.png`, `settings-safeguarding.png`, `settings-api--full.png`, `settings-api-create-key.png`, `settings-webhooks--full.png`, `settings-webhook-add-endpoint.png`, `settings-studybugs--full.png`, `settings-beta--full.png`, `settings-beta-feedback.png`, `settings-activity--full.png`, `settings-activity-filter.png`, `billing--loaded.png`, `billing--starter-selected.png`.
- `15-tutor-role/screenshots/tutor-profile-email-change.png`, `tutor-profile-password.png`, `tutor-profile-notifications.png`: Change your email dialog, Password card, tutor's reduced settings list (CFG-S, CFG-N). `tutor-settings--default.png` (tutor dashboard after /settings redirect) confirms tutors have no account settings.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-profile-two-factor-setup.png` (FEAT-009): Turn on two-factor dialog wording recorded for when CFG-S adds it.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-account-menu.png` (FEAT-009): settings reached from the sidebar.

### 13 Billing

- `14-settings/screenshots/billing--entry.png`, `billing--loaded.png`, `billing--starter-selected.png`: Bobbin's own subscription billing, not tutors billing students; nothing copied. Parent wording removed from 13 (families, siblings, Mrs Davis).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-lessons-status-canceled-chargeable.png` (FEAT-009): chargeable status, not copied.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/11-report-approvals/screenshots/report-approvals--populated.png` (FEAT-009): trial "Set up billing" banner, not copied.

### 14 Old flows inventory
- `/projects/sandbox/atlas/kanvise/admin_dashboard_mocks.png` (FEAT-009): today's Assessments page; 14 /dashboard/mocks row updated (MCQ only, written answers to the Later list).
- `/projects/sandbox/atlas/kanvise/class_workspace.png` (FEAT-009): today's class workspace, covered by the classes rows.
- `/projects/sandbox/atlas/kanvise/admin_dashboard.png`, `admin_dashboard_more.png`, `learner_dashboard_student.png` (earlier passes). Bobbin has no equivalent for this spec.

### 15 Resources

- All 11 `10-resources/screenshots/*` listed in the index; opened: `page--default.png`, `folder-created--library.png`, `resources-filter-type.png`, `resources-filter-visibility.png`, `upload-files--dialog.png`, `upload-files--selected.png`, `upload-files--completed.png`, `new-folder--filled.png`. Changes: Bobbin's FOLDERS / FILES layout with Show files in folders and a Visibility filter replace the Folders / All files switch and Mine / Shared tabs; upload dialog copies the drop area, accepted types (no video), Add more files, Rename / Remove, Upload 3 files; Share with the team ticked on upload, unticked on new folder.
- `15-tutor-role/screenshots/tutor-course-add-resources.png` (Add resources: Upload files, Attach from library, Attach a folder; No resources attached), `tutor-resource-upload.png` (no sharing option for tutors), `tutor-resources-show-folders.png`.
- Not opened: `new-folder--dialog.png`, `resources-filter-uploaded-from.png`, `resources-filter-uploaded-to.png` (taken from `10-resources/spec.md`).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/10-resources/screenshots/new-folder--dialog.png`, `resources-filter-uploaded-from.png` (FEAT-009, previously not opened): RS-03 title and placeholder, Uploaded from sub-panel with Apply.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-resources--default.png` (FEAT-009): tutor library without folders.

### 16 Responsive

- `00-recon/screenshots/post-login.png`: desktop sidebar groups that the More sheet repeats.
- `15-tutor-role/screenshots/tutor-dashboard--default.png`: dashboard order used for the phone stack.
- `01-dashboard/screenshots/dashboard-mobile-app.png`: Bobbin's phone app home (Upcoming list, no separate next-lesson card). Bobbin's web app has no phone layout in the atlas, so R-02 and R-10 are Kanvise's own.
- `atlas/kanvise/admin_dashboard_more.png`: the retired More page.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-mobile-app-learn-more.png` (FEAT-009): Bobbin's phone experience is a separate recording app.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-account-menu.png` (FEAT-009): account menu repeated by the More sheet.

### 17 Recordings and attendance

- `09-recordings/screenshots/page--default.png`: empty state, All/Online/In person (In person not copied), disabled Export CSV.
- `09-recordings/screenshots/recordings-online.png`, `recordings--recheck.png`: table columns (Billed dropped), red 'didn't join' line, No recording.
- `09-recordings/screenshots/recording-session--detail.png`, `recording-session--detail-recheck.png`: expanded attendance, Admin, leads the room, Attended / Didn't join chips, Open lesson.
- `09-recordings/screenshots/recordings--filter-open.png`, `recordings-filter-lesson.png`, `recordings-filter-student.png`, `recordings-filter-tutor.png`, `recordings-filter-from-date.png`, `recordings-filter-to-date.png`: filter menu and sub-panels (Lesson becomes Course).
- `09-recordings/screenshots/recordings-player.png`: player dialog and the Watch button.
- `09-recordings/screenshots/recordings-in-person.png`: Loading recordings spinner (Kanvise uses skeleton rows).
- `15-tutor-role/screenshots/tutor-recording-session--expanded.png`, `tutor-recordings-filter-tutor.png` (opened) and the other tutor-recordings shots (listed): tutor view has no Billed column and no Export CSV.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/13-unlinked-sessions/screenshots/unlinked-sessions--latest.png` (FEAT-009): Unlinked sessions, not needed (rooms only exist for lessons).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-student-attendance.png`, `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/sample-session--recheck.png` (FEAT-009): attendance columns match.

### 18 Notifications

- `14-settings/screenshots/settings-emails--full.png`, `settings-emails.png`: Bobbin's account-wide email switches (scheduled, reminders, rescheduled or cancelled, attendance 10 minutes in, client emails).
- `15-tutor-role/screenshots/tutor-profile-notifications.png`: personal Notifications card layout copied by 12 CFG-N.
- `01-dashboard/screenshots/page--default.png`: no notification bell in Bobbin's shell, so tutors get the Page channel, not a list.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/03-lessons/screenshots/classroom--tutor-invite-emailed.png` (FEAT-009): email button on classroom Invite rows.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/08-team/screenshots/add-team-member--dialog.png` (FEAT-009): invite line.

### 19 Tutors and team

- `07-tutors/screenshots/page--default.png`: header, Import and Add tutor, search, sample banner, empty card.
- `07-tutors/screenshots/add-tutor--step-1.png`: Add tutor fields and invite line.
- `07-tutors/screenshots/tutor-created--detail.png`: tutor page, Invite not accepted chip, Actions and Edit, tabs, Linked courses, Contact, Activity, toast.
- `08-team/screenshots/page--default.png`, `team-member-created--list.png`: Team table, You chip, Resend invite and Remove text actions, toast.
- `08-team/screenshots/add-team-member--dialog.png`, `add-team-member--filled.png`: Add team member dialog.
- `08-team/screenshots/team-remove-confirmation.png`: Remove from team? wording, red Remove (TM-09 and TM-06 step 1).
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/08-team/screenshots/add-team-member--dialog.png` (FEAT-009, the 08-team shot not opened before): empty Add team member dialog.
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-course-add-tutor.png` (FEAT-009): Add tutors to a course with + Add a tutor (TM-03). "Bello Tutors" replaced by Science Students Academy in 18 and 19.
- `08-team/screenshots/page--default.png` (review v1): Bobbin's sample admin is 'Admin User' with a Demo chip, so Kanvise names its sample admin Chidi Okafor in 00 section 13.

### 20 Data model

- No Bobbin data model screens. Tables checked against the screens they serve: `recording-session--detail.png` (attendance columns), `team-member-created--list.png` (invitation status), `tutor-created--detail.png` (linked courses, activity counts), `tutor-profile-notifications.png` (per-person switches). Staging tables read from `origin/staging:supabase/migrations/*.sql`.
- Kavi service (FEAT-008): `15-tutor-role/screenshots/tutor-course-plan-describe.png` (review every module before use: drafts only), `03-lessons/screenshots/sample-insights--recheck.png` (skeleton while preparing), `03-lessons/screenshots/lesson-ended--insights-status.png` ('AI insights coming soon' placeholder, not copied: Kanvise shows the manual path), `15-tutor-role/spec.md` ('too short to analyze', basis for the 5 minute minimum). Code read on `origin/staging`: `api/src/jobs/live-class-recording.ts`, `api/src/domain/mock-pdf-import.ts`, `api/src/jobs/durable-jobs.ts`, migrations `20260921090000` and `20261120090700`. Provider facts from the Gemini API additional terms, the Gemini abuse monitoring page, the Gemini pricing page, Deepgram's Model Improvement Program page and Deepgram pricing.
- FEAT-009: no further screens; 20 has no Bobbin equivalent beyond the screens above.

## Remaining mismatches with Bobbin

- 01 SH-02: Bobbin fills the active nav item black; Kanvise uses an orange left bar (brand, 00 section 11).
- 01 SH-02: Kanvise adds a WORK group (Homework, Quizzes); Bobbin has Clients, TO REVIEW and ORGANIZATION groups that Kanvise doesn't (no clients, review queues out of scope).
- 01 SH-15: Bobbin's help "new" dot is yellow; Kanvise uses blue (orange is only "you are here").
- 01 SH-16 / 16: Bobbin's web app has no phone layout; the bottom bar, More sheet and R-10 stacking are Kanvise's own.
- 01 SH-16: phone tab and top bar title say "Today"; the desktop sidebar keeps Bobbin's "Dashboard".
- 02: Bobbin has no onboarding questions; Kanvise asks five scripted ones (00 section 10). Bobbin's "Add a client" step becomes "Build the course plan"; independent tutors get "Check your classroom" instead of "Add a tutor". Bobbin's "Find the right plan" and "Chat to us" are not copied.
- 03 DB-08: Live now is admin-only; Bobbin gives tutors Live view. A tutor's own live lesson is already the Live row with Join.
- 03 DB-02: Bobbin's "Brief your tutors on letting students in" card is not copied (no admit step in Kanvise).
- 03: no trial banner, sales card, help card or mobile app card on the dashboard (billing on hold, online only); help lives in the help menu and on /setup.
- 03 DB-05: no safeguarding or approval rows (out of scope); adds homework, starting check, links and team rows.
- 04 CRS-01: Bobbin has an "Export join links" button; not copied (links live on each lesson).
- 04 CW-1: Bobbin's "where it runs" (delivery context) is dropped (online only); Kanvise adds Subject and a This is a trial switch.
- 04 CRS-04: Bobbin counts objectives ("27 of 90 objectives covered"); Kanvise counts topics because statuses live on topics. Bobbin's green Complete module chip is neutral with a tick (01 SH-15).
- 04 CRS-06: Bobbin's Browse plans template library (Country, Subject, Level, Exam board) is replaced by Copy plan from another course.
- 04 course page: Kanvise adds Archive to Bobbin's Actions (Edit, Delete) and keeps tutors from deleting (standard 03).
- 05 LL-01 and CAL-06: no Client filter, no Pending / approval / chargeable statuses; Kanvise adds Not held and Missed.
- 05 LW-2: Repeat, plan topic chips, timezone line and clash warning are Kanvise additions (Bobbin's step 2 has only topic, starts, ends).
- 05 LP-05: Bobbin has Copy and Email; Kanvise adds WhatsApp (confirmed by the owner) and the one-connection-per-link rule.
- 05 CAL-08: Bobbin shows an empty grid with no message; Kanvise adds "No lessons this week." and scrolls to off-screen early lessons. CAL-09 Agenda is Kanvise's own.
- 06 STU-03: Bobbin's 'Recording consent already given' starts ticked; Kanvise starts it unticked, because ticking it is the tutor attesting consent and recording depends on it (00 section 14d). Confirmed by the owner. Bobbin requires the last name; Kanvise requires either name.
- 06 STU-05: Bobbin's tabs are Summary, a progress tab, Lessons, Attendance; Kanvise has Summary, Lessons, Homework and quizzes, Summaries, Attendance (Summaries replaces the progress tab; courses stay a Summary card as in Bobbin). Bobbin's 'Recordings can be shared' (clients and students) becomes 'Casey can watch recordings'.
- 06 STU-07: consent is changed only from the Lesson recording card, not in Edit (Bobbin's edit has no consent field either).
- 07 CR-01/CR-06: Bobbin returns to the start card after End lesson and lets the tutor start again; Kanvise goes to CR-07 and offers Restart this lesson only for 60 minutes after an automatic end.
- 07 CR-03: Bobbin's 'Letting students in' tip and its 'Starting reloads the classroom.' line are not copied (no admit step; start must not reload, spike). Kanvise adds objectives, Materials, Set homework, Quick check, Let {student} know and Report a concern to Bobbin's panel.
- 07 CR-09: Bobbin has one admin join; Kanvise adds Lead and Watch with visible labels. Lead is preselected (owner's moderator decision); Watch is offered only when the tutor is in the lesson. Confirmed by the owner.
- 04 CW-2: after a one-to-one onboarding answer, Kanvise opens the student list as a single-choice picker with Add another student; Bobbin always shows checkbox rows (review v1).
- 07 CR-13: Bobbin flags transcripts automatically for a safeguarding queue; Kanvise has only a manual Report a concern by email.
- 08: Bobbin's lesson summary, student and tutor performance cards are AI-written with an admin approval step; Kanvise has five tutor-completed sections, no approvals, and No summary needed.
- 09: Bobbin's student side isn't in the atlas; the student app is Kanvise's own, checked against Bobbin's join link and lesson page and today's Kanvise portal.
- 10 HW-01: Bobbin's visibility line is "Only you and admins see what they hand in."; Kanvise names the course's tutors for agencies (same group as private notes, 00 section 16) and says "Only you" for independent tutors. Kanvise adds a students line and More options (hand-in mode, marking) that Bobbin's dialog doesn't have.
- 11: Bobbin has no quizzes; the whole spec is Kanvise's own.
- 12: Bobbin's timezone picker lists raw zone names (Africa/Abidjan); Kanvise shows city, zone and local time. Bobbin's default style is Detailed; Kanvise defaults to Structured (phone reading). Confirmed by the owner.
- 12: Bobbin's account-wide Emails switches and its Lesson insights, approvals, safeguarding, API, MCP, webhooks, Studybugs, beta and activity log sections are not copied.
- 15: Bobbin accepts no video either, and shows no size limits; the Upload limits table is Kanvise's own.
- 17: no In person tab (online only), no Billed column (billing on hold); Bobbin's Lesson filter is Course; loading uses skeleton rows instead of Bobbin's spinner. Late, Left early, Admin watching, Tutor didn't join, Deleted student, consent reasons, Delete recording and the student view are Kanvise's own.
- 17 REC-03: Bobbin shows the Tutor filter to tutors with one name; Kanvise hides it for agency tutors.
- 18: Bobbin's account-wide email switches are not copied; student scheduling and change emails are always on, reminder timing lives in 12 CFG-L. Kanvise has no tutor notification list (Bobbin has none either) but adds a student Bell and an admin daily summary email that Bobbin doesn't have.
- 18 NTF-02: 'reminders go to tutors' is interpreted as: tutors get a reminder of their own lessons, students get reminders per 12 CFG-L, and chasing reminders are tutor-pressed only. Confirmed by the owner.
- 19 TM-01: Bobbin's Import (CSV) and sample tutor banner are not copied; Kanvise adds status chips, This week and Summaries overdue columns. TM-04 tabs replace Bobbin's progress tab with Summaries.
- 19 TM-06: Bobbin's remove has no reassign step; Kanvise requires one. Bobbin deletes the person's account and personal data when they are in no other organization; Kanvise stops their sign-in and leaves deletion to the deferred account-closure policy.
- 19 TM-07/TM-08: Bobbin's 'client manager' lines are dropped (no clients).
- 20 DM-26: the Gemini API terms' line on under-18s is accepted by the owner and is not a launch blocker; the writing provider can still be moved (Vertex AI or another) by configuration.
- 20 DM-25: private notes are never sent to Kavi in v1 (00 sections 16 and 17 now say the same; review v1); 06 Ask Kavi matches 12 CFG-K's 'Never sent: private notes'.
- 15 RS-04: Bobbin's tab says files are for "this course's classrooms"; Kanvise also shares them with the course's students.
- 01 SH-06: Bobbin's tutor account menu has only Sign out; Kanvise shows My profile and Sign out to every role.
- 01 SH-04 / 03: Bobbin's NEW · MOBILE APP card and its mobile app dialog are not copied (one responsive web app, online only).
- 04 CRS-03: Bobbin lets agency tutors edit, delete and add people to a course; Kanvise lets them edit their own courses only (standard 03).
- 05 LW-2: Bobbin's step 2 is "Topic & schedule" / "When does the lesson take place?"; Kanvise says "Topic and time" because the step also links plan topics.
- 05 LP-02: Bobbin's "No insights for this lesson" banner with End lesson is replaced by the Awaiting summary, Not held and restart banners.
- 06 STU-01: Bobbin's tutor Students list shows only Name and Lessons completed; Kanvise shows the same columns as admins (minus Export).
- 07 CR-01: loading uses Bobbin's "Loading the classroom..." on Kanvise's dark background, not Bobbin's white.
- 12 CFG-S: two-factor sign-in is later; Bobbin has it now.
- 17: Bobbin's Unlinked sessions page is not copied (a Kanvise room only exists for a lesson).
- Shell, all pages: Kanvise uses underline tabs where Bobbin uses grey pill tabs, and an orange "you are here" bar where Bobbin fills the active nav item black (00 section 11).
- Scope, all pages: no clients, no in-person lessons, no report approvals queue, no safeguarding queue, no unlinked sessions, no trial or billing banner (00 sections 14 and 15).
- 03 DB-03 (fixed in review v1): Bobbin's Planned row shows Join beside the Planned chip; Kanvise had Prepare. Now Join, in secondary style until the classroom opens for students.
- Unintended mismatches still open: none known after the review v1 pass. The Bobbin student app is not in the atlas, so 09 could only be checked against Bobbin's tutor screens and today's Kanvise portal.

## Review v1 responses

Review file: `/projects/sandbox/.agents/tasks/task-redesign-spec-fix/2026-11-28-003616-review.md` (verdict NEEDS_CHANGES, 15 issues). Every issue was fixed; none declined.

| # | Issue | Action | Files and IDs |
|---|---|---|---|
| 1 | 00 private notes rule split | Fixed. 00 section 16 now says private notes are never sent to Kavi for any output in v1, matching section 17; 06 and 20 no longer call 16 looser; HANDOFF item 6 reworded | 00 §16; 06 STU-05 Kavi; 20 DM-10, DM-25; HANDOFF |
| 2 | Use my lesson notes feeds student-facing drafts | Fixed. Permanent warning line under the button ("...which your students will see. Take out anything private before drafting."), copied text highlighted until edited; added as owner confirmation 8 | 08 SM-01; HANDOFF |
| 3 | Manual starting check has no editor | Fixed. DIAG-P is the editor with or without Kavi (Write the questions opens two empty questions per topic); new 11 "Starting check mode" table (four options, fixed Not sure, two per topic, fixed topic, no explanation); 00 §5 says two per topic | 00 §5; 04 DIAG-D, DIAG-P, Kavi block; 11 QZ-02 Starting check mode; 20 DM-13, DM-30 |
| 4 | Build order dependency inversion | Fixed. New order: shell, people and settings, courses, homework and quizzes, starting check, lessons, classroom and recordings, summary, dashboard and setup, notification preferences, Kavi last. Rule that later-step buttons stay hidden, plus a table of minimum slices (SM-07 with step 7, early dashboard slice, onboarding defaults) | HANDOFF Build order |
| 5 | Dashboard Planned row drops Join | Fixed against `tutor-dashboard--default.png`: Join (secondary style) beside Planned for tutors and admins; Prepare removed | 03 DB-03, Checked against Bobbin |
| 6 | Join links expire before Start anyway closes | Fixed. Once a lesson starts, links are valid until 2 hours after the actual end; time-expired links work again; restart moves the time | 05 LP-05, status transitions; 20 DM-07 |
| 7 | Undo on Complete vs accepted CRS-08 rows | Fixed. Undo sets back rows accepted from that summary (unless changed again since), with toast "Lesson reopened. 3 course plan changes were set back."; CRS-08 notes the exception | 08 SM-04; 04 CRS-08 |
| 8 | Recording draft trigger described two ways | Fixed. Recording route is automatic (no button); card shows progress, then Show it; restart drops the job and draft for the shorter recording via a recording version in the dedupe keys | 08 flow, SM-01, SM-02; 07 CR-06; 20 DM-09, DM-24 |
| 9 | Admin Watch default | Fixed. Lead always preselected; Watch offered only when the tutor is in the lesson; owner confirmation 7 | 00 §14b; 07 CR-09; HANDOFF |
| 10 | Sample set not unified (F-64) | Fixed. Tutor Michael (Chen), admin Chidi Okafor (added to 00 §13), no-email student always Alex, Mathematics · Algebra 1 | 00 §13; 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 17, 18, 19 |
| 11 | Check length copy | Fixed. WhatsApp text and email use {minutes} from the chosen length (10, 20 or 35) | 04 DIAG-D, DIAG-S |
| 12 | Notification matrix misses opt-in notes | Fixed. Rows for Missed with Let Casey know and for Mark as cancelled with Let students know; 00 §19 points to NTF-02 | 18 NTF-01; 00 §19 |
| 13 | 00 §10 onboarding effect drift | Fixed. Question 3 now sets only how the People step opens, as in 02 | 00 §10 |
| 14 | Not held wording on the dashboard | Fixed. Uses 05's definition; Missed row added to the DB-03 table | 03 DB-03 |
| 15 | No-email student gaps | Fixed. Homework and quizzes tab shows starting check results for no-email students; CW-2 inline form reuses all STU-03 fields except Course and creates the student as STU-03 does | 06 No email; 04 CW-2 |
| Also | One-to-one picker missing from mismatch list | Added to 04 Checked against Bobbin and to Remaining mismatches | 04; this file |

## Review v2 responses

Review file: `/projects/sandbox/.agents/tasks/task-redesign-spec-fix/2026-11-28-004847-review.md` (verdict NEEDS_CHANGES, 4 issues). Every issue was fixed; none declined.

| # | Issue | Action | Files and IDs |
|---|---|---|---|
| 1 | Dashboard moved to step 9 | Fixed. Dashboard and setup are step 2 again, as a slice that grows: step 2 ships the DB-01, DB-03, DB-04, DB-07 and DB-08 frames with empty states; the table names the step that adds each DB-05 Needs attention row, each DB-06 suggestion rule, the DB-02 banners, DB-09 and Join. The briefed order is restored (courses and lessons together, then classroom, summary, homework and quizzes, starting check), using the hidden-until rule for CRS-07, the Homework and Quizzes tabs, LP-01's homework card and both Set homework buttons. Three deliberate changes from the briefed order are recorded in HANDOFF for the owner: people and settings before courses, the student app built step by step, recordings with the classroom and resources with courses. Kavi stays last (step 10, now also naming 12 CFG-K) | HANDOFF Build order |
| 2 | Course plan title off the screenshot | Fixed against `04-courses/screenshots/sample-course--outline.png`: 'Mathematics · High School' restored in CRS-03 and CRS-04, with the Mathematics and High School chips. The level needed a source, so CRS-04 adds an optional course level edited from the header (short text, or the CFG-K level names when set). 00 section 13 now allows general levels and limits only local ones such as SS2 or Year 9 | 04 CRS-03, CRS-04; 00 §13; 12 CFG-K; 20 DM-03 |
| 3 | Reopened summary proposals | Fixed. Undo withdraws every proposal from that summary: accepted rows are set back, waiting rows are removed, and completing again proposes fresh rows from what is ticked then. The toast reads 'Lesson reopened.' when nothing had been accepted. The proposals table gains a source id and a withdrawn state | 08 SM-04; 04 CRS-08; 20 DM-05 |
| 4 | Setup slice at step 9 | Fixed with issue 1. Onboarding (ONB-01 to ONB-11), /setup (SET-01 to SET-03) and the sidebar setup card ship in step 2. Each /setup row appears when its target ships (step 3, 4 or 5), with the count reading '{n}/{rows shown} completed' until all five exist; onboarding answers are saved in step 2 and used as STU-04 and the wizard ship. The sample course and its banner arrive in step 4 | HANDOFF Build order |

## Commits on design/redesign-spec (not pushed)

Start SHA `d07dee2`.

| SHA | Feature | Summary |
| --- | --- | --- |
| `1786213` | FEAT-002 | Settle decisions, amendments table, unique IDs and wording purge |
| `6616506` | FEAT-003 | Shell, responsive, onboarding and dashboard fixes |
| `a6a5928` | FEAT-004 | Courses, status models, starting check, lessons and calendar |
| `05a4f30` | FEAT-005 | Students, classroom and lesson summary fixes |
| `bdfe710` | FEAT-006 | Student app, homework, quizzes, settings and resources fixes |
| `9529e21` | FEAT-007 | Recordings, notifications, tutors and team, data model specs |
| `b14f802` | FEAT-008 | Kavi service spec, built last |
| `73161f9` | FEAT-009 | README, handoff and build order after the spec fix pass |
| `3943b24` | Review v1 | Address all 15 review v1 issues (private notes rule, starting check editor, build order, dashboard Join, link expiry, Undo, recording draft trigger, Lead default, sample names, notifications, no-email gaps) |
| `90491d0` | Review v2 | Address all 4 review v2 issues (dashboard and setup back at step 2 as a growing slice, briefed order restored with three recorded changes, 'Mathematics · High School' restored with an optional course level, Undo withdraws a reopened summary's proposals) |
| `73487f8` | Owner confirmations | Record confirmed decisions: consent unticked, reminders reading, Structured style, Lead/Watch, WhatsApp join links, Gemini under-18 terms no longer a launch blocker |
