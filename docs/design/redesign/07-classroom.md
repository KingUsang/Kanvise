# 07 · Classroom

Status: draft for owner review. Builds on `00-decisions.md` (sections 14a to
14e), `01-app-shell.md` and `05-lessons-and-scheduling.md`.

**Who:** tutors, students, and agency admins who join a lesson they don't
teach (to lead it or to watch).
**Goal:** get everyone into the lesson with working audio, keep the tutor's
plan and notes at hand while teaching, and end cleanly so the lesson summary can
follow.

## What Kanvise owns and what PlugNMeet owns

The live room is **PlugNMeet**. Kanvise mounts PlugNMeet's web client inside a
Kanvise page (`window.plugNmeetConfig`, see
`docs/operations/plugnmeet-integration-reference.md`). That sets the boundary
for this design:

| Kanvise designs and builds | PlugNMeet provides (Kanvise configures it) |
|---|---|
| Everything before the room: the join button, waking the classroom server, waiting for the tutor, errors | Microphone, camera, speaker selection inside the room |
| The device check page (setup step and help) | Audio and video, active-speaker layout |
| The **Lesson tools** panel beside the room | Whiteboard, including uploaded PDF and slide files |
| Starting, ending and restarting the lesson, and what happens after | Screen sharing (tutor and leading admin), chat (no file uploads), raise hand, polls |
| Who may enter, and as what (tutor, student, admin leading, admin watching) | Participants list, mute controls for moderators |
| Recording consent check and notice, push alerts, reconnecting | Its own in-room messages and errors |
| **Let {student} know** messages, **Report a concern**, **Add a device** | |
| Branding passed to PlugNMeet (logo, colours) | Rendering that branding |

Kanvise does not restyle PlugNMeet's controls beyond its supported
`designCustomization` options (primary colour, button colours, logo). Those
options must move to the new palette: indigo buttons, never orange (decisions
§11).

**Room settings stay as they are today:** audio-first, cameras off on entry
for everyone, students muted on entry, screen share for moderators only, chat
without file uploads, whiteboard on, polls on, analytics on for attendance.
PlugNMeet's waiting room stays off: students arrive through their own account
or their own join link, so Kanvise already knows who each person is, and
Kanvise only issues a student's classroom token once the lesson has started.

**Cameras:** off on entry for tutor and students, as the PlugNMeet room
profile says. There is no setting to turn students' cameras on at entry (it
would hurt students on mobile data). A tutor who wants cameras asks in the
lesson.

**Supported tutor device:** a laptop or desktop with Chrome, Edge or Safari. A
phone is supported as a second device (CR-14), for example to show written
work. A tutor who opens the classroom on a phone can still teach, and sees a
one-time line: **For the whiteboard and screen sharing, a laptop works best.
You can still teach from here.**

### Spikes before build

Each is a short technical test with a fallback, so the design holds either
way:

| Spike | Question | Fallback if it fails |
|---|---|---|
| Docking | Can the PlugNMeet client share the page with the Lesson tools panel? Its CSS assumes it owns the full height | Lesson tools becomes a slide-over drawer opened from a Kanvise **Lesson tools** button above the room. Contents unchanged |
| Start without reload | Can a lesson go from "entered without starting" to started without reloading the room? Kanvise creates the room on entry and only starts letting students in on **Start lesson**, so no new room should be needed. Starting must keep the tutor's microphone, camera choice and anything on the whiteboard | Hide **Enter without starting a lesson**; the pre-entry card offers **Start lesson** only, and the device check (CR-10) covers setup |
| Quick check results | Does PlugNMeet's `voted_poll` analytics field give each student's choice, or only whether they voted? | Quick check shows class totals only (**3 of 4 chose B**), and the summary gets the totals, never per-student answers |
| Phone as tutor device | Whiteboard drawing, file upload and the Lesson tools sheet on a 360px screen | Keep the laptop line above; phones are a second device only |
| Admin watching label | Can the participant name carry **(Admin watching)** for every viewer, with `is_hidden: false`? | Kanvise shows **Chidi Okafor is watching** in Lesson tools and in the students' Kanvise bar |

## Flow at a glance

```
Tutor:   Dashboard / lesson page › Join classroom
           → CR-01 pre-entry (waking / ready / ended)
           → CR-03 room with Lesson tools (not started → running)
           → CR-06 end lesson → CR-07 lesson ended → Lesson summary (spec 08)
           → after an automatic end: Restart this lesson (CR-06)
Student: Dashboard › Join classroom, or their own join link
           → CR-02 waiting for the tutor (if not started)
           → CR-04 room (no Lesson tools)
           → CR-08 lesson ended
Admin:   Lesson page › Join classroom → CR-09 Join as an admin? → Lead or Watch
Anyone:  Setup / Settings › Test classroom → CR-10 device check
In the lesson: CR-12 Let {student} know · CR-13 Report a concern · CR-14 Add a device
```

---

## CR-01 · Pre-entry (tutor)

Checked against `03-lessons/screenshots/classroom--lesson-ended.png` and
`15-tutor-role/screenshots/tutor-classroom-ended.png` (Bobbin's start card).

Route: `/lessons/:id/classroom`. On desktop it opens in a new tab so the
dashboard stays open. On phones it opens in the same tab, so the installed app
keeps its shell, and **Back to lesson** returns to the lesson page (spec 01,
SH-16).

A dark, calm full-page screen (matching the room), Kanvise logo top left,
**Back to lesson** top right. A centred card:

| State | Card |
|---|---|
| Loading | A spinner with **Loading the classroom…** (Bobbin's, `15-tutor-role/screenshots/tutor-classroom-entered.png`), on the dark background instead of Bobbin's white. |
| Ready, lesson not started | **Start your 4:00 PM lesson** · an inner lesson card (**Today, 4:00 PM - 5:00 PM**, topic) with primary **Start lesson** inside it · below, a full-width secondary **Enter without starting a lesson** (Bobbin's layout and wording). Line: **Students can join once you start.** |
| Ready, before the classroom opens for students (12 CFG-L **Classroom opens**) | Tutors and admins can always go in. The Ready card with one extra line: **Students can join from 3:45 PM, or as soon as you start.** |
| Waking the classroom server | **Getting your classroom ready…** "This can take up to a minute." A progress line. It checks every few seconds and moves on by itself. |
| Ready, lesson already running (rejoin) | Goes straight into the room. Toast: **Back in your lesson.** |
| Ended automatically, within 60 minutes | **This lesson ended at 4:42 PM because everyone had left.** · primary **Restart this lesson** · secondary **Open the lesson**. Line: **Restarting carries on the same lesson. Attendance and the recording continue.** (CR-06) |
| Unavailable | **We can't open the classroom right now.** "Our classroom server isn't responding. Try again in a minute." **Try again** · **Contact support**. |
| Lesson ended or cancelled | **This lesson has ended.** with **Open the lesson** (or **This lesson was cancelled.**). |

**Enter without starting a lesson** lets the tutor set up (test audio, open the
whiteboard, upload a PDF) while students still wait. Lesson tools then shows
**Start** in the Lesson card (CR-03). Starting must not reload the room (see
Spikes before build).

**Recording line** under the buttons, worked out from consent (00 section 14d)
and the account setting (12 CFG-L **Record lessons**):
- every student on the lesson has consent: **This lesson will be recorded.**
- one or more don't: **This lesson won't be recorded: Casey hasn't consented.**
  (or **Casey and Sam haven't consented.**) with **Why?**, which explains
  **Lessons are recorded only when every student has recording consent. You
  can record consent on the student's page.** and links to it for people who
  can change it (06 STU-05).
- recording is off for the account: no line.

## CR-02 · Waiting for the tutor (student)

Same dark full page. Card:
- Tutor's avatar, **Michael hasn't started yet.**
- "We'll bring you in as soon as the lesson starts. Keep this tab open."
- Lesson card: time, topic.
- A soft pulsing dot while it checks every few seconds.
- **Test your microphone** link (opens CR-10 in a side panel, so they don't lose
  their place).
- **Let Michael know** chips (CR-12): **Can't make it** and **Need another
  time**. (**Running late** isn't shown here, because Casey is already
  waiting and Michael can see that.)
- When the lesson will be recorded: **This lesson will be recorded.**

When the tutor starts, a short sound plays (if allowed), the tab title changes
to **Your lesson has started**, and the student goes into the room.

If the student opens the page before the classroom opens for students (12
CFG-L **Classroom opens**) and the tutor hasn't started: **Your lesson starts
at 4:00 PM. The classroom opens at 3:45 PM.** with **Add to calendar**. If
the tutor has already started, the student goes straight in.

If the tutor hasn't started 10 minutes after the start time, the card adds:
**Michael is running late. We've let them know you're waiting.** (Kanvise sends
the tutor a push and email, CR-11.) If the tutor sent **Running late** (CR-12),
the card shows that instead: **Michael is running about 10 minutes late.**

## CR-03 · The room, with Lesson tools (tutor)

Checked against `03-lessons/screenshots/classroom--live-onboarding-dismissed.png`,
`classroom--invite-open.png`, `15-tutor-role/screenshots/tutor-classroom-popup.png`
and `tutor-classroom-live--started.png`.

```
┌ Lesson tools (320px) ┬──────────────── PlugNMeet room ────────────────┐
│ …                    │                                                 │
└──────────────────────┴─────────────────────────────────────────────────┘
```

**First visit:** a one-time dialog over the room, like Bobbin's welcome:
**Welcome to your classroom** with four short rows (**Allow your microphone**,
**Each student has their own link**, **Your files are in Materials**,
**Everything comes back to the lesson page**) and **Got it**.

**Lesson tools panel** (Kanvise), top to bottom, in Bobbin's order with
Kanvise's additions:

1. **Header:** **Lesson tools**, **Invite** (jumps to Students), a sound button
   (alert sounds on or off), a collapse button (the room then takes the full
   width; a small tab on the left edge brings the panel back).
2. **Lesson** card:
   - Not started: **No lesson running.** "Start the lesson to let students
     in." A lesson row (topic, date and time) with **Start**.
   - Running: a green dot and **Running · 12 min**, the topic and time.
   - Recording state, one line: a red dot and **Recording**, or **Not
     recording: Casey hasn't consented.** (CR-01 rule), or nothing when
     recording is off for the account. Consent is checked when the lesson
     starts and when it restarts; a change during the lesson applies next
     time.
   - Shortcuts, each opening in the panel with a back arrow:
     - **Lesson plan:** the plan, read-only here, with **Edit** opening the
       lesson page in a new tab.
     - **Last lesson:** the previous lesson's summary for these students (What
       went well, What to work on).
     - **Notes:** the lesson notes, one note for this lesson, saved as you
       type (**Saved** appears for a moment). The same text shows on the
       lesson page's Notes tab (05 LP-02) and as the **Lesson notes** section
       of the summary (08 SM-01), where Kavi can draft the summary from it
       when there is no usable recording. They follow the private notes rule
       (00 section 16). Line: **Only you, your admins and the course's tutors
       can see these. Students never do.** Placeholder: **e.g. Elimination
       method, Q1-6. Good on setting up equations. Mixed up signs on Q3 and
       Q5.**
   - **End lesson** (outline, red text) at the bottom of the card (CR-06).
3. **Today's objectives:** the objectives from the lesson plan as a tick-list.
   Ticking one marks it as taught in the lesson; the summary shows it ticked
   with **Ticked in the lesson** (08 SM-01). Empty: **No objectives for this
   lesson.** with **Add one**.
4. **Students** (Bobbin's **Invite**): each student with avatar and status:
   **In the lesson** (green), **Not here yet**, **Left at 4:32 PM**, plus their
   latest message if they sent one (**Running late · 4:02 PM**, CR-12). For
   students not here: **Copy link**, **WhatsApp** (when they have a phone),
   **Email** (when they have an email), and **Remind** ("Your lesson with Michael
   has started", push, or email when they have no push; 18 NTF-01). **Let Casey know** (or **Let everyone
   know**) opens the tutor chips (CR-12). When a link is opened on a second
   device: **Casey's link was just opened on another device.** with **Get a
   new link** (05 LP-05).
5. **Materials:** files attached to this lesson or its course. **Present** next
   to PDFs and images within the whiteboard limit puts them on the PlugNMeet
   whiteboard; PowerPoint files show **Open** and the save-as-PDF line from
   the upload limits table. **+ Add a
   file** uploads to the whiteboard, within the whiteboard limit in the
   upload limits table of `15-resources.md` (10 MB per file today). A larger
   file gets **This file is over 10 MB. Compress it first for students on
   mobile data.** (This replaces today's separate slides feature; see
   `14-old-flows-inventory.md`.)
6. **Set homework:** opens the homework form (10 HW-01) as a side sheet over
   the room, with the course, the students and **Set after: this lesson**
   filled in. The lesson keeps running underneath. Once set: **Homework set:
   Simultaneous equations worksheet, due Fri.** The students see it after the
   lesson (CR-08).
7. **Quick check:** **Ask a quick question.** Pick a question from the
   course's quizzes (11) or type one with up to four options. It runs as a
   PlugNMeet quiz poll (answers hidden until it closes). Results appear here
   and feed the lesson summary's What we covered as a line (**Quick check: 3
   of 4 chose the right answer**). Per-student results are subject to the
   Quick check spike; if it fails, only class totals are shown.
8. **Other devices:** **Add a device** (CR-14), as in Bobbin.
9. **Alerts** (once, until answered): **Get an alert when a student is waiting,
   even in another tab.** with **Turn on alerts** / **Not now** (CR-11).
10. **Report a concern** (a quiet text link at the bottom, CR-13).

When an admin is in the room (CR-09), a line under the header: **Chidi Okafor is
watching.** or **Chidi Okafor (admin) is leading.**

**Phone and narrow screens:** Lesson tools opens as a bottom sheet from a
**Tools** button above the room, with End lesson inside the sheet; on tablets
it is a side drawer (16 R-07).

**Room (PlugNMeet):** audio, video, whiteboard, screen share, chat, raise hand,
polls. Kanvise doesn't add controls inside it.

## CR-04 · Students in the room

- Students see the PlugNMeet room only, with no Lesson tools.
- Above the room, a slim Kanvise bar: the lesson topic, a red **Recording** dot
  when the lesson is recorded, **Report a concern** (CR-13) and **Leave
  lesson**.
- When an admin is watching: **Chidi Okafor (admin) is watching** in the bar, and
  their name in the participants list. There are no hidden people in a lesson.
- Microphone muted on entry and camera off; the tutor can unmute or the
  student can when allowed.

## CR-05 · Reconnecting and second devices

- Refreshing the page or a dropped connection brings the person back into the
  same lesson without a new start. A small banner: **Reconnecting…** then
  **You're back.**
- One connection per person, matching 05 LP-05. Opening the lesson on a
  second device or tab while the first is still in it asks first, before any
  classroom token is issued: **You're already in this lesson on another
  device.** (or **…in another tab.**) with **Join here instead** (the other
  connection leaves and sees **You joined from another device.**) and
  **Cancel**.
- For a student's link, the tutor gets the notice in Lesson tools (CR-03,
  item 4).
- A tutor who wants a phone in the lesson as well uses **Add a device**
  (CR-14), which is the one allowed second connection.

## CR-06 · Ending and restarting the lesson

Checked against `03-lessons/screenshots/classroom--end-lesson-confirmation.png`.

**End lesson** expands inline in the Lesson card (no pop-up, as in Bobbin):
- "End the lesson for everyone? Students leave the classroom and the recording
  stops."
- **End lesson** (red) · **Cancel**.

**Leaving without ending** (the PlugNMeet leave button) keeps the lesson
running; the tutor can rejoin. If everyone has left, Kanvise ends the lesson
automatically after the delay set in 12 CFG-L **End lessons automatically**
(10 minutes by default), and records **Ended automatically** in the lesson's
Activity.

**Restart this lesson** (after an automatic end only, for example a power cut
emptied the room):
- Offered for 60 minutes after the automatic end, on the pre-entry card
  (CR-01), the lesson page (05 LP-02) and the dashboard's lesson row.
- It returns the lesson to Live (05 status transitions). Attendance continues
  in the same records, and if the lesson was being recorded, the new part is
  added to the same recording. Any Kavi transcript or draft already started
  from the shorter recording is dropped, and Kavi starts again from the whole
  recording when the restarted lesson ends (08 SM-02, 20 DM-24).
- Students' links work again; students who are still on the lesson page are
  brought back in.
- Activity shows **Restarted by Michael at 4:51 PM**.
- After 60 minutes, or once a summary has been started, it's gone and the
  lesson stays Awaiting summary.

A lesson the tutor ended with **End lesson** can't be restarted. A tutor who
needs more time schedules another lesson.

## CR-07 · Lesson ended (tutor)

Kanvise page, light again (back to the app's look). A centred card:
- **Lesson ended · 58 minutes.**
- **Who came:** **Casey · 56 min**, **Sam · 41 min (joined late)**.
- What happens next, one of:
  - Recorded and at least 5 minutes long: Kavi mark, **Kavi is drafting your
    lesson summary from the recording.** A progress line. (No promised time
    until it has been measured.)
  - Not recorded (or under 5 minutes) with lesson notes: **This lesson wasn't
    recorded. Kavi can draft the summary from your lesson notes.**
  - Not recorded and no lesson notes: **This lesson wasn't recorded. Add a few
    lesson notes on the summary, and Kavi can draft it for you.**
  - Before Kavi exists: **Write your lesson summary so Casey knows what to work
    on.**
  - Nobody came: 08 SM-06.
- Primary **Write lesson summary** (spec 08; the objectives ticked in the
  lesson are already ticked there, and Kavi's draft slots in when ready).
- Secondary **Back to dashboard**.

## CR-08 · Lesson ended (student)

- **That's the end of the lesson.**
- "Michael will write a lesson summary with what to work on next. You'll find it
  in your lessons."
- If homework was set during the lesson (CR-03 item 6): **New homework:
  Simultaneous equations worksheet, due Fri.** with **Open**.
- **Back to my dashboard**.

## CR-09 · Admin joins a lesson they don't teach

Checked against `03-lessons/screenshots/classroom--join-dialog.png`.

From the lesson page, an admin who isn't the tutor presses **Join classroom**.
It opens a confirmation (wording as in Bobbin), with Kanvise's two ways in
under it:
- **Join as an admin?**
- "You're joining as an admin, not as this lesson's tutor, so your attendance
  won't count toward the tutor's. If you teach this lesson, switch to your
  Tutor role in the account menu." For an admin who has not added themselves as
  a tutor yet, the line ends **Add yourself as a tutor first**, linking to
  19 TM-10. Kanvise has one account per person, so there is no other account to
  join from.
- Two choices (radio cards):
  - **Lead** · "Start, end and run the lesson, present files and share your
    screen. Shown as Admin, leads the room." Always selected to start with,
    because the owner's decision is that an admin in the room has moderator
    rights (00 section 14b).
  - **Watch** · "Camera and microphone off. Everyone in the lesson sees that
    you're watching." Offered only when the tutor is already in the lesson,
    with the line **Michael is teaching. Choose Watch to sit in without
    taking over.** Watch is a Kanvise addition, confirmed by the owner (00
    section 19).
- **Cancel** · **Join as admin**.

| | Lead | Watch |
|---|---|---|
| PlugNMeet join token | `is_admin: true`, `is_hidden: false` | `is_admin: false`, `is_hidden: false` |
| Shown to others | **Chidi Okafor (Admin, leads the room)** | **Chidi Okafor (Admin watching)** |
| Pre-entry | The tutor's choices (CR-01): **Start lesson** or **Enter without starting a lesson** | Goes straight in. Can't start the lesson without switching to Lead |
| Lesson tools | Full | Read-only: plan, objectives, students. No Notes editing, Set homework or Quick check |
| Microphone and camera | Off on entry, like everyone | Off, and can't be turned on |
| Attendance and Activity | **Admin, leads the room**; never counted as the tutor attending | **Admin watching**; never counted |

- A watching admin can switch with **Lead the room** in the Kanvise bar. It
  rejoins them with the Lead token (a moment of reconnecting) and tells the
  tutor: **Chidi Okafor is now leading.**
- There are no hidden watchers. Students and the tutor always see an admin in
  the room (CR-03, CR-04).
- An admin who leads a lesson whose tutor never joined: attendance shows
  **Tutor didn't join** and the admin row; the summary can be written by the
  admin (08 Permissions). This settles DEV-ACC-004 (00 section 14b).

## CR-10 · Device check

Route `/classroom/check`. Built by Kanvise with the browser's own device access;
it doesn't need the classroom server.

1. **Allow microphone and camera:** an explanation and **Allow access**. If the
   browser blocks it: **Your browser blocked the microphone.** with steps for
   Chrome, Safari and Edge, and **Try again**.
2. **Microphone:** a live level bar. "Say something. The bar should move." A
   device dropdown.
3. **Speakers:** **Play a test sound**, then **Did you hear it?** **Yes** /
   **No** (No shows how to pick another output).
4. **Camera (optional):** a live preview and device dropdown. **Skip camera**.
5. **Connection:** a short speed check. Result: **Good for audio and video**,
   **Good for audio. Video may freeze.**, or **Your connection is weak. Lessons
   may cut out.** with tips.
6. **Done:** **You're ready to teach.** (students: **You're ready for your
   lesson.**).

Finishing saves a device check record on the server for that person and
browser (date, result per step). Setup step "Check your classroom" ticks from
that record (02), so it stays ticked on another visit and can be seen by
support.

## CR-11 · Alerts

The messages Kanvise sends around a lesson. Channels, defaults and switches
are in the matrix in 18 NTF-01 (tutors switch theirs in 12 CFG-N); this table
only gives the wording.

| Who | When | Message |
|---|---|---|
| Student | Before the lesson, at the 12 CFG-L **Remind students** time | "Your lesson with Michael starts at 4:00 PM." |
| Student | Tutor starts the lesson | "Michael has started your lesson. Join now." |
| Student | Tutor sends a Let {student} know chip (CR-12) | The chip's message |
| Tutor | A student is waiting and the lesson hasn't started | "Casey is waiting for your 4:00 PM lesson." |
| Tutor | 10 minutes after the start, not started | "Your 4:00 PM lesson hasn't started. Casey is waiting." |
| Tutor | A student sends a chip (CR-12) | "Casey: running late for your 4:00 PM lesson." |

The first time a tutor enters the classroom, Lesson tools shows the Alerts tip
(CR-03 item 9).

## CR-12 · Let {student} know

Quick one-tap messages about a lesson, both ways. They don't change the
lesson; they only tell the other person. Out of scope: free chat.

**Tutor to student** (Lesson tools Students section, the lesson page's
Students card in 05 LP-01, and the dashboard's next-lesson row in 03):
- **Running late**, with a minutes choice (**5**, **10**, **15**): "Michael is
  running about 10 minutes late. Stay on your lesson page."
- **Starting now**: "Michael is starting your lesson now."
- **Can't make it**: "Michael can't make today's lesson and will be in touch
  about a new time." After sending, the tutor sees **Reschedule** and **Cancel
  lesson** (05 LP-03, LP-04); nothing is cancelled by the chip.

**Student to tutor** (on the student's lesson page and Home next-lesson card
in spec 09, and on the waiting card CR-02):
- **Running late**, **Can't make it**, **Need another time**.
- The tutor gets a push (CR-11) and sees the message on the lesson page's
  Activity and in Lesson tools. **Need another time** shows the tutor
  **Reschedule** beside it.

**Rules:**
- Delivery: in the app and by push; by email when the person has an email and
  no push. For a no-email student, the tutor's chip becomes **Send on
  WhatsApp** (prefilled) or **Copy message**.
- Each chip can be sent once per lesson by each person; a sent chip shows
  **Sent 4:02 PM**.
- Messages are kept on the lesson's Activity, so attendance and cancellations
  have the context.

## CR-13 · Report a concern

For a safeguarding or conduct worry during a lesson. Bobbin flags transcripts
automatically for admins (`12-safeguarding`); Kanvise keeps only this way for
a person to raise a concern, which is the minimum (safeguarding queues are out
of scope, 00 section 15).

- Where: the quiet **Report a concern** link at the bottom of Lesson tools
  (tutors), and in the students' Kanvise bar (CR-04). Spec 09 adds it to the
  student app.
- A small dialog: **Report a concern** · "Tell us what happened. Only the
  people below will see it."
  - **What happened** (text, required, up to 2,000 characters).
  - **Send to:** **Your agency's admins** (default in an agency) · **Kanvise
    support**. For an independent tutor's lesson, it goes to **Kanvise
    support** only. The admins exclude the person the concern is about; if
    that person is the only admin (for example the owner of a team of one), it
    goes to **Kanvise support**.
  - Line: **If someone is in danger now, call your local emergency number
    first.**
  - **Cancel** · **Send**.
- Sent by email to the chosen people, with the lesson, the time and who sent
  it. Toast: **Sent. Thank you for telling us.**
- The lesson keeps running. The person it is about is not told, and a
  concern a student raises is never shown to the tutor.

## CR-14 · Add a device

Checked against `03-lessons/screenshots/classroom--invite-open.png` (OTHER
DEVICES · Add a device).

For the tutor's second device, usually a phone pointed at written work.

- **Add a device** opens a small panel: a QR code and a short link, with
  **Open this on your phone. It joins as you, with the microphone and speaker
  off so there's no echo.** The link works for 10 minutes and once.
- The phone joins as **Michael (phone)**, camera on if the tutor allows it there,
  never counted again in attendance.
- The panel then lists it: **Michael's phone · connected** with **Remove**.
- One added device at a time.

## Permissions

| Action | Tutor of the lesson | Admin, Lead | Admin, Watch | Student on the lesson |
|---|---|---|---|---|
| Enter before start | Yes | Yes | Yes | No (waits, CR-02) |
| Start, end, restart | Yes | Yes (never counts as the tutor) | No | No |
| Lesson tools | Full | Full | Read-only | No |
| Present files, screen share, mute others | Yes | Yes | No | No |
| Set homework, Quick check | Yes | Yes | No | No |
| Let {student} know (CR-12) | Tutor chips | Tutor chips | No | Student chips |
| Report a concern | Yes | Yes | Yes | Yes |
| Add a device | Yes | Yes | No | No |

### Kavi

- Input: none during the lesson in v1. Nothing in the classroom calls Kavi
  live. Afterwards, the transcript of the recording (only with every
  student's consent, and only for 5 minutes or more, 20 DM-24) and the
  objectives ticked in the lesson feed the summary draft in 08. The lesson
  notes from Lesson tools are sent only when there is no usable recording and
  the tutor presses **Draft with Kavi** on the summary (00 section 16, 08
  SM-01).
- Output: none in the classroom.
- Failure state: none in the classroom; the summary draft states are in 08.
- What the tutor must confirm: nothing here; the summary is confirmed in 08.
- Without Kavi: Lesson tools is unchanged. Quick check uses typed or quiz
  questions, and CR-07 offers **Write lesson summary**.

## Data needed (for the build)

Tables are in `20-data-model.md`: lessons and room state DM-06, join links DM-07, attendance DM-08, recordings and consent DM-09, chip messages and concerns DM-16, added devices and device checks DM-17.

- Join token per person and role, including the admin Lead and Watch tokens
  (exists for tutor and student).
- Lesson start, end, automatic end, restart window and restart events (the
  lifecycle code has start and end).
- Recording consent check at start and restart, and the result on the lesson
  (recorded, or not recorded with the students who lacked consent).
- Objectives ticked during the lesson, the lesson notes (one per lesson,
  shared with 05 LP-02 and 08 SM-01; 20 DM-10), quick-check results (new).
- Attendance from PlugNMeet analytics and webhooks (exists), with admin rows
  marked as Lead or Watch.
- Lesson materials linked to PlugNMeet whiteboard upload (needs the docking
  spike).
- Chip messages (CR-12), concerns raised (CR-13), added devices (CR-14).
- Device check records per person and browser (CR-10).
- Push subscriptions (exist).

## Checked against Bobbin

- `03-lessons/screenshots/classroom--lesson-ended.png`, `15-tutor-role/screenshots/tutor-classroom-ended.png`:
  **Start your 2:00 AM lesson**, inner card with **Start lesson**,
  **Enter without starting a lesson** (CR-01). Bobbin returns to this card
  after ending; Kanvise goes to CR-07 and restarts only after an automatic
  end.
- `15-tutor-role/screenshots/tutor-classroom-popup.png`, `tutor-classroom-before-start-retry.png`:
  **No lesson running**, "Start one to let students in. Starting reloads the
  classroom.", lesson row with **Start**, Other devices (CR-03). Kanvise
  requires no reload (spike).
- `03-lessons/screenshots/classroom--live.png`: first-visit welcome dialog
  (CR-03 First visit).
- `03-lessons/screenshots/classroom--live-onboarding-dismissed.png`, `classroom--invite-open.png`,
  `15-tutor-role/screenshots/tutor-classroom-live--started.png`: panel order
  (header with Invite, sound and collapse; Lesson card with Running, Lesson
  plan, Last lesson, Notes and End lesson; Invite rows with Copy link and
  email; Other devices; Alerts). Bobbin's "Letting students in" tip is not
  copied (no admit step). The room shows **This session is being recorded.**;
  Kanvise shows its own recording line.
- `03-lessons/screenshots/classroom--end-lesson-confirmation.png`: inline end
  confirmation in the Lesson card (CR-06).
- `03-lessons/screenshots/classroom--join-dialog.png`: **Join as an admin?**
  wording and **Join as admin** (CR-09). Lead and Watch are Kanvise's.
- `atlas/s2/15-tutor-role_tutor-classroom-room--default.png`, `15-tutor-role_tutor-classroom-live--started.png`,
  `15-tutor-role_tutor-classroom-end-confirmation.png`, `15-tutor-role_tutor-classroom-ended.png`,
  `15-tutor-role_tutor-classroom-popup.png`: same states in the curated set.
- `12-safeguarding/screenshots/safeguarding-open.png`, `page--default.png`:
  Bobbin's automatic transcript flags; not copied, CR-13 is raised by a person.

Final Bobbin pass (FEAT-009):
- `03-lessons/screenshots/classroom--joined.png`: start card wording (CR-01).
- `03-lessons/screenshots/classroom--tutor-invite-emailed.png`, `15-tutor-role/screenshots/tutor-classroom-live--media-ready.png`: Lesson tools panel (Lesson plan, Last lesson, Notes, End lesson, Invite rows with Copy link and email, Other devices) and the pre-join media check with "This session is being recorded." (CR-03).
- `15-tutor-role/screenshots/tutor-classroom-entered.png`: "Loading the classroom..." spinner (CR-01 Loading row).
