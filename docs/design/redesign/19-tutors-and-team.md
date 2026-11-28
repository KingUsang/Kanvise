# 19 · Tutors and team

Status: draft for owner review. Builds on `00-decisions.md` (§2, §14c, §19),
`01-app-shell.md` (SH-02, SH-08, SH-14a), `02` (SET-01, ONB-10), `03` (DB-05),
`04` (CW-2), `05` (LW-1), `07` (CR-09), `12` (CFG-P, CFG-T), `17`, `18`.

**Who:** agency admins. Independent tutors have no Tutors or Team page; they
switch to a team in 12 CFG-T (**With a team** › **Set up your team**), which
turns their account into an agency with them as its admin.
**Goal:** add the people who teach and run the agency, see how each tutor is
doing, and remove someone without leaving a course without a tutor.

This replaces the Team section that used to be in 12 (CFG-TM now points
here). It copies Bobbin's PEOPLE group: Tutors (`/tutors`, `/tutors/:id`) and
Team (`/team`) are separate sidebar items (01 SH-02).

## Flow at a glance

```
PEOPLE › Tutors (/tutors) → TM-01 list → Add tutor (TM-03) → TM-04 tutor page
                                        → ⋯ Remove (TM-06 with Reassign)
PEOPLE › Team (/team)     → TM-07 list → Add team member (TM-08)
                                        → Remove (TM-09, Reassign if they teach)
Admin teaches too: 12 CFG-P I teach too → TM-10
Invitations and the 50-an-hour limit: TM-11
```

## Roles in one table

| | Agency admin | Agency tutor |
|---|---|---|
| Where they are listed | Team (`/team`); also Tutors when **I teach too** is on | Tutors (`/tutors`) |
| Courses and lessons | Sees and changes everything in the agency (00 section 14c) | Only courses they are the tutor on |
| Create courses, add students | Yes | No (owner decision, standard 03) |
| Teach lessons as the tutor | Only with **I teach too** (TM-10); otherwise **Join as an admin?** (07 CR-09) | Their own lessons |

---

## TM-01 · Tutors list

Checked against `07-tutors/screenshots/page--default.png`.

Route `/tutors`. Header **Tutors** · "The tutors who teach your agency's
courses." On the right: **Add tutor** (primary, indigo). Bobbin's **Import**
(CSV) is not copied: agencies have a handful of tutors and each one needs an
invite, so the list grows one by one (see Checked against Bobbin).

Under the header: **Search tutors…** (name or email), and status chips **All**
· **Active** · **Invited** · **Removed**, with counts. The dashboard's **Tutors
not joined yet** row (03 DB-05) opens this list on **Invited**.

**Table:**

| Column | Shows |
|---|---|
| **Name** | Avatar, name, and a chip: **Invite not accepted** (amber, as Bobbin), **Admin** (for an admin with **I teach too**), **You** |
| **Courses** | Count, with the first two course swatches |
| **This week** | Lessons this week: **6 lessons** |
| **Summaries overdue** | A count in red tint when over 0 (ended over 48 hours ago, 03 DB-05), otherwise **-** |
| **⋯** | **Resend invite** (Invited only), **Edit**, **Remove from agency** |

- Rows open the tutor page (TM-04).
- **Removed** tutors keep a row so their past lessons stay findable; their
  only action is **Invite again**.
- Pagination as 16 R-04. On phones each row is a card (16).

## TM-02 · Tutors empty, loading and error

Checked against `07-tutors/screenshots/page--default.png`.

- **Empty**, as Bobbin's card: people icon in the Tutors tint, **No tutors
  yet**, "Tutors teach your agency's courses. Add one so you can put them on a
  course." Buttons: **Add tutor** (primary) and, for an admin who teaches,
  **I teach too** (secondary, opens 12 CFG-P with the toggle highlighted, TM-10).
  Bobbin's sample tutor banner is not copied: the sample course (02) is enough.
- **No results** (search or chip): **No tutors match "mic".** with **Clear
  search**.
- **Loading:** five grey skeleton rows in the table's shape.
- **Error:** banner **Couldn't load tutors. Try again.** with **Try again**.
- **Not available:** agency tutors and independent tutors opening `/tutors`
  see 01 SH-14a.

## TM-03 · Add tutor

Checked against `07-tutors/screenshots/add-tutor--step-1.png` and
`tutor-created--detail.png`.

A dialog, as Bobbin's:
- Title **Add tutor** · "Add a tutor to Science Students Academy." (Bobbin's "They have no
  paying client" is dropped: Kanvise has no clients.)
- **First name (optional)** and **Last name** side by side.
- **Email**, placeholder **tutor@example.com**. Line under it, Bobbin's
  wording in Kanvise terms: **We'll email Michael an invite to set a password
  and sign in. If they already use Kanvise, they'll sign in with their existing
  password instead.**
- **Timezone**, searchable, starting at the account's timezone (12 CFG-A),
  shown as **Lagos (WAT) · 4:02 PM** (12 CFG-P style).
- **Courses (optional):** a multi-select of the agency's courses with
  swatches. Line: **They'll see only the courses you give them.** A course
  that already has a tutor shows **Replaces Priya Shah** beside it.
- **Cancel** · **Add tutor**.

**After adding:** the tutor page (TM-04) opens with the **Invite not
accepted** chip and the toast **Tutor added and invited. They'll see their
courses once they accept.** (Bobbin's toast, `tutor-created--detail.png`).

**Errors (inline, the typed values kept):**
- Missing last name: **Add a last name.** Bad email: **Check the email
  address.**
- Already a tutor or admin here: **Michael is already in your agency.** with
  **Open their page**.
- The email belongs to a student in this agency: **This email belongs to a
  student in Science Students Academy. Use a different email for teaching.**
- Over the invite limit (TM-11): **You've sent a lot of invitations. Try again
  in an hour.**

## TM-04 · Tutor page

Checked against `07-tutors/screenshots/tutor-created--detail.png`.

Route `/tutors/:id`. Header: avatar, name, status chip (**Invite not
accepted**, **Removed**, or none when active). On the right: **Actions ▾**
(**Resend invite**, **Remove from agency**) and **Edit** (TM-05), as Bobbin.

Tabs (Bobbin's Summary, Lessons and Attendance, with Bobbin's progress tab
becoming Summaries): **Summary** · **Lessons** · **Summaries** ·
**Attendance**.

**Summary tab:**
- Left, **Courses** (Bobbin's Linked courses): each course with swatch, name,
  students count and next lesson. Empty: **No courses yet.** with **Give them a
  course** (opens a course picker; the same reassignment rules as TM-06
  apply when the course has a tutor).
- Left, **Upcoming lessons:** the next five, with **See all** (Lessons tab).
  Empty: **No lessons booked.**
- Right, **Contact:** email (mail link, as Bobbin) and WhatsApp when set.
- Right, **At a glance** (Bobbin's Activity card): Lessons completed, Total
  lessons, **Summaries overdue** (red when over 0), **Hand-ins waiting over 3
  days**, **Tutor didn't join** count this term (17).

**Lessons tab:** the Lessons list (05 LL-01) filtered to this tutor, with the
same tabs.

**Summaries tab:** summaries by this tutor, overdue first (**Overdue · 3 days**
in red), then newest. Each opens the lesson's Summary tab (05 LP-02). Private
notes follow 00 section 16 (admins can see them).

**Attendance tab:** the attendance table from 17 (REC-01 with the Tutor filter
fixed to this tutor), including **Tutor didn't join** rows.

**States:** loading skeleton in the page's shape; error banner with **Try
again**; a tutor not in this agency shows 01 SH-14a.

## TM-05 · Edit tutor

- **First name**, **Last name**, **Timezone**.
- **Email** can be changed only while the invite is not accepted (the invite is
  then sent to the new address). After that, the tutor changes it themselves
  (12 CFG-S). Line: **Michael manages their own email now.**
- **Cancel** · **Save changes**. Toast **Changes saved.**

## TM-06 · Remove a tutor, and reassign their courses

Checked against `08-team/screenshots/team-remove-confirmation.png` (Bobbin's
remove wording) for step 1. Step 2 is Kanvise's.

From **⋯ › Remove from agency** (TM-01) or **Actions › Remove from agency**
(TM-04). A dialog with up to two steps.

**Step 1, confirm:**
- **Remove Michael Chen from Science Students Academy?**
- "Michael will no longer be able to sign in to Science Students Academy, and an invite
  they haven't accepted stops working. Their past lessons, summaries and
  students' work stay, with their name on them."
- If they teach no course: **Cancel** · **Remove** (red). Done.
- If they teach courses: **Cancel** · **Next: choose new tutors**.

**Step 2, Reassign (required when they teach any course):**
- **Who teaches Michael's courses now?** · "Their upcoming lessons and
  unwritten summaries move with each course."
- One row per course they teach: swatch, name, **4 upcoming lessons**, and a
  **New tutor** dropdown (active and invited tutors, and admins with **I teach
  too**, TM-10). When the course has other tutors, the first of them is
  preselected. Under the list: **+ Add a tutor** opens TM-03 on top and returns
  with the new tutor selectable.
- **Use one tutor for all** fills every row at once.
- **Back** · **Remove and reassign** (red), disabled until every course has a
  new tutor. Line beside it when disabled: **Choose a tutor for 1 more
  course.**

**After removing:**
- Toast: **Michael Chen removed. 2 courses moved to Priya Shah.** No **Undo**:
  access ends at once. **Invite again** on the Removed row brings them back
  (their old courses are not given back automatically).
- The new tutors get **Courses given to me** and the students get **Priya Shah
  is now your tutor** (18 NTF-01). The removed tutor gets the removal email.
- Upcoming lessons keep their times and links; their tutor changes. Summaries
  still to write move to the new tutor. Past lessons keep Michael's name with
  **(removed)**.
- Their sign-in for other Kanvise accounts is untouched. If they belong to no
  other account, they can no longer sign in; deleting their personal data
  follows the account-closure policy, which the owner has deferred (12 CFG-D).

**Blocked cases:**
- Teaching right now: **Michael is teaching a lesson now. Remove them after it
  ends.** (Remove disabled.)
- **Lessons without a tutor** (03 DB-05) never come from this flow, because
  step 2 is required. The dashboard row only shows if a tutor's access ended
  outside it (for example Kanvise support closed their sign-in); it then opens
  step 2 for those courses.

## TM-07 · Team

Checked against `08-team/screenshots/page--default.png` and
`team-member-created--list.png`.

Route `/team`. Header **Team** · "The admins who run Science Students Academy. Admins can
see and change everything in the agency." (Bobbin's "client manager" line is
dropped: Kanvise has no clients.) On the right: **Add team member**.

**Table** (Bobbin's two columns):
- **Name:** avatar, name, chips **You**, **Invite not accepted** (amber),
  **Teaches too** (when **I teach too** is on).
- **Email.**
- Actions as plain text buttons on the right, as Bobbin: **Resend invite**
  (only while not accepted) and **Remove**. Your own row and the only admin's
  row have no **Remove**.

**States:** loading skeleton rows; error banner with **Try again**; agency
tutors and independent tutors see 01 SH-14a. The list is never empty (it
always has you).

## TM-08 · Add team member

Checked against `08-team/screenshots/add-team-member--dialog.png` and
`add-team-member--filled.png`.

- Title **Add team member** · "Team members can manage everything in Bello
  Tutors, including every course, lesson and student."
- **First name (optional)**, **Last name**, **Email** with the line: **We'll
  email Ada an invite to set a password and sign in. If they already use
  Kanvise, they'll sign in with their existing password instead.**
- **Cancel** · **Add team member**.
- After: the row appears at the top with **Invite not accepted**, and the
  toast **Team member added and invited. They'll get access once they
  accept.** (Bobbin's toast).
- Errors as TM-03, including the invite limit.

## TM-09 · Remove from team

Checked against `08-team/screenshots/team-remove-confirmation.png`.

- **Remove from team?**
- "Ada Obi will no longer be able to manage Science Students Academy, and an invite they
  haven't accepted stops working. If they aren't in another account on
  Kanvise, they can no longer sign in."
- **Cancel** · **Remove** (red).
- If the admin has **I teach too** and teaches courses, **Remove** becomes
  **Next: choose new tutors** and step 2 of TM-06 follows.
- There is always at least one admin: the last admin has no **Remove**, and
  you can't remove yourself (another admin must).
- Toast: **Ada Obi removed from the team.**

## TM-10 · I teach too

The setting is in 12 CFG-P (agency admins only, off by default). This section
owns what it changes.

- **On:** the admin also appears in Tutors (TM-01, with the **Admin** chip), in
  the tutor choices of the course wizard (04 CW-2), the lesson wizard (05
  LW-1) and Reassign (TM-06). Lessons they teach count as a tutor's: reminders
  (18 NTF-02), Summaries overdue, attendance as **Tutor** (17).
- **Off:** they lead a lesson only through **Join as an admin?** (07 CR-09).
- **Turning it off while teaching courses:** the dialog **You're the only
  tutor on 2 courses. Choose a new tutor first.** with step 2 of TM-06 for
  those courses. Turning it off is saved only after every course has a new
  tutor.
- A one-person agency (the owner teaches) turns it on once; the setup step
  **Add a tutor** (02 SET-01) counts it as done.

## TM-11 · Invitations and limits

- **The invite email** (18 NTF-01): from the agency, **Science Students Academy invited
  you to teach on Kanvise.** with **Accept invitation**. Accepting sets a
  password and goes to the invited tutor's welcome (02 ONB-10), or signs in an
  existing Kanvise user and adds the agency to their account switcher.
- An invite link works for 7 days and once. **Resend invite** makes a new link;
  the old one stops at once. An expired link shows: **This invite has expired.
  Ask Science Students Academy to send a new one.**
- **Limit:** an account can send at most 50 invitations an hour, counting
  students, tutors and team members together (00 section 19). Over that, the
  dialog shows **You've sent a lot of invitations. Try again in an hour.** and
  keeps what was typed.
- Inviting is admin-only. Agency tutors never see Add tutor or Add team
  member.

## Permissions

| Action | Agency admin | Agency tutor | Independent tutor |
|---|---|---|---|
| See `/tutors`, `/tutors/:id`, `/team` | Yes | No (01 SH-14a) | No (switch to a team in 12 CFG-T) |
| Add tutor, add team member, resend invites | Yes | No | No |
| Edit a tutor | Yes | No (they edit their own profile in 12) | n/a |
| Remove a tutor or team member, reassign | Yes, except themselves and the last admin | No | n/a |
| Turn on **I teach too** | Their own | n/a | n/a |
| Create courses, add students | Yes | No (owner decision) | Yes |

## Data needed (for the build)

Tables are in `20-data-model.md`: people, memberships and roles DM-01,
invitations and the hourly limit DM-02, course tutors and reassignment DM-03,
lessons DM-06, attendance DM-08, settings (I teach too) DM-14, notifications
DM-15.

### Kavi

- Input: none.
- Output: none. Tutors and Team have no Kavi feature in this version.
- Failure state: none.
- What the tutor must confirm: n/a.
- Without Kavi: the pages are the same.

## Checked against Bobbin

- `07-tutors/screenshots/page--default.png`: header **Tutors** with a subtitle,
  **Import** and **Add tutor** top right, **Search tutors…**, sample tutor
  banner, empty card **No tutors yet** with **Add tutor** and **Import from
  CSV** (TM-01, TM-02). Import and the sample banner are not copied.
- `07-tutors/screenshots/add-tutor--step-1.png`: **Add tutor** dialog with
  First name (optional), Last name, Email with the invite line, Timezone,
  **Cancel** · **Add tutor** (TM-03). Kanvise drops "no paying client" and adds
  Courses (optional).
- `07-tutors/screenshots/tutor-created--detail.png`: tutor page with the
  **Invite not accepted** chip, **Actions ▾** and **Edit**, tabs, Linked courses
  (**No courses linked yet.**), Contact, Activity (Lessons completed, Total
  lessons) and the toast **Tutor created and invited** (TM-04).
- `08-team/screenshots/page--default.png`: **Team** with the subtitle and
  **Add team member**, Name and Email columns, **You** chip, **Remove** as a
  text action (TM-07).
- `08-team/screenshots/add-team-member--dialog.png`, `add-team-member--filled.png`:
  dialog title, the "can manage everything" line, First name (optional), Last
  name, Email with the invite line (TM-08). "client's manager" dropped.
- `08-team/screenshots/team-member-created--list.png`: **Invite not accepted**
  chip, **Resend invite** and **Remove**, and the toast (TM-07, TM-08).
- `08-team/screenshots/team-remove-confirmation.png`: **Remove from team?**,
  the access and invite wording, **Cancel** · **Remove** in red (TM-09, and
  step 1 of TM-06). The Reassign step is Kanvise's own (F-35).
- `01-dashboard/screenshots/page--default.png`: PEOPLE group with Students,
  Clients, Tutors and Team (Clients not copied).

Final Bobbin pass (FEAT-009):
- `08-team/screenshots/add-team-member--dialog.png`: empty Add team member dialog (TM-08).
- `15-tutor-role/screenshots/tutor-course-add-tutor.png`: Add tutors to a course, with + Add a tutor opening TM-03.
