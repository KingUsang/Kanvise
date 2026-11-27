# 08 · Lesson summary

Status: draft for owner review. Builds on `00-decisions.md` (§6),
`05-lessons-and-scheduling.md` and `07-classroom.md`.

**Who:** the tutor writes it (Kavi drafts it); the student reads it in their app.
**Goal:** in two minutes after a lesson, record what was taught and what to work
on, in plain words with real examples. This keeps the course plan up to date and
tells the student what to practise.

Nothing is emailed for now. Students see the summary, the recording and any
homework in their own app (spec 09).

## What happens after a lesson

1. The lesson ends: the tutor presses **End lesson**, or Kanvise ends it 10
   minutes after everyone has left.
2. Status becomes **Awaiting summary**. The dashboard's **summaries to write**
   count goes up by one.
3. Attendance is saved from PlugNMeet: who came, when they joined, how long
   they stayed.
4. If the lesson was recorded, the recording is processed and Kavi drafts the
   summary (about 5 minutes).
5. The tutor opens the summary (SM-01), checks Kavi's draft, ticks what was
   covered (with **Got it** or **Needs more work**), and sets homework if any.
6. The tutor presses **Complete** (SM-04):
   - the lesson becomes **Complete**;
   - the course plan updates for each student;
   - the student gets a notification, and the summary, recording and homework
     appear in their app;
   - Kavi may suggest what to do next lesson (dashboard, DB-06);
   - the tutor can **Copy** the summary to share it anywhere.
7. If nobody came: SM-06.
8. If it isn't completed after 24 hours, the tutor gets one reminder.

## Flow at a glance

```
Lesson ends (CR-07) / Dashboard › Write summary / Lesson page › Write summary
  → SM-01 summary editor (per student)
       ↳ SM-02 Draft with Kavi
       ↳ SM-03 Set homework (spec 10)
  → SM-04 Complete → SM-05 Summary on the lesson page (Copy)
  → SM-06 Nobody came
```

---

## SM-01 · Summary editor

Route `/lessons/:id/summary`. Full page in the app shell. Autosaves as the tutor
types (**Saved** appears for a moment in the header).

**Header:** **Lesson summary** · lesson topic, date and course under it. Right:
**Preview** (secondary) and **Complete** (primary).

**Who it's for:**
- One-to-one: the student's name and avatar at the top.
- Group: a row of student tabs (underline style), with a toggle above them:
  **Same summary for everyone** (on by default). Turning it off lets the tutor
  write per student; each tab then shows a dot until it's done. Even with the
  toggle on, **What to work on** can be different per student (a small
  **Different for each student** link on that section).

**Kavi bar** (top of the form, Kavi mark):
- With a recording: **Draft with Kavi** · "I'll write a first draft from the
  recording. You check it before your student sees it." (SM-02)
- Without a recording: **Draft with Kavi** · "Jot a few notes below and I'll turn
  them into a summary." (SM-02)

**Sections:**

1. **What we covered**
   - The lesson's objectives, with the ones ticked in the classroom already
     ticked. Each shows its course plan topic.
   - **+ Add something else we covered** opens a picker over the course plan's
     topics (search), plus free text for things not on the plan.
   - Ticking an objective marks its topic **Taught** for this student on the
     course plan when the summary is completed.
   - Under each ticked topic, an optional choice: **Got it** · **Needs more
     work**. "Needs more work" sets the topic to **Needs work** on the course
     plan. Left untouched, the topic is just marked taught.
2. **What went well**
   - A text box. Placeholder: **e.g. Casey set up both equations without help
     and checked her answers by substituting back.**
3. **What to work on**
   - A text box. Placeholder: **e.g. Mixing up signs when subtracting one
     equation from another (questions 3 and 5). Slow down on that step.**
   - Line under it: **Specific examples help most.**
4. **Homework**
   - **Set homework** opens the homework dialog (spec 10) with the course and
     this student filled in. Once set, it shows here as a card (title, due
     date). **No homework this time** is a quiet text button.
5. **Private notes** (collapsed under **+ Add private notes**)
   - Line: **Only you and admins see these. Your student never does.**

**Validation on Complete:** at least one item in **What we covered**, and
something in either **What went well** or **What to work on**. Error at the top,
with the empty section highlighted: **Add what you covered and at least one
comment before completing.**

**Phone:** one column, sections stacked; the header buttons move to a sticky bar
at the bottom.

## SM-02 · Draft with Kavi

| State | What the tutor sees |
|---|---|
| Recording still processing | Kavi bar: **Kavi is listening back to the lesson… about 5 minutes.** A progress line. The tutor can keep writing; Kavi's draft never overwrites what they typed. A toast when ready: **Kavi's draft is ready.** with **Show it**. |
| Drafting | Text streams into the sections, a few words at a time. Each section Kavi filled gets a faint Kavi-tinted border and a small **Kavi's draft** label. |
| Draft ready | The label stays on each Kavi section until the tutor edits it. Above the form: **Check Kavi's draft before completing. It can get things wrong.** with 👍 / 👎 and **Regenerate**. |
| Not enough to go on | **This lesson was too short for Kavi to draft a summary.** (or **There's no recording for this lesson.**) with **Draft from my notes instead**. |
| Failed | **Kavi couldn't draft this right now.** with **Try again**. Nothing the tutor typed is lost. |

What Kavi fills:
- **What we covered:** ticks objectives it heard taught, and suggests extra
  topics as unticked suggestions the tutor can accept.
- **What went well** and **What to work on:** with examples from the lesson
  ("When you solved 3x + 2y = 12…").
- It never sets **Got it** or **Needs more work**; those stay the tutor's call.
- It never writes private notes and never sets homework. It can suggest
  homework: **Kavi suggests homework: 5 elimination questions** with **Use
  this**, which opens the homework dialog filled in for the tutor to confirm.

## SM-03 · Homework from the summary

See spec 10. Homework set here is linked to this lesson: it shows as **Set after
this lesson** on the lesson page and **Before this lesson** on the next one.

## SM-04 · Preview and Complete

**Preview** opens a dialog showing exactly what the student sees in their app
(spec 09). Private notes never appear. Buttons **Back to editing** ·
**Complete**.

**Complete** asks once:
- **Complete this lesson?**
- "Casey will see this summary, the recording and any homework in their Kanvise
  app."
- **Cancel** · **Complete**.

**After completing:**
- The lesson status becomes **Complete**.
- Ticked topics become **Taught** (and **Needs work** where marked) on the
  course plan for each student.
- The student gets an in-app notification and a push: **Alex added a summary of
  today's lesson.**
- Kavi may add a suggestion for the next lesson (dashboard, DB-06).
- The tutor lands on the lesson page's **Summary** tab with a toast: **Lesson
  complete.** and **Copy summary**.
- The dashboard's **summaries to write** count drops by one.

**Editing after completing:** allowed. The summary shows **Edited 27 Nov, 6:10
PM**, and the student sees the latest version.

**Reminder:** if a lesson is still **Awaiting summary** 24 hours after it ended,
the tutor gets one push and email: **Casey's lesson summary from yesterday is
still waiting.** (switchable in Settings).

## SM-05 · Summary on the lesson page

The **Summary** tab (lesson status Complete):
- The sections as written, per student (tabs for groups).
- **What we covered** shows topics with a **Taught** chip, and **Needs work**
  where marked, each linking to the course plan.
- **Homework** card, if set.
- **Recording** (if there is one): a player. Students can watch it in their app.
- **Copy summary**: copies the student-facing text (topic, date, the three
  sections and homework) as plain text, ready to paste into WhatsApp or an
  email. Toast: **Summary copied.**
- **Export as PDF** in **⋯**.

## SM-06 · Nobody came

When a lesson ends with no student attendance:
- The lesson ended screen (CR-07) and the lesson page show: **Casey didn't join
  this lesson.**
- Choices: **Mark as missed** (status **Missed**, no summary; counts on the
  student's Attendance) · **Schedule a replacement** (opens the reschedule
  dialog with the same details) · **Write a summary anyway**.
- **Mark as missed** shows nothing to the student unless the tutor ticks **Let
  Casey know**, which posts a short, neutral note in their app: **You missed
  today's lesson. Alex will be in touch about the next one.**

## Permissions

| Action | Tutor of the lesson | Agency admin | Student |
|---|---|---|---|
| Write, edit, complete | Yes | Yes | No |
| See private notes | Yes | Yes | No |
| Read the summary | Yes | Yes | Their own, in the app |

## Data needed (for the build)

- Summary per lesson per student: sections, ticked topics with Got it / Needs
  more work, homework link, private notes, completed and edited times.
- Kavi draft from the recording transcript (today's recap processing) or from
  notes, with which sections Kavi wrote.
- Course plan status updates on Complete.
- In-app notification and push to the student.
