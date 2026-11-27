# 02 · Onboarding and setup

Status: draft for owner review. Builds on `00-decisions.md` and `01-app-shell.md`.

**Who:** a new tutor or agency owner, right after creating their account.
**Goal:** in about five minutes, go from an empty account to a first lesson on
the calendar, without wondering what to do next.

Login and sign-up screens themselves are deferred (decisions, open items).
This spec starts at the first signed-in screen.

## Flow at a glance

```
Sign-up and email confirmed
  → ONB-01 Kavi says hello
  → ONB-02…06 Five questions (each skippable)
  → ONB-07 Agency name (team only)
  → ONB-08 Kavi builds the setup
  → SET-01 /setup page with the checklist
       ↳ each step opens its normal flow (Add student, New course, …)
       ↳ returning to /setup shows the step ticked (SET-02)
  → SET-03 All done → dashboard
```

Anyone can leave at any point. Unfinished onboarding answers fall back to the
defaults in ONB-09, and the Setup item and card stay in the sidebar until the
checklist is done.

---

## ONB-01 · Kavi says hello

**Screen:** full page, no sidebar. Kanvise logo top left, **Skip setup** text
link top right. A single column, 560px wide, centred.

**Content, appearing in order:**
1. The Kavi mark, with a small wave animation.
2. A typing indicator (three dots) for about 0.8s, then Kavi's message streams
   in:
   > Hi Alex, I'm Kavi.
   > I'll help you set up Kanvise so it fits the way you teach. Five quick
   > questions, about 30 seconds.
3. Button: **Let's go**.

**Controls:**
| Control | Result |
|---|---|
| Let's go | ONB-02 |
| Skip setup | ONB-09 (defaults applied) → SET-01 |

**Reduced motion:** text appears at once, no wave, no typing indicator.

---

## ONB-02 … ONB-06 · The five questions

**Shared layout:**
- A thin progress bar at the top: 5 segments, the current one in orange.
- **← Back** at the top left from question 2 onwards. Going back keeps the
  previous answer selected.
- Kavi's question streams in, then the answer chips slide up one after the
  other (about 60ms apart).
- Tapping a chip highlights it, shows it as your reply in a right-aligned
  bubble, and Kavi answers with one short line before the next question
  appears. The exchange stays visible above, like a chat, so you can see your
  earlier answers.
- **Skip this question** text link under the chips.
- Keyboard: chips are buttons, reachable with Tab, chosen with Enter or Space.

| ID | Kavi asks | Chips | Kavi's reply after the answer |
|---|---|---|---|
| ONB-02 | Do you teach on your own or with a team? | **On my own** · **With a team** | On my own: "Got it, I'll keep things simple." With a team: "Nice, I'll set you up to invite your tutors." |
| ONB-03 | Who do you mostly teach? | **Children and teens** · **Adults** · **Both** | Children and teens: "I'll ask for a parent's details when you add students." Adults: "Then your students are your main contact." Both: "I'll ask each time." |
| ONB-04 | How do you usually teach? | **One-to-one** · **Small groups** · **Both** | "Okay, I'll set that as your default." |
| ONB-05 | What do you teach? | Free-text field with suggestions as chips under it: **Mathematics**, **English**, **Physics**, **Chemistry**, **Biology**, **Coding**, **Languages**, **Music**. Several allowed. **Continue** button. | "Great. I'll use that when I help you plan courses and quizzes." |
| ONB-06 | Do you already have students? | **Yes, I have students** · **Not yet** | Yes: "Let's start by bringing them in." Not yet: "No problem. There's a sample course you can explore first." |

**What each answer changes:** see `00-decisions.md` §10.

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

## ONB-08 · Kavi builds the setup

- Kavi: **Give me a second, I'm putting together your setup.**
- A short animation: the five checklist rows appear one by one, already in the
  order they'll have on `/setup`.
- After about 1.5s, it moves to SET-01 automatically. No button needed.
- If saving the answers fails: Kavi says **Something went wrong saving that.**
  with **Try again** and **Continue anyway** (defaults are used and a toast says
  **We'll use the defaults for now. You can change them in Settings.**).

---

## ONB-09 · Defaults when skipped

| Question | Default |
|---|---|
| On my own / team | On my own |
| Who they teach | Both |
| How they teach | Both |
| What they teach | Nothing chosen |
| Existing students | Not yet |

All answers live in **Settings → Teaching preferences** and can be changed at
any time. Changing them later updates the sidebar and defaults, but never
deletes data.

---

## SET-01 · The `/setup` page

**Shell:** the normal app shell (spec 01). **Setup** is the active sidebar item.

**Header:** **Welcome to Kanvise, Alex**. No subtitle; Kavi does the talking.

**Main card (left, about 2/3 width):**
- Kavi mark, then: **Let's get your first lesson on the calendar.** and **A few
  quick steps and you're ready to teach. I'll help with course plans, quizzes
  and lesson summaries from there.**
- A progress bar with **0/5 completed** on the right.
- Five step rows. Each row: an icon in a soft circle, the step name, a time
  chip (**1 min**, **2 mins**), a **Next** chip on the first unfinished step, a
  one-line reason, and a button on the right.

**Steps for an independent tutor:**

| # | Step | Time | Reason line | Button | Opens |
|---|---|---|---|---|---|
| 1 | Add your students | 2 mins | Students are the people you teach. Parents get lesson summaries and invoices later. | **Add students** | Add student dialog (spec 06). If they said "Yes, I have students", the dialog opens on the **Import a list** tab. |
| 2 | Create a course | 2 mins | A course pairs a student with you over time and holds the course plan. | **Create course** | New course wizard (spec 04) |
| 3 | Find out what they know | 1 min | Optional. A short check before the first lesson shows where to start. | **Send diagnostic** | Step 4 of the course wizard, for the course from step 2 |
| 4 | Schedule your first lesson | 1 min | Put it on the calendar and your student gets the link. | **Schedule lesson** | New lesson wizard (spec 05) |
| 5 | Check your classroom | 1 min | Test your camera, microphone and speakers before a student is waiting. | **Test classroom** | Device check (spec 07) |

**Steps for an agency admin:** the same, with **Invite a tutor** as step 1
(**Tutors run the lessons. Add yourself or a colleague.**), and "Find out what
they know" dropped, keeping five steps.

**Rules:**
- Steps can be done in any order. **Next** always marks the first unfinished
  step.
- Step 3 can be ticked with **Skip this step**, a small text link beside its
  button. Skipped steps show **Skipped** instead of a tick and still count
  toward completion.
- A step's button is disabled until it makes sense, with the reason on hover or
  tap:
  - Step 3 before step 2: **Create a course first.**
  - Step 4 before step 2: **Create a course first.**

**Right column (about 1/3):**
- **Get started with confidence:** a short video (60–90s) of a tutor's first
  lesson on Kanvise, with a play overlay. Plays in place.
- **Visit the help guide**, with an external-link icon.
- **Explore the sample course:** **See a course with lessons, reports and a
  course plan before you add your own.** Button **Open sample course** (spec
  04, sample state). Hidden once the user deletes sample data.

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

When the fifth step is ticked:
- Confetti-style burst behind the main card (subtle, 1s, skipped with reduced
  motion).
- Kavi: **You're all set. Your first lesson is on {day, time}. I'll remind you
  before it starts.**
- Button **Go to dashboard**.
- The Setup sidebar item and card fade out.
- From now on, visiting `/setup` redirects to `/dashboard`.

---

## Permissions

| Who | Sees `/setup`? |
|---|---|
| Independent tutor | Yes, until done |
| Agency owner or admin | Yes, until done |
| Tutor invited to an agency | No. They get a short welcome card on their dashboard instead (spec 03) |
| Student | No |

## Data needed (for the build)

- Onboarding answers stored per account (and per person for "how they teach").
- Setup step completion worked out from real data where possible (has a
  student, has a course, has a lesson, has a sent diagnostic, has a passed
  device check), plus explicit "skipped" flags.
- Sample course data, kept separate from real data and deletable in one action.
