# 08 · Lesson summary

Status: draft for owner review. Builds on `00-decisions.md` (§6, §16, §17),
`04-courses-plan-and-diagnostic.md` (Topic status model, CRS-08),
`05-lessons-and-scheduling.md` (Lesson statuses) and `07-classroom.md`.

**Who:** the tutor writes it (Kavi can draft it); the student reads it in their
app.
**Goal:** in two minutes after a lesson, record what was taught and what to work
on, in plain words with real examples. This keeps the course plan up to date and
tells the student what to practise.

Nothing is emailed for now. Students see the summary, the recording and any
homework in their own app (spec 09). The tutor can **Copy** the summary to send
it anywhere.

**Left out of Bobbin on purpose:** Bobbin's approval step, where an admin
approves each write-up before families see it (the **Awaiting approval**
status). Approvals are out of scope (00 section 15); the tutor's **Complete**
is the only step. Bobbin's **Tutor performance** section is also not copied.

## What happens after a lesson

1. The lesson ends: the tutor presses **End lesson**, or Kanvise ends it after
   everyone has left (12 CFG-L **End lessons automatically**). After an
   automatic end the tutor can restart it for 60 minutes (07 CR-06).
2. Status becomes **Awaiting summary** (05 Lesson statuses). The dashboard's
   **summaries to write** count goes up by one.
3. Attendance is saved from PlugNMeet: who came, when they joined, how long
   they stayed (`17-recordings-and-attendance.md`).
4. Kavi can draft the summary in one of two ways (SM-01):
   - **From the recording**, only when the lesson was recorded (every student
     had consent, 00 section 14d) and the recording is at least 5 minutes long.
     This starts on its own when the recording is ready; the tutor presses
     **Show it** to use the draft;
   - **From the lesson notes**, when there is no usable recording: the tutor
     presses **Draft with Kavi** and Kavi drafts from the lesson notes they
     wrote in the classroom or on the summary (00 section 16).
5. The tutor opens the summary (SM-01), checks any draft, ticks what was
   covered (with **Got it** or **Needs more work**), and sets homework if any.
6. The tutor presses **Complete** (SM-04):
   - the lesson becomes **Complete**;
   - the **Review changes** sheet (04 CRS-08) opens with the proposed course
     plan changes for each student, all unticked;
   - the student gets a notification, and the summary, recording and homework
     appear in their app;
   - the tutor can **Copy** the summary to share it anywhere.
7. If nobody came: SM-06. If no summary is needed: SM-07.
8. If it isn't completed after 24 hours, the tutor gets one reminder.

A lesson that was **Not held** (05: the scheduled end passed and nobody
started it) has no summary. Its lesson page offers Reschedule, Start anyway
and Mark as cancelled (05 LP-02).

## Flow at a glance

```
Lesson ends (CR-07) / Dashboard › Write summary / Lesson page › Write summary
  → SM-01 summary editor (per student)
       ↳ SM-02 Draft with Kavi (recording, or lesson notes when there is no usable recording)
       ↳ SM-03 Set homework (spec 10)
  → SM-04 Complete → CRS-08 Review changes → SM-05 Summary on the lesson page (Copy)
  → SM-06 Nobody came (Missed)
  → SM-07 No summary needed
```

---

## SM-01 · Summary editor

Route `/lessons/:id/summary`. Full page in the app shell. Autosaves as the tutor
types (**Saved** appears for a moment in the header; offline rules in 01
SH-13).

**Header:** **Lesson summary** · lesson topic, date and course under it. Right:
**⋯** (**No summary needed**, SM-07), **Preview** (secondary) and **Complete**
(primary).

**Who it's for:**
- One-to-one: the student's name and avatar at the top.
- Group: a row of student tabs (underline style), with a toggle above them:
  **Same summary for everyone** (on by default). Turning it off lets the tutor
  write per student; each tab then shows a dot until it's done. Even with the
  toggle on, **What to work on** can be different per student (a small
  **Different for each student** link on that section).
- A student who didn't join is shown greyed with **Didn't join**. They get no
  summary and no course plan changes from this lesson unless the tutor turns
  on **Include Casey anyway**.

**Draft with Kavi** card (top of the form, Kavi mark). One card, which shows
the route that fits this lesson:
- **Usable recording** (recorded with every student's consent, 5 minutes or
  more): "Kavi drafts from what was said in the lesson." There is no button:
  when the lesson ends, Kavi starts drafting from the recording on its own, in
  the background (07 CR-07, 20 DM-24). The card shows where it has got to:
  **Kavi is listening back to the lesson…**, then **Kavi's draft is ready.**
  with **Show it**, or the failure line with **Try again** (SM-02). The draft
  is tutor-only and fills nothing until the tutor presses **Show it**. The
  recording draft never reads the lesson notes.
- **No usable recording** (not recorded, under 5 minutes, the recording
  didn't save, or the recording draft failed after its last try): the card
  says why in one line (**This lesson wasn't recorded.**, **The recording is
  too short (under 5 minutes).**, **The recording didn't save.**) and offers
  **Draft with Kavi**, which drafts from the lesson notes (section 5). A line
  sits beside the button at all times: **Kavi reads your lesson notes to draft
  this. Check it before you complete it, because students see the summary.**
  Under it, the first two lines of the lesson notes, greyed, so the tutor can
  see what Kavi will read, with **Edit lesson notes** (opens section 5).
- **No lesson notes and no usable recording:** **Draft with Kavi** is
  disabled, with the helper line **Add a few lesson notes or record the
  lesson, and Kavi can draft this for you.** and **Add lesson notes**, which
  opens section 5 with the cursor in it. The button turns on as soon as the
  lesson notes have text; nothing is sent until the tutor presses it.
- Pressing **Draft with Kavi** is the tutor asking for the draft. Kavi never
  fills anything before a press (**Show it**, **Draft with Kavi** or **Use
  this**). Whatever Kavi drafts is tutor-only until the tutor edits it and
  presses **Complete** (SM-04).
- Before Kavi exists, the card is not shown (see the Kavi block).

**Sections:**

1. **What we covered**
   - The lesson's objectives, grouped under their course plan topic. Objectives
     the tutor ticked in the classroom are ticked, with **Ticked in the lesson**.
     Nothing else starts ticked.
   - Topics Kavi thinks were covered appear unticked with a **Kavi's pick**
     badge and a short reason (**Heard at 12:40: "let's eliminate y"**). The
     tutor ticks each one to keep it (00 section 17).
   - **+ Add something else we covered** opens a picker over the course plan's
     topics (search), plus free text for things not on the plan.
   - Quick check results from the classroom appear as a line under the topic
     (07 CR-03: **Quick check: 3 of 4 chose the right answer**).
   - Under each ticked topic, an optional choice per student: **Got it** ·
     **Needs more work**. Nothing is chosen by default.
   - On Complete, each ticked topic is proposed as **Taught**, or **Knows it**
     with Got it, or **Needs work** with Needs more work (04 Topic status
     model). Proposals change nothing until accepted in CRS-08.
2. **What went well**
   - A text box. Placeholder: **e.g. Casey set up both equations without help
     and checked her answers by substituting back.**
3. **What to work on**
   - A text box. Placeholder: **e.g. Mixing up signs when subtracting one
     equation from another (questions 3 and 5). Slow down on that step.**
   - Line under it: **Specific examples help most.**
4. **Homework**
   - **Set homework** opens the homework dialog (10 HW-01) with the course and
     this lesson's students filled in. Homework already set in the classroom
     (07 CR-03) shows here as a card (title, due date). **No homework this
     time** is a quiet text button.
5. **Lesson notes** (open when they have text; collapsed under **+ Add
   lesson notes** when empty)
   - The lesson's one set of lesson notes: the same text the tutor wrote in
     the classroom (07 CR-03) or on the lesson page's Notes tab (05 LP-02).
     Editing it here edits it there too; it saves as the tutor types. For a
     group it is one note for the lesson, not one per student, and stays the
     same on every student tab.
   - Private notes rule (00 section 16). Line: **Only you, your admins and the
     course's tutors can see these. Students never do.** They never appear in
     Preview, Copy, the student's app or any notification. Kavi reads them
     only when the tutor presses **Draft with Kavi** (above).

**Validation on Complete:** at least one ticked item in **What we covered**,
and something in either **What went well** or **What to work on**. Error at
the top, with the empty section highlighted: **Add what you covered and at
least one comment before completing.** Kavi's unticked picks don't count.

**Phone:** one column, sections stacked; the header buttons move to a sticky bar
at the bottom (16 R-10).

## SM-02 · Draft with Kavi

| State | What the tutor sees |
|---|---|
| Recording still processing | The recording card: **Kavi is listening back to the lesson…** with a progress line. This starts on its own when the recording is ready (DM-24). The tutor can keep writing. Kavi's draft never overwrites what they typed. When ready: an inline **Kavi's draft is ready.** with **Show it** on the card (and a toast if they are elsewhere on the page). |
| Recording draft shown | **Show it** fills the empty sections at once, each sliding open in turn (instant with reduced motion), with the same Kavi borders, labels and **Kavi suggests** rows as the Drafting row below. |
| Lesson restarted (07 CR-06) | Any recording draft in progress or not yet shown is dropped, and the card goes back to **Kavi is listening back to the lesson…** once the restarted lesson ends. (Restart is only offered before a summary is started, 07 CR-06, so no shown draft is lost.) |
| Drafting (from lesson notes) | Text streams into empty sections, a few words at a time, in a busy region announced once when done (01 SH-12). Each section Kavi filled gets a faint Kavi-tinted border and a small **Kavi's draft** label. Sections the tutor already wrote are left alone; Kavi's version appears under them as **Kavi suggests** with **Use this**. |
| Draft ready | The label stays on each Kavi section until the tutor edits it. Above the form: **Check Kavi's draft before completing. It can get things wrong.** with 👍 / 👎 and **Regenerate**. |
| Too short | **The recording is under 5 minutes, which is too short for Kavi to draft from.** The card then offers **Draft with Kavi** from the lesson notes (SM-01). |
| No lesson notes | **Draft with Kavi** disabled, with **Add a few lesson notes or record the lesson, and Kavi can draft this for you.** and **Add lesson notes** (SM-01). |
| Not enough notes | **Kavi needs a bit more to go on. Add a sentence about what you covered to your lesson notes.** with **Edit lesson notes** (lesson notes under 20 characters; nothing is sent). |
| Failed (recording) | After the last try: **Kavi couldn't draft from the recording. Nothing you typed was changed.** The card then offers **Draft with Kavi** from the lesson notes, or the tutor writes it themselves. |
| Failed (lesson notes) | **Kavi couldn't draft this right now. Nothing you typed was changed.** with **Try again**. |

What Kavi fills:
- **What we covered:** **Kavi's pick** suggestions, unticked (SM-01). It never
  ticks anything.
- **What went well** and **What to work on:** with examples from the lesson
  ("When you solved 3x + 2y = 12…").
- It never sets **Got it** or **Needs more work**; those stay the tutor's call.
- It never writes lesson notes and never sets homework. It can suggest
  homework: **Kavi suggests homework: 5 elimination questions** with **Use
  this**, which opens the homework dialog filled in for the tutor to confirm
  (10 HW-01).

### Kavi

- Input: the lesson transcript (only when every student consented and the
  recording is at least 5 minutes), or, when there is no usable recording and
  the tutor presses **Draft with Kavi**, that lesson's lesson notes; plus the
  lesson's objectives and topics, the objectives ticked in the lesson, quick
  check totals, and the last summary's What to work on. Never student notes,
  and never another lesson's notes (00 section 16).
- Output: drafts of What went well and What to work on, **Kavi's pick**
  suggestions for What we covered, and at most one homework suggestion, all in
  SM-01.
- Failure state: preparing (**Kavi is listening back to the lesson…**), too
  short (**The recording is under 5 minutes…**), no lesson notes (button
  disabled with its helper line), not enough notes, couldn't
  generate (**Kavi couldn't draft this right now. Nothing you typed was
  changed.**), as in the SM-02 table.
- What the tutor must confirm: ticking each Kavi's pick, editing or keeping the
  drafted text, and pressing **Complete**. Course plan changes are then
  accepted row by row in CRS-08.
- Without Kavi: the Kavi bar is hidden and the tutor writes in a blank editor
  with the same five sections. Objectives ticked in the lesson are still
  ticked; everything else works the same.

## SM-03 · Homework from the summary

See spec 10. Homework set here or in the classroom is linked to this lesson:
it shows as **Set after this lesson** on the lesson page and **Before this
lesson** on the next one.

## SM-04 · Preview and Complete

**Preview** opens a dialog showing exactly what the student sees in their app
(spec 09). Lesson notes and Kavi's unticked picks never appear. Buttons
**Back to editing** · **Complete**.

**Complete** has no extra "are you sure" step; Preview is there for that, and
the toast has **Undo**.

**After pressing Complete:**
- The lesson status becomes **Complete** and the tutor lands on the lesson
  page's **Summary** tab.
- A toast: **Lesson complete.** with **Undo** (01 SH-08). The student's
  notification is held until the undo window closes; **Undo** returns the
  lesson to Awaiting summary and nobody is told.
- **Undo also withdraws every course plan proposal from this summary**,
  because they came from a summary that is no longer complete. Rows accepted
  in CRS-08 while the toast was showing are set back: each status returns to
  what it was before, and the history notes **Set back (lesson reopened)**. A
  status that someone changed again since is left as it is. Rows still
  waiting are removed, so the Summary tab no longer shows **3 changes to
  review** on a lesson that is Awaiting summary. When the tutor completes the
  summary again, CRS-08 proposes fresh rows from what is ticked then, so no
  topic is proposed twice. The toast that follows says what happened:
  **Lesson reopened. 3 course plan changes were set back.** (or, when nothing
  had been accepted, **Lesson reopened.**) The toast stays clickable over the sheet (01
  SH-08), and CRS-08's own **Course plan updated.** toast waits behind it.
- The **Review changes to the course plan** sheet (04 CRS-08) opens over the
  page when there are proposals: one row per student per ticked topic
  (**Factorising: Next → Knows it · From this lesson's summary**), each
  unticked. **Accept 3 changes** applies the ticked rows; **Not now** leaves
  **3 changes to review** on the Summary tab. Students who didn't join get no
  rows (04 Groups and absence).
- When the window closes, the student gets an in-app notification and a push:
  **Michael added a summary of today's lesson.** A no-email student gets nothing
  from Kanvise; the tutor sees **Copy summary** and **Send on WhatsApp** (06
  No email).
- Kavi may add a suggestion for the next lesson (dashboard, DB-06).
- The dashboard's **summaries to write** count drops by one.

**Editing after completing:** allowed. The summary shows **Edited 27 Nov, 6:10
PM**, and the student sees the latest version, with a Bell notice **Michael
updated the summary of Monday's lesson.** (at most once a day, 18 NTF-01).
Newly ticked topics or changed choices create new CRS-08 rows; nothing
changes the plan without them.

**Reminder:** if a lesson is still **Awaiting summary** 24 hours after it ended,
the tutor gets one push and email: **Casey's lesson summary from yesterday is
still waiting.** (switchable in Settings). **No summary needed** stops it.

## SM-05 · Summary on the lesson page

Checked against `03-lessons/screenshots/sample-insights--recheck.png` and
`sample-insights--share-open.png`.

The **Summary** tab (lesson status Complete; tabs Summary, Session, Lesson
plan, Notes as in 05 LP-02):
- The sections as written, per student (tabs for groups).
- **What we covered**, like Bobbin's **Objectives covered**: a header line
  **3 topics this lesson · 12 of 32 on the plan**, a progress bar, then the
  topics with a **Taught**, **Knows it** or **Needs work** chip once accepted
  (or **Waiting for review** while the CRS-08 row is open), each linking to the
  course plan.
- **Homework** card, if set.
- **Recording** (if there is one): a player. Students can watch it in their app
  when allowed (06 STU-05).
- **Copy summary** (in **Share ▾**, as in 05 LP-02): copies the student-facing
  text (topic, date, What we covered, What went well, What to work on and
  homework) as plain text, ready to paste into WhatsApp or an email. Toast:
  **Summary copied.** **Export as PDF** is in the same menu. Bobbin's **Email
  to clients** is not copied.

## SM-06 · Nobody came

When a lesson ends and no student joined:
- The lesson ended screen (CR-07) and the lesson page show: **Casey didn't join
  this lesson.**
- Choices: **Mark as missed** (status **Missed**, 05 Lesson statuses; no
  summary; counts on the student's Attendance) · **Schedule a replacement**
  (opens the reschedule dialog with the same details) · **Write a summary
  anyway**.
- **Mark as missed** shows nothing to the student unless the tutor ticks **Let
  Casey know**, which posts a short, neutral note in their app: **You missed
  today's lesson. Michael will be in touch about the next one.**

## SM-07 · No summary needed

Checked against `15-tutor-role/screenshots/tutor-lesson-final-report.png`
(Bobbin's "This lesson was completed without insights.").

For lessons where a summary would add nothing: a trial, a lesson cut short, or
a lesson covered by another summary.

- From the editor's **⋯**, or **No summary needed** beside **Write summary** on
  the lesson page's Awaiting summary banner.
- A small dialog: **Close this lesson without a summary?** · optional reason
  chips (00 section 6): **Trial lesson** · **Cut short** · **Covered in another
  summary** · **Other** (with a short text box). · **Cancel** · **Close
  lesson**.
- The lesson becomes **Complete** (05). The student is not notified, the
  course plan doesn't change, the reminder stops, and the dashboard count drops.
- The Summary tab shows an empty state like Bobbin's: **No summary** · "This
  lesson was closed without a summary: Trial lesson." with **Write a summary
  anyway**, which opens SM-01. Without a reason: "This lesson was closed
  without a summary."
- Toast: **Lesson closed.** with **Undo**.

## Permissions

| Action | Tutor of the lesson | Agency admin | Other tutors on the course | Student |
|---|---|---|---|---|
| Write, edit, complete, No summary needed | Yes | Yes (including an admin who led the lesson, 07 CR-09) | No | No |
| Accept course plan changes (CRS-08) | Yes | Yes | No | No |
| See and edit lesson notes | Yes | Yes | See only (00 section 16) | No |
| Read the summary | Yes | Yes | Yes | Their own, in the app |

## Data needed (for the build)

Tables are in `20-data-model.md`: lesson summaries DM-10, topic status proposals DM-05, recordings DM-09.

- Summary per lesson per student: sections, ticked topics with Got it / Needs
  more work, which ticks came from the lesson, Kavi's picks and whether each
  was accepted, homework link, completed and edited times, the No summary
  needed reason.
- Lesson notes: one per lesson, shared with the classroom (07 CR-03) and the
  lesson page (05 LP-02), not stored with the summary (20 DM-10).
- Kavi draft from the recording transcript (today's recap processing) or from
  the lesson notes, with which route and which sections Kavi wrote.
- Course plan status proposals for CRS-08 (04 Data needed).
- In-app notification and push to the student, held until the undo window
  closes.

## Checked against Bobbin

- `03-lessons/screenshots/sample-insights--recheck.png`: lesson page tabs
  Summary, Session, Lesson plan, Notes; **Lesson summary** card with **Share**;
  **Objectives covered** with "27 of 90 on the plan · 3 here" and ticks
  (SM-05). Bobbin's per-student and tutor performance cards are AI-written
  with no tutor step; Kanvise uses the five sections the tutor completes.
- `03-lessons/screenshots/sample-insights--share-open.png`: Share menu Export
  as PDF and Email to clients; Kanvise has Copy summary and Export as PDF.
- `03-lessons/screenshots/lesson-ended--insights-status.png`: Bobbin's "AI
  insights coming soon" placeholder before a lesson is complete; Kanvise shows
  the Awaiting summary banner instead (05 LP-02).
- `15-tutor-role/screenshots/tutor-lesson-final-report.png`: **No insights** ·
  "This lesson was completed without insights." (SM-07 empty state) and **Set
  after this lesson** Homework card.
- `15-tutor-role/screenshots/tutor-lesson-finalized.png`, `tutor-lessons-status-awaiting-report.png`:
  Bobbin's **Awaiting approval** status and tab; not copied (no approvals).

Final Bobbin pass (FEAT-009):
- `03-lessons/screenshots/lesson-ended--recheck.png` and `sample-lesson--loaded.png`: Bobbin's Summary tab (AI lesson summary, Student performance and Tutor performance rows) and the too-short "No insights" banner; Kanvise keeps the tutor-written five sections (SM-01) and the 5 minute minimum (SM-02 Too short).
- `03-lessons/screenshots/sample-session--recheck.png`: transcript lives on the Session tab, not in the summary.
