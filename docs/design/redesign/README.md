# Kanvise redesign specs

New session? Start with [SESSION-HANDOFF.md](SESSION-HANDOFF.md). Then read
`HANDOFF.md`, then `00-decisions.md`. `00-decisions.md` wins if anything
conflicts; `16-responsive.md` wins on phone behaviour.

| File | Covers | Status |
|---|---|---|
| SESSION-HANDOFF.md | Start here in a new session: who the owner is and how they work, repo workflow, what's done, next step, open items, opening prompt | Current |
| history/ | Archived critic review, spec fix notes, screenshot index and the spec checker (`check.py`) | Archive |
| HANDOFF.md | Where things stand, owner decisions, content dependencies, launch checks, build order | Current |
| 00-decisions.md | What has been agreed, words we don't use, permissions, consent, private notes (student notes and lesson notes), Kavi rules, billing left out, standards changes | Agreed |
| 01-app-shell.md | Sidebar, search, help, account menu, toasts, dialogs, saving and offline, colour rule, accessibility | Draft for review |
| 02-onboarding-and-setup.md | Kavi's five scripted questions, the /setup checklist, invited tutors | Draft for review |
| 03-dashboard.md | Today, This week, Needs attention, Suggestions, Live lessons | Draft for review |
| 04-courses-plan-and-diagnostic.md | Courses, the three-step new course wizard, course plan, topic status model, starting check | Draft for review |
| 05-lessons-and-scheduling.md | Lesson statuses, lessons list, new lesson wizard, lesson page, join links, timezones, calendar | Draft for review |
| 06-students.md | Students list, add and import, student page, recording consent, student notes, deleting a student's data | Draft for review |
| 07-classroom.md | PlugNMeet boundary, start card, waiting for the tutor, Lesson tools, ending and restarting, admin Lead and Watch, device check, alerts, second devices | Draft for review |
| 08-lesson-summary.md | After a lesson: writing the summary, lesson notes, Kavi drafts (from the recording or the lesson notes), completing, No summary needed, missed lessons | Draft for review |
| 09-student-app.md | Getting in, join links, students without an email, Home, lessons, homework, courses, notifications | Draft for review |
| 10-homework.md | Set, hand in, mark, Kavi feedback drafts | Draft for review |
| 11-quizzes.md | Multiple-choice quizzes: write or generate, take, results, the Later list | Draft for review |
| 12-settings-and-team.md | Profile, sign-in and security, notifications, teaching, lessons and classroom, Kavi, business details, data. Team pages moved to 19; the file name is kept so references don't break | Draft for review |
| 13-billing.md | Proposal only, not built: payers, prices, invoices (on hold with payments; reserved room in 20 DM-31) | Proposal |
| 14-old-flows-inventory.md | Every current page and feature and what happens to it (Keep, Replace, Retire) | Draft |
| 15-resources.md | Library, upload limits, folders, attaching to courses, lesson materials | Draft for review |
| 16-responsive.md | Phone, tablet and desktop rules for every screen and role | Draft for review |
| 17-recordings-and-attendance.md | Attendance rules, recordings page, player, export, delete and retention, what students see | Draft for review |
| 18-notifications.md | The notification matrix, reminders, held messages, email rules, admin daily summary, push | Draft for review |
| 19-tutors-and-team.md | Tutors list and page, add and remove with reassign, Team, adding yourself as a tutor, Switch role, invitations | Draft for review |
| 20-data-model.md | Product tables mapped to staging (DM-01 to DM-20); Kavi service (DM-21 to DM-30), built last; reserved for billing, not built (DM-31) | Draft for review |
| 21-sign-in-and-sign-up.md | Sign up, sign in, forgot and reset password, signed-out dialog. Flow and words only; look waits for the owner's screenshots | Draft for review |

## State IDs

Every screen state has an ID made of a prefix and a number, for example
`CW-3` or `LP-04`. IDs are stable: build tickets, PRs and reviews refer to
them, so an ID is never reused or renumbered. A removed state keeps its number
retired; a new state takes the next free number or a letter suffix (`SH-04a`).

| Prefix | Spec | Covers |
|---|---|---|
| SH | 01 | App shell |
| ONB | 02 | Onboarding questions |
| SET | 02 | Setup checklist |
| DB | 03 | Dashboard |
| CRS | 04 | Courses and the course page |
| CW | 04 | New course wizard |
| DIAG | 04 | Starting check |
| LL | 05 | Lessons list |
| LW | 05 | New lesson wizard |
| LP | 05 | Lesson page and join links |
| CAL | 05 | Calendar |
| STU | 06 | Students |
| CR | 07 | Classroom |
| SM | 08 | Lesson summary |
| SA | 09 | Student app |
| HW | 10 | Homework |
| QZ | 11 | Quizzes |
| CFG | 12 | Settings |
| BL | 13 | Billing proposal |
| RS | 15 | Resources |
| R | 16 | Responsive rules |
| REC | 17 | Recordings and attendance |
| NTF | 18 | Notifications |
| TM | 19 | Tutors and team |
| DM | 20 | Data model and Kavi service |
| AU | 21 | Sign up and sign in |

The spec fix pass retired two old prefixes because they collided between
specs. The old LS numbers became LL-01 (05) and SM-01 to SM-06 (08). The old
ST numbers became STU-01 to STU-10 in 06 (student notes moved from number 10
to STU-06, and the old 6 to 9 became STU-07 to STU-10) and CFG- with the same
letters in 12 (for example CFG-K). The undefined classroom reference "07b" was
removed; the text points to CR-03.
