# Bobbin competitive product check

## Deliverable

Open `_artifact/atlas.html` locally for the visual atlas. It contains 229 structured states and 49 observed flow links, with 118 searchable tags, a section tree, detail views, and a flow graph. Chromium smoke testing verified all 229 cards, search results across admin/tutor/settings evidence, an opening detail sheet, a visible Flows surface, and no page or console errors.

## Product shape

Bobbin is an administrator-led tutoring-operations product built around a continuous loop:

1. Set up organization data: clients, tutors, students, courses.
2. Schedule a lesson with a course roster.
3. Deliver it in a LessonSpace classroom.
4. Collect attendance/session artifacts.
5. Produce insights and reports after processing.

The left rail groups the product into organization, people, library, review queues, and settings. It creates a strong sense of a single operational workspace rather than a collection of disconnected tools.

## Strong observed patterns

### Progressive setup with real sample data

The five-part onboarding checklist is deliberate: client → tutor → student → course → lesson. Sample data gives a populated parallel example without contaminating the organization’s real lists. After the synthetic test data and lesson were created, the setup route resolved to the normal dashboard.

### Explicit side effects and role distinctions

Creation flows explain email/invitation consequences before submission. The classroom makes a clear distinction between an administrator observer and an assigned tutor; the admin can join, but their attendance does not substitute for the tutor’s. Student participation is separately controlled through waiting/let-in behavior.

### Evidence-rich lesson lifecycle

The live-room flow is unusually well articulated: pre-start choice, first-run onboarding, participant-specific invite links, device access, lesson-plan/notes shortcuts, end confirmation, session-history rows, and insight-pending state. The product records activity before AI insights are ready, which makes the asynchronous state legible.

### Operational controls near their consequences

Course roster controls sit beside course details; lesson creation is course-scoped; resource sharing explains its classroom effect; billing shows trial use, plan entitlements, and the external Stripe boundary. These reduce hidden dependencies between setup and delivery.

### Tutor role is narrow in navigation, broad inside a course

The tutor sidebar hides Clients, Tutors, Team, review queues, and organization Settings, and direct navigation to eight admin routes redirects to the tutor dashboard. But course roster dialogs let a tutor open full organization-level Add tutor and Add student forms, including invitation email, client linkage, and recording consent. Global search likewise returns client and tutor matches. This is a material product and permissions distinction for competitive analysis.

### Deep organization policy and integration surface

Admin Settings controls report approval, recording access/retention, consent defaults, tutor visibility, classroom entry, insight selection/order, email automation, safeguarding routing, AI content style, audit history, MCP, REST API keys, webhooks, Studybugs, GDPR export, billing, and beta features. The MCP screen explicitly distinguishes admin-assistant and tutor-assistant access and separately gates tutor-assistant write operations.

## Friction and watch-outs

- Several principal flows depend on invited users accepting email-based accounts, which complicates evaluation and multi-role test setup.
- The classroom can create multiple short session rows when administrators repeatedly enter/leave while testing; this is visible in Recordings even when no student joined and no session was billed.
- The test lesson's AI insight/report generation remains unavailable because the participant session was too short. The sample completed lesson provides populated insight, performance, objective, transcript/chat/analytics, PDF-export, and client-email evidence; a tutor-authored report on the synthetic lesson could not be produced.
- Native/in-person recording is mobile-app dependent, so it is structurally outside a web-only crawl.
- LessonSpace required media permission on both Bobbin and its `go.room.sh` frame. With those grants and fake media devices, the crawl captured live camera/microphone preview, final room Join, running recorded lesson controls, ending, manual Bobbin completion, admin approval/release, and the tutor's final Complete state.

## Exact coverage status

See `coverage-matrix.md`. Admin coverage now includes organization setup, invitations, course/lesson creation, classroom lifecycle, Dashboard/Calendar controls, Team add/remove boundaries, recording details/player/filters, resource folder/upload/filters, all review-queue substates, every Settings route and safe dialog, billing/Stripe boundary, and populated audit history. Tutor coverage includes its entire navigation, profile/security preferences, course/student/lesson details and sub-tabs, full non-submitted lesson wizard, course roster/edit/delete/AI-plan dialogs, classroom entry/ready room, recording player, resource controls, global utilities, filters, and direct-route authorization checks.

The final control audit also ran one real AI course-plan generation on the synthetic research course. Bobbin generated and automatically applied an eight-module GCSE algebra plan with 21 topic groups and 46 objectives. The atlas now includes its asynchronous drafting state, generated outline, module/topic/objective editing structure, coverage toggle, plan-history/template/freeform menu, immediate blank-module creation and cleanup, linked tutor/student destinations, and shared global-search/sidebar/help/account states.

## Test data created

The authorized test run created synthetic client, student, tutor, administrator, course, lesson, resource folder, and uploaded fixture. Related screenshots and specs are contained in the corresponding numbered section folders. One-time test-account join links are kept locally in `03-lessons/join-links.local.txt` at the account owner’s request and must not be published.

## Responsive authentication addendum

The authentication atlas adds 132 captures: 44 distinct access/setup states at desktop, tablet, and mobile web sizes. It covers login notices and errors, password visibility, two-factor and recovery-code challenges, signup and referral handling, administrator/client password recovery variants, reset/setup forms and validation, invitation lifecycle states, two-factor reset, recording consent, protected-route reauthentication, and first-time organization setup with all five entry forms. Token- or outcome-gated screens were rendered against controlled API responses and are labeled as such; the setup lane used the authorized account with only its completion read model reset. No real password, account email, consent, invitation decision, two-factor setting, or organization record was changed. Bobbin uses a split marketing/form composition on desktop and a single centered form column on tablet/mobile, with functional parity across the three breakpoints.
