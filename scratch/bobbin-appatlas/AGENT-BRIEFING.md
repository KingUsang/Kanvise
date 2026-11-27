# Bobbin AppAtlas browser brief

## Environment

- Product: Bobbin administrator web app.
- Browser: one Playwright Chromium context, using a session state held outside the repository.
- Crawl discipline: one route/section at a time; never open a second browser lane.

## Hard limits

- The owner authorized inspection of billing/checkout up to, but never including, payment-card entry or a plan purchase.
- The owner authorized a minimal synthetic data set and invitations only to their controlled mailbox aliases; document each sent invitation.
- Do not connect OAuth, start/join a live lesson, create a recording, or consume quota.
- Capture every create wizard step. Submit only the approved synthetic records.

## Capture workflow

1. Navigate and wait for hydration.
2. Save a full-page screenshot into the section's `screenshots/` directory.
3. Record visible text and interactive controls.
4. Exercise only reversible controls and restore the initial state.
5. Write a section `spec.md` and `screens.json` record for each screenshot.
