# Bobbin AppAtlas

Local competitive-product research for Bobbin's administrator and tutor experiences.

## Scope and safeguards

- Authenticated, authorized administrator account; no credentials or session state live in this directory.
- One browser lane, crawled sequentially.
- The account owner explicitly authorized minimal synthetic records, invite delivery to controlled mailbox aliases, and inspection of the billing path.
- No payment-card details will be entered and no plan will be purchased.
- OAuth connections, destructive actions, and live-lesson starts remain out of scope.

## Live index

| Section | Route | Status | Evidence |
| --- | --- | --- | --- |
| Recon and setup | `/setup` | ✅ | `00-recon/` |
| Dashboard | `/` | ✅ | `01-dashboard/` |
| Calendar | `/calendar` | ✅ | `02-calendar/` |
| Lessons | `/lessons`, `/lessons/:id/*`, `/space` | ✅ | `03-lessons/` |
| Courses | `/courses`, `/courses/:id/*` | ✅ | `04-courses/` |
| Students | `/students`, `/students/:id` | ✅ | `05-students/` |
| Clients | `/clients`, `/clients/:id` | ✅ | `06-clients/` |
| Tutors | `/tutors`, `/tutors/:id` | ✅ | `07-tutors/` |
| Team | `/team` | ✅ | `08-team/` |
| Recordings | `/recordings` | ✅ | `09-recordings/` |
| Resources | `/resources` | ✅ | `10-resources/` |
| Review queue | `/report-approvals`, `/safeguarding`, `/sessions/unlinked` | ✅ | `11-*`–`13-*` |
| Tutor role | tutor workspace routes | ✅ | `15-tutor-role/` |
| Settings | `/settings/*`, billing | ✅ | `14-settings/` |

## Known gates

- The account remains on a free trial. Billing and Stripe Checkout were inspected, but no payment data was entered and no plan was purchased.
- Tutor classroom entry, media setup, joined live room, end flow, manual completion, real admin approval, client release, and tutor-visible Complete state are captured. The controlled session was intentionally short, so its final report has no AI insights; the sample lesson separately evidences populated AI output.
- Native/in-person recording creation belongs to the mobile-app lane; the web UI, mobile feature explanation, and empty/processing states are captured.
- Two-factor setup was stopped before generating a QR/shared secret.

## Post-crawl checklist

- [x] Complete detail/modal coverage for dashboard, calendar, team, recordings, resources, review queues, and settings tabs.
- [x] Verify synthetic records and invitations are captured and labeled as test data.
- [x] Run feature-level coverage audit.
- [x] Normalize screen records and generate the local HTML atlas.
- [x] Smoke-test `_artifact/atlas.html` in Chromium: 229 cards, 49 links, searchable tutor/admin records, detail sheet and flow surface visible, no browser errors.
