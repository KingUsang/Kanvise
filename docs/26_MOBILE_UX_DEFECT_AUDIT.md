# Kanvise Mobile UX Defect Audit

Status: active investigation. This is a defect ledger, not an implementation plan. Items stay separate so later messages and fixes are not lost or mixed together.

Environment note: the root checkout's local `staging` branch is behind/divergent from `origin/staging` and `origin/main` for the student journey. Staging and production contain the newer four-item mobile student navigation. Findings below identify environment differences where relevant.

## Implementation tracking — 11 September 2026

This ledger separates code completed in the root `staging` branch from work that still needs runtime evidence or belongs to the concurrent student-journey branch.

| Scope | Current state | Evidence / boundary |
| --- | --- | --- |
| UX-01–02 classroom viewport and controls | Deferred | Live-class implementation is intentionally outside this goal; physical Android evidence is still required. |
| UX-03–04 centre setup length and media preview | Implemented and code-verified | First setup is reduced to centre name; profile sections are collapsible; previews are consistent and welcome video is playable (`916ea0e`). |
| UX-05 production-phone logo failure | Improved, not closed | Loading/error feedback and visible previews are implemented, but the original production CDN failure still needs a physical-device network trace. |
| UX-06 upload feedback | Implemented for root admin/tutor surfaces | Centre media and materials (`a3d10fc`), question images (`bb1bf1e`), assignment attachments (`6608960`) and programme covers (`12c22c1`) report byte progress, then a distinct server-processing state. Student upload surfaces belong to the concurrent student branch. |
| UX-07 centre slug | Implemented; staging migration pending | Generation/edit warning and reserved routes are protected (`916ea0e`, `a86cf4c`); historical redirects are implemented atomically (`2761cb0`). A linked-ledger check on 11 September found six remote migration versions absent from this checkout. Five are owned by the concurrent student branch; `migration fetch` was proven in a disposable simulation to overwrite historical local files, so the slug migration has not been pushed blindly. |
| UX-08–10 student navigation, density and filters | Concurrent branch boundary; not yet verified complete | Do not duplicate or overwrite `.student-journey-worktree`. A read-only check on 11 September still found 30px mobile headings and horizontally scrolling assignment/mock filters in its dirty working state; final verification must use that branch after its owner finishes and integrates it. |
| UX-11 scheduling/dashboard density | Implemented and code-verified | Compact dashboards and the Classes/start-now/timetable flows are covered by `7ea3d39`, `eb2f0cf`, `e504f5a`, `f9c7de6` and `7a66e78`. Runtime staging verification remains part of release testing. |
| UX-12–14 centre reset, validation and activation | Implemented and code-verified | Dirty-only confirmed discard, server normalization/validation, short centre activation and registration centre-name capture are in `916ea0e` and `537a3f1`. |
| UX-15 student access-code identity | Product decision still open | Invitation names were reduced (`de61942`), but a student-ID/PIN authentication and recovery model has not been approved or implemented. |
| UX-16 form reductions | Implemented for confirmed root flows | Account setup, centre profile, programme, question bank, mock, schedule, learning material and waitlist reductions are committed. Student-profile/journey verification remains with the concurrent branch. |
| UX-17 anonymous Supabase auth | No implementation intended | The audit concluded the present narrow guest pathway is defensible; switching auth models would not remove transfer/merge work. |
| UX-18 mock creation | Implemented and code-verified | Audience separation, programme-qualified subjects, visible add feedback, stable mode switching, compact progress and honest import stages are covered by `a31c2d0`, `91aead2`, `4aa3b87`, `79c3c21` and `46c3d73`. |
| UX-19–20 class start and timetable publishing | Implemented and code-verified | Start-now, recurring rules, draft publication and published-version preservation are covered by the scheduling commits above. Live classroom internals remain deferred. |

Verification baseline: the root web workspace passed its complete Vitest suite (42 files, 128 tests) and a real Next.js production build on 11 September 2026. Poppins is now bundled locally (`fb6d390`), so that build and the app's primary typeface no longer depend on a Google Fonts request.

## Evidence standard

- `Confirmed`: reproduced in staging or proven directly by the current implementation.
- `Likely`: implementation contains a credible failure path, but it has not been reproduced on the affected physical device.
- `Needs device`: browser emulation cannot reproduce the relevant operating-system behaviour.

## UX-01 — Android bottom navigation / edge-to-edge collision

Status: **likely; needs physical Android confirmation**.

- Kanvise opts into edge-to-edge rendering with `viewportFit: "cover"`.
- The loaded classroom uses `100dvh`, so its height follows the dynamic visual viewport rather than legacy `100vh`.
- At a 412×915 emulated Android viewport, the classroom measured exactly 915px high and its footer ended at 915px. There was no document-level horizontal or vertical overflow.
- The emulation reports `safe-area-inset-bottom: 0px`; it does not simulate the physical Android gesture or three-button navigation area.
- Kanvise adds `padding-bottom: env(safe-area-inset-bottom)` to the whole classroom. This can protect the controls, but current Chrome guidance advises against dynamically padding a bottom-anchored element because it can cause layout thrashing as Chrome's bottom UI retracts.
- A real Chrome 135+ Android capture must verify whether the footer is obscured. Emulation cannot pass this item.

## UX-02 — Live classroom mobile control density and clipping

Status: **confirmed on staging**.

- Tutor and student views fit the document width, but the closed chat/people drawer doubles the internal main-stage scroll width from 412px to 824px and relies on `overflow: clip` to hide it.
- On the tutor screenshot, Excalidraw controls, tutor PiP, Kanvise teaching-mode controls, media controls, chat, people and leave all compete on one screen.
- Excalidraw's right-side tool group is visibly clipped at the right edge.
- Kanvise hides most bottom-toolbar labels on phones, leaving several adjacent icon-only controls with weak discoverability.
- The temporary class remained in `Connecting` during capture, so connected-state and poor-network transitions still require a real room/device test.

## UX-03 — Centre setup is excessively long and copy-heavy on mobile

Status: **confirmed on staging**.

- A 412px-wide render is a long single column containing About, Photos/Video, Student Page, Contact Info and Social Links before completion.
- The page uses a 30px page heading and repeated 20px card headings, helper paragraphs, optional labels and upload instructions.
- Primary and reset actions appear before the form, while the user may be several screens lower when they finish editing.

## UX-04 — Centre media previews are inconsistent

Status: **confirmed in staging and implementation**.

- Logo preview is a separate 96×96 box placed above the mobile uploader.
- Cover preview is rendered dimly inside the upload target.
- Welcome video has no inline player or poster. After upload, the page only adds a link that opens the public file in another tab.
- There is no technical requirement preventing an inline video preview; it was simply not built.

## UX-05 — Uploaded centre logo does not reliably appear on phone

Status: **reported on physical phone; not reproduced in Chromium**.

- A disposable staging upload completed, persisted and loaded in the mobile Chromium image element (`naturalWidth: 1154`).
- Staging returns centre media from a raw `r2.dev` development URL. The reported failure occurred in production, which uses a CDN, so staging hosting is not an explanation for that production incident.
- The image UI has no loading, broken-image, retry or cache-refresh state. A failed request therefore appears as an unchanged or empty preview.
- On mobile, the preview is above the upload target. When the file picker returns the user to the upload control, the changed preview can be outside the visible area. This can make a successful upload look unchanged.
- The original physical-phone failure still needs its production CDN response status to distinguish a presentation problem from a failed image request.

## UX-06 — Upload feedback is fragmented

Status: **confirmed in implementation**.

- Classroom PDF upload uses real XHR byte progress and shows a percentage.
- Centre logo, cover and welcome-video uploads use `fetch` and show only an indeterminate “Uploading…” label—even though welcome videos may be as large as 500MB.
- Profile photo, notes, question images and other upload surfaces each implement their own loading text/spinner.
- A reusable upload task UI is warranted, but it must distinguish measurable byte transfer from server-side processing and must not invent percentages.

## UX-07 — Centre slug is necessary, but presented as setup work

Status: **confirmed in implementation**.

- The slug is required as the unique public centre address and tenant lookup key.
- The API can already generate it from the centre name when omitted, but the form still requires the admin to enter it manually.
- The current form allows the slug to change on later saves without warning that shared links will break.
- There is no reserved-word blocklist or old-slug redirect.
- Product direction: generate it automatically, show the resulting student link, make editing secondary, and protect later changes.

## UX-08 — Old local checkout contains duplicate mock destinations

Status: **confirmed only in the outdated local checkout; not present in current staging/production source**.

- The student navigation exposes both `Mocks` and `My mocks` with the same book icon.
- `My mocks` leads to `/my-mocks`, which immediately redirects back to the same student Mocks page.
- The newer student-journey code removes `My mocks` and uses the four-item mobile navigation seen on staging: Home, Learn, Mocks and Progress. This item must not be fixed again in the outdated checkout.

## UX-09 — Student mobile typography and cards consume too much space

Status: **confirmed on staging**.

- Primary student pages use 30px headings at 360px viewport width.
- The dashboard welcome card repeats the centre name, uses a very large two-line welcome heading, repeats explanatory copy and gives an entire inset panel to the number of accessible subjects.
- The class card repeats a long class identifier and course identifier, making a single upcoming-class card occupy most of the first viewport.
- Empty states are rendered as large bordered cards with large icons, headings and explanatory sentences instead of compact states.
- The 360px student dashboard is 1,226px tall even with almost no activity; Progress is 1,422px tall with no recorded results.

## UX-10 — Student assignment and mock filters overflow on narrow phones

Status: **confirmed on staging**.

- The Assignments `overdue` filter extends to 451px on a 360px viewport.
- Mock status tabs extend to 544px. The screenshot visibly cuts off `Upcoming` and hides later options.
- The document itself reports a 360px width because the filter container clips or scrolls its children; this avoids page-level horizontal scrolling but does not make the controls discoverable.

## UX-11 — Centre dashboard and scheduling are desktop information designs stacked on mobile

Status: **confirmed on staging**.

- The nearly empty admin dashboard is 1,957px tall at a 360×800 viewport and contains four separate metric cards, schedule, grading and mock-promotion cards.
- The nearly empty tutor dashboard similarly stacks four large metric cards before schedule and grading sections.
- The Schedule page exposes 41 buttons and 11 form controls in one 1,578px page.
- `Schedule Manager`, two header actions, the full creation form, calendar and scheduled-class table all render in one continuous mobile flow.
- The scheduled-class table retains desktop columns; its rightmost action area is visibly clipped on the 360px screenshot.

## UX-12 — Reset Changes is too prominent and detached from editing state

Status: **confirmed on staging and production source**.

- Reset appears at the top beside the primary save action before the form fields.
- It remains visible when nothing has changed.
- It resets immediately without a confirmation.
- On the 2,979px mobile form, the actions are far away when the user finishes the final field.

## UX-13 — Social and contact fields accept unvalidated arbitrary text

Status: **confirmed in frontend and API**.

- Website, Instagram, X/Twitter and Facebook are plain text fields.
- The API stores them without URL parsing, scheme enforcement, platform-host checks or normalisation.
- WhatsApp and phone values are not normalised to a canonical international number.
- Validation must allow legitimate platform URL variations and handles; a simplistic regex would create new problems.

## UX-14 — Centre identity is deferred into an oversized setup gate

Status: **confirmed in production registration flow**.

- Centre registration asks for personal name, email and password, verifies email, then sends the admin to the full School Setup page.
- The first setup technically requires only centre name and slug, but the user lands on the same 15-input page used for later profile editing.
- Moving centre name into the first account form is possible, but tenant creation should occur only after identity verification. A short post-verification `Name your centre` step avoids orphan centres and keeps optional profile fields out of activation.

## UX-15 — Student authentication assumes email/password despite access-code use case

Status: **confirmed product gap; design decision required**.

- Current student registration requires first name, last name, email, password and a six-digit email verification code.
- Students can self-register from public programme/mock flows; ordinary enrolment does not require an admin to manually enter every student's email.
- The admin `Add a student` modal nevertheless hard-requires email and immediately sends an activation email. CSV import can accept phone instead, but a phone-only roster row receives no usable login identity. These two paths are inconsistent.
- Admin-entered email is also central to tutor invitations because the invite is identity-bound.
- A shared class or centre access code alone is insufficient for paid entitlement, private results, progress and account recovery.
- A viable low-friction alternative is a unique student ID/access code plus a short PIN, with email, Google or phone as recovery or later account-upgrade methods. Shared enrolment codes can identify the centre/programme, but each student still needs an individual identity.

## UX-16 — Optional and derived fields make several forms unnecessarily long

Status: **confirmed in current production source**.

The audit covered all 37 production TSX components containing an input control, including 16 explicit form components. A field is not unnecessary merely because it is optional; the problem is presenting optional, derived and advanced decisions as part of the primary task.

| Flow | Keep in the primary task | Remove, derive or defer |
| --- | --- | --- |
| First centre setup | Centre name | Generate the student-page slug; default support email from the admin; defer description, logo, cover, welcome video, phone, website and five social/contact fields to Centre profile. `Reset Changes` is unnecessary before the form is dirty. |
| Account profile setup | Nothing is required to enter the product | The forced avatar builder and bio are optional profile decoration and should not gate entry. The placeholder Terms and Contact Support actions also do not belong in a required step. |
| Centre-admin registration | Personal identity plus verified sign-in method; centre name as the short product-setup question | With Google-first auth, do not ask separately for names/password when Google already supplies identity. Do not send the user from registration into the full centre-profile form. |
| Student registration | A recoverable identity method | Prefer Google first. Names can come from Google or be completed later. Password should only appear for the email-password fallback. |
| Add student | Programme and invitation destination | The admin does not need to type the student's first and last name; collect those from the student on activation or Google. The whole form should be secondary to self-enrolment links/codes. |
| Tutor invitation | Email or shareable identity-bound invite | Already lean. Names and password belong to acceptance only when they cannot come from an existing/Google account. |
| Programme creation | Name, at least one subject, and free/paid choice | Default to free; defer description, cover image and per-subject descriptions. Auto-assign the creator where appropriate; only ask for tutor assignment when ambiguous. Keep a review before publish, but it need not be a separate editing step. |
| Mock creation | Structure, title, subject(s), questions and the minimum delivery choice | Auto-generate link slug. Put calculator, attempts, pass mark, result release, availability window, shuffle switches and time overrides under Advanced settings with strong defaults. Reconcile scheduled publishing with `Students can start from`; the current UI asks two similar availability questions. Description/instructions can be optional and collapsed. |
| Question-bank creation | Bank name | Description and visibility can use defaults and be edited later. |
| Question editor | Question content and, for MCQ, options/correct answer | Default type and marks without demanding attention. Derive exam subject from Programme subject; show manual exam subject only when no programme subject is selected. Topic, explanation and scientific-notation controls are optional advanced sections. Image alt text remains necessary when an image is supplied. |
| Schedule class | Exact programme-subject record and start date/time | Do not infer by subject name: show a grouped picker such as `JAMB 2027 → Mathematics` and retain its unique course ID and programme ID. Title can default from that selection; duration can retain a default; tutor can auto-select the current/only assigned tutor and only ask when multiple choices exist. |
| Share learning material | Subject and file | Derive the title from the filename and let the tutor edit it. Collapse the optional student note. |
| Create assignment | Subject, deadline, title and task/question | This form is appropriately scoped. Attachment is already optional; use a sensible deadline default but do not remove the core fields. |
| Payout account | Bank and account number | Already lean. Account name is a verification result, not a user field, and should continue to be read-only. |
| Login, password reset and forgot password | Existing fields | Already lean. The main reduction is Google-first login, not deleting recovery fields. |
| Student profile settings | Names and recovery/account information | Bio and profile photo are optional and should remain out of onboarding. Student bio currently has little student-facing value compared with tutor bio. |
| Landing centre-interest form | Name, work email and centre name | Phone and estimated student count are sales qualification fields, not necessary to submit interest; make them optional or collect them after the lead is created. |

The biggest reduction is therefore not hiding every optional label. It is splitting **activation** from **profile completion**, applying defaults, and revealing advanced controls only when the user's choice makes them relevant.

## UX-17 — Supabase anonymous auth was viable, but would not eliminate guest-transfer logic

Status: **architecture reviewed against current production source and Supabase documentation**.

- Supabase anonymous sign-in would provide a real Auth user ID and JWT without collecting PII. It has the same browser/device-loss limitation as the current guest cookie until an identity is linked.
- Anonymous users receive the `authenticated` Postgres role. Enabling it would require auditing every existing authenticated RLS policy so anonymous students cannot access ordinary enrolled-user capabilities.
- Signing into an existing permanent account is not the same as upgrading the anonymous user. Kanvise would still need custom conflict and ownership-transfer handling for entitlements, used attempts and an already-in-progress account attempt.
- Supabase does not automatically clean up abandoned anonymous Auth users. Kanvise would need scheduled deletion, CAPTCHA/Turnstile and rate-limit management.
- The present Kanvise pathway intentionally creates no Auth user, `user_profile`, centre membership or enrolment for a free trial. Guest tables and RPCs are service-role-only, ownership is held by a hashed 30-day cookie, starts are separately rate-limited, and transfer is atomic.
- The custom route is therefore defensible for a narrowly scoped free-mock trial. Its cost is bespoke session/security/cleanup code. Supabase anonymous auth would simplify identity plumbing, but it would broaden the Auth/RLS surface and still leave the hardest account-merge logic custom.

## UX-18 — Mock setup conflates content, audience and selling decisions

Status: **confirmed in current production source and data model**.

- The first step simultaneously asks for exam structure, title, instructions, centre targeting, public-link access, free/paid status, price, link address and subject identity.
- `Centre`, `Anyone with the link` and `Both` are presented as three exclusive radio options even though link sharing is naturally an independent on/off capability alongside centre delivery.
- The same subject concept is used both to label exam content and to decide which enrolled students receive it. A direct-link mock instead uses a free-text subject. This makes changing access mode appear to change what the mock itself is.
- Course/subject rows are uniquely identified and carry `programme_id`, but the builder fetches no programme labels and displays only the course name.
- The multi-subject selector removes duplicate course names with a lowercase-name comparison. If Mathematics exists under two programmes, only the first can appear. Identity must be based on course ID, never display name.
- The backend supports programme-wide and centre-wide audience scopes, but the current builder only maps its controls to course, combination or direct-link targeting. For multi-subject mocks, the backend further restricts centre delivery to learners matching every selected course. Those implementation rules leak into confusing interface copy.

Recommended mobile flow:

1. **Basics:** title and `Single subject` / `Multi-subject exam`. Keep instructions optional and collapsed.
2. **Questions:** add/import questions. In multi-subject mode, create named exam sections without forcing centre enrolment mapping yet.
3. **Who gets it:** choose a clear recipient card: `A class/programme in my centre` or `No centre audience`. Use a searchable full-screen/bottom-sheet picker grouped as `Programme → Subject`; show programme and subject together and store IDs. Multi-subject centre delivery should target an explicit programme/cohort rather than silently infer audience from matching every question section.
4. **Share link:** an independent `Create a share link` switch. When enabled, choose `Free` or `Paid`; show price only for paid. Generate the address automatically and put `Customise link` behind a secondary action.
5. **Publish:** show timing plus a compact summary. Put attempts, pass mark, calculator, result release and shuffling under `Advanced settings` with defaults.

Each mobile step should be one column, use a sticky bottom `Back` / `Continue` action, preserve all draft state when choices change, and show completed choices as editable summary rows rather than repeating nested cards and explanatory paragraphs.

## UX-19 — Starting a live class is hidden behind scheduling terminology and workflow

Status: **confirmed in current production source and API**.

- The dashboard action is `Schedule Class`, the destination is titled `Schedule Manager`, and `New Class` merely focuses the already-visible scheduling form.
- The tutor's `Start Class` action exists only in a row of the scheduled-classes table. The dashboard's classes-today list has no start action.
- On mobile that table's action column is already clipped, making the only obvious start control even harder to discover.
- The API only starts a class whose state is already `scheduled`. A tutor who wants to teach now must first provide title, programme, subject, date, time and duration, create a scheduled record, find it in the list, and then start it.

Recommended interaction:

- Put **Start live class** on the tutor dashboard as the primary teaching action. If a class is due now, show **Start** directly on its card.
- Rename the scheduling destination to **Classes**, with `Upcoming` and `Past` views and a single add action offering **Start now** or **Schedule for later**.
- `Start now` should ask one primary question: **What are you teaching?** Show the subject name prominently and its parent course/programme as secondary text, for example `Mathematics` / `JAMB Science 2027`. Select by unique course ID.
- Generate a default title such as `Mathematics class`, use the signed-in tutor, and default duration. Put title and duration behind **Edit details**.
- `Schedule for later` adds date/time to the same compact flow. Only admins scheduling another person should see a tutor picker, and only when more than one assigned tutor is possible.
- Add one server operation for `start now` that validates assignment, creates the class record and starts the LiveKit room as one recoverable workflow. Chaining the existing create-then-start calls in the browser can leave an orphan scheduled class when the second call fails.

### User-facing terminology

`Programme` is not technically wrong: the current object is a sellable/enrollable bundle with a price, cover, subjects and tutors. The problem is forcing that abstract catalogue term into everyday actions such as starting a class.

The clearest consistent user-facing hierarchy is:

- **Course** — the bundle a student enrols in, e.g. `JAMB Science 2027` (currently `programme` internally).
- **Subject** — Mathematics, Physics, English (currently `course` internally).
- **Live class** — one teaching session.

The database names do not need to change. UI copy can map the internal model to these terms. In task-focused screens, prefer questions such as **What are you teaching?** and show `Subject · Course` rather than asking users to understand the hierarchy first.

## UX-20 — There is no draft or Publish Timetable workflow

Status: **confirmed in current production source, student query and reminder job**.

- Creating a scheduled class inserts it immediately with status `scheduled`.
- Student class pages query those records directly, so each new entry becomes visible immediately.
- The reminder job also scans every `scheduled` class with `notification_sent = false`; there is no timetable publication condition.
- `Download Schedule` exports CSV. It does not publish anything.
- There is no timetable entity, draft state, batch preview, published version or `published_at` field for live-class scheduling.

This means **Publish timetable** cannot honestly be added as a cosmetic button. The product needs an unpublished state and student/reminder queries must respect it.

Recommended separation:

- **Start class** is the everyday dashboard action. Its compact sheet defaults to **Start now** and offers **Schedule for later** as the secondary mode. Starting now creates an ad-hoc live session and never requires a timetable or timetable publication. Scheduling one isolated class for later publishes that class directly after a clear confirmation; it should not force the user through the bulk timetable builder.
- **Classes → Timetable** is a one-time administrative setup for an ongoing weekly pattern belonging to a programme or standalone course. It repeats indefinitely by default; admins return only when they need to change it. It consumes the existing subject–tutor assignments and must not recreate assignment controls. A tutor choice is shown only when several already-assigned tutors make the host ambiguous.
- A timetable slot defaults to **Repeats every week** and offers **This week only** for an exception. The compact **Schedule for later** flow also supports recurrence, but defaults to **One time** so an ad-hoc class cannot accidentally become an indefinite timetable rule.
- Initial setup should be a subject-first mobile list: select a subject, add its day/time, accept the default duration, and optionally repeat or add another time. Title, duration and recurrence details remain under **More options**. Programme/course context is secondary text used only to disambiguate subjects with the same name.
- Timetable drafts autosave and remain invisible to students. The builder provides duplicate-day/duplicate-class shortcuts, inline conflict feedback and a student preview, then one **Publish timetable** action.
- A persistent action shows **Publish timetable** with a count such as `Publish 6 classes`. Before publishing, show a mobile student preview and conflicts/missing-tutor checks.
- Publishing marks the selected draft entries visible in one transaction, records `published_at`/publisher, and only then makes them eligible for student queries and reminders.
- After first publication, the default view becomes a compact read-only agenda with one **Edit timetable** action. Editing displays **Unpublished changes** and requires **Publish changes**, rather than silently changing what students already saw. Students continue seeing the last published version while edits are in progress.
- Cancellation is a separate explicit action and should notify affected students; it is not the same as deleting an unpublished draft.

Recurring schedules should not be represented by pre-creating an unlimited number of `live_classes` rows. Store an ongoing timetable rule/series separately and create concrete class occurrences only within a bounded upcoming window or when needed. Store cancellations, moved times and substitute tutors as dated exceptions to that rule. When editing an occurrence, ask **This class only** or **This and future classes**; never silently rewrite past classes. Draft/publication metadata remains necessary so a partially edited timetable is not exposed to students.

## Pending audit areas

- Full student journey: dashboard → class → assignment → mock → result.
- Full tutor journey: schedule → start class → teach → upload → end class.
- Full centre-admin journey and navigation grouping.
- Physical Android Chrome and installed-PWA safe areas, address-bar changes and keyboard behaviour.
- Slow/failed uploads, retry, cancellation and server-side processing feedback.
- Global typography, copy reduction and redundant navigation/content.
