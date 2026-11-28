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
4. Kavi can draft the summary two ways, shown side by side (SM-01):
   - **From the recording**, only when the lesson was recorded (every student
     had consent, 00 section 14d) and the recording is at least 5 minutes long.
     This starts on its own when the recording is ready; the tutor presses
     **Show it** to use the draft;
   - **From your notes**, always: the tutor jots a few lines for Kavi and
     presses **Draft from my notes**.
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
       ↳ SM-02 Draft with Kavi (recording or notes)
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

**Draft with Kavi** bar (top of the form, Kavi mark). Two equal cards side by
side (one above the other on phones); neither is the "real" route:
- **From the recording** · "Kavi drafts from what was said in the lesson."
  This route has no button: when a recorded lesson of 5 minutes or more ends,
  Kavi starts drafting from the recording on its own, in the background (07
  CR-07, 20 DM-24). The card shows where it has got to: **Kavi is listening
  back to the lesson…**, then **Kavi's draft is ready.** with **Show it**, or
  the failure line with **Try again** (SM-02). When it can't be used, the card
  stays and says why: **This lesson wasn't recorded.** or **The recording is
  too short (under 5 minutes).** The draft is tutor-only and fills nothing
  until the tutor presses **Show it**.
- **From your notes** · "Jot a few lines about what happened and Kavi turns
  them into a summary." A text box **Notes for Kavi** (up to 1,000
  characters), placeholder **e.g. Elimination method, Q1-6. Good on setting up
  equations. Mixed up signs on Q3 and Q5.**, and **Draft from my notes**.
  **Use my lesson notes** copies the private notes from the classroom into this
  box so the tutor can edit them first. A line sits under the button at all
  times: **Kavi uses this box to write What went well and What to work on,
  which your students will see. Take out anything private before drafting.** After
  copying, the copied text is highlighted until the tutor edits it or presses
  Draft. Nothing from private notes is sent unless the tutor copies it here and
  presses Draft. (Owner confirmation, HANDOFF.)
- Before Kavi exists, the bar is not shown (see the Kavi block).

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
5. **Private notes** (collapsed under **+ Add private notes**)
   - Private notes rule (00 section 16). Line: **Only you, your admins and the
     course's tutors can see these. Students never do.** They never appear in
     Preview or Copy, and are never sent to Kavi for the summary.

**Validation on Complete:** at least one ticked item in **What we covered**,
and something in either **What went well** or **What to work on**. Error at
the top, with the empty section highlighted: **Add what you covered and at
least one comment before completing.** Kavi's unticked picks don't count.

**Phone:** one column, sections stacked; the header buttons move to a sticky bar
at the bottom (16 R-10).

## SM-02 · Draft with Kavi

| State | What the tutor sees |
|---|---|
| Recording still processing | The recording card: **Kavi is listening back to the lesson…** with a progress line. This starts on its own when the recording is ready (DM-24). The tutor can keep writing or draft from notes instead. Kavi's draft never overwrites what they typed. When ready: an inline **Kavi's draft is ready.** with **Show it** on the card (and a toast if they are elsewhere on the page). |
| Recording draft shown | **Show it** fills the empty sections at once, each sliding open in turn (instant with reduced motion), with the same Kavi borders, labels and **Kavi suggests** rows as the Drafting row below. |
| Lesson restarted (07 CR-06) | Any recording draft in progress or not yet shown is dropped, and the card goes back to **Kavi is listening back to the lesson…** once the restarted lesson ends. (Restart is only offered before a summary is started, 07 CR-06, so no shown draft is lost.) |
| Drafting (from notes) | Text streams into empty sections, a few words at a time, in a busy region announced once when done (01 SH-12). Each section Kavi filled gets a faint Kavi-tinted border and a small **Kavi's draft** label. Sections the tutor already wrote are left alone; Kavi's version appears under them as **Kavi suggests** with **Use this**. |
| Draft ready | The label stays on each Kavi section until the tutor edits it. Above the form: **Check Kavi's draft before completing. It can get things wrong.** with 👍 / 👎 and **Regenerate**. |
| Too short | **The recording is under 5 minutes, which is too short for Kavi to draft from.** with **Draft from my notes instead**. |
| Not enough notes | **Kavi needs a bit more to go on. Add a sentence about what you covered.** (notes under 20 characters) |
| Failed | **Kavi couldn't draft this right now. Nothing you typed was changed.** with **Try again** and **Draft from my notes instead** (or **Write it myself**). |

What Kavi fills:
- **What we covered:** **Kavi's pick** suggestions, unticked (SM-01). It never
  ticks anything.
- **What went well** and **What to work on:** with examples from the lesson
  ("When you solved 3x + 2y = 12…").
- It never sets **Got it** or **Needs more work**; those stay the tutor's call.
- It never writes private notes and never sets homework. It can suggest
  homework: **Kavi suggests homework: 5 elimination questions** with **Use
  this**, which opens the homework dialog filled in for the tutor to confirm
  (10 HW-01).

### Kavi

- Input: the lesson transcript (only when every student consented and the
  recording is at least 5 minutes), or the tutor's **Notes for Kavi**; plus the
  lesson's objectives and topics, the objectives ticked in the lesson, quick
  check totals, and the last summary's What to work on. Never private notes
  (00 section 16), unless the tutor copied text into Notes for Kavi.
- Output: drafts of What went well and What to work on, **Kavi's pick**
  suggestions for What we covered, and at most one homework suggestion, all in
  SM-01.
- Failure state: preparing (**Kavi is listening back to the lesson…**), too
  short (**The recording is under 5 minutes…**), not enough notes, couldn't
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
(spec 09). Private notes and Kavi's unticked picks never appear. Buttons
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
| See private notes | Yes | Yes | Yes (00 section 16) | No |
| Read the summary | Yes | Yes | Yes | Their own, in the app |

## Data needed (for the build)

Tables are in `20-data-model.md`: lesson summaries DM-10, topic status proposals DM-05, recordings DM-09.

- Summary per lesson per student: sections, ticked topics with Got it / Needs
  more work, which ticks came from the lesson, Kavi's picks and whether each
  was accepted, homework link, private notes, completed and edited times, the
  No summary needed reason.
- Notes for Kavi (kept with the summary, tutor-only).
- Kavi draft from the recording transcript (today's recap processing) or from
  Notes for Kavi, with which sections Kavi wrote.
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
