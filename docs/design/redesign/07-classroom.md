# 07 · Classroom

Status: draft for owner review. Builds on `00-decisions.md`, `01-app-shell.md`
and `05-lessons-and-scheduling.md`.

**Who:** tutors, students, and agency admins who observe.
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
| Everything before the room: the join button, "too early", waking the classroom server, waiting for the tutor, errors | Microphone, camera, speaker selection inside the room |
| The device check page (setup step and help) | Audio and video, active-speaker layout |
| The **Lesson tools** panel beside the room | Whiteboard, including uploaded PDF and slide files |
| Starting and ending the lesson, and what happens after | Screen sharing (tutor only), chat (no file uploads), raise hand, polls |
| Who may enter, and as what (tutor, student, observing admin) | Participants list, mute controls for the tutor |
| Recording notice, push alerts, reconnecting | Its own in-room messages and errors |
| Branding passed to PlugNMeet (logo, colours) | Rendering that branding |

Kanvise does not restyle PlugNMeet's controls beyond its supported
`designCustomization` options (primary colour, button colours, logo). Those
options must move to the new palette: indigo buttons, never orange (decisions
§11).

**Room settings stay as they are today** (audio-first, cameras off on entry,
students muted on entry, screen share for the tutor only, chat without file
uploads, whiteboard on, polls on, PlugNMeet waiting room off, analytics on for
attendance). PlugNMeet's waiting room stays off: students arrive through their own
account or their own join link, so Kanvise already knows who each person is.

**Spike needed before build:** PlugNMeet's CSS assumes it owns the full page
height. Docking the Lesson tools panel beside it needs a short technical test.
If it can't share the page cleanly, the panel becomes a slide-over drawer opened
from a Kanvise button above the room. The panel's contents are the same either
way (CR-03).

## Flow at a glance

```
Tutor:   Dashboard / lesson page › Join classroom
           → CR-01 pre-entry (too early / waking / ready)
           → CR-03 room with Lesson tools (not started → running)
           → CR-06 end lesson → CR-07 lesson ended → Lesson summary (spec 08)
Student: Dashboard › Join classroom, or their own join link
           → CR-02 waiting for the tutor (if not started)
           → room (no Lesson tools)
           → CR-08 lesson ended
Admin:   Lesson page › Join classroom → CR-09 Join as an admin? → room as an admin
Anyone:  Setup / Settings › Test classroom → CR-10 device check
```

---

## CR-01 · Pre-entry (tutor)

Route: `/lessons/:id/classroom`. On desktop it opens in a new tab so the
dashboard stays open. On phones it opens in the same tab, so the installed app
keeps its shell, and **Back to lesson** returns to the lesson page (spec 01,
SH-16).

A dark, calm full-page screen (matching the room), Kanvise logo top left,
**Back to lesson** top right. A centred card:

| State | Card |
|---|---|
| Too early (more than 15 min before) | **Your lesson starts at 4:00 PM.** "The classroom opens 15 minutes before." **Back to lesson**. Opening this page early isn't an error. |
| Waking the classroom server | **Getting your classroom ready…** "This can take up to a minute." A progress line. It checks every few seconds and moves on by itself. |
| Ready, lesson not started | **Start your 4:00 PM lesson** · lesson card (**Today, 4:00–5:00 PM**, topic, course) · primary **Start lesson** · secondary **Go in without starting**. Line: **Students can join once you start.** |
| Ready, lesson already running (rejoin) | Goes straight into the room. Toast: **Back in your lesson.** |
| Unavailable | **We can't open the classroom right now.** "Our classroom server isn't responding. Try again in a minute." **Try again** · **Contact support**. |
| Lesson ended or cancelled | **This lesson has ended.** with **Open the lesson** (or **…was cancelled.**). |

**Go in without starting** lets the tutor set up (test audio, open the
whiteboard, upload slides) while students still wait. Lesson tools then shows
**Start lesson** prominently.

**Recording notice** under the buttons when recording is on: **This lesson will
be recorded.** (Recording settings live in Settings, spec 12.)

## CR-02 · Waiting for the tutor (student)

Same dark full page. Card:
- Tutor's avatar, **Alex hasn't started yet.**
- "We'll bring you in as soon as the lesson starts. Keep this tab open."
- Lesson card: time, topic.
- A soft pulsing dot while it checks every few seconds.
- **Test your microphone** link (opens CR-10 in a side panel, so they don't lose
  their place).

When the tutor starts, a short sound plays (if allowed), the tab title changes
to **Your lesson has started**, and the student goes into the room.

If the student opens the page more than 15 minutes early: **Your lesson starts
at 4:00 PM. Come back 15 minutes before.** with **Add to calendar**.

If the tutor hasn't started 10 minutes after the start time, the card adds:
**Alex is running late. We've let them know you're waiting.** (Kanvise sends
the tutor a push and email, CR-11.)

## CR-03 · The room, with Lesson tools (tutor)

```
┌ Lesson tools (320px) ┬──────────────── PlugNMeet room ────────────────┐
│ …                    │                                                 │
└──────────────────────┴─────────────────────────────────────────────────┘
```

**Lesson tools panel** (Kanvise), top to bottom:

1. **Header:** **Lesson tools**, a collapse button (the room then takes the
   full width; a small tab on the left edge brings the panel back).
2. **Lesson** card:
   - Not started: **No lesson running.** "Start the lesson to let students in."
     Lesson row with **Start**. Starting reloads the room once; the card says so:
     **Starting reloads the classroom.**
   - Running: a green dot and **Running · 12 min**, the topic and time.
3. **Today's objectives:** the objectives from the lesson plan as a tick-list.
   Ticking one marks it as taught (it pre-fills the lesson summary). Empty:
   **No objectives for this lesson.** with **Add one**.
4. **Shortcuts** (each opens in the panel, with a back arrow):
   - **Lesson plan:** the plan, read-only here, with **Edit** opening the lesson
     page in a new tab.
   - **Last lesson:** the previous lesson's summary for these students (What
     went well, What to work on).
   - **Notes:** private notes, saved as you type (**Saved** appears for a
     moment). Line: **Only you and admins see these.**
5. **Students:** each student with avatar and status: **In the lesson** (green),
   **Not here yet**, **Left at 4:32 PM**. For students not here: **Copy link**,
   **WhatsApp**, and **Remind** (push and email, if they have one: "Your lesson
   with Alex has started").
6. **Materials:** files attached to this lesson or its course. **Present** next
   to PDFs and slide files puts them on the PlugNMeet whiteboard. **+ Add a
   file** uploads (10 MB max; larger files get **Compress it first for students
   on mobile data.**). (This replaces today's separate slides feature; see
   `14-old-flows-inventory.md`.)
7. **Quick check:** **Ask a quick question.** Pick a question from the lesson's
   quiz or type one, with **Generate with Kavi**. It runs as a PlugNMeet quiz
   poll (answers hidden until it closes). Results appear here and feed the
   lesson summary.
8. **End lesson** (bottom, outline, red text).

**Phone and narrow screens:** Lesson tools becomes a drawer opened from a
**Tools** button above the room.

**Room (PlugNMeet):** audio, video, whiteboard, screen share, chat, raise hand,
polls. Kanvise doesn't add controls inside it.

## CR-04 · Students in the room

- Students see the PlugNMeet room only, with no Lesson tools.
- Above the room, a slim Kanvise bar: the lesson topic and **Leave lesson**.
- Microphone muted on entry; the tutor can unmute or the student can when
  allowed.

## CR-05 · Reconnecting and second tabs

- Refreshing the page or a dropped connection brings the person back into the
  same lesson without a new start. A small banner: **Reconnecting…** then
  **You're back.**
- Opening the same lesson in a second tab: **You're already in this lesson in
  another tab.** with **Use this tab** (closes the other connection) and
  **Cancel**.

## CR-06 · Ending the lesson

**End lesson** expands inline in the panel (no pop-up):
- "End the lesson for everyone? Students leave the classroom and the recording
  stops."
- **End lesson** (red) · **Cancel**.

**Leaving without ending** (the PlugNMeet leave button) keeps the lesson
running; the tutor can rejoin. If everyone has left, Kanvise ends the lesson
automatically after 10 minutes and records it in the lesson's Activity.

## CR-07 · Lesson ended (tutor)

Kanvise page, light again (back to the app's look). A centred card:
- **Lesson ended · 58 minutes.**
- **Who came:** **Casey · 56 min**, **Alex · 41 min (joined late)**.
- What happens next:
  - If recording was on: Kavi mark, **Kavi is drafting your lesson summary from
    the recording. This usually takes about 5 minutes.** A progress line.
  - If not: **Write your lesson summary so Casey knows what to work on.**
- Primary **Write lesson summary** (spec 08; if Kavi's draft is still coming, the
  summary opens with your ticked objectives and notes, and the draft slots in
  when ready).
- Secondary **Back to dashboard**.

## CR-08 · Lesson ended (student)

- **That's the end of the lesson.**
- "Alex will write a lesson summary with what to work on next. You'll find it
  in your lessons."
- If homework was set during the lesson: **New homework: Simultaneous equations
  worksheet, due Fri.** with **Open**.
- **Back to my dashboard**.

## CR-09 · Admin joins a lesson they don't teach

From the lesson page, an admin who isn't the tutor presses **Join classroom**.
It opens a confirmation (wording as in Bobbin):
- **Join as an admin?**
- "You're joining as an admin, not as this lesson's tutor, so your attendance
  won't count toward the tutor's. If you teach this lesson from another
  account, join from that account instead."
- **Cancel** · **Join as admin**.

An admin who only watches enters with camera and microphone off and sees a
read-only Lesson tools (plan, objectives, students).

After confirming, the admin gets the same pre-entry choice as a tutor (CR-01):
**Start lesson** or **Go in without starting**. An admin who starts or leads the
lesson is shown as **Admin, leads the room** in Activity and attendance, and it
never counts as the tutor attending (as in Bobbin; settles DEV-ACC-004).

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
   lesson.**). Ticks the setup step "Check your classroom".

## CR-11 · Alerts

Browser push (with email as backup), all switchable in Settings:

| Who | When | Message |
|---|---|---|
| Student | 30 minutes before | "Your lesson with Alex starts at 4:00 PM." |
| Student | Tutor starts the lesson | "Alex has started your lesson. Join now." |
| Tutor | A student is waiting and the lesson hasn't started | "Casey is waiting for your 4:00 PM lesson." |
| Tutor | 10 minutes after the start, not started | "Your 4:00 PM lesson hasn't started. Casey is waiting." |

The first time a tutor enters the classroom, Lesson tools shows a one-time tip:
**Get an alert when a student is waiting, even in another tab.** with **Turn on
alerts** / **Not now**.

## Permissions

| Action | Tutor of the lesson | Agency admin | Student on the lesson |
|---|---|---|---|
| Start, end | Yes | Yes, after **Join as an admin?** (never counts as the tutor) | No |
| Lesson tools | Full | Read-only while only watching (CR-09) | No |
| Present files, screen share | Yes | No | No |
| Join | Yes | As an admin, after **Join as an admin?** | Yes, once started |

## Data needed (for the build)

- Join token per person and role (exists).
- Lesson start, end and auto-end (exists in the lifecycle code).
- Objectives ticked during the lesson, notes, quick-check results (new).
- Attendance from PlugNMeet analytics and webhooks (exists).
- Lesson materials linked to PlugNMeet whiteboard upload (needs the spike).
- Push subscriptions (exist).
