# Feature-level coverage audit

| Feature | Verdict | Evidence / next action |
| --- | --- | --- |
| Five-step organization setup | WALKED | Synthetic client, tutor, student, course, and lesson; setup route now resolves to dashboard. |
| Client invitation | WALKED | Captured wizard and submitted a controlled test invitation. |
| Student client-picker and consent default | WALKED | Picker-open, selected, and created detail captured. |
| Tutor invitation | WALKED | Captured wizard and submitted a controlled test invitation. |
| Course creation and roster | WALKED | All three wizard steps and created course captured. |
| AI course-plan generation and generated-outline editing | WALKED | One authorized freeform generation was submitted and auto-applied: loading/game state, 8-module result, overflow actions, module detail/edit mode, objective coverage toggle/revert, immediate blank-module creation, remove confirmation, and cleanup verification captured. |
| Course roster linked entities | WALKED | Course tutor and student names were followed to their real detail routes; adjacent remove controls are inventoried and earlier roster-management surfaces cover membership changes. |
| Lesson scheduling | WALKED | Empty-topic validation, filled schedule, review, and scheduled detail captured. |
| Classroom lifecycle | WALKED | Admin confirmation, pre-start, live room, invite panel, end confirmation, and post-end state captured. |
| Lesson insights/report generation | WALKED | Sample lesson provides populated AI insights/export/email evidence; synthetic tutor lesson provides the real no-insights manual completion, approval, and client-release path. |
| Billing / plan selection | WALKED | Trial usage and plan selector captured; Stripe checkout reached, no payment entered. |
| Dashboard and calendar interactions | WALKED | Admin search/help/account/mobile overlays, Day/Week/Month views, and all entity/status filter pickers captured. |
| Shared app chrome and minute-control audit | WALKED | Empty and populated global search, Help/updates, account menu, sidebar collapse/expand captured; live inventory covered 20 admin routes and 552 visible controls, cross-checked against earlier section evidence. |
| Team management | WALKED | Add-member invitation flow and unsent remove/revoke confirmation captured. |
| Recording lifecycle | WALKED | Populated online sessions, expanded attendance, every filter picker, in-person empty state, and recording player captured; mobile creation is outside the web lane. |
| Resource upload/library | WALKED | Shared folder creation, real test upload, completed library, and every type/visibility/date filter captured. |
| Report approval, safeguarding, unlinked sessions | WALKED | Current queues rechecked after tutor sessions; report approval remains empty, all safeguarding status/filter states captured, and unlinked toggle/filter captured. No actionable record exists. |
| Settings controls | WALKED | All 13 routes plus search, Jump-to, timezone, audit filter, insight reorder, AI comparison, API key, webhook, beta feedback, and integration/export forms captured without secret creation or external submission. |
| Tutor workspace and role boundary | WALKED | Tutor dashboard, calendar, lessons, courses, students, recordings, resources, account menu, and restricted Settings route captured. |
| Tutor lesson creation | WALKED | All three non-mutating wizard states captured through Review & create; final duplicate test lesson was not scheduled. |
| Tutor course resources and homework | WALKED | Settled empty states plus attach/upload and homework-form dialogs captured; no submission made. |
| Tutor course management and roster boundary | WALKED | Edit/delete confirmations, add-tutor/add-student pickers, nested organization-person forms, and AI plan catalog/freeform entries captured. |
| Tutor personal settings | WALKED | Details, email-change dialog, password, two-factor, and notification preference pages captured. |
| Tutor global utilities and filters | WALKED | Global search, help/updates, and Calendar/Lessons/Courses/Recordings/Resources filter overlays captured. |
| Tutor calendar and lesson-status substates | WALKED | Day/Week/Month calendar views and every lesson status segment captured. |
| Tutor recordings and resources | WALKED | Online/in-person states, recording player, folder form/grouping toggle, upload, and filters captured. |
| Tutor admin-route enforcement | WALKED | Eight hidden admin/organization routes directly probed; all ultimately redirect to the tutor dashboard. |
| Tutor classroom entry and controls | WALKED | Pre-entry choice, LessonSpace first-run guide, and hydrated ready room with waiting-room/device/media/collaboration controls captured. |
| Tutor classroom live/post-lesson report | WALKED | Camera/microphone device preview, final room Join, running recorded lesson, end confirmation, manual completion, awaiting approval, admin edit/approve/release, and tutor-visible Complete state captured. |
| Responsive authentication and access | WALKED | 44 states × desktop/tablet/mobile: login, notices/errors, signup/referral, recovery, password setup, signup confirmation, invitations, 2FA challenge/reset, protected-route reauthentication, recording consent, and first-time organization setup plus all five entry forms. Controlled states are labeled; see `16-auth-responsive/coverage.md`. |
| Administrator + tutor dual membership | WALKED | Existing admin email resolved to a two-step confirmation, tutor creation returned HTTP 201 without mailbox acceptance, the identity then held both memberships, and live Tutor/Admin switches each returned HTTP 200 with the expected workspace navigation. |
