# Aiqaramba augmentation

Aiqaramba project: `01a21a79-f44d-7764-9333-e6a435ae1028`

Completed unauthenticated SPA discovery: `01a21a7a-99eb-7136-a47b-f6f5d5ff5bad`

Entry URL: `https://app.withbobbin.com/`

Result: 8 states and 8 edges; it exhausted its public surface in about 25 seconds.

Authenticated max-budget discovery: `01a21a7d-fc9a-7a1f-94e5-2b0421d15153`

Configuration: custom preset; 500 states, unlimited depth, API-enforced maximum 1,200-second duration, 10,000ms navigation/click settling, and duplicate threshold 1.

The owner explicitly authorized the test-account login. Aiqaramba documents that credentials supplied to a discovery are shared with its LLM during the login stage. Credentials are write-only and are not recorded in this file.

Use the discovery map endpoint after completion to compare the agent-discovered state graph against the local AppAtlas evidence.

## Completed run

The authenticated crawl completed at its time limit with 45 states, 49 transitions, and 114 attempted actions. It discovered the dashboard, calendar, clients, courses, lessons, recordings, report approvals, resources, safeguarding, unlinked sessions, students, tutors, team, lesson settings, and billing.

Aiqaramba produced 14 unaccepted reviewer suggestions: 12 candidate regression tests and two low-severity observations. Its strongest candidate flows are lesson scheduling with required-field validation, tutor/team invitations, student creation, resources, report approvals, course/curriculum review, safeguarding filters, settings persistence, billing/promo validation, and global search.

The crawl stopped at the service's maximum duration with 25 observed-but-unreached URLs. Those URLs, and crawler replay failures, remain coverage gaps; the local Playwright/AppAtlas capture is the source of truth for flows manually walked.
