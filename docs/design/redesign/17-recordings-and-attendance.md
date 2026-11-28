# 17 · Recordings and attendance

Status: draft for owner review. Builds on `00-decisions.md` (§14b, §14c,
§14d, §15, §16, §17), `01-app-shell.md` (SH-02, SH-08, SH-14a), `05` (Lesson
statuses, LP-02), `06` (STU-05, STU-11), `07` (CR-01, CR-09, CR-14), `08`,
`09` (SA-05), `12` (CFG-L).

**Who:** independent tutors, agency admins and agency tutors on `/recordings`;
students see their own recordings and attendance in the student app (spec 09).
**Goal:** one place that answers "who came to which lesson, for how long, and
can I watch it again?", copying Bobbin's Recordings page.

Kanvise lessons are online only (00 section 15), so there is no **In person**
tab and no Online / In person switch. Every row is an online lesson that
someone joined. There are no public share links for recordings (00 section
15): a recording plays only inside Kanvise for people allowed to see it.

## Flow at a glance

```
Sidebar LIBRARY › Recordings (/recordings)
  → REC-01 list of lessons that ran (newest first)
      → REC-03 Filter (Course, Student, Tutor, From date, To date)
      → REC-05 Export CSV
      → expand a row → REC-02 attendance for that lesson → Open lesson (05 LP-02)
      → Watch → REC-04 player
Student app (09 SA-05): their own lesson page shows the recording (REC-08)
```

Attendance is also shown on the lesson page's **Session** tab (05 LP-02), the
student page's **Attendance** tab (06 STU-05) and the tutor page's
**Attendance** tab (19 TM-04). All of them use the rules below.

---

## Attendance rules

Attendance is saved from PlugNMeet's join and leave events (07). One lesson
has one attendance record per person who was on it, even if the room ran twice
because the tutor restarted it after an automatic end (07 CR-06).

**Statuses for a student on the lesson:**

| Status | When | Chip |
|---|---|---|
| **Attended** | Joined, and none of the statuses below applies | Neutral grey, as Bobbin's **Attended** |
| **Late** | First joined more than 10 minutes after the lesson started | Amber |
| **Left early** | Last left more than 10 minutes before the lesson ended and didn't come back | Amber |
| **Missed** | On the lesson but never joined before it ended | Red tint, as Bobbin's **Didn't join** |

- **Late** and **Left early** can both apply; the chip shows the first and the
  row's time columns show both.
- **Missed** is the per-student status that 05 (Lesson statuses) and 06
  (Attendance tab) refer to. It is set when the lesson ends. A lesson where
  every student missed is the lesson-level **Missed** status in 05, set by the
  tutor through 08 SM-06.
- "Started" means the tutor (or an admin leading) pressed **Start lesson**, not
  the scheduled time. "Ended" means the last end, after any restart.
- A student who joins and leaves several times: **Joined** is the first join,
  **Left** the last leave, **Time in session** adds up the time connected. A
  small **Rejoined 2 times** line appears under the times.
- A link opened on a second device (05 LP-05) and the tutor's added device (07
  CR-14) are never counted as extra people.
- A student added to a lesson after it ended has no attendance for it.

**Tutor and admin rows:**

| Row | Role line under the name | Status | Counts as the tutor attending |
|---|---|---|---|
| The lesson's tutor | **Tutor** | **Attended**, **Late**, **Left early**, or **Tutor didn't join** | Yes |
| An admin who chose Lead (07 CR-09) | **Admin, leads the room** (Bobbin's wording) | **Attended** | No |
| An admin who chose Watch | **Admin watching** | **Attended** | No |
| A deleted student (06 STU-11) | **Deleted student** (no name, grey initials) | The status they had | n/a |

- If an admin led and the tutor never came, the tutor's row says **Tutor didn't
  join** (07 CR-09) in red tint and the admin row stays below it.
- An admin with **I teach too** (12 CFG-P) who is the lesson's tutor is shown
  as **Tutor**, like any tutor.

**People summary on a row (REC-01):** the tutor's avatar and name, and under it
one line: **All 3 joined** (grey), or **1 student missed** in red, or **Tutor
didn't join** in red. This is Bobbin's **1 student didn't join** line, using
Kanvise's word.

---

## REC-01 · Recordings page

Checked against `09-recordings/screenshots/recording-session--detail.png`,
`recordings-online.png` and `15-tutor-role/screenshots/tutor-recordings--default.png`.

Route `/recordings`. Header **Recordings** · "Online lessons, who joined them,
and their recordings." On the right of the toolbar: **Filter** and **Export
CSV** (REC-05; independent tutors and agency admins only, as Bobbin shows it
only to admins).

**Table** (one row per lesson that someone joined, newest first):

| Column | Shows |
|---|---|
| **Lesson ▾** (sort) | Expand arrow, the lesson topic (or the course name when there is no topic), course swatch (01 SH-15) and course name, then **27 Nov 2026, 4:00 to 4:58 PM** in the viewer's timezone |
| **Length** | Time between start and end: **58 min**, **<1 min** |
| **People** | Tutor avatar and name, with the people line from Attendance rules |
| **Recording** | One of the recording states below |

- **Lesson ▾** sorts **Newest first** (default) or **Oldest first**, as
  Bobbin's **SESSION ▾**.
- A lesson that is running shows a green **Live** chip (01 SH-15) in place of
  the times and **In progress** under Length. Its attendance fills in as people
  join.
- Bobbin's **Billed** column is not copied: billing is on hold (00 section 14).
- Pagination at the bottom, 25 rows a page, with the page in the URL (16
  R-04). Filters and sort are in the URL too, so a filtered view can be
  bookmarked.

**Recording column states:**

| State | Shows |
|---|---|
| Ready | **▷ Watch** (outline button, as Bobbin) and under it the recording's length |
| Processing | **Processing…** in grey with a small spinner. Line on hover or focus: **Usually ready within 30 minutes of the lesson ending.** |
| Not recorded, consent | **Not recorded** with an info icon; the expanded row says why (REC-02) |
| Not recorded, switched off | **Not recorded** (the account has **Record lessons** off, 12 CFG-L) |
| Failed | **Recording failed** in red tint; the expanded row explains (REC-02) |
| Deleted | **Deleted** in grey: **Deleted on 25 Feb after 90 days.** or **Deleted by Mrs Bello on 3 Dec.** |

Every recording state also appears on the lesson page's Session tab (05
LP-02) with the same words.

## REC-02 · Lesson attendance (expanded row)

Checked against `09-recordings/screenshots/recording-session--detail.png`,
`recording-session--detail-recheck.png` and
`15-tutor-role/screenshots/tutor-recording-session--expanded.png`.

Expanding a row (the arrow, or the row itself; Enter or Space with the
keyboard) opens an attendance table under it, as in Bobbin. Only one row is
expanded at a time.

| Column | Shows |
|---|---|
| **Participant** | Avatar, name, and the role line (**Tutor**, **Student**, **Admin, leads the room**, **Admin watching**, **Deleted student**) |
| **Status** | The chip from Attendance rules |
| **Joined** | **4:02 PM**, or **-** |
| **Left** | **4:58 PM**, or **-** |
| **Time in session** | **56 min**, **<1 min**, or **-** |

Order: tutor first, then admins, then students A to Z.

Under the table, one line about the recording when it isn't a plain Ready:
- Consent: **Not recorded: Casey hasn't consented.** For more than one:
  **Not recorded: Casey and Ada haven't consented.** The names link to the
  student page's Lesson recording card (06 STU-05). Agency tutors see the names
  without links to the consent buttons (they can't record consent).
- Switched off: **Not recorded: recording is off for your account.** with
  **Change** (12 CFG-L) for independent tutors and admins.
- Failed: **The recording didn't save. Kavi can still draft the summary from
  your notes (08).** There is no retry: the audio is gone.
- Ready: **Kept until 25 Feb (90 days).** from 12 CFG-L **Keep recordings
  for**.

Bottom right: **Open lesson →** (05 LP-02), as in Bobbin. Independent tutors
and admins also get **⋯** with **Delete recording** (REC-06) when there is one.

## REC-03 · Filter

Checked against `09-recordings/screenshots/recordings--filter-open.png`,
`recordings-filter-lesson.png`, `recordings-filter-student.png`,
`recordings-filter-tutor.png`, `recordings-filter-from-date.png` and
`recordings-filter-to-date.png`.

**Filter** opens a menu, as in Bobbin: **Course ›**, **Student ›**, **Tutor ›**
(agency admins only), **From date ›**, **To date ›**.

- Course, Student and Tutor open a sub-panel with a back arrow, the sub-panel
  title, a search field (**Search by course…**, **Search by student…**,
  **Search by tutor…**) and the matching names. Choosing one applies it and
  closes the menu. Bobbin's **Lesson** filter becomes **Course**, because every
  Kanvise lesson belongs to a course (00 section 3).
- From date and To date open a date field with **Apply**, disabled until a date
  is picked. To date can't be before From date: **Pick a date after 3 Nov.**
- Applied filters appear as chips under the toolbar: **Course: Algebra 1 ×**,
  **From 1 Nov ×**, with **Clear all**. The **Filter** button turns indigo
  (filled) while any filter is on, as Bobbin's button turns dark.
- Agency tutors see only Course, Student and dates: their list holds only their
  own courses' lessons, so a Tutor filter would have one name. (Bobbin shows it
  with one name, `15-tutor-role/screenshots/tutor-recordings-filter-tutor.png`;
  not copied.)

## REC-04 · Player

Checked against `09-recordings/screenshots/recordings-player.png` and
`15-tutor-role/screenshots/tutor-recording-player.png`.

**▷ Watch** opens a large dialog over the page, as in Bobbin: the lesson topic
as the title, a line **Algebra 1 · 27 Nov, 4:00 PM**, a close button, and the
video at 16:9 with rounded corners.

- Controls: play and pause, scrub bar, time, volume, speed (**1×**, **1.25×**,
  **1.5×**, **2×**), full screen. Space plays and pauses; the arrow keys skip 10
  seconds. Esc closes the dialog and stops playback.
- No download and no share button (no public links, 00 section 15).
- While it loads: the black frame with a spinner. If it can't play: **This
  recording couldn't play. Try again.** with **Try again**, inside the dialog.
- Phones: the dialog becomes a full-screen sheet and the video plays inline
  first (16).
- The transcript is not shown here; it lives on the lesson page's Session tab
  (05 LP-02).

## REC-05 · Export CSV

Checked against `09-recordings/screenshots/recordings-online.png` (Export CSV
top right, disabled on an empty page in `page--default.png`).

- **Export CSV** downloads the rows matching the current filters, one line per
  person per lesson: lesson date, start, end, course, topic, tutor, person,
  role, status, joined, left, minutes in session, recorded (yes or no).
- Times are in the account's timezone (12 CFG-A) with the zone in the header.
- Disabled (grey) when the list is empty, as in Bobbin.
- Up to 5,000 lines download straight away with the toast **Exported 214
  rows.** Larger exports are prepared in the background and emailed as a link,
  with the toast **We'll email you a link when the file is ready.** (same job
  as 12 CFG-D exports).
- Deleted students appear as **Deleted student**.

## REC-06 · Deleting a recording

For an independent tutor or agency admin who wants a recording gone before it
expires.

- **⋯ › Delete recording** on the expanded row (REC-02) or the lesson page's
  Session tab.
- Dialog: **Delete this recording?** · "Students can no longer watch it and
  its transcript is deleted too. The lesson summary stays." · **Cancel** ·
  **Delete recording** (red). No undo; the dialog is the confirmation.
- Afterwards the Recording column shows **Deleted** (REC-01), and a toast
  **Recording deleted.**
- Expiry: recordings are deleted automatically after 12 CFG-L **Keep recordings
  for** (30, 90 or 365 days). Summaries and attendance are kept. Deleting a
  student's data follows 06 STU-11 (one-to-one recordings deleted, group
  recordings kept with the name removed until they expire).

## REC-07 · Loading, empty, no results, error

Checked against `09-recordings/screenshots/page--default.png` and
`recordings-in-person.png` (Bobbin's loading spinner).

- **Loading:** five grey skeleton rows in the table's shape (as 12 Layout),
  not Bobbin's centred **Loading recordings…** spinner on a blank page.
- **Empty** (no lesson has run yet), copying Bobbin's card: video icon in the
  Recordings tint, **No lessons yet**, "Lessons appear here once someone joins
  the classroom." For tutors and admins, a secondary button **Go to Lessons**.
  Filter and Export CSV are disabled.
- **No results** (filters on): **No lessons match these filters.** with **Clear
  filters**.
- **Error:** a banner over the table: **Couldn't load recordings. Check your
  connection and try again.** with **Try again** (01 SH-08 failures). The
  filters stay as they were.
- **Not available:** a recording or lesson the person may not see (a link from
  someone else) shows 01 SH-14a. Students never reach `/recordings`; their
  app has no such page.

## REC-08 · What students see

Students don't have a Recordings page. In the student app (09 SA-05) each past
lesson page shows:
- **Recording**, when the lesson was recorded, it is still kept, the account
  lets students watch recordings (12 CFG-L), and this student may watch them
  (06 STU-05 **Casey can watch recordings**). Player as REC-04 inside the
  page.
- Group lessons: the recording is visible to every student on the lesson who
  is allowed to watch, including a student who missed it. A lesson is recorded
  only when every student on it has consent (00 section 14d), so everyone who
  can see it has consented.
- **Not recorded** lessons show nothing about recording to students (no names,
  no consent reasons).
- A student removed from a course keeps no access to its recordings.
- Their own attendance only: **You joined at 4:02 PM · 56 min** or **You
  missed this lesson.** Never other students' attendance.
- While processing: **The recording will be here soon.**

## Permissions

| Action | Independent tutor | Agency admin | Agency tutor | Student |
|---|---|---|---|---|
| See `/recordings` and attendance | Their lessons | Every lesson in the agency | Lessons on their courses | No (own lessons in the app, REC-08) |
| Watch a recording | Yes | Yes | Lessons on their courses | Own lessons, when allowed (REC-08) |
| Tutor filter | No | Yes | No | n/a |
| Export CSV | Yes | Yes | No | No |
| Delete a recording | Yes | Yes | No | No |
| Record or withdraw consent | Yes (06) | Yes (06) | No (06) | No |

## Phones

- The table becomes one card per lesson (16 table rule): topic, course swatch,
  date and time, the people line and **Watch**. Tapping the card opens the
  attendance as a list under it, one person per line with the status chip and
  times.
- Filter opens as a bottom sheet with the same menu. Export CSV moves into a
  **⋯** in the header.

## Data needed (for the build)

Tables are in `20-data-model.md`: lessons DM-06, attendance DM-08, recordings
and consent DM-09, settings DM-14. Export jobs use the existing durable jobs.

### Kavi

- Input: none on this page. The transcript of a consented recording feeds the
  summary draft in 08; that is described there and in 20 DM-24. A transcript
  is deleted with its recording (REC-06, 20 DM-25).
- Output: none here.
- Failure state: none here; a failed recording is shown in REC-01 and REC-02.
- What the tutor must confirm: nothing on this page.
- Without Kavi: the page is the same. Recordings are still made (with
  consent) so students can watch them; no transcript is made until Kavi
  exists.

## Checked against Bobbin

- `09-recordings/screenshots/page--default.png`: header, segmented All /
  Online / In person (not copied: online only), Filter, disabled Export CSV,
  empty card **No sessions yet** with the video icon (REC-07).
- `09-recordings/screenshots/recordings-online.png`, `recordings--recheck.png`:
  table columns Session ▾, Length, Billed (dropped), People with the red
  **1 student didn't join** line, Recording with **No recording** (REC-01).
- `09-recordings/screenshots/recording-session--detail.png`,
  `recording-session--detail-recheck.png`: expanded attendance with
  Participant, Status, Joined, Left, Time in session, **Admin, leads the room**,
  **Attended** and **Didn't join** chips, **Open lesson →** (REC-02).
- `09-recordings/screenshots/recordings--filter-open.png`,
  `recordings-filter-lesson.png`, `recordings-filter-student.png`,
  `recordings-filter-tutor.png`, `recordings-filter-from-date.png`,
  `recordings-filter-to-date.png`: Filter menu with Lesson, Student, Tutor,
  From date, To date; search sub-panels with a back arrow; date field with
  Apply (REC-03). Lesson becomes Course.
- `09-recordings/screenshots/recordings-player.png`: player dialog with the
  title and close button; the row shows **▷ Watch** (REC-04).
- `09-recordings/screenshots/recordings-in-person.png`: In person tab with the
  **Loading recordings…** spinner; not copied (online only, skeleton loading).
- `15-tutor-role/screenshots/tutor-recordings--default.png`,
  `tutor-recordings-all.png`, `tutor-recordings-online.png`,
  `tutor-recordings-in-person.png`, `tutor-recording-session--expanded.png`,
  `tutor-recordings-filter.png`, `tutor-recordings-filter-lesson.png`,
  `tutor-recordings-filter-student.png`, `tutor-recordings-filter-tutor.png`,
  `tutor-recordings-filter-from-date.png`, `tutor-recordings-filter-to-date.png`,
  `tutor-recording-player.png`: the tutor's view has no Billed column and no
  Export CSV, which Kanvise copies for agency tutors.
- Kanvise additions not in Bobbin: Late and Left early, Admin watching, Tutor
  didn't join, Deleted student, consent reasons, retention line, Delete
  recording, the student view.
