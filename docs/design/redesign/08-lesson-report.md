# 08 · Lesson report

Status: draft for owner review. Builds on `00-decisions.md` (§6 Lesson report),
`05-lessons-and-scheduling.md` and `07-classroom.md`.

**Who:** tutors write it; students and parents read it.
**Goal:** in two minutes after a lesson, record what was taught and what to work
on, in plain words with real examples, and send it. This is how the course plan
stays up to date, how students know what to practise, and how parents see the
value of what they pay for.

## Flow at a glance

```
Lesson ends (CR-07) / Dashboard › Write report / Lesson page › Write report
  → LR-01 report editor (per student)
       ↳ LR-02 Draft with Kavi (from the recording or from notes)
       ↳ LR-03 Set homework (spec 10)
  → LR-04 Preview → LR-05 Complete and send
  → Lesson status: Complete · course plan updated · student and parent notified
  → LR-06 Report on the lesson page · LR-07 Parent's view (no login)
  → LR-08 Nobody came
```

---

## LR-01 · Report editor

Route `/lessons/:id/report`. Full page in the app shell. Autosaves as the tutor
types (**Saved** appears for a moment in the header).

**Header:** **Lesson report** · lesson topic, date and course under it. Right:
**Preview** (secondary) and **Complete and send** (primary).

**Who it's for:**
- One-to-one: the student's name and avatar at the top.
- Group: a row of student tabs (underline style), with a toggle above them:
  **Same report for everyone** (on by default). Turning it off lets the tutor
  write per student; each tab then shows a dot until it's done. Even with the
  toggle on, **What to work on** can be different per student (a small
  **Different for each student** link on that section).

**Kavi bar** (top of the form, Kavi mark):
- With a recording: **Draft with Kavi** · "I'll write a first draft from the
  recording. You check it before anything is sent." (LR-02)
- Without a recording: **Draft with Kavi** · "Jot a few notes below and I'll turn
  them into a report." (LR-02)

**Sections:**

1. **What we covered**
   - The lesson's objectives, with the ones ticked in the classroom already
     ticked. Each shows its course plan topic.
   - **+ Add something else we covered** opens a picker over the course plan's
     topics (search), plus free text for things not on the plan.
   - Ticking an objective marks its topic **Taught** for this student on the
     course plan when the report is completed.
   - Under each ticked topic, a small optional choice: **Got it** · **Needs
     more work**. "Needs more work" sets the topic to **Needs work** on the
     course plan. Untouched means taught, no judgement.
2. **What went well**
   - A text box. Placeholder: **e.g. Casey set up both equations without help
     and checked her answers by substituting back.**
3. **What to work on**
   - A text box. Placeholder: **e.g. Mixing up signs when subtracting one
     equation from another (questions 3 and 5). Slow down on that step.**
   - Line under it: **Specific examples help most. Students tell us they like
     seeing exactly where they went wrong.**
4. **Homework**
   - **Set homework** opens the homework dialog (spec 10) pre-filled with the
     course and this student; once set, it shows here as a card (title, due
     date). **No homework this time** is a quiet text button.
5. **Private note** (collapsed under **+ Add a private note**)
   - Line: **Only you and admins see this. It's never sent.**

**Validation on Complete and send:** at least one item in **What we covered**
and something in either **What went well** or **What to work on**. Error at the
top, with the empty section highlighted: **Add what you covered and at least one
comment before sending.**

**Phone:** one column, sections stacked; the header buttons move to a sticky bar
at the bottom.

## LR-02 · Draft with Kavi

| State | What the tutor sees |
|---|---|
| Recording still processing | Kavi bar: **Kavi is listening back to the lesson… about 5 minutes.** A progress line. The tutor can keep writing; Kavi's draft never overwrites what they typed. A toast when ready: **Kavi's draft is ready.** with **Show it**. |
| Drafting | Text streams into the sections, a few words at a time. Each section Kavi filled gets a faint Kavi-tinted border and a small **Kavi's draft** label. |
| Draft ready | The label stays on each Kavi section until the tutor edits it. Above the form: **Check Kavi's draft before sending. It can get things wrong.** with 👍 / 👎 and **Regenerate**. |
| Not enough to go on | **This lesson was too short for Kavi to draft a report.** (or **There's no recording for this lesson.**) with **Draft from my notes instead**. |
| Failed | **Kavi couldn't draft this right now.** with **Try again**. Nothing the tutor typed is lost. |

What Kavi fills:
- **What we covered:** ticks objectives it heard taught, and suggests extra
  topics as unticked suggestions the tutor can accept.
- **What went well** and **What to work on:** with examples quoted or
  paraphrased from the lesson ("When you solved 3x + 2y = 12…").
- It never sets **Got it** or **Needs more work**; those stay the tutor's call.
- It never writes the private note and never sets homework (it can suggest
  one: **Kavi suggests homework: 5 elimination questions** with **Use this**).

## LR-03 · Homework from the report

See spec 10. When set from here, the homework is linked to this lesson (it
shows as **Set after this lesson** on the lesson page and **Before this
lesson** on the next one).

## LR-04 · Preview

A dialog showing exactly what the student and parent receive (LR-07 layout),
with a switch **Student's view** · **Parent's view** (the parent's view adds
the tutor's sign-off and the course name; the private note never appears).
**Back to editing** · **Complete and send**.

## LR-05 · Complete and send

A confirmation dialog:
- **Send Casey's report?**
- "Casey and their parent (Mrs Davis) will get it by email. You can still edit
  it afterwards." For a student without an email: "Casey has no email. You'll
  get a link to send them yourself." For a parent with a phone: a **Also send
  on WhatsApp** checkbox (opens WhatsApp with the link after sending).
- **Cancel** · **Send report**.

**After sending:**
- The lesson status becomes **Complete**.
- Ticked topics become **Taught** (and **Needs work** where marked) on the
  course plan for each student.
- Kavi may add a suggestion for the next lesson (dashboard, DB-06).
- The tutor lands on the lesson page's **Report** tab with a toast: **Report
  sent to Casey and Mrs Davis.**
- Needs attention's "Lesson reports to write" count drops by one.

**Editing after sending:** allowed. The report shows **Edited 27 Nov, 6:10 PM**.
No new email is sent unless the tutor presses **Send update**.

**Reminders:** if the report isn't sent 24 hours after the lesson, the tutor gets
one email: "Casey's report from yesterday is still waiting." (switchable in
Settings).

## LR-06 · Report on the lesson page

The **Report** tab (lesson status Complete):
- The sections as written, per student (tabs for groups).
- **Covered** shows the topics with a **Taught** chip, and **Needs work** where
  marked, each linking to the course plan.
- **Homework** card, if set.
- **Recording** (if there is one): a player, and **Share recording** for the
  student and parent (on by default when recording consent allows).
- **Share ▾**: **Email to student and parent**, **Copy link** (the parent link,
  LR-07), **Send on WhatsApp**, **Export as PDF**.

## LR-07 · Parent's view (no login)

Opened from the email or WhatsApp link. A simple public page, signed and
specific to this report:
- Tutor's name and photo (or agency logo), **Lesson report for Casey**.
- Lesson topic, date, course.
- **What we covered**, **What went well**, **What to work on**, **Homework**
  (title and due date).
- **Watch the recording** (if shared).
- Footer: **Questions? Reply to this email or message Alex.** (with the tutor's
  WhatsApp link if they've added a number), and **Powered by Kanvise**.
- The link expires after 90 days; an expired link says **This report link has
  expired. Ask Alex to send it again.**

Students see the same report in their app (spec 09), not on this public page.

## LR-08 · Nobody came

When a lesson ends with no student attendance:
- The lesson ended screen (CR-07) and the lesson page show: **Casey didn't join
  this lesson.**
- Choices: **Mark as missed** (status **Missed**, no report; counts on the
  student's Attendance) · **Schedule a replacement** (opens the reschedule
  dialog with the same details) · **Write a report anyway** (for example if the
  lesson happened another way).
- Mark as missed sends nothing to the student unless the tutor ticks **Let Casey
  know** (a short, neutral message: "You missed today's lesson. Alex will be in
  touch about the next one.").

## Permissions

| Action | Tutor of the lesson | Agency admin | Student | Parent |
|---|---|---|---|---|
| Write, edit, send | Yes | Yes | No | No |
| See private note | Yes | Yes | No | No |
| Read the report | Yes | Yes | Their own, in the app | Their child's, via link |

## Emails this flow sends

- **Lesson report** to the student (if they have an email) and to the parent,
  in the tutor's name, with Kavi's light touch only in the footer.
- **Report update** when the tutor presses Send update.
- **Report reminder** to the tutor after 24 hours (once).

## Data needed (for the build)

- Report per lesson per student: sections, ticked topics with Got it / Needs
  more work, homework link, private note, sent and edited times.
- Kavi draft from the recording transcript (exists as recap processing) or from
  notes; draft provenance per section.
- Course plan status updates on send.
- Signed parent link per report; recording share flag.
