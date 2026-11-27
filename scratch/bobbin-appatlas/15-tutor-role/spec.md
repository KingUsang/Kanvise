# Tutor role

Authenticated as: `Atlas Research Tutor` (Tutor role).

## Role boundary

The tutor has a reduced top-level workspace: Dashboard, Calendar, Lessons, Courses, Students, Recordings, Resources, and personal Settings. It does not expose dedicated Clients, Tutors, Team, Report approvals, Safeguarding, Unlinked sessions, or organization billing navigation. However, course roster management still exposes nested organization-level student and tutor creation forms, and global search returns client and tutor matches.

## Dashboard

The tutor dashboard is schedule-led: today/this-week lesson timeline, Live view, calendar shortcut, a Join action on the planned lesson, a “reports to write” attention count, and a mobile-recording prompt. The observed state has one planned lesson and zero reports to write.

## Calendar and lesson management

Calendar shows **New lesson**, filters, captured Day/Week/Month views, and the tutor's scheduled lesson. The Lessons list exposes **New lesson**, filters, and separately captured All, Planned, Awaiting report, Awaiting approval, Complete, Canceled, and Canceled (chargeable) segments. Only Planned is populated in the test dataset. This establishes that tutors can plan sessions—not merely join administrator-created ones.

## Course, student, and recordings access

The tutor sees the assigned course and learner, but only within their teaching context. The recordings list omits the administrator-only billing column, keeping session duration, people, and recording availability. All and Online show an existing watchable recording plus the short synthetic sessions; In person has its own empty processing state. **Watch** opens an in-page video-player modal.

### Tutor lesson detail

The tutor reaches the lesson's plan surface, including **Join classroom**, lesson lifecycle, homework, roster, and the student classroom link. It shows the same “too short to analyze” insight state as the administrator, but the tutor is an operational participant rather than an organization manager.

### Tutor course and student detail

The course detail lets the tutor open Actions, create a lesson, view lessons/resources/homework/about, and start the AI-assisted course-plan paths. Actions exposes Edit course and a permanent Delete course confirmation. The roster's Add dialogs can either attach existing people or open the full organization-level Add tutor/Add student forms; the student form includes client linkage and recording consent. These creation forms were inspected but not submitted.

The curriculum-plan catalog contains 211 published templates and supports search/filtering, module/topic preview, and applying a template. The freeform alternative asks for subject, level, and intended outcomes before generating a plan. Neither a template nor an AI generation was applied during this tutor pass.

The tutor's student detail is materially reduced: Summary, Progress reports, Lessons, and Attendance remain, but there is no Edit/Remove action and no recording-consent or sharing controls on the student detail itself.

The settled **Resources** tab shows an empty attached-resource state with Add resources and Upload files. Add resources offers upload, attach from library, and attach a folder. The settled **Homework** tab shows an empty state and a homework form with title, due date, instructions, student-downloadable files, and an explicit Set homework submission; it says only the tutor and admins can see submissions. No files or homework were submitted.

### Resources and settings

The tutor's Resources page supports New folder and Upload files, with a personal/assigned file-library empty state. The New folder form and reversible Show files in folders state were captured. Tutor Settings points to `/profile`, a personal settings area with name, email, timezone, password, authenticator-app two-factor authentication, and independent email preferences for lesson insights, transcript speaker-label review, and AI-feedback updates. Two-factor setup was followed through its current-password confirmation; the QR/secret stage was deliberately not generated or stored. The organization-level `/settings` route remains unavailable to the tutor.

The tutor can complete all non-mutating steps of the **New lesson** wizard: Course & attendees, Topic & schedule, and Review & create. The final **Schedule lesson** action was deliberately not submitted because the existing test lesson already covers the created state. The resources upload surface accepts PNG, JPG, PDF, Word, and PowerPoint via file picker or drag/drop, optionally adds the upload to a folder, and requires an explicit Upload submission. No file was submitted in the tutor crawl.

### Cross-workspace utilities

Global search returns grouped Students, Tutors, Clients, Courses, and Lessons results with keyboard navigation. The help/updates menu exposes What's new, Help guide, Share feedback, and Privacy policy; the changelog feed and unsent feedback form were captured. Calendar and Lessons filters include Student, Course, Client, and Status; Courses filters include Student, Tutor, and Client. Recording and resource filter overlays were also captured.

Dashboard **Live view** opens an auto-refreshing monitor (15-second cadence) for running lessons and joined participants; the captured state is empty. The mobile-app beta dialog advertises background/offline in-person recording, attendance capture, and automatic transcripts/reports, with App Store and Google Play destinations.

## Direct-route authorization audit

The tutor session was directly navigated to `/clients`, `/tutors`, `/team`, `/report-approvals`, `/safeguarding`, `/sessions/unlinked`, `/settings`, and `/settings/billing`. Each ultimately redirected to the tutor dashboard; `/clients` took a longer hydration cycle before redirecting. This confirms route enforcement, not merely hidden navigation. Nested course roster forms remain the documented exception for creating students/tutors.

## Classroom

**Join classroom** opens a pre-entry choice between starting the scheduled lesson and entering without starting it. The latter reaches the real LessonSpace classroom rather than a Bobbin-only placeholder.

On first entry, LessonSpace shows a tutor guide covering camera/microphone permission, unique per-student join links, course/library files, and the return of transcript, chat, and recording data to Bobbin. After dismissing it, the ready-but-not-started room exposes:

- waiting-room admission guidance and the scheduled lesson's **Start** action;
- add-device and browser-alert setup;
- leave-session and overflow menus;
- settings, screen share, microphone, camera, reactions, raise hand, and chat tools.

The room was verified in headed Chromium. LessonSpace embeds its media surface from `go.room.sh`; granting camera and microphone permissions to both Bobbin and that frame, with Playwright fake media devices, completed the device preview. The tutor then started the lesson, joined the recorded room with camera/microphone active, exercised the end confirmation, and returned the classroom to its ready state.

Because the controlled session was too short for AI analysis, Bobbin offered a manual completion path. Its confirmation states that no summary will be generated, tutor notes enter admin approval, and completion cannot be undone. Completion created a real held report. The administrator edited the tutor note, staged approval, confirmed immediate client email release, and sent the single controlled test report. The tutor's lesson then resolved to **Complete** on the Insights route with an explicit “No insights” state.

## Evidence

Screenshots cover dashboard, calendar, lessons, courses, students, recordings, resources, course and student sub-tabs, course-resource and homework dialogs, lesson detail, account menu, the Settings-to-dashboard route, classroom pre-entry, first-run guidance, and the hydrated ready room. Tutor-authored post-lesson reporting remains unavailable without a substantive completed participant session.
