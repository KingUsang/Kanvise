# Kanvise PWA and Web Push deployment

## Release order

1. Apply `supabase/migrations/20260816090000_add_web_push_notifications.sql`.
2. Deploy the API with `WEB_PUSH_ENABLED=false` and the new `web-push` dependency installed.
3. Deploy the web application and verify `/manifest.webmanifest`, `/sw.js`, and every `/icons/*` manifest asset over HTTPS.
4. Generate a VAPID pair for the environment with `npm run push:vapid --workspace=api`.
5. Store the public/private keys and subject in the API process environment, then set `WEB_PUSH_ENABLED=true` and restart the API.
6. Sign in as a staging student, enable browser notifications in Settings, and trigger each supported event.

Use different VAPID pairs for staging and production. Never commit the private key or expose it through a `NEXT_PUBLIC_*` variable. Rotating a VAPID pair invalidates existing subscriptions, so users must enable notifications again after rotation.

## API environment

```dotenv
WEB_PUSH_ENABLED=true
WEB_PUSH_VAPID_PUBLIC_KEY=<environment public key>
WEB_PUSH_VAPID_PRIVATE_KEY=<environment private key>
WEB_PUSH_SUBJECT=mailto:notifications@kanvise.com
```

If the feature flag is false, existing email, Telegram, and in-app delivery continue while Web Push is skipped.

## Verification

Run the normal repository gates, then the request-based PWA check against the deployed origin:

```bash
npm test --workspace=api
npm test --workspace=web
npm run build --workspace=api
npm run build --workspace=web
E2E_BASE_URL=https://staging.kanvise.com npx playwright test --config=web/playwright.config.ts web/e2e/pwa.spec.ts --project=desktop
```

On a real Android, desktop, and installed iOS device, verify installation, explicit permission enablement, notification display, deep-link navigation, and subscription removal after logout. The service worker intentionally has no fetch handler, precache, or offline data behavior.
