# Independent tutor and tutoring agency: how each works

Status: draft for owner review, 28 Nov 2026. Uses the updated Bobbin atlas
(`research/bobbin-appatlas`, commit `c49a8fb`) and the redesign specs. The model
in section 2 (D-22) is a **recommendation that changes approved spec text**, so it
waits for your yes before I edit the specs.

## 1. What the atlas update showed

The new folder `17-admin-tutor-role-test` tested an admin who is also a tutor, on
Bobbin's live app. Results:

- Typing the admin's own email in **Tutors, Add tutor** does not send an
  invitation. Bobbin recognises the person and asks: "{Name} is already an admin
  here. Add them as a tutor too?" After **Add {Name} as a tutor** the tutor is
  created at once. No email, no acceptance.
- The same login then holds **two roles** in the organisation (administrator and
  tutor). The account menu gains **SWITCH ROLE: Admin / Tutor**.
- In **Tutor** mode the menu loses Clients, Tutors, Team, Report approvals,
  Safeguarding, Unlinked sessions and organisation settings. It keeps Dashboard,
  Calendar, Lessons, Courses, Students, Recordings, Resources and personal
  Settings, and the dashboard shows the teaching schedule and reports to write.
- Switching back to **Admin** restores everything. Both switches worked live.

**A correction.** Earlier I told you Bobbin sends an admin to a separate tutor
account. That was wrong. Bobbin's join-dialog line ("join from that account
instead") means this role switch. I have fixed the wording in my notes (below).

Bobbin has no "independent tutor" type. Everyone, even a one-person business, is
an organisation. That is a useful hint for the model below.

## 2. The model (recommendation D-22)

One person has one login. A login can hold roles in organisations: **admin**,
**tutor** or **student**. An **independent tutor is an organisation of one**
whose owner holds both the admin and tutor roles.

![Account model](diagrams/16-account-model.png)

- **Independent tutor:** no team. The Tutors and Team pages are hidden, and there
  is no role switch, because there is nobody else to be an admin over. One merged
  view: the tutor screens plus the owner's powers (create courses, add students,
  settings, data).
- **Agency:** the team flag is on. Admins see everything. Tutors see only their
  own courses. An admin who also teaches holds both roles and gets **Switch
  role**.
- **Student:** a role in one or more organisations.

Why this model, in plain terms:

| Reason | What it means |
|---|---|
| One code path (D-19) | Independent and agency are the same product with a flag. No separate screens to build and keep in sync |
| Reuses the tutor view | In Tutor mode an admin sees exactly what an agency tutor sees, so it is built and tested once |
| Simple permission checks | Each request is judged in one active role, not a blend |
| Cleaner admin screens | An admin who teaches is not shown admin clutter while teaching |
| Proven | It is what Bobbin does, tested live |

### Options compared

| | A. Toggle only (spec as approved) | B. Two roles and Switch role (recommended) |
|---|---|---|
| How an admin starts teaching | **I teach too** in My profile | The same switch in My profile, or Bobbin's confirm on Tutors, Add tutor |
| What they see while teaching | The admin view, with tutor items added and a **Mine only** toggle | Tutor view, identical to an agency tutor's |
| Extra build | Rules inside the admin view (tutor lists, reminders, attendance) | A role switch in the account menu, using the tutor view that already exists |
| Risk | Admin view grows more complex over time | A person can forget which role they are in. The role is shown in the account card |
| Independent tutor | Separate account type with its own rules | Organisation of one, same code |

**I teach too stays.** It is the easy, visible way to add yourself as a tutor
(one switch, no email), and it creates the tutor role. The role switch is what
changes after that.

## 3. Side by side

| | Independent tutor | Tutoring agency |
|---|---|---|
| What it is | An organisation of one | An organisation with admins and tutors |
| Chosen at | Kavi: **On my own** | Kavi: **With a team**, then the agency name |
| Roles | One person holds admin and tutor | Admins, tutors, and admins who also teach |
| Setup list | Add students, Create course, Build plan, Schedule first lesson, Check classroom | Add a tutor (or I teach too), Add students, Create course, Build plan, Schedule first lesson |
| Pages | No Tutors, Team | Tutors, Team |
| Create courses, add students | Yes | Admins only |
| Lesson wizard | No tutor choice | Tutor choice |
| Dashboard | One tutor view | Admin view, or Tutor view after Switch role |
| Classroom | Always the tutor | Admin Lead or Watch, or teach as Tutor |
| Settings | Personal plus General (timezone, currency) | Admins also set agency name and logo in General |
| Emails to students | "Michael Chen via Kanvise" | "Science Students Academy" |
| Concerns | Go to Kanvise support | Go to admins |
| Extra messages | None | Daily summary at 7 AM for admins |
| Payout (proposal) | The tutor's own bank account | The agency's bank account |

## 4. Independent tutor, start to finish

![Independent tutor](diagrams/17-independent-journey.png)

## 5. Agency, start to finish

![Agency](diagrams/18-agency-journey.png)

Things to notice:
- A tutor invited to an agency does not create courses or add students. They see
  only courses the admin gives them, and an empty state says so.
- An admin invited to an existing agency skips setup (the owner already did it).
- Students can belong to more than one tutor or agency with one login.

## 6. Growing from solo to team

![Solo to team](diagrams/19-solo-to-team.png)

Nothing is deleted when someone goes either way. Going back to **On my own** is
only allowed when no other team member is active.

## 7. The admin who also teaches

![Dual role](diagrams/20-dual-role.png)

## 8. Money (proposal)

Kanvise holds the Paystack account and pays organisations out (owner, 28 Nov).
Recommendation (OQ-12): **one payout bank account per organisation**. An
independent tutor uses their own. An agency uses the agency's, and the agency
pays its own tutors. Kanvise does not split money among an agency's tutors. This
keeps Kanvise out of employment and tax questions it has no reason to enter.

## 9. If you approve D-22, these spec edits follow

- `12` CFG-P: **I teach too** adds the tutor role (no email), and **Switch role**
  appears in the account menu when a person holds both roles.
- `07` CR-09: the dialog line becomes "If you teach this lesson, switch to your
  Tutor role from the account menu." The text can mention **I teach too** for
  admins who have not added the role.
- `19` TM-03 and TM-10: typing your own email in Add tutor shows Bobbin's
  confirm ("You're already an admin here. Add yourself as a tutor too?").
- `01` SH-07 and the account card: show the active role, for example **Tutor ·
  Science Students Academy**.
- `02`: an independent tutor is described as an organisation of one with both
  roles. Nothing the user sees changes.
- `16`: the role switch on phones lives in the More sheet.
- `12` CFG-T: the confirm dialog when moving to a team (diagram 19).

## 10. Other things the atlas update added

Not yet applied, and for you to look at:

- **Sign-in and invitations (`16-auth-responsive`, 44 states at three screen
  sizes).** Bobbin's invitation page lets someone with an existing account
  **Accept** or **Decline**, and has pages for invitations that are expired,
  already accepted, declined or withdrawn. Its reset link works once and lasts 48
  hours, and recovery says the same thing whether or not the account exists. It
  also has a two-factor challenge and reset. I would add **Decline** for tutor
  invitations and the declined and withdrawn states to `21-sign-in-and-sign-up.md`
  (D-23). Two-factor stays later.
- **Sign-up form.** Bobbin asks for name, company, country, phone, consent and a
  bot check. Kanvise asks only name, email and password, and gets country and
  timezone later in General. I would keep it that way.
- **First-time setup order.** Bobbin's checklist runs client, tutor, student,
  course, first lesson, the same shape as ours without clients.
- **`18-ai-plan-control-audit`** (53 files on generating and editing an AI course
  plan). I have not read it. It is relevant to `04` CRS-06 and CRS-04.

## 11. Decisions and questions

| ID | Item | Recommendation |
|---|---|---|
| D-22 | Two roles plus **Switch role** for admins who teach; independent tutor is an organisation of one | Yes (this document) |
| D-23 | Tutor invitations can be **declined**, with declined and withdrawn states | Yes |
| OQ-12 | One payout account per organisation | Yes |
| OQ-13 | Is the chosen role remembered when someone signs in again? | Yes, per device |
