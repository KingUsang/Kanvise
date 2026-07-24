# Kanvise Mock Marketplace Delivery Plan

**Status:** Marketplace foundation is implemented on `staging`; tutor PDF import and pre-publish review are the current authoring slice
**Foundation:** `15_MOCK_ENGINE_AND_QUESTION_BANK_IMPLEMENTATION_PLAN.md`  
**Initial product shape:** One Kanvise application and API; no separate subdomain or
second authentication system

### Current tutor authoring slice

The first practical authoring path is intentionally mixed-subject: tutors may put
questions from different subjects into one mock, but Kanvise does not yet split the
mock into subject sections or calculate subject-specific scores. The builder accepts
PDF, CSV, and DOCX imports. PDF and DOCX imports are sent from the API to Gemini as
editable drafts; mathematical equations and chemical notation are saved as Kanvise
content blocks and rendered in the review screen. The tutor must review the returned
questions before publishing.
Configure `GEMINI_API_KEY` on the API server and optionally set
`GEMINI_MOCK_IMPORT_MODEL`. The browser never receives the provider key.

**Deferred follow-up — PDF image preservation:** Gemini can recognise diagrams,
graphs, maps, circuits, and other images during import, but the current import
slice saves text and review warnings only. A later slice must extract or crop
those visual assets, upload them to Cloudflare R2, save them as question
`content_blocks`, and render them in the tutor review and student CBT screens.

**Deferred follow-up — visual scientific editor:** The current review screen lets
 tutors edit the imported LaTeX or mhchem source directly and see a live preview.
 Add a small visual toolbar later for common fractions, roots, powers, symbols,
 chemical arrows, subscripts, and superscripts so tutors do not need to learn
 LaTeX syntax before correcting an imported question.

## 1. Product definition

The mock marketplace is a catalogue where an authorised tutor or centre can publish
a frozen mock version for students beyond their own centre. A listing can be free
or paid. A student discovers the mock, reviews enough information to make a choice,
gets access, takes it in the existing CBT runner, and receives results according to
the creator's release settings.

The marketplace does not sell editable source questions. It grants a student the
right to attempt a particular published mock version. The creator's question banks,
answer keys, rubrics, and future edits remain private.

This distinction makes the marketplace feasible on top of the current engine:

- question banks supply reusable authoring content;
- publication already creates an immutable mock version;
- the CBT runner already handles timing, calculator choice, images, mathematics,
  chemistry, autosave, timeout, grading, and result release;
- a marketplace entitlement can grant access to that version without copying it.

## 2. Why it should remain inside Kanvise

The first release should use public discovery routes such as `/mocks` and
`/mocks/[slug]`, while authenticated attempts remain under the student experience.
A separate subdomain can be introduced later for branding or search optimisation,
but it should still use the same API, identity, database, and payment contracts.

Building a second product now would duplicate sign-in, student identity, Paystack
verification, result history, accessibility, and the CBT runner. It would also make
cross-product entitlements and support harder.

## 3. Pilot boundary

The pilot should prove that tutors will publish useful mocks and students will
complete them before Kanvise builds a complex marketplace economy.

Include:

1. Creator eligibility limited to verified Kanvise centres and their authorised
   admins/tutors. A tutor submits a public mock; a centre admin approves it.
2. Free and one-time paid listings in NGN.
3. Public catalogue, search, and filters for examination, subject, year/category,
   duration, question count, creator, and free/paid.
4. A listing page with accurate syllabus/subject coverage, instructions, duration,
   calculator availability, attempts included, result-release rule, creator, price,
   and a small creator-selected preview.
5. Paystack checkout for paid mocks and immediate entitlement for free mocks.
6. Existing CBT preflight, runner, submission, grading, and results.
7. Creator sales/completion summary and Kanvise support visibility.
8. Report-listing and unpublish controls.

Defer until pilot evidence supports them:

- ratings and public written reviews;
- coupons, bundles, subscriptions, affiliates, and dynamic pricing;
- revenue sharing beyond the centre payout destination, tax handling, and refunds;
- Kanvise-owned or community question-bank licensing;
- recommendation feeds and ranking personalisation;
- printable/exportable copies of paid mock content.

## 4. Roles and permissions

### Creator

- An admin may publish a centre-owned mock.
- A tutor may create and submit a mock they own or are assigned to. A tutor working
  under a centre needs centre-admin approval before it becomes a public listing.
- A verified solo tutor is both the centre admin and tutor, so they can approve
  and publish their own listing.
- Creating or listing a mock always requires a verified Kanvise account. Anonymous
  visitors may browse safe previews but cannot author or publish content.
- Only an admin may connect or change the centre's payout destination.
- Publication to enrolled centre students and publication to the public marketplace
  are separate choices.

### Student

- Anyone may browse the public catalogue and safe preview without signing in.
- A student must create or sign in to a Kanvise student account before claiming,
  buying, or attempting a mock so access, attempts, payment, and results have one
  accountable owner.
- Marketplace access is based on an entitlement, not the student's centre
  enrolment.
- An entitlement grants only the advertised number of attempts against the
  purchased immutable version.

### Kanvise support and moderation team

- This means authorised internal Kanvise staff, not a tutorial-centre admin and not
  a public user role.
- They may suspend or remove a listing after a report, fraud, copyright, safety,
  or dispute issue without deleting attempts or financial history. They do not
  approve ordinary listings before publication.
- Cannot silently edit creator questions or answer keys.
- Has an auditable reason and actor for moderation changes.

## 5. Data model

All identifiers remain UUIDs and all money is stored as integer kobo.

### `mock_marketplace_listings`

- creator school, creator user, source mock, published mock version
- unique slug, title, short description, cover image
- examination/category, subjects, tags, difficulty label
- question count, total marks, duration, calculator mode, attempts included
- `approval_status`: `draft | submitted | approved | rejected`
- `publication_status`: `unlisted | listed | withdrawn | suspended`
- optional `available_from` and `closes_at` timestamps
- `pricing_type`: `free | paid`
- price in kobo and currency fixed to NGN for the pilot
- preview configuration containing only explicitly selected safe questions
- listed, suspended, and withdrawn timestamps

A listed record always points to one immutable version. Publishing a revised mock
creates a new listing revision; it never changes what an existing buyer purchased.

### `mock_marketplace_orders`

- student, listing, purchased version, creator school
- amount, platform fee, creator amount, currency
- Paystack reference, idempotency key, status
- created, paid, failed, refunded timestamps

An order records the commercial facts at purchase time. Later price changes do not
rewrite it.

### `mock_marketplace_entitlements`

- student, listing, purchased version, originating order or free claim
- attempts granted and attempts consumed
- granted, expires, revoked timestamps and reason

A unique constraint prevents duplicate active claims for the same student and
version. Attempt creation consumes entitlement atomically so retries and parallel
requests cannot exceed the allowance.

### `mock_marketplace_moderation_events`

- listing, actor, action, reason, structured evidence, timestamp

Reports may be stored separately so repeated reports can be triaged without
changing listing state.

### Financial ledger

The pilot must record the platform, Paystack-processing, and creator portions at
payment confirmation. The student pays the processing charge; the checkout must
show mock price, processing charge, and total before redirecting to Paystack.
Use the centre's verified Paystack subaccount for automated settlement. Do not
calculate historical balances from the listing's current price.

## 6. API contracts

Public, answer-safe reads:

- `GET /marketplace/mocks`
- `GET /marketplace/mocks/:slug`
- `GET /marketplace/mocks/:slug/preview`

Student actions:

- `POST /marketplace/mocks/:listingId/claim`
- `POST /marketplace/mocks/:listingId/checkout`
- `GET /marketplace/orders/:reference`
- `GET /students/me/marketplace-mocks`

Creator actions:

- listing create/update/submit/withdraw endpoints beneath
  `/marketplace/creator/listings`
- creator overview and order summaries

Operations actions:

- suspend, restore, and support-lookup endpoints with audit events

The existing student mock preflight and attempt endpoints should accept either a
centre enrolment or a marketplace entitlement through one central access resolver.
Do not scatter marketplace exceptions across every route.

## 7. Payment and entitlement flow

1. The API reads the authoritative listing/version and price.
2. It creates an idempotent pending order before contacting Paystack.
3. Paystack receives the server-calculated total—mock price plus the student-paid
   processing charge—and an unguessable reference.
4. A verified Paystack success webhook confirms reference, amount, currency, and
   metadata.
5. One database transaction marks the order paid, records the financial split, and
   grants the entitlement.
6. Duplicate webhook delivery returns success without creating another entitlement.
7. The checkout callback only displays status; it never grants access itself.

Free claims use the same entitlement service without creating a fake successful
payment.

## 8. Safety and quality gates

- Never expose correct answers, explanations, rubrics, private media keys, or full
  question payloads in catalogue or preview endpoints.
- Scan and verify all marketplace media through the existing Cloudflare R2 boundary.
- Require accessible descriptions for meaningful question images.
- Render equations and chemistry with the same tested content renderer used by the
  CBT runner.
- Freeze price, version, settings, and attempt allowance in the order/entitlement.
- Rate-limit claims, checkout creation, reporting, and preview reads.
- Add creator confirmation that they own or may publish the content.
- Provide takedown and dispute procedures before accepting paid public listings.
- Keep cross-centre marketplace reads explicit; do not weaken ordinary
  `school_id` tenancy queries.

## 9. Delivery sequence

### M1 — Product contract and free pilot

- Finalise listing language, creator eligibility, moderation states, and preview
  rules.
- Add listing, entitlement, report, and audit schema.
- Implement central mock-access resolution.
- Build creator listing controls and a responsive public catalogue/listing page.
- Allow idempotent free claims and run the complete CBT flow.

### M2 — Paid access

- Add immutable orders and ledger entries.
- Extend the existing Paystack service and verified webhook processing.
- Grant entitlements transactionally and add checkout recovery/status UX.
- Add creator sales summaries without promising available payout balances.

### M3 — Controlled launch

- Add operations review tools, support lookup, suspension, and disputes.
- Seed a small verified supply from selected centres.
- Run accessibility, mobile, low-bandwidth, payment replay, cross-tenant, and
  answer-leakage testing.
- Measure listing-to-claim, claim-to-start, completion, repeat purchase, report,
  and refund/support rates.

### M4 — Evidence-led expansion

Only after the pilot demonstrates demand should Kanvise decide the commission rate,
ratings, bundles, public question-bank licensing, and recommendation systems.

## 10. Pilot decisions

1. Display both the tutorial centre and the tutor who authored the mock. For a solo
   tutor, the centre name may be their teaching brand.
2. A tutor working under a centre requires centre-admin approval. A solo tutor
   performs that approval for their own teaching brand. Kanvise does not perform a
   routine pre-publication review.
3. The creator explicitly sets attempts included. The listing and preflight show
   that allowance before the student acquires or starts the mock.
4. Availability is creator-configured: a listing is public only from
   `available_from` until `closes_at`. An expired listing is not discoverable or
   acquirable, and a student cannot start a new attempt after its closing time.
   An attempt already in progress may finish.
5. The student pays the Paystack processing charge, shown as a separate checkout
   line item. Kanvise's marketplace percentage remains server-side configuration
   until a commercial decision is made.
6. Paid listings require the centre's verified Paystack subaccount. Settlement is
   automated through that destination; free listings do not require one.
7. Which examination categories are allowed at launch, and who verifies claims such
   as “JAMB standard” or “WAEC standard”?

These decisions should become explicit configuration and policy records, not
hard-coded frontend text.

## 11. Current-state gap analysis

The CBT engine is reusable, but the current student boundary assumes that every
student belongs to a centre:

- `tenantMiddleware` rejects most requests when `user.school_id` is null;
- the student dashboard API returns an error when no school exists;
- the student layout expects a school name and always renders centre-only links;
- student mock discovery checks course enrolment and the mock's school;
- attempt RPCs receive a school ID and do not understand marketplace entitlements;
- registration copy and redirects assume a student arrived through a school portal.

The profile model already permits a student with `school_id = null`. That is the
correct identity for a marketplace-only learner. The implementation must make the
student experience capability-aware without turning marketplace access into a
general exception to centre tenancy.

The two access paths must remain distinct:

| Access source | What grants access | Centre membership required | Content ownership |
| --- | --- | --- | --- |
| Centre learning | Active course/programme enrolment | Yes | Creator centre |
| Marketplace | Active entitlement to a frozen mock version | No | Creator centre |

A marketplace entitlement is not a course enrolment, centre membership, or right
to access the creator's classes, assignments, materials, question bank, or other
mocks.

## 12. Target identity and dashboard experience

Kanvise should keep one student account and one student dashboard. Do not create a
separate marketplace dashboard or authentication system.

### Anonymous visitor

- Can browse `/mocks`, filter listings, open `/mocks/[slug]`, and view an
  answer-safe preview.
- Is asked to sign in only when claiming, buying, or starting a mock.
- Returns to the intended listing after authentication.

### Marketplace-only student

- Has a normal `user_profiles` student record with `school_id = null`.
- Sees Home, Explore mocks, My mocks, Results/Progress, Purchases, and Settings.
- Home is a personal resume screen—not a second catalogue. It shows an
  in-progress attempt, recently acquired mocks, recent results, purchase/receipt
  status, and a clear **Explore mocks** action. A new student with no activity
  sees an onboarding explanation and that action.
- Does not see empty Classes, Assignments, or Materials navigation.
- Sees a plain explanation that course learning becomes available when they join a
  Kanvise-powered tutorial centre.

### Centre-enrolled student

- Keeps Classes, Assignments, Materials, course progress, and centre information.
- Also sees Explore mocks, My mocks, purchases, and marketplace results.
- Sees centre mocks and marketplace mocks in one list with a small source label,
  not in two competing dashboards.

### Student who later joins a centre

The same Supabase user is retained. Their first supported centre membership may
populate `user_profiles.school_id`; existing marketplace entitlements, attempts,
orders, and results remain attached to `student_id` and are not moved or copied.
The current product still supports one centre membership per student. Supporting
simultaneous membership in multiple centres requires a separate membership model
and is outside this marketplace release.

### Adaptive dashboard contract

Replace the mandatory `school` response with a capability-aware context:

```ts
type StudentContext = {
  student: { id: string; name: string };
  centre: { id: string; name: string } | null;
  capabilities: {
    hasCentreLearning: boolean;
    hasMarketplaceAccess: boolean;
  };
  overview: {
    centreCourses: number;
    availableMocks: number;
    attemptsInProgress: number;
    completedMocks: number;
  };
};
```

Navigation must be derived from these capabilities on the server. A hidden link is
not authorization: every API endpoint still enforces its own access rule.

## 13. Central mock-access boundary

Add one domain service used by preflight, attempt start, autosave, submit, timeout,
result, and review:

```ts
type StudentMockGrant = {
  source: "centre_enrolment" | "marketplace_entitlement";
  studentId: string;
  ownerSchoolId: string;
  mockId: string;
  mockVersionId: string;
  listingId?: string;
  entitlementId?: string;
  attemptsGranted?: number;
  attemptsConsumed?: number;
};
```

`resolveStudentMockAccess(studentId, mockId, versionId?)` should:

1. Load the published mock/version without trusting a client-supplied school ID.
2. Check centre access using the existing course-enrolment rules.
3. If that fails, check an active entitlement owned by the student for the exact
   frozen version.
4. Return the creator's `ownerSchoolId` for storage and audit, while retaining the
   real student ID as the attempt owner.
5. Return one generic not-found/forbidden response when neither grant exists.

Do not relax `tenantMiddleware` globally. Public marketplace routes and explicitly
centreless student routes should use authentication middleware plus their dedicated
authorization service. All ordinary centre routes continue to require `school_id`.

`mock_attempts` should gain nullable `marketplace_entitlement_id` and a required
`access_source`. Attempt creation must be a database transaction/RPC which:

- locks the relevant entitlement;
- verifies that it is active and the version matches;
- counts or consumes the allowance atomically;
- creates at most one active attempt for one idempotency key;
- never increments usage twice on a retried request.

Autosave, submission, result, and review authorize by attempt ownership and its
stored access source. They must not depend on the student's current centre. This
allows a student to retain legitimate results if they later leave or join a centre.

## 14. Detailed database plan

All marketplace tables use UUID primary keys, UTC timestamps, integer kobo, explicit
checks, foreign keys, and indexed lookup columns. Enable RLS but keep direct
`anon`/`authenticated` table and RPC privileges revoked because application data
continues through the Hono API and its trusted service boundary.

### Listings

`mock_marketplace_listings`:

- `creator_school_id`, `creator_user_id`, `source_mock_id`, `mock_version_id`;
- unique `slug`;
- searchable title, short description, examination, subjects, tags, difficulty;
- immutable listing snapshot: duration, question count, marks, calculator mode,
  result-release rule, attempts included, version title;
- `pricing_type`, `price_kobo`, `currency`;
- `approval_status`: `draft | submitted | approved | rejected`;
- `publication_status`: `unlisted | listed | withdrawn | suspended`;
- optional `available_from` and `closes_at` timestamps;
- preview question IDs selected from the frozen version;
- content-rights confirmation and timestamps for submission, approval, listing,
  suspension, withdrawal, and availability changes.

Checks enforce NGN for the pilot, zero price for free listings, positive price for
paid listings, at least one attempt, and a published immutable version. The API
must never derive purchasable facts from editable source mock rows after listing.
A listing is publicly discoverable and acquirable only when it is approved,
publication status is `listed`, `available_from` has passed, and `closes_at` has
not passed. This condition is enforced by every public read, claim, checkout, and
new-attempt path; it must not depend solely on a scheduled background job.

### Entitlements

`mock_marketplace_entitlements`:

- `student_id`, `listing_id`, `mock_version_id`;
- `source`: `free_claim | purchase | support_grant`;
- nullable `order_id`;
- attempts granted and consumed;
- granted and optional expiry timestamps;
- revoked timestamp, actor, and reason.

Use a partial unique index to prevent duplicate active entitlements for the same
student and frozen version. A withdrawn or expired listing blocks new
claims/purchases and new attempts, but does not remove completed results or an
attempt already in progress. Only refund, fraud, copyright/safety action, or an
explicit entitlement expiry may revoke access, and revocation must be audited.

### Orders and ledger

`mock_marketplace_orders` stores student, listing, version, creator centre,
Paystack reference, idempotency key, immutable amount/currency/split, and
`pending | paid | failed | expired | refunded` status.

`mock_marketplace_ledger_entries` records the mock price, student-paid Paystack
processing charge, total charged, Kanvise portion, creator-centre portion,
transaction type, order, and effective timestamp. Settlement uses the verified
Paystack subaccount already held by the creator centre; it must not recompute
historical balances from current prices.

### Governance

Add:

- `mock_marketplace_reports` for student/public reports;
- `mock_marketplace_moderation_events` for immutable staff actions;
- `mock_marketplace_creator_events` for tutor submission and centre-admin approval.

Do not create a second marketplace-student profile table.

### Migration order

1. Create enum/check domains and marketplace tables.
2. Add indexes, constraints, and updated-at triggers.
3. Add attempt access-source columns and backfill existing attempts as
   `centre_enrolment`.
4. Add transactional free-claim and marketplace-attempt functions.
5. Add payment-confirmation/entitlement function.
6. Enable RLS, revoke public/client privileges, and grant only the service role.
7. Run database lint/advisors and verify rollback against a staging clone.

Never edit an already-applied migration. Each correction gets a new migration.

## 15. API and page contracts

### Public discovery

- `GET /marketplace/mocks` — paginated, indexed filters; listed records only.
- `GET /marketplace/mocks/:slug` — listing snapshot, creator identity, availability,
  price, attempts, and safe metadata.
- `GET /marketplace/mocks/:slug/preview` — creator-selected stems/media only; never
  answers, scoring keys, explanations, hidden question metadata, or private R2 keys.
- `POST /marketplace/mocks/:id/reports` — rate-limited report submission.

Pages:

- `/mocks`
- `/mocks/[slug]`

### Student acquisition and library

- `POST /marketplace/mocks/:id/claim` — idempotent free claim.
- `POST /marketplace/mocks/:id/checkout` — server-priced paid order.
- `GET /marketplace/orders/:reference` — owner-only payment status.
- `GET /students/me/marketplace-mocks` — owned entitlements and attempt state.
- `GET /students/me/purchases` — paid order history, not creator accounting.
- `GET /students/me/context` — centre-nullable dashboard capabilities.

Pages:

- `/dashboard/student/mocks` — combined centre and marketplace library.
- `/dashboard/student/mocks/explore` or a clear link back to public `/mocks`.
- `/dashboard/student/purchases`.
- Existing preflight, attempt, and result pages, backed by the new resolver.

### Creator and centre approval

- create/update draft listing;
- validate snapshot and preview;
- submit for centre approval;
- approve/reject with a reason;
- publish immediately after centre-admin approval, subject only to configured
  availability dates;
- withdraw from new acquisition;
- view aggregate claims, purchases, starts, completions, and gross sales.

Tutors may only manage their own/assigned mocks. Centre admins manage centre-owned
listings. A solo tutor satisfies both roles. No creator endpoint exposes student
answers beyond the existing legitimate grading/result permissions.

### Kanvise operations

Operations endpoints require a separate trusted internal role and record every
state change. They can suspend, restore, and inspect transaction history after a
report or incident, but cannot silently alter questions, answers, prices, attempts,
or financial rows. They are not a pre-publication approval gate.

## 15.1 Creator authoring and distribution contract

The existing mock builder was designed for centre learning and currently requires a
course. That must change before marketplace creation begins. A mock is a reusable
assessment; a course is only one possible way to distribute it.

### Audience-first builder flow

After the creator builds and reviews questions, they choose one or both audiences:

| Audience | Course required | Access rule |
| --- | --- | --- |
| Centre students | Yes | Active course/programme enrolment |
| Public marketplace | No | Free-claim or paid marketplace entitlement |
| Both | Required only for the centre audience | Each student is checked against the relevant access rule |

The builder flow becomes:

`Build mock → add/reuse/import questions → review → choose audience → enter listing details when public → submit/publish`

The database must make `mock_exams.course_id` nullable and add a constraint that a
centre-student distribution always includes a course. Existing course mocks remain
valid and retain their enrolment rule. Marketplace-only mocks are organised by
exam/category, subject(s), topic coverage, and difficulty instead of being forced
into an unrelated course.

### Public-listing fields

Selecting public marketplace access reveals, before submission:

- examination/category, subject(s), topic coverage, difficulty, and instructions;
- public title, short description, cover image, and creator display name;
- free or paid choice; price is shown only for paid listings;
- attempts included, duration, calculator mode, availability and result-release
  settings;
- creator-selected safe preview questions;
- a rights-to-publish confirmation.

The creator may save this as a draft. Once it is live, its questions and settings
are immutable. A genuine correction requires withdrawing new acquisition, copying
to a new draft, correcting it, and obtaining centre-admin approval for the new
published version. Existing attempts and results remain tied to their original
version.

### Creator permissions in this flow

- A centre admin can create, approve, price, publish, withdraw, and manage payout
  details for centre-owned listings.
- A tutor can create drafts and propose listing metadata/price for their assigned
  content, then submit it to the centre admin. They cannot independently change a
  centre payout destination or publish a public listing.
- A verified solo tutor follows the same creation flow but fulfils the centre-admin
  approval step for their own teaching brand.

Question-bank access must not require a course for marketplace-only content.
Course-assignment checks still apply when a tutor is making a centre-student mock;
marketplace authoring instead checks verified creator ownership and centre policy.

### Creator workspace changes

The mock list should clearly separate:

- drafts;
- centre-only published mocks;
- marketplace drafts awaiting centre approval;
- listed public mocks;
- suspended or withdrawn listings.

For listed mocks, show useful creator measures: claims/purchases, starts,
completions, reports, gross sales, and settlement status. Do not surface student
answers or promise a tutor-level withdrawal balance: settlement belongs to the
creator centre's configured payout destination.

### Course-optional compatibility contract

Making `mock_exams.course_id` nullable is deliberately limited to mocks. It does
not make classes, notes, assignments, enrolments, or tutor-course assignments
course-optional.

| Existing dependency | Required marketplace change |
| --- | --- |
| `mock_exams.course_id` is `NOT NULL ... ON DELETE CASCADE` | Make it nullable and replace the course foreign key with `ON DELETE SET NULL`; a course deletion must not delete a purchased marketplace mock or its results. |
| Draft create/update validates a course and tutor-course assignment | Require a course only when `distribution_mode` includes `centre`; public-only drafts authorise by creator ownership and centre membership. |
| Tutor mock lists, counts, assembly, archive, and publish use course-assignment checks | Introduce one `canManageMock` rule: centre admins manage their centre's mocks; tutors manage their own marketplace drafts/listings and their assigned course mocks. |
| Student mock discovery and preflight use course enrolment | Keep that check for centre distribution; route marketplace access through the entitlement resolver. |
| Builder sends a course and puts it on the default section | Permit no course for public-only mocks; keep section/question course metadata optional. |
| Publication snapshots include the course | Preserve nullable course metadata in the frozen version; marketplace classification comes from listing fields, not a fake course. |
| Scheduled mock notification job derives recipients from course enrolments | Exclude marketplace-only mocks from course notifications. Marketplace acquisition and receipt notifications target the entitlement/order owner instead. |
| Student progress groups results by course | Show marketplace results in overall progress and My mocks without attempting to place them under a centre course. |

Add `distribution_mode` to `mock_exams` with `centre | marketplace | both`. Enforce
these database invariants:

- `centre` and `both` require `course_id`;
- `marketplace` permits `course_id` to be null;
- every mock retains a non-null owner `school_id` and creator `tutor_id`;
- existing mocks backfill as `centre` before the constraint is enabled.

The migration must update the course foreign key, the builder contract, and the
authorization resolver together. Making only the column nullable would either block
legitimate tutor actions or expose a public mock through a course-based path.

## 16. Authentication and acquisition journeys

### Free claim

1. Visitor opens a public listing and selects **Get this mock free**.
2. If anonymous, Kanvise stores an allowlisted claim intent and sends them to
   registration/sign-in.
3. Registration creates a `student` profile; `school_id` may remain null.
4. Email verification returns to the claim continuation, not a hard-coded school
   dashboard.
5. The API revalidates that the listing is free, approved, and within its
   availability window, then creates the entitlement idempotently.
6. The student lands in My mocks with **Start mock** available.

Never trust an arbitrary `returnTo` URL. Store a signed intent or validate a strict
set of relative routes.

### Paid purchase

1. Require a signed-in student before checkout so the order has a stable owner.
2. Re-read price/version from the listing and create an idempotent pending order.
3. Initialize Paystack with the server-calculated total—mock price plus the
   student-paid processing charge—and an opaque reference.
4. Verify the webhook signature, amount, currency, reference, listing/version, and
   student metadata.
5. In one transaction mark paid, write ledger entries, and grant entitlement.
6. The browser callback polls order status; it cannot grant access.
7. Replayed webhooks and browser retries return the existing result.

Free claims do not create fake payment orders.

## 17. Moderation without blocking the marketplace

Kanvise enforcement exists for copyright, answer correctness complaints, scams,
abusive media, and paid-content disputes—not to make Kanvise rewrite tutors' work
or delay ordinary publication. Only verified centres and solo tutors can list; a
centre tutor first needs centre-admin approval. Kanvise staff never edit the mock
and intervene only after a report or incident, by suspending acquisition with an
audited reason. Existing buyers retain completed results and any already-in-progress
attempt when a creator voluntarily withdraws a listing.

## 18. Delivery workstreams and acceptance gates

### Phase 0 — Contract, flags, and instrumentation

- Confirm naming, states, entitlement rules, creator approval, launch categories,
  and support/refund language.
- Add configuration for discovery, free claims, paid checkout, creator publishing,
  attempt defaults, and allowed categories.
- Define events: listing viewed, claim started/completed, checkout started/paid,
  mock started/completed, report opened/submitted.
- Ensure events contain IDs and outcome codes, not question answers or sensitive
  payment data.

**Gate:** product contract and threat model approved; no unresolved schema meaning.

### Phase 1 — Centreless student foundation

- Make student registration intent explicit and resume safe return journeys.
- Add the centre-nullable student context API.
- Make the student layout and home capability-aware.
- Add marketplace-only empty states and navigation.
- Preserve the existing centre student experience.

**Gate:** a centreless student can sign in and use their dashboard without a 400,
500, fake school, or access to centre-only data.

### Phase 2 — Marketplace persistence and access resolver

- Apply reviewed migrations in the documented order.
- Implement repositories and the central access resolver.
- Extend attempt creation and ownership checks.
- Backfill and regression-test centre attempts.

**Gate:** existing centre mocks still work; an entitlement grants only its exact
version; cross-tenant and cross-student attempts fail.

### Phase 3 — Public listing and free claim vertical slice

- Build creator draft, preview selection, approval, and listing controls.
- Build responsive `/mocks` and listing-detail pages.
- Implement safe preview serialization and media access.
- Implement idempotent free claim and the combined My mocks library.
- Complete preflight → attempt → autosave → timeout/submit → result.

**Gate:** an anonymous visitor can discover a free mock, create a centreless
account, claim it once, complete it, and see the result without course enrolment.

### Phase 4 — Paid acquisition

- Extend the existing Paystack integration with marketplace orders.
- Add transactional webhook confirmation, ledger, recovery, purchases, and support
  lookup.
- Add clear pending/failed/expired states; do not show provider jargon to students.

**Gate:** successful verified payment grants once; callback spoofing, amount
mismatch, webhook replay, and concurrent checkout cannot grant incorrectly.

### Phase 5 — Operations and controlled launch

- Add reporting, suspension, creator history, and audit views.
- Seed representative free and paid mocks from pilot creators.
- Run mobile, keyboard, screen-reader, low-bandwidth, and slow-webhook tests.
- Document support, withdrawal, refund, and incident procedures.

**Gate:** support can trace a listing, order, entitlement, and attempt without
database surgery; disabling acquisition does not erase owned access or results.

## 19. Verification matrix

Automated coverage must include:

- anonymous browse versus authenticated acquisition;
- centreless student, centre student, tutor, centre admin, solo tutor, and operations
  role matrices;
- tutor ownership and centre-admin approval;
- free-claim idempotency and concurrent claims;
- entitlement attempt exhaustion and concurrent starts;
- exact-version enforcement after a creator publishes a revision;
- scheduled availability, listing withdrawal, suspension, entitlement revocation,
  and refund states;
- Paystack signature, amount/currency mismatch, replay, late webhook, and callback
  spoofing;
- cross-school, cross-student, object-ID guessing, and answer-leakage tests;
- safe auth redirects and claim-intent resumption;
- media authorization, broken images, equations, chemistry, calculator modes,
  timeout, refresh recovery, autosave, and offline/reconnect behaviour;
- centreless, centre-only, and mixed dashboard rendering;
- migration constraints, function privileges, and Supabase security/performance
  advisors.

Required test layers:

1. Pure domain tests for listing states, prices, access grants, and attempt limits.
2. Database/RPC integration tests for transactions, locks, constraints, and replay.
3. API tests with real schema-shaped fixtures—not mocks that omit production
   columns.
4. Component tests for capability-aware navigation and acquisition states.
5. Browser E2E for the complete free flow and paid webhook flow.

## 20. Recommended pilot defaults

Unless product/legal decisions replace them:

- the creator sets attempts included; this is shown before acquisition and before
  starting;
- a listing is public and acquirable only during its configured availability
  window; closing it prevents a new attempt from starting, while an in-progress
  attempt may finish;
- withdrawing a listing stops new acquisition but preserves completed results;
- use “JAMB practice”, “WAEC practice”, and “NECO practice”; never imply official
  endorsement;
- refund requests before an attempt starts are support-reviewable; after starting,
  technical-failure exceptions are reviewed rather than promised automatically;
- platform fee and payout schedule are configuration/finance decisions and must not
  be hard-coded;
- marketplace settlement uses the existing verified Paystack centre subaccount;
  show the student-paid processing charge before checkout and retain an accurate
  immutable ledger.

## 21. Rollout and rollback

Use independent server-side feature flags:

- marketplace discovery;
- creator publishing;
- free claims;
- paid checkout.

Launch on staging with seeded creators, then a small production allowlist. Rollback
should disable new discovery/acquisition while leaving authentication, owned mocks,
attempts, results, orders, and support lookup available. Never roll back by deleting
financial or entitlement history.

## 22. Definition of done

The marketplace pilot is complete only when:

- public discovery works without an account and reveals no protected answers;
- free claim and paid purchase work without course/programme enrolment;
- marketplace-only learners use the existing adaptive student dashboard;
- centre students retain every existing learning flow;
- creator, centre-admin, student, and operations permissions are enforced by APIs;
- attempt allowances and payments are atomic and replay-safe;
- all media, calculator, equation, chemistry, timing, autosave, grading, and result
  cases use the production CBT engine;
- security, integration, component, and E2E suites pass against a production-shaped
  schema;
- support, moderation, withdrawal, refund, and rollback procedures are documented;
- staging verification is signed off before enabling production acquisition.
