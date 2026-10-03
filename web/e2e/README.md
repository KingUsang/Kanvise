# Browser journeys

These Playwright specs call the running Kanvise application and Hono API. They
do not mock browser fetches, API responses, Supabase application data, or UI
state.

## Independent tutor journey

Use a disposable **independent tutor** account on localhost or staging. The
journey creates a free draft class, schedules a dated teaching session, opens
the class-bound quiz builder, and publishes a class-bound assignment. If a
controlled student mailbox is supplied, it also performs the actual learner
invite flow and verifies that a one-student class shows student evidence rather
than cohort aggregates. Never point this suite at production.

```bash
E2E_BASE_URL=https://staging.kanvise.com \
E2E_INDEPENDENT_TUTOR_EMAIL='...' \
E2E_INDEPENDENT_TUTOR_PASSWORD='...' \
E2E_INDEPENDENT_STUDENT_EMAIL='...' \
npx playwright test --config=web/playwright.config.ts \
  web/e2e/independent-tutor-journey.spec.ts --project=desktop
```

The student email is optional; without it the invite and one-student evidence
assertions are skipped while the class, scheduling, quiz and assignment
journeys still run.

## Live tutor-to-student round trip

This test starts a real enrolled Physics class, makes an enrolled student see
and join it through the student Classes screen, and checks the resulting
attendance signal before ending the room. It deliberately has no mocked API
responses and must only run on localhost or staging.

```bash
E2E_BASE_URL=https://staging.kanvise.com \
E2E_LIVE_TUTOR_EMAIL='tutor@demo.com' \
E2E_LIVE_TUTOR_PASSWORD='Password123!' \
E2E_LIVE_STUDENT_EMAIL='emeka@demo.com' \
E2E_LIVE_STUDENT_PASSWORD='Password123!' \
npx playwright test --config=web/playwright.config.ts \
  web/e2e/live-class-student-roundtrip.spec.ts --project=desktop
```
