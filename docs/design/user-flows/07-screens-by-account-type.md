# Screen by screen: who sees what

Written 28 Nov 2026 from the redesign specs. "Merged view" was too vague, so this
lists every screen and what changes on it for each kind of person. Spec IDs point
at the rule. Where the specs say nothing, the row is marked **gap**.

## The idea in one paragraph (what "D-22" means)

Two switches decide almost everything on screen:

1. **Role.** What the logged-in person is allowed to do: **admin**, **tutor** or
   **student**. One login can hold two roles in the same organisation, for example
   an admin who also teaches.
2. **Team on or off.** Whether the organisation has other people besides the
   owner. An **independent tutor** is an organisation with team **off**, whose owner
   holds both the admin and tutor roles. An **agency** has team **on**.

So an independent tutor needs no special screens. They get the admin's powers
(create courses, add students, settings, data) minus everything that only makes
sense when there is a team (Tutors page, tutor columns and filters, and so on).
When they add their first colleague, team turns on and those items appear.

The "model" I kept calling D-22 is just this: **roles plus a team switch, instead of
separate account types.** The only new thing for people is **Switch role** in the
account menu, for an admin who also teaches. It shows the agency-tutor screens
exactly as a tutor sees them.

## 1. The columns

| Column | Who | Notes |
|---|---|---|
| **Independent** | Owner of an organisation with team off | Admin and tutor roles together |
| **Admin** | Agency admin, in the Admin role | Everything in the agency |
| **Tutor** | Agency tutor, **and** an admin who has switched to the Tutor role | Own courses only |
| **Student** | Student | Own lessons and work |

## 2. App shell (01)

| Element | Independent | Admin | Tutor | Student |
|---|---|---|---|---|
| Account card label (SH-02) | **YOUR TUTORING**, photo, name | **TUTORING AGENCY**, logo, agency name | Same as admin | Student shell |
| Setup item and card | Yes, until done | Only the admin who created the agency | No | No |
| Sidebar: Dashboard, Calendar, Lessons, Courses, Homework, Quizzes, Recordings, Resources, Settings | Yes | Yes | Yes (courses and data limited, below) | Own set (09) |
| Sidebar: Students | Yes | Yes | Read-only list of their students | No |
| Sidebar: **Tutors**, **Team** | Hidden (team off) | Yes | Not available (SH-14a) | No |
| User card second line | Email only | **Admin · Agency name** | **Tutor · Agency name** | Name |
| Account menu | Sign out, Switch account if in several | Same, plus **Switch role** if they also teach | Same | Sign out |
| Search results (SH-05) | Students, courses, lessons, homework, quizzes, resources, settings | Adds Tutors | Only their own courses, lessons and students | n/a |

## 3. Dashboard (03)

| Element | Independent | Admin | Tutor | Student |
|---|---|---|---|---|
| View | Tutor view (DB-07) | Admin view (DB-08) | Tutor view (DB-07) | Home (SA-03) |
| Today and This week | Own lessons | Every lesson; each row also shows the tutor; **Mine only** toggle | Own lessons | Own lessons |
| **Live now** link and `/lessons/live` (DB-09) | No | Yes | No | No |
| Needs attention: summaries to write, homework to mark, checks to review, links to send | Yes | Yes if they teach; agency-wide counts need OQ-05 | Yes | No |
| Needs attention: students not joined yet | Yes | Yes | No | No |
| Needs attention: summaries overdue, lessons that didn't start, homework waiting over 3 days, tutors not joined yet, lessons without a tutor | No | Yes | No | No |
| Banners | Sample course; no Welcome | Sample course; Welcome for an invited admin | Welcome with **Test classroom** | Notifications card |
| Suggestions | Yes | Yes | Yes | No |

## 4. Courses (04)

| Element | Independent | Admin | Tutor | Student |
|---|---|---|---|---|
| List: which courses | All theirs | All in the agency | Only courses given to them | Own courses (SA-07) |
| **New course** button | Yes | Yes | No | No |
| List columns | Course, Subject, Students, Course plan, Next lesson | Adds **Tutor**; filter adds Tutor | Same as independent | Cards |
| Empty state | "No courses yet" with **Create a course** | Same | "Your admin adds you to courses." No button | "No lesson booked yet." |
| New course wizard, step 2 | **Students** only | **Students** and **Tutors** (at least one) | n/a | n/a |
| Course page: Tutor card with **+ Add** | Hidden | Yes | Shows tutors, no add | n/a |
| Archive, delete | Yes | Yes | No | n/a |
| Edit plan, set statuses, send starting check | Yes | Yes | Own courses | No (reads plan) |

## 5. Lessons and calendar (05)

| Element | Independent | Admin | Tutor | Student |
|---|---|---|---|---|
| List and calendar scope | Own | Every lesson | Own courses | Own |
| Tutor column and Tutor filter | No | Yes | No | No |
| New lesson, wizard step 1 | Course and students | Adds **Tutor** | Course and students (own courses) | n/a |
| Schedule, reschedule, cancel | Yes | Any lesson | Lessons on own courses | No |
| Start and teach | Yes | Only as tutor (needs the Tutor role) | Own lessons | No |
| **Join as an admin?** (Lead or Watch) | n/a | Yes, for lessons they don't teach | No | No |
| Copy, send, renew join links | Yes | Yes | Own lessons | Own link |
| Empty state for no course | "You need a course first" | Same | "Ask your admin to add you to a course." | n/a |

## 6. People (06, 19)

| Element | Independent | Admin | Tutor | Student |
|---|---|---|---|---|
| Students list | All | All | Only students on their courses, read-only | n/a |
| Add, import, edit, remove, export, delete data | Yes | Yes | No | No |
| Recording consent | Yes | Yes | See only | Own |
| Student notes | Yes | Yes | Students on their courses | Never |
| **Tutors** page, tutor page, remove and reassign | Hidden | Yes | No | No |
| **Team** page, add team member | Hidden | Yes (not themselves, not the last admin) | No | No |
| Invite tutors | Not available until team is on | Yes | No | No |

## 7. Work and library (10, 11, 15, 17)

| Element | Independent | Admin | Tutor | Student |
|---|---|---|---|---|
| Homework and quizzes: which | Own | Any course in the agency | Own courses | Own |
| Accept course plan changes (CRS-08) | Yes | Yes | Own courses | No |
| Resources: upload and organise | Yes | Any file | Own files | No |
| Resources: **Team folders** | n/a | Manage | Read-only | No |
| Recordings: which lessons | Own | Every lesson | Own courses | Own lessons, in the app |
| Recordings: Tutor filter | No | Yes | No | n/a |
| Recordings: export CSV, delete | Yes | Yes | No | No |

## 8. Classroom and notifications (07, 18)

| Element | Independent | Admin | Tutor | Student |
|---|---|---|---|---|
| In the classroom | Tutor tools | **Lead** (full tools) or **Watch** (read-only) on a lesson they don't teach; Tutor tools if they teach | Tutor tools on own lessons | Room only |
| Attendance shown as | Tutor | **Admin, leads the room** or **Admin watching** (not counted as tutor) | Tutor | Student |
| Notification rows: lesson reminders, students waiting, homework handed in, and so on | Yes | Only those for lessons they teach | Yes | Their own |
| **Courses given to me** | No | If they teach | Yes | No |
| **Daily summary for admins** (7 AM) | No | Yes | No | No |
| Where a concern goes | Kanvise support | The agency's admins | The agency's admins | Same |

## 9. Settings (12)

| Section | Independent | Admin | Tutor |
|---|---|---|---|
| PERSONAL: My profile, Sign-in and security, Notifications | Yes | Yes | Yes |
| LESSONS: How you teach, Lessons and classroom, Kavi | Yes | Yes | No (inherited, read-only) |
| ACCOUNT: General, Data and privacy | Yes | Yes | No |
| Billing (hidden until it exists) | Yes | Yes | No |
| **Add me as a tutor** (Tutors page, setup step) | Not needed, already both roles | Yes, once | Not shown |

## 10. What turns on when team goes on

Everything listed as **Hidden** for Independent is controlled by one fact: the team
is on. Turning it on (Settings › How you teach › **With a team**) adds:

- the Tutors and Team pages,
- the Tutor column and filter on lists, the calendar and recordings,
- the Tutor step in the new-course and new-lesson wizards,
- the Tutor card on the course page,
- **Live now**, the **Mine only** toggle, and the admin Needs attention rows,
- **Join as an admin?** and **Switch role**,
- the Team folders in Resources,
- the 7 AM daily summary,
- invitations for tutors and team members,
- concerns going to admins instead of Kanvise support.

The owner's own courses and students stay as they were. Nothing is deleted.
Going back to **On my own** is only allowed when no other team member is active
(diagram `19-solo-to-team.png`).

## 11. Gaps this exercise found

| Gap | Recommendation |
|---|---|
| Independent tutors set "Alex Thompson Tutoring" as the sidebar name (SH-02), but the old Business details only asked for an agency name | Fixed: **General** now has the same name field for everyone (D-18, revised) |
| The admin dashboard's Needs attention counts for an admin who does not teach (OQ-05) | Show agency-wide counts, labelled for admins |
| Agency tutors see settings sections hidden from them, but the agency's lesson defaults still apply to them. Nothing tells them | Show them the agency defaults, read-only, under PERSONAL |
| The account card for an admin who has switched to Tutor role | Show **Tutor · Agency name** (user card second line) |
| What a person sees on a phone for Switch role | Put it in the More sheet (16) |

Items in this table that need the spec text changed are marked as proposals in
`03-decisions-and-open-questions.md`.
