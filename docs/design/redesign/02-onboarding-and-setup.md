# 02 · Onboarding and setup

Status: draft for owner review. Builds on `00-decisions.md` and `01-app-shell.md`.

**Who:** a new independent tutor or agency owner, right after creating their
account. Invited agency tutors get a shorter path (ONB-10).
**Goal:** in about five minutes, go from an empty account to a first lesson on
the calendar, without wondering what to do next.

Login and sign-up screens themselves are deferred (decisions, open items).
This spec starts at the first signed-in screen.

**Bobbin has no onboarding questions.** Its new accounts land straight on the
five-step `/setup` checklist. Kanvise adds five short scripted questions first
(00 section 10) so the checklist and the defaults fit the person. The
checklist itself copies Bobbin's card.

## Flow at a glance

```
Sign-up and email confirmed
  → ONB-01 Kavi says hello                (or "Answer as a form" → ONB-11)
  → ONB-02…06 Five questions (each skippable)
  → ONB-07 Agency name (team only)
  → ONB-08 Answers saved → straight to SET-01, no wait screen
  → SET-01 /setup page with the checklist
       ↳ each step opens its normal flow (Add student, New course, …)
       ↳ returning to /setup shows the step ticked (SET-02)
  → SET-03 All done → dashboard

Invited agency tutor: invitation accepted → ONB-10 → dashboard
```

Anyone can leave at any point. Unanswered questions fall back to the defaults
in ONB-09, and the Setup item and card stay in the sidebar until the
checklist is done.

**Taps, counted:** **Let's go**, five answers and **Continue** after subjects
is 7 taps for an independent tutor; a team adds the agency name and one
**Continue**. Nothing waits on a timer.

---

## ONB-01 · Kavi says hello

**Screen:** full page, no sidebar. Kanvise logo top left, **Skip setup** text
link top right. A single column, 560px wide, centred.

**Content, appearing in order:**
1. The Kavi mark, with a small wave animation.
2. A typing indicator (three dots) for about 0.4s, then Kavi's message appears
   as if typed:
   > Hi Alex, I'm Kavi.
   > Five quick questions, so Kanvise fits the way you teach. About a minute.
3. Button: **Let's go**.
4. Under it, a quiet text link: **Answer as a form instead** (ONB-11).

**Controls:**
| Control | Result |
|---|---|
| Let's go | ONB-02 |
| Answer as a form instead | ONB-11 |
| Skip setup | ONB-09 (defaults applied) → SET-01 |

### How the "typing" works

- Every Kavi line in onboarding is fixed, scripted text. There is no AI call,
  so onboarding works before Kavi's service exists and costs nothing.
- A line takes at most 1 second to appear in full, however long it is. The
  answer chips are usable as soon as the question starts appearing; tapping
  one, or pressing any key, shows the rest of the line at once.
- **Reduced motion:** lines appear at once, with no wave and no typing
  indicator.
- **Slow devices:** if the browser asks to save data, or the first animation
  drops frames, lines appear at once for the rest of onboarding.
- **Screen readers:** each line is announced once, when it has fully appeared
  (01, SH-12). The typing indicator is hidden from them.

---

## ONB-02 … ONB-06 · The five questions

**Shared layout:**
- A thin progress bar at the top: 5 segments, the current one in orange.
- **← Back** at the top left from question 2 onwards. Going back keeps the
  previous answer selected.
- Kavi's question appears, then the answer chips slide up one after the
  other (about 60ms apart; at once with reduced motion).
- Tapping a chip highlights it, shows it as your reply in a right-aligned
  bubble, and Kavi answers with one short line saying what it changed. The
  next question follows straight away. The exchange stays visible above, like
  a chat, so you can see your earlier answers.
- **Skip this question** text link under the chips.
- Keyboard: chips are buttons, reachable with Tab, chosen with Enter or Space.

| ID | Kavi asks | Chips | Kavi's reply after the answer |
|---|---|---|---|
| ONB-02 | Do you teach on your own or with a team? | **On my own** · **With a team** | On my own: "Okay. I'll leave out the team features for now." With a team: "Okay. I'll add a step for inviting your tutors." |
| ONB-03 | Who do you mostly teach? | **Children and teens** · **Adults** · **Both** | Children and teens: "I'll set lessons to 45 minutes and keep what I write short and simple for young readers." Adults: "I'll set lessons to an hour and write for adult readers." Both: "I'll set lessons to an hour and match each course's level." |
| ONB-04 | How do you usually teach? | **One-to-one** · **Small groups** · **Both** | One-to-one: "New courses will start with one student." Small groups: "New courses will start ready for a group." Both: "New courses will ask each time." |
| ONB-05 | What do you teach? | Free-text field with suggestions as chips under it: **Mathematics**, **English**, **Physics**, **Chemistry**, **Biology**, **Coding**, **Languages**, **Music**. Several allowed. **Continue** button. | "I'll suggest these when you create a course." |
| ONB-06 | Do you already have students? | **Yes, I have students** · **Not yet** | Yes: "Setup starts with importing your list." Not yet: "There's a sample course you can explore first." |

### What each answer changes

Every answer changes something named. These are the only effects.

| Question | Answer | What changes |
|---|---|---|
| ONB-02 | On my own | Independent tutor setup list (SET-01). PEOPLE shows Students only. Account name "{First name} {Last name} Tutoring" |
| ONB-02 | With a team | Agency admin setup list (SET-01), with **Add a tutor** first. PEOPLE shows Tutors and Team. Asks ONB-07 |
| ONB-03 | Children and teens | Default lesson length 45 minutes (12 CFG-L, 05 LW-2); Kavi writes for young readers (12 CFG-T) |
| ONB-03 | Adults or Both | Default lesson length 60 minutes; Kavi writes for adults (Both: matches each course's level) |
| ONB-04 | One-to-one | The New course wizard's **People** step opens with a single student picker and an **Add another student** link (spec 04) |
| ONB-04 | Small groups | The **People** step opens with a multi-select student picker, and the course name placeholder reads **e.g. Algebra 1 Small Group** |
| ONB-04 | Both | The **People** step opens with the multi-select picker and no hint |
| ONB-05 | Subjects | The **Subject** field in the New course wizard suggests these first. With Kavi, they are also its starting point for course plans and quizzes |
| ONB-06 | Yes, I have students | Setup step **Add your students** opens the Add student dialog on the **Import a list** tab (06 STU-04). The sample course banner is not shown |
| ONB-06 | Not yet | The sample course is created and its banner is shown on `/setup` and the dashboard (03 DB-02) |

**ONB-05 details:**
- Typing filters and suggests subjects; Enter adds the typed subject as a chip.
- Each chosen subject shows as a removable chip.
- **Continue** stays enabled with nothing chosen (that counts as skipping).
- Max 10 subjects. At 10 the field hides with the line **That's plenty for
  now. You can add more later.**

---

## ONB-07 · Agency name (only if "With a team")

Kavi: **What's your agency called?**
- Field **Agency name**, placeholder **e.g. Science Students Academy**.
- Line under it: **This is what your tutors and students will see.**
- **Continue** validates: required, 2–80 characters. Error: **Add your agency's
  name.**
- Independent tutors skip this. Their account name is set to "{First name}
  {Last name} Tutoring" and can be changed in Settings.

---

## ONB-08 · Saving the answers

There is no "building your setup" screen. The checklist is a fixed list, so
nothing pretends to build it.

- After the last answer (or ONB-07), the answers are saved and `/setup`
  (SET-01) opens straight away. While saving, the last button shows
  **Saving…** and can't be pressed twice.
- **If saving fails:** the page stays, with an inline error under the last
  answer: **We couldn't save your answers. Your choices are still here.** and
  two buttons: **Try again** and **Continue with defaults**.
- **Continue with defaults** opens `/setup` with the ONB-09 defaults. A
  persistent info banner at the top of `/setup` says **We used the default
  settings. You can change them in Settings → Teaching preferences.** with a
  link and a ✕. It is not a toast (01, SH-08).

---

## ONB-09 · Defaults when skipped

| Question | Default |
|---|---|
| On my own / team | On my own |
| Who they teach | Both |
| How they teach | Both |
| What they teach | Nothing chosen |
| Existing students | Not yet |

All answers live in **Settings → Teaching preferences** (12 CFG-T) and can be
changed at any time. Changing them later updates the sidebar and defaults, but
never deletes data.

---

## ONB-10 · Invited agency tutors

An agency tutor does not create courses or add students (00 section 14c), so
they get no questions and no checklist, as in Bobbin, where an invited tutor
lands on the dashboard.

- They inherit the agency's answers: lesson length, reading level, how the
  agency teaches and its subjects. They cannot change them (12 CFG-T is hidden
  from agency tutors).
- After accepting the invitation and setting a password, they land on the
  dashboard with the **Welcome** banner (03 DB-02), which offers **Test
  classroom**.
- No Setup item or setup card appears in their sidebar.

---

## ONB-11 · The same questions as a plain form

For people who prefer it, and for anyone using a screen reader who chooses it.

- One page, same column, title **A few questions** and the line **So Kanvise
  fits the way you teach. You can change these later in Settings.**
- The five questions as labelled radio groups (and the subjects field), in the
  same order, with the same options, plus **Agency name** when "With a team" is
  chosen.
- **Save and continue** at the bottom. Unanswered questions use the ONB-09
  defaults. Saving and failure behave as ONB-08.

---

## SET-01 · The `/setup` page

**Shell:** the normal app shell (spec 01). **Setup** is the active sidebar item.

**Header:** **Welcome to Kanvise, Alex**. No subtitle; the card does the
talking (Bobbin: "Welcome to Bobbin, Emmanuel").

**Main card (left, about 2/3 width):**
- Kavi mark, then: **Let's get your first lesson on the calendar.** and **A few
  quick steps and you're ready to teach.**
- A progress bar with **0/5 completed** on the right.
- Five step rows. Each row: an icon in a soft circle, the step name, a time
  chip (**1 min**, **2 mins**), a **Next** chip on the first unfinished step, a
  one-line reason, and a button on the right. This copies Bobbin's setup card
  row for row.

Both lists have five steps, as Bobbin's does. The total is always 5, and
**{n}/5 completed** counts steps that are done or skipped.

### Independent tutor: 5 steps

| # | Step | Time | Reason line | Button | Opens | Done when |
|---|---|---|---|---|---|---|
| 1 | Add your students | 2 mins | Students are the people you teach. They get their lessons, homework and summaries in Kanvise. | **Add students** | Add student dialog (06 STU-03; on the **Import a list** tab, STU-04, if they said "Yes, I have students") | The account has at least one real student |
| 2 | Create a course | 2 mins | A course pairs a student with you over time. | **Create course** | New course wizard (spec 04) | The account has at least one real course |
| 3 | Build the course plan | 2 mins | The topics you'll teach, so every lesson and summary ticks them off. | **Build plan** | The **Build the course plan** card on the course from step 2 (spec 04): Draft with Kavi, Start blank, or Copy plan from another course | That course plan has at least one topic, or the step was skipped |
| 4 | Schedule your first lesson | 1 min | Put it on the calendar and your student gets their join link. | **Schedule lesson** | New lesson wizard (spec 05) | The account has at least one scheduled lesson |
| 5 | Check your classroom | 1 min | Test your camera, microphone and speakers before a student is waiting. | **Test classroom** | Device check (07 CR-10) | This person has a passed device check on record |

### Agency admin: 5 steps

| # | Step | Time | Reason line | Button | Opens | Done when |
|---|---|---|---|---|---|---|
| 1 | Add a tutor | 1 min | Tutors run the lessons. Add yourself or a colleague. | **Add tutor** | Invite tutor dialog (`19-tutors-and-team.md`) | The agency has at least one tutor (an invited tutor counts, as does the admin adding themselves) |
| 2 | Add your students | 2 mins | Students are the people your tutors teach. They get their lessons, homework and summaries in Kanvise. | **Add students** | Add student dialog (06 STU-03, or STU-04 as above) | At least one real student |
| 3 | Create a course | 2 mins | A course pairs a student with a tutor over time. | **Create course** | New course wizard (spec 04) | At least one real course |
| 4 | Build the course plan | 2 mins | The topics the course will cover, so lessons and summaries tick them off. | **Build plan** | The **Build the course plan** card on the course from step 3 | That course plan has at least one topic, or the step was skipped |
| 5 | Schedule the first lesson | 1 min | Put it on the calendar; the tutor and students get their links. | **Schedule lesson** | New lesson wizard (spec 05) | At least one scheduled lesson |

The admin list has no classroom check: the tutors who teach check their own
devices from the Welcome banner (ONB-10). An admin can still test from
Settings (12 CFG-L).

The starting check is not a setup step. It is optional and is offered on the
course page once the plan has a topic (00 section 5).

**Rules (both lists):**
- Steps can be done in any order. **Next** always marks the first unfinished
  step.
- Only **Build the course plan** can be skipped, with **Skip this step**, a
  small text link beside its button. A skipped step shows **Skipped** instead
  of a tick and counts toward completion. It can be undone with **Do this
  step**.
- A step's button is disabled until it makes sense, with the reason as text
  under the button (not only on hover):
  - Build the course plan before a course exists: **Create a course first.**
  - Schedule before a course exists: **Create a course first.**
- The sample course and its sample student never tick a step. Only real data
  counts.

**Right column (about 1/3), as in Bobbin's "Get started with confidence"
card:**
- **Get started with confidence:** a short video (60 to 90 seconds) of a
  tutor's first lesson on Kanvise, with a play overlay. Plays in place, with
  captions and no autoplay. Until the video exists, the card shows a still
  image and the help guide link only.
- **Visit the help guide**, with an external-link icon.
- **Explore the sample course:** **See a course with lessons, summaries and a
  course plan before you add your own.** Button **Open sample course** (spec
  04, sample state). Shown only if they answered "Not yet" (or skipped), and
  hidden once the user deletes sample data.

**Content dependencies (must exist before launch; listed in HANDOFF):** the
"first lesson" video with captions, the help guide pages linked from setup
and the help menu, and the sample course content (Algebra 1 Small Group).

**Phone:** one column. The right column moves under the checklist.

---

## SET-02 · Coming back after finishing a step

- The finished row's icon turns into a tick with a small pop animation, the row
  text turns secondary, and its button becomes a **View** link (for example to
  the course that was created).
- The progress bar and the sidebar card fill to the new count.
- **Next** moves to the next unfinished step.
- If the step was finished somewhere else (for example the user scheduled a
  lesson from the calendar), it is ticked the same way the next time `/setup`
  is shown.

---

## SET-03 · All done

When all five steps are done or skipped:
- Confetti-style burst behind the main card (subtle, 1s, skipped with reduced
  motion).
- Kavi: **You're all set. Your first lesson is on {day, time}.**
- Button **Go to dashboard**.
- The Setup sidebar item and card fade out.
- From now on, visiting `/setup` redirects to `/dashboard` (as Bobbin does).

---

### Kavi
- Input: none. Onboarding uses no AI.
- Output: fixed, scripted lines shown as if typed (ONB-01 to ONB-08, SET-01,
  SET-03).
- Failure state: none from Kavi. The only failure is saving the answers
  (ONB-08), shown inline.
- What the tutor must confirm: each answer chip, or **Save and continue** on the
  form (ONB-11).
- Without Kavi: the same scripted lines and the same questions. ONB-11 asks
  them as a plain form. **Draft with Kavi** on the course plan step is one of
  three choices; **Start blank** and **Copy plan from another course** work
  without it.

## Permissions

| Who | Sees onboarding questions? | Sees `/setup`? |
|---|---|---|
| Independent tutor | Yes | Yes, until done (independent tutor list) |
| Agency owner or admin who created the agency | Yes | Yes, until done (agency admin list) |
| Admin invited to an existing agency | No | No; the agency's setup is already the owner's |
| Tutor invited to an agency | No (ONB-10) | No. They get the Welcome banner on their dashboard (spec 03) |
| Student | No | No |

## Data needed (for the build)

- Onboarding answers stored per account. Invited tutors read the account's
  answers; nothing is stored per tutor.
- Setup step completion worked out from real data: has a real student, has a
  real course, the first course's plan has a topic, has a scheduled lesson,
  has a tutor (agencies), has a passed device check. Plus an explicit
  "skipped" flag for the course plan step.
- **Device check record:** when the device check (07 CR-10) finishes, the
  browser sends the result to the server, which stores one row per person and
  device: person, account, browser and device label, camera, microphone,
  speakers and connection results, and the time. The setup step reads "has at
  least one passed row". Nothing about the check lives only in the browser.
- Sample course data, flagged as sample, kept out of every real list, search,
  count and setup step, and deletable in one action.

---

Checked against Bobbin (screenshots opened and compared):
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/00-recon/screenshots/post-login.png` (setup card: "Let's create your first lesson", 0/5 completed, five rows with time chip, Next chip, reason line and button; right column help card)
- `/projects/sandbox/atlas/s2/00-recon_post-login.png` (same screen, curated copy)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/00-recon/screenshots/setup--post-test-data.png` (after setup: Setup item gone, dashboard with sample course banner)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/01-dashboard/screenshots/dashboard-help-updates.png` (sample course banner wording and Delete demo data)
- `/projects/sandbox/.critic-atlas/scratch/bobbin-appatlas/15-tutor-role/screenshots/tutor-dashboard--default.png` (invited tutor: no Setup item, lands on the dashboard)

Deliberate differences from Bobbin: Kanvise asks five scripted questions
before the checklist (Bobbin asks none); Bobbin's step 1 "Add a client" is
replaced by "Build the course plan" (no clients in Kanvise); the independent
tutor list has "Check your classroom" instead of "Add a tutor"; Bobbin's "Find
the right plan" sales card and "Chat to us" are not copied.
