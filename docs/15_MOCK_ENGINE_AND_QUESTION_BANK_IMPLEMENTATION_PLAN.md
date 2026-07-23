# Kanvise Mock Engine and Question Bank Implementation Plan

**Status:** In implementation — foundation and authoring API committed/in review
**Scope:** Tutor/admin authoring, centre question banks, student CBT attempts, grading, and results  
**Related documents:** `04_KANVISE_ERD_Database_Schema.md`, `05_KANVISE_API_Specification.md`, `08_KANVISE_Feature_Specifications.md`, `14_DASHBOARD_UX_AND_STITCH_AUDIT.md`

## 1. Decision and MVP boundary

Kanvise should build this inside the existing application and API. A separate subdomain or backend would duplicate authentication, enrolment, payment access, school tenancy, and reporting without improving the first release.

The first release is centre-first. It includes:

1. A tutor's private question banks.
2. Question banks shared with tutors in the same centre.
3. Manual question creation and validated CSV/DOCX import.
4. Search and filtering by subject, topic, type, author, and bank.
5. Reusing one question in multiple mocks without duplicating its source record.
6. Random question selection from a bank or filtered pool.
7. Immutable question and settings snapshots whenever a mock is published.
8. A Nigerian CBT-style student runner, including configurable calculator access, passages, keyboard shortcuts, autosave, reconnection, and server-authoritative timing.

The following are deliberately deferred until centre usage proves the model:

- A Kanvise-owned, verified Nigerian examination bank.
- A public/community bank contributed by tutors across centres.
- Paid question packs, licensing, creator payouts, and revenue sharing.

The data model must not prevent those later features, but the MVP must not expose marketplace language, public visibility, licensing, or payout controls.

## 2. Current-state audit

The current database stores questions directly under `mock_exams` through `mock_questions.mock_exam_id`. Options belong to those questions, and answers point back to the same mutable question and option records. This creates four problems:

- A question cannot be reused without copying it.
- Editing a source question can affect the meaning of an existing examination.
- Random bank-based assembly has no source pool.
- Published attempts have no immutable version to preserve exactly what a student saw.

The current tutor builder supports manual MCQ/theory authoring and CSV import. Tutor results and theory grading are partially implemented. The documented student start, save, submit, resume, timeout, and detailed-result flow is not yet a complete implementation.

The existing specification says the frontend owns the countdown and the API checks lateness only on submission. That is insufficient: a closed browser, lost connection, modified client clock, or missing submit request can leave an attempt in the wrong state. The new engine must calculate and enforce a server-owned `deadline_at`.

The earlier provisional `GET /mocks/student` route was removed during Phase 0. It
must not be restored as the final student contract; the versioned attempt endpoints
in this plan replace it.

### 2.1 Implementation checkpoint — 23 July 2026

Implemented in the repository:

- Additive question-bank, rich-content, immutable-version, mock-section, published-
  snapshot, attempt-timing, and retry-grant schema migrations.
- Atomic `SECURITY INVOKER` functions for creating and revising a question with its
  options in one database transaction.
- Hono-only private/centre question-bank CRUD, searchable question listing,
  version creation, version history, tenant/owner/course checks, and pagination.
- Runtime validation for text, equations, chemistry, accessible images, tables,
  MCQ answer keys, and theory questions.
- Student-response sanitation utilities and tests that remove correct-answer,
  explanation, and rubric fields.

Not yet operational:

- The new migrations have not been applied to staging because this workspace has
  neither an authenticated/linked Supabase CLI project nor a database connection
  string. A service-role API key cannot execute schema DDL.
- The tutor question-bank screens, import pipeline, mock-builder integration,
  publication snapshots, and student attempt runner remain subsequent phases.
- No new route should be enabled in a deployed environment until both migrations
  are applied and verified there.

## 3. Product language

Use plain terms consistently in the UI:

- **Question bank:** a reusable collection of questions.
- **Private bank:** visible only to its owner and centre admins.
- **Centre bank:** available to permitted tutors in the same tutorial centre.
- **Mock:** the examination tutors configure and publish to students.
- **Mock version:** the frozen copy of a mock created at publication.
- **Attempt:** one student's sitting of one published mock version.
- **Mock settings:** timing, availability, calculator, attempts, shuffling, and result-release choices. Do not label these as “policies” in the product.

## 4. Recommended domain model

All new tenant-owned rows must carry `school_id`. UUID primary keys and timestamps should follow existing conventions.

### 4.1 Authoring tables

#### `question_banks`

- `id`, `school_id`, `owner_id`
- `name`, `description`
- `visibility`: `private | centre`
- `created_at`, `updated_at`, `archived_at`

Rules:

- Private banks are editable by their owner and centre admins.
- Centre banks are readable by centre tutors; the author and admins may edit bank metadata.
- A question is edited by its author or an admin. Other tutors reuse it without silently changing it.

#### `bank_questions`

- `id`, `school_id`, `bank_id`, `author_id`
- `current_version_id`
- searchable classification: `course_id` where applicable, `subject_name`, `topic`, `subtopic`
- `question_type`: initially `mcq | theory`
- `status`: `active | archived`
- `created_at`, `updated_at`

`subject_name` and topic fields are retained even when a course is not yet configured, so imported Nigerian examination content can be organised before it is attached to a centre course.

#### `bank_question_versions`

Every edit creates a new immutable version rather than overwriting examination history:

- `id`, `question_id`, `version_number`, `created_by`, `created_at`
- `plain_text` for search and accessible fallbacks
- structured `content_blocks` for text, equations, chemistry, images, tables, and diagrams
- structured explanation and grading rubric content
- `marks`, `stimulus_id`
- immutable media references using the existing Cloudflare R2 storage boundary

Questions must not be limited to a single plain-text or arbitrary HTML field. The
structured content format must support:

- Paragraphs and formatted text.
- Inline and display mathematics stored as LaTeX and rendered with KaTeX.
- Chemical formulae and reactions stored as LaTeX-compatible `mhchem` expressions.
- Images used as the whole question, between text blocks, or inside an option.
- Tables, graphs, maps, circuits, geometry figures, and scientific diagrams.
- Accessible alternative text, captions, ordering, dimensions, and zoom behaviour.

The same block types must be available to answer options, explanations, theory
rubrics, and shared stimuli. Arbitrary stored HTML is not the source format because
it is harder to sanitize, edit, migrate, and render consistently on mobile.

#### `bank_question_option_versions`

- `id`, `question_version_id`
- structured option content, searchable plain-text fallback, `is_correct`, `order_index`

Options remain relational instead of JSON so validation, grading, ordering, and future option analytics remain explicit. Correct-answer fields must never be returned by student question endpoints.

#### `question_stimuli`

- `id`, `school_id`, `author_id`
- `title`, structured content blocks, searchable plain-text fallback

This supports one comprehension passage, diagram, or source text shared by several questions without repeating it.

#### `question_media`

- `id`, `school_id`, `storage_key`, MIME type, original filename
- intrinsic width/height where applicable, size, checksum, alternative text
- ownership, creation timestamp, and processing status

Files are uploaded to Cloudflare R2 through Hono-authorised flows. Published mock
versions retain immutable media references, so replacing an image in the bank cannot
change an examination that students have already taken. The student runner provides
responsive display, zoom/full-screen viewing, predictable reserved dimensions, and
low-bandwidth previews while keeping the original available when required.

### 4.2 Mock assembly and publication tables

#### `mock_sections`

- `id`, `school_id`, `mock_exam_id`
- `title`, `course_id`, `subject_name`, `order_index`
- optional section instructions

Sections are part of the MVP because Nigerian mocks commonly combine subjects. A simple single-subject mock still has one default section.

#### `mock_section_questions`

The editable draft assembly:

- `id`, `section_id`, `question_id`, `question_version_id`
- `order_index`, `marks_override`

The stored `question_version_id` makes intentional updates explicit: editing the source bank does not silently rewrite a draft mock. The tutor can choose “use latest version”.

#### `mock_question_rules`

Optional random-pool rules for a section:

- `id`, `section_id`, `bank_id`
- subject/topic/type filters
- `question_count`, ordering priority

Before publication the API shows the matching pool size and prevents publishing when the pool cannot satisfy the requested count.

#### `mock_exam_versions`

- `id`, `school_id`, `mock_exam_id`, `version_number`
- complete settings snapshot
- `published_by`, `published_at`
- aggregate question/mark counts

#### `mock_version_questions`

- `id`, `mock_exam_version_id`, `section_snapshot`, `question_version_id`
- `order_index`, `marks`

For the MVP, random rules are resolved once during publication. Every student taking a version receives the same selected set, with optional per-attempt ordering. This is auditable and easier to support than selecting a different question set for every student. Per-student random draws can be added later if centres prove they require them.

### 4.3 Attempt tables

Extend `mock_attempts` with:

- `mock_exam_version_id`
- `attempt_number`
- `deadline_at` calculated by Hono from server time
- `last_saved_at`, `finalized_at`
- `submission_reason`: `student | timeout | admin`
- score totals appropriate to MCQ and theory

Replace the current one-row-ever constraint with a unique `(mock_exam_version_id, student_id, attempt_number)` constraint. The MVP defaults to one attempt. An admin or assigned tutor may grant another attempt explicitly; this avoids casual unlimited retries.

Extend answers to reference `mock_version_question_id` and the selected immutable option. Saving an answer must use an idempotent upsert keyed by `(attempt_id, mock_version_question_id)`.

## 5. Mock settings for the first release

Required settings:

- Start and close dates.
- Time limit and server-owned deadline.
- One attempt by default, with explicit retry grants.
- Calculator: `none | basic | scientific`.
- Shuffle questions and shuffle options independently.
- Result release: `score_only | immediately_with_corrections | after_close | after_theory_grading`.
- Instructions shown before the attempt begins.
- Pass mark.

Multi-subject sections, passages, and mixed MCQ/theory are core requirements. Negative marking can be supported in the schema but should remain off and hidden until a real centre requests it; it adds avoidable grading and explanation complexity.

The calculator setting belongs to the entire mock initially. Basic mode covers arithmetic, percentages, roots, and memory. Scientific mode adds powers, logarithms, trigonometry, constants, and brackets. The student must see the selected calculator during preflight. On desktop it opens as a movable panel; on mobile it opens as a bottom sheet and must not obscure navigation or the active answer.

## 6. API contract

All endpoints run through Hono. Next.js must not access Supabase directly for application data.

### 6.1 Question banks

- `GET /question-banks` — banks accessible to the current tutor/admin.
- `POST /question-banks` — create private or centre bank.
- `GET /question-banks/:bankId` — metadata and counts.
- `PATCH /question-banks/:bankId` — rename, describe, archive, or change allowed visibility.
- `GET /question-banks/:bankId/questions` — paginated search and filters.
- `POST /question-banks/:bankId/questions` — create question and version 1.
- `GET /bank-questions/:questionId/versions` — version history.
- `PATCH /bank-questions/:questionId` — create a new version.
- `POST /question-banks/imports/preview` — parse and validate without writing questions.
- `POST /question-banks/imports/:importId/commit` — commit an accepted preview atomically.

Search parameters include `q`, `subject`, `topic`, `question_type`, `author_id`, and pagination. Search should use indexed normalized columns first; Postgres full-text/trigram indexes may be introduced only after real query-volume measurement.

### 6.2 Tutor mock authoring

- Existing create/update/list routes remain, but responses gain sections and settings.
- Add section CRUD and attach/detach/reorder endpoints.
- Add a bank-search endpoint scoped to the mock's school.
- Add rule preview/validation endpoints for random selection.
- `POST /mocks/:id/publish` runs one transaction that validates the draft, resolves random rules, creates the immutable version, freezes settings/questions/options, and makes that version available.
- Editing a published mock creates a new draft revision; it never rewrites an existing version or attempt.

### 6.3 Student attempts

- `GET /students/me/mocks` — available, in-progress, upcoming, and completed mocks based on paid/enrolled course access.
- `GET /mocks/:mockId/preflight` — instructions, timing, attempts, calculator, and availability; no questions or answers.
- `POST /mocks/:mockId/attempts` — atomically validates access and availability, creates or returns the resumable attempt, and returns server timing.
- `GET /attempts/:attemptId` — resumable attempt and sanitized questions.
- `PUT /attempts/:attemptId/answers/:questionId` — idempotent single-answer save.
- `PATCH /attempts/:attemptId/questions/:questionId/flag` — mark for review.
- `POST /attempts/:attemptId/submit` — idempotent final submission and MCQ grading.
- `GET /attempts/:attemptId/results` — result data filtered by the mock's release setting.
- `POST /mocks/:mockId/students/:studentId/retry` — authorised retry grant.

The API must never accept the browser's claimed elapsed time, score, correct answer, school, or student identity as authoritative.

## 7. Import experience

The first importer supports CSV and structured DOCX. Arbitrary PDF extraction is deferred because scan quality, columns, diagrams, and answer-key association make silent corruption too likely.

Import is a two-step workflow:

1. Upload and preview parsed questions.
2. Fix validation errors, choose bank/subject/topic, detect likely duplicates, then commit.

CSV templates should cover question type, question, options A–F, correct option, marks, explanation, subject, topic, and passage key. DOCX uses a published Kanvise template with examples. A failed row must be shown clearly; committing should not leave a half-imported file. The user can intentionally exclude bad rows before committing the rest.

DOCX import must preserve supported images and Word equations where they can be
converted safely. Equations are normalized to LaTeX and images are uploaded to R2
only after preview approval. Unsupported objects are blocking validation errors—not
silently discarded content. CSV may reference separately uploaded media but is not
expected to embed binary images.

AI parsing may later assist with messy documents, but it is not a dependency for a trustworthy MVP.

## 8. Tutor/admin experience

Add **Question banks** as a first-class dashboard destination for tutors and admins. The page shows “My banks” and “Centre banks”, question counts, subjects, last updated, and clear ownership.

The mock builder offers three obvious ways to add questions:

- Write a question.
- Import a document.
- Choose from a question bank.

Before publishing, show a review page with section coverage, question count, total marks, duration, calculator, availability, result-release choice, and any blocking validation. Random rules show both requested and available counts.

Admins can manage all centre banks. Pure tutors can use centre banks and manage their own content, subject to assigned-course authoring rules. A solo tutor receives the same tools without team-oriented wording or unnecessary permission screens.

## 9. Student CBT experience

The student mocks page should use four useful states: **Available**, **Continue**, **Upcoming**, and **Completed**. It should not advertise a marketplace or premium mock catalogue during this phase.

The runner includes:

- Persistent server-derived countdown.
- Question number palette with answered, unanswered, current, and flagged states.
- Previous/Next controls and a final review screen.
- Keyboard shortcuts: A–F to choose options where safe, N/P for navigation, and a visible shortcut guide. Shortcuts must not fire while typing theory answers.
- Calculator according to the tutor's setting.
- Passage/stimulus panel for comprehension questions.
- Consistent rendering of equations, chemical notation, tables, and images in
  questions, options, passages, and result explanations.
- Local optimistic state plus API autosave, with visible “Saving”, “Saved”, and “Offline — changes waiting” states.
- Reconnection and refresh resume from server state.
- Explicit submission confirmation showing unanswered questions.
- Accessible focus, labels, contrast, and mobile targets.

The browser countdown is presentation only. It derives remaining time from `deadline_at` and periodically reconciles with server time. Hono rejects answer changes after the deadline and finalizes expired attempts even if the browser disappears. A scheduled worker should close abandoned expired attempts; API reads/writes also lazily finalize them so correctness does not depend solely on the worker.

## 10. Access, integrity, and security requirements

- Every query must scope by authenticated `school_id`; route IDs alone are never sufficient.
- Student access reuses the existing paid/enrolled course entitlement logic. Manually admitted unpaid students are outside this plan.
- Private bank access requires owner/admin status. Centre bank access never crosses schools.
- Correct options, explanations, rubrics, and grading keys are removed from all attempt payloads until allowed by result-release settings.
- Publication is transactional and immutable.
- Attempt start, answer save, submission, timeout, and retry grants must be race-safe and idempotent.
- Submitted/timed-out answers are immutable to students.
- Theory scores must be between zero and the snapshotted marks for the question.
- Rich text and imported content must be sanitized; media must use authorised Cloudflare R2 upload flows.
- Publication must fail if required media is missing, still processing, or inaccessible.
- Audit events record publishing, version changes, retry grants, imports, and theory grading.
- Authorisation must use verified profiles/roles, not client-supplied metadata.
- MVP content remains tutor/centre-owned. Import requires confirmation that the centre has permission to use the material. No cross-centre redistribution is enabled.

The API currently uses a privileged Supabase server client, so application-layer tenant checks are mandatory. New database tables must still receive explicit grants and RLS policies before production exposure. The wider RLS hardening can remain a separately tracked task, but these tables must not ship openly accessible.

## 11. Additive migration and compatibility strategy

Do not replace or drop the current mock tables in the first migration.

1. Add bank, version, section, snapshot, and attempt-version structures.
2. Create an “Imported from existing mocks” centre bank for each affected school.
3. Convert each existing `mock_question` and its options into a bank question version while retaining a deterministic legacy mapping.
4. Generate one immutable mock version for every published mock and for any mock with attempts.
5. Backfill each attempt and answer to the generated version/snapshot while preserving IDs, scores, timestamps, and grading.
6. Switch Hono reads/writes behind a feature flag after verification queries pass.
7. Keep compatibility reads for legacy rows during rollout.
8. Stop writing legacy question relationships only after production verification.
9. Drop obsolete constraints/columns only in a later, separately reviewed cleanup migration.

Migration verification must compare per school: mocks, questions, options, attempts, answers, published counts, and stored scores before and after backfill. Rollback should disable the feature path, not delete migrated data.

## 12. Test and verification matrix

### Database and domain tests

- Existing data backfills without count or score loss.
- Editing a bank question creates a version and cannot alter published snapshots.
- Random rules cannot overdraw a pool and produce a reproducible published selection.
- Attempt and answer uniqueness constraints survive concurrent requests.

### API tests

- Role and tenant matrix for admin, assigned tutor, unassigned tutor, solo tutor, enrolled student, and unauthorised student.
- BOLA tests for bank, mock, question, attempt, answer, result, and retry IDs from another school/user.
- No correct-answer or rubric leakage in list, preflight, start, resume, and save responses.
- Start/resume, duplicate start, idempotent saves, duplicate submission, timeout, and late writes.
- Result release in every configured mode.
- Import preview, invalid rows, duplicates, cancellation, and atomic commit.
- Theory score bounds and full-grading notification.

### Frontend and end-to-end tests

- Tutor manually creates, imports, searches, reuses, randomises, previews, and publishes.
- Image-only questions, option images, shared diagrams, tables, mathematics, and
  chemistry render identically in author preview, student attempt, and results.
- Student sees only entitled mocks, starts, answers, flags, refreshes, disconnects/reconnects, uses calculator, times out, submits, and receives the permitted result.
- Tutor grades theory and student sees the completed result.
- Desktop, tablet, and narrow-mobile runner layouts.
- Keyboard-only, screen-reader labels, focus order, reduced motion, and contrast.
- Top navigation progress does not remain stuck on browser back/forward or attempt-route transitions.

### Operational tests

- Concurrent start/save/submit load test using realistic centre cohorts.
- Worker and lazy-timeout reconciliation agree.
- Structured logs expose attempt ID, mock version, route, status, and error category without logging answers or grading keys.

## 13. Delivery sequence

Each phase should be a reviewable PR/commit set with its own migrations, tests, and documentation.

### Phase 0 — Contract alignment

- Remove or replace the provisional student-list endpoint.
- Update API and feature specifications to match this plan.
- Add feature flags and freeze final naming/settings.

### Phase 1 — Versioned data foundation

- Add bank/question-version/stimulus/section/mock-version schema.
- Write migration and backfill verification tests.
- Preserve existing tutor results and grading.

### Phase 2 — Question-bank API

- Implement private/centre permissions, CRUD, versioning, search, and audit records.
- Add tenant, role, and leakage tests.

### Phase 3 — Tutor bank and import UX

- Build bank screens, manual editor, CSV/DOCX preview, validation, duplicate review, and commit.
- Integrate bank selection into the mock builder.

### Phase 4 — Publishing and random assembly

- Add sections, pool rules, preview, publish transaction, immutable snapshots, and new-draft editing.
- Backfill and switch existing published mocks safely.

### Phase 5 — Student CBT runner

- Implement mock list/preflight/start/resume/autosave/flags/submit.
- Add calculator, passages, palette, keyboard controls, responsive layout, offline recovery, and authoritative timeout.

### Phase 6 — Results and grading completion

- Enforce release settings, complete student result views, connect theory grading to snapshots, retry grants, and notifications.

### Phase 7 — Verification and rollout

- Run migrations in staging, execute the full test matrix, complete accessibility/load checks, update documentation, and release behind flags.
- Compare production-compatible backfill reports before enabling each school.

### Deferred growth phases

Only after centre usage, retention, content volume, copyright operations, and willingness to pay are demonstrated should Kanvise plan:

8. A Kanvise-owned verified bank with editorial provenance and syllabus mapping.
9. Cross-centre community contribution, moderation, reporting, and reputation.
10. Paid packs, entitlements, refunds, tax, creator earnings, payout reconciliation, and revenue sharing.

Printable PDF/mock export is also deferred. It would allow centres to produce a
paper version for offline practice or record-keeping, but it is not required for the
online examination engine or the marketplace foundation.

## 14. Recommended product defaults

- Include multi-subject sections now because they are normal in JAMB-style preparation.
- Start import with CSV and Kanvise-structured DOCX; defer arbitrary PDF parsing.
- Let admins manage centre banks; let assigned tutors create and reuse; restrict edits to the author/admin.
- Default to one attempt, with an explicit retry grant.
- Default result release to score only after submission; tutors deliberately opt into showing corrections.
- Resolve random pools at publication for the MVP.
- Keep the marketplace out of the student UI until supply, licensing, and payment behaviour are proven.

## 15. Definition of done

This initiative is complete only when a tutor can create or import reusable questions, share them appropriately inside a centre, assemble and publish an immutable mock, and an entitled student can complete that mock reliably on desktop or mobile under server-enforced timing. Results must survive source-question edits, theory grading must work against the exact published version, cross-tenant access must fail, and the implemented API/schema behaviour must match the documentation.
