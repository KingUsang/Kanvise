# Kanvise Mock Marketplace Delivery Plan

**Status:** Proposed after the centre CBT engine  
**Foundation:** `15_MOCK_ENGINE_AND_QUESTION_BANK_IMPLEMENTATION_PLAN.md`  
**Initial product shape:** One Kanvise application and API; no separate subdomain or
second authentication system

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
   admins/tutors.
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
- automated creator payouts, revenue sharing, tax handling, and refunds;
- Kanvise-owned or community question-bank licensing;
- recommendation feeds and ranking personalisation;
- printable/exportable copies of paid mock content.

## 4. Roles and permissions

### Creator

- An admin may publish a centre-owned mock.
- A tutor may create and submit a mock they own or are assigned to. A tutor working
  under a centre needs centre-admin approval before it becomes a public listing.
- A verified solo tutor is both the centre admin and tutor, so they can approve
  their own listing before Kanvise review.
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
- They may review, approve, suspend, or remove a listing without deleting attempts
  or financial history.
- Cannot silently edit creator questions or answer keys.
- Has an auditable reason and actor for moderation changes.

## 5. Data model

All identifiers remain UUIDs and all money is stored as integer kobo.

### `mock_marketplace_listings`

- creator school, creator user, source mock, published mock version
- unique slug, title, short description, cover image
- examination/category, subjects, tags, difficulty label
- question count, total marks, duration, calculator mode, attempts included
- `visibility`: `draft | review | listed | suspended | withdrawn`
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

The pilot must record the platform and creator portions at payment confirmation
even if creator payout is initially manual. Do not calculate historical balances
from the listing's current price.

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

- review, list, suspend, and restore endpoints with audit events

The existing student mock preflight and attempt endpoints should accept either a
centre enrolment or a marketplace entitlement through one central access resolver.
Do not scatter marketplace exceptions across every route.

## 7. Payment and entitlement flow

1. The API reads the authoritative listing/version and price.
2. It creates an idempotent pending order before contacting Paystack.
3. Paystack receives the server-calculated amount and an unguessable reference.
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

Only after the pilot demonstrates demand should Kanvise decide commission, automated
payouts, ratings, bundles, public question-bank licensing, and recommendation
systems.

## 10. Pilot decisions

1. Display both the tutorial centre and the tutor who authored the mock. For a solo
   tutor, the centre name may be their teaching brand.
2. A tutor working under a centre requires centre-admin approval before Kanvise
   moderation. A solo tutor performs that approval as their own centre admin.
3. What attempt allowance does a one-time purchase include by default?
4. Is a paid entitlement permanent for its frozen version, or can listings expire?
5. What refund conditions apply after a student has opened or submitted an attempt?
6. What platform fee and payout schedule will Kanvise use after the pilot?
7. Which examination categories are allowed at launch, and who verifies claims such
   as “JAMB standard” or “WAEC standard”?

These decisions should become explicit configuration and policy records, not
hard-coded frontend text.
