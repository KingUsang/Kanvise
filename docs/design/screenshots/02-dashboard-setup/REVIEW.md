# Step 2 design and wording review

Reviewed against the Bobbin atlas (`bobbin-appatlas`), specs 03-dashboard, 02-onboarding-and-setup, 01-app-shell (SH-02, SH-11), 16-responsive (R-08, R-09) and 00-decisions sections 12, 13 and 13a. Every screenshot in this folder was retaken after the fixes below. How the shots were made is in README.md.

## Bobbin dashboard reference (v3 review note 5)

`HANDOFF.md` cites `01-dashboard/screenshots/page--default.png` as the dashboard reference. That capture is the page while it loads: the sidebar and the trial banner, and an empty content area.

Better reference: **`00-recon/screenshots/setup--post-test-data.png`**. It is the admin dashboard with data: greeting and date, Today with a lesson row (Join, Planned), This week with the day strip, Needs attention and the right column. For the tutor view keep `15-tutor-role/screenshots/tutor-dashboard--default.png`. `page--default.png` stays the reference for the loading state only. The spec branch is not edited here; this choice is recorded in this file and in the PR summary. See `compare/admin-dashboard.png`.

## Design findings

| Screenshot | Issue | Status |
| --- | --- | --- |
| dashboard-*-populated-360 | Today rows squeezed the title to one or two letters ("Q…") because time, two swatches, title and status chip shared one line. Both course swatches showed on phones: `CourseSwatch` sets `inline-block`, which beat the `hidden` class passed in. | Fixed in `dashboard-home-view.tsx`. On phones the row is a two-column grid: time, then title and details, with the status chip on its own line under them. Wrapper spans now own the swatch display. Wider screens keep one row. |
| setup-*-360 | Each checklist row put the empty status circle on a line of its own, above the title. | Fixed in `setup-view.tsx`. The circle stays beside the title; the button moves under the text on phones. |
| setup-*-360 | "Let's get your first lesson on the calendar." wrapped to three lines. | Fixed: 18px on phones, 20px from 640px. |
| setup-* | Bobbin's rows have an icon in the circle and a bordered card per row. Kanvise has an empty circle until done and divider lines. | Deferred. Spec 02 SET-01 does not ask for row icons. Worth a look in the step 3 polish pass. |
| dashboard-admin-populated-1280 vs Bobbin | Bobbin has a right column (Needs attention, help card, mobile app card). Kanvise is one column. | Expected. Needs attention (DB-05) and Suggestions (DB-06) are hidden until their steps; the cards are not copied (03 "Deliberate differences"). |
| dashboard-*-loading vs Bobbin page--default | Bobbin shows an empty content area while loading; Kanvise shows a skeleton shaped like the page. | Deliberate. 00 section 12 and 16 R-08 ask for skeletons, not blank pages. Atlassian's design system gives the same advice: "Match the size and shape of the expected content so the page does not jump when loading completes" ([Atlassian, Skeleton usage](https://atlassian.design/components/skeleton/usage)). |
| This week, all widths | Kanvise lists every lesson in the week under the day strip. Bobbin lists the selected day's lessons and links "All lessons". | Owner question (below). Not changed here. |
| Phone bottom bar on /dashboard/setup | More is the active tab, since Setup lives in the More sheet on phones. | Fine. Matches SH-02 placement. |

Checked and fine: 4px spacing rhythm, page title 24/30px bold, panel headings 18px, course swatches are squares and status chips are dots (SH-15), orange only on the active nav bar and today's day border, indigo primary buttons, no horizontal scrolling at 360px, tap targets 44px (day buttons are 56px tall), the bottom bar never covers content (the `-end` shots).

## Speed and motion audit

Run with `e2e/screenshots/step-02-motion-audit.mjs`, motion on. All checks pass after the fixes.

| Check | Result |
| --- | --- |
| R-08: skeleton within 100 ms on a full page load of `/dashboard` | **Failed before, fixed.** `app/dashboard/layout.tsx` awaited `supabase.auth.getUser()`, a network call to Supabase Auth, before any HTML was sent. `/dashboard` has no `loading.tsx`, and a `loading.tsx` would not help: it wraps the page, not the layout. The browser showed a blank page for the whole round trip. Now the layout is a Suspense boundary around `SignedInDashboardLayout` (moved to `components/dashboard/signed-in-layout.tsx`), with `ShellFirstPaintSkeleton` as the fallback, so the skeleton streams in the first bytes. This is the fix Next.js documents: "wrap the runtime data access in your layout in its own `<Suspense>` boundary" ([Next.js, loading.js](https://nextjs.org/docs/app/api-reference/file-conventions/loading)). Test: `app/dashboard/layout.test.tsx`. |
| R-08: `/onboarding` | **Failed before, fixed.** The page awaited the same call with no loading UI, and `OnboardingGate` then showed an empty page while the onboarding state loaded. Added `app/onboarding/loading.tsx` and `OnboardingSkeleton`, used in both places. |
| Redirects inside the Suspense boundary | Signed-out people and students are still sent away. Inside a stream, Next.js sends the redirect as a client-side redirect ([Next.js, redirect](https://nextjs.org/docs/app/api-reference/functions/redirect)). In practice the proxy already redirects signed-out requests before the layout runs (checked: `/dashboard` with no session returns 307 to `/auth/login` in 0.13 s). |
| SH-11: Let's go while the greeting is typing | Acts at once (47 ms to the next question). |
| SH-11: an answer chip while the question is typing | Acts at once (44 ms). |
| ONB-01: any key shows the rest of the line | Pass. |
| SH-11: Mine only, day filter, Skip this step straight after load | Each acts within 70 ms. |
| Dead animation class | `dashboard-home-client.tsx` wrapped the page in `animate-in fade-in duration-300`. No animation plugin is installed, so it did nothing. Removed. Eleven other pages outside this step use the same dead classes; left for the step that touches them. |

The preview timings (skeleton visible about 150 to 240 ms after navigation on this machine) include loading the preview's JavaScript, because the previews render in the browser. They do not measure the app path; the app path is covered by the structural fix and its test. A real-device check on a slow connection is still needed (R-09).

Motion research behind keeping Kavi's typing short and skippable: Atlassian's motion guidance says "Avoid motion that blocks the next step in a flow" and "Verify the interface remains fully usable with all motion disabled" ([Atlassian, Motion](https://atlassian.design/foundations/motion)). Kavi's typing (0.4 s dots, at most 1 s per line) never blocks a tap, and reduced motion shows plain text.

## Bobbin side-by-sides

In `compare/`, named after the spec "Checked against Bobbin" lists:

| File | Bobbin | Kanvise |
| --- | --- | --- |
| tutor-dashboard.png | 15-tutor-role/tutor-dashboard--default.png | dashboard-tutor-populated-1280 |
| admin-dashboard.png | 00-recon/setup--post-test-data.png (new reference) | dashboard-admin-populated-1280 |
| admin-dashboard-full-width.png | 01-dashboard/dashboard-help-updates.png | dashboard-admin-populated-1280 |
| dashboard-right-column.png | 01-dashboard/dashboard-account-menu.png (email masked) | dashboard-independent-populated-1280 |
| dashboard-loading.png | 01-dashboard/page--default.png | dashboard-admin-loading-1280 |
| dashboard-empty.png | 15-tutor-role/tutor-dashboard--default.png (no empty capture exists) | dashboard-tutor-empty-1280 |
| live-view.png | 15-tutor-role/tutor-live-view.png | dashboard-admin-populated-1280 (Live now hidden until step 5) |
| setup-checklist.png, setup-some-done.png | 00-recon/post-login.png | setup-admin-fresh-1280, setup-admin-some-done-1280 |
| after-setup.png | 00-recon/setup--post-test-data.png | setup-admin-all-set-1280 |
| invited-tutor.png | 15-tutor-role/tutor-dashboard--default.png | dashboard-tutor-populated-1280 |
| sample-course.png | 04-courses/sample-course--outline.png | onboarding-hello-1280 (sample course hidden until step 4) |

`/projects/sandbox/atlas/s2/00-recon_post-login.png` (listed in spec 02) is not on disk; `00-recon/post-login.png` is the same screen.

## Wording

Checked every user-facing string in `components/dashboard/home`, `components/dashboard/setup`, `components/onboarding`, `lib/setup-checklist.ts`, `lib/onboarding-script.ts`, `lib/dashboard-overview.ts` and the new skeletons against 00 sections 13 and 13a. Spec copy was not reworded.

| Check | Result |
| --- | --- |
| Banned words (learner, live class, report, observer, parent, guardian, diagnostic, tutoring account, waiting room, class, session, assignment) | None in UI copy. |
| Kavi never jokes or praises for nothing | Pass. Replies say what happens next ("Okay. I'll add a step for inviting your tutors."). |
| Sample names | Fixed in the dashboard preview: it used "GCSE Biology", "GCSE Physics" (exam-board names, banned by 13a) and a name outside the sample set. Now Algebra 1 Small Group, Biology Basics, Physics Foundations, English Writing, Michael Chen and Chidi Okafor. |
| Em dashes | None in new or changed files. |
| Plurals | "1 student", "2 students", "1 lesson", "4 lessons" (helpers in dashboard-overview.ts). |

## Owner questions

1. **This week list.** The owner prefers Bobbin's way for the calendar part of the dashboard. Bobbin's This week shows the selected day's lessons under the strip, with an "All lessons" link; Kanvise lists the whole week. Not changed in this step; to be picked up by the planner with the right step.
2. **Course plan row.** It can only be skipped, never done, until step 4 adds the topic read, so a new account cannot reach "You're all set." without skipping it. Fine for now, since the row is hidden until step 4.

## Known differences from the design

These are not logged in `docs/deviations.md`, which is for closing bugs and inconsistencies. No register rows were closed in this step.

- **Tutor admin-page block (SH-14a).** Middleware no longer redirects a Tutor who opens an admin-only URL. The client shell hides admin destinations and redirects, and the API refuses the data through role checks. A Tutor can briefly request an admin route's client bundle. Move the check to a server layout if admin pages ever render data on the server.
- **Dashboard frame (DB-01, DB-03, DB-04).** Needs attention, Suggestions, Live now, Join, Write summary, Schedule lesson and the Sample course banner are not rendered until the step that owns their target ships. Lesson rows and All lessons are not links until the lesson page ships in step 4.
- **Overview endpoint.** "Classroom opens" is a fixed 15 minutes until CFG-L stores the setting. Student counts cost one lookup per distinct course in view, so a week with many courses runs several lookups. Batch them if the week view gets slow. Course swatch colours derive from the course id.
- **Setup checklist (SET-01).** `SETUP_SHIPPED_STEP` is 2, so no row shows, the Setup item and sidebar card stay hidden, and `/dashboard/setup` redirects to `/dashboard`. Raise it as steps 3, 4 and 5 ship, and add the stored facts for the course plan topic and device check in steps 4 and 5.
- **Account type (ONB-02).** The account type is set at tutoring agency setup. A team answer on an independent account is stored only, and an agency name renames only an agency account.
- **Account owner (ONB-10).** `account_onboarding_answers` has one row per account. Only the earliest active admin answers and sees the checklist. Accounts with no row get no checklist. A removed owner hands the checklist to the next admin.
- **Typing (ONB-02 to ONB-06).** Kavi's reply to an answer shows with the next question. Only questions and the greeting are typed.
- **Omitted content (ONB-05, SET-03).** The defaults banner leaves out the Teaching preferences link (CFG-T, step 3). SET-03 omits the first lesson time. The help card shows only when `NEXT_PUBLIC_HELP_URL` is set. Explore the sample course is not built.

