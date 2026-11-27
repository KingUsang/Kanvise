# Recordings and session history

Route: `/recordings`

The surface segments All, Online, and In person sessions; supports filters for lesson, student, tutor, and date range; and offers CSV export. The authorized classroom run populated two short online-session rows, each marked not billed and without a recording.

Expanding a row reveals participant-level attendance, join/leave time, time-in-session, non-attendance, and an Open lesson path. This detail was captured for the synthetic lesson session.

## Verified session-detail state

The expanded online-session row exposes a compact attendance ledger rather than a separate record-detail page: participant avatar/name, role, attended or didn't-join status, joined and left times, and total time in session. For the synthetic run, the administrator is marked as the room lead and attended for under a minute; the student is marked as not having joined. The parent row retains the lesson, date range, duration, billing status, people summary, and recording availability. **Open lesson** links back to the lesson record.

Native/in-person recording creation was not walked because it requires the mobile app lane rather than this browser lane.

The completed admin audit additionally captures Online and In person tabs, every nested Lesson/Student/Tutor/date filter picker, and the in-page recording-player modal. In-person remains an evidenced empty state because creation belongs to the mobile lane.
