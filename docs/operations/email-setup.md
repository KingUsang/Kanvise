# Email setup

**Status:** Current (setup guide)
**Owner:** Kanvise engineering
**Last verified:** 2026-11-28 against `api/src/emails/config.ts`, `api/src/emails/footer.ts`, `api/src/notifications/rows.ts`, `api/src/routes/supabase-email-hook.ts` and `api/src/scripts/email-smoke.ts`. Statements about hosted Supabase, Resend, Brevo or Mailjet accounts are marked **unverified** because they cannot be checked from the repository.

The Hono API sends platform email (invitations, welcome, payment, notifications) through a provider router. Supabase Auth email (sign-up verification, password reset) is also delivered by the API through a Supabase Send Email hook. For the deployment sequence see the [email and notification deployment checklist](email-notification-deployment-checklist.md).

## Providers

`api/src/emails/config.ts` supports three providers. At least one must be configured or delivery fails explicitly.

| Provider | Variables | Default daily limit variable |
|---|---|---|
| Resend | `RESEND_API_KEY` | `RESEND_DAILY_LIMIT` (100) |
| Brevo | `BREVO_API_KEY` | `BREVO_DAILY_LIMIT` (300) |
| Mailjet | `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` (both or neither) | `MAILJET_DAILY_LIMIT` (200) |

Other variables:

```env
EMAIL_FROM=Kanvise <noreply@kanvise.com>     # required
EMAIL_REPLY_TO=support@kanvise.com           # optional
FRONTEND_URL=https://kanvise.com             # required
EMAIL_PROVIDER_ORDER=resend,brevo,mailjet    # optional; unconfigured providers are skipped
EMAIL_PROVIDER_TIMEOUT_MS=3500               # optional, 500 to 10000
EMAIL_PROVIDER_USAGE_THRESHOLD_PERCENT=95    # optional; share of the daily limit before the router moves on
SEND_EMAIL_HOOK_SECRET=v1,whsec_...          # required for Supabase Auth email (see below)
```

`api/.env.example` lists only the Resend variables. Which providers hold live keys in staging and production is **unverified**.

Scheduled notification jobs start with the API unless `SCHEDULED_JOBS_ENABLED=false`. Set that only on a process that must serve HTTP without running schedulers (for example a second web-only instance). Run schedulers on exactly one API process.

## Footers, unsubscribe links and sender names

Every email has one footer (18 NTF-04). `api/src/notifications/rows.ts` classifies each template:

- **Essential** emails (invitations, welcome, payment receipt, cancelled lesson, account emails from Supabase Auth) say why they were sent, for example "You're getting this because Michael Chen teaches you on Kanvise." They have no unsubscribe link and no List-Unsubscribe header.
- **Switchable** emails (lesson reminders, homework and quiz emails, onboarding emails) end with "Don't want these emails? Unsubscribe". `renderEmail` refuses to render one without an unsubscribe link.

Each switchable email gets its own token. Only the token's sha-256 hash is stored, in `unsubscribe_tokens`. The link works for 90 days and, once used, for one more day.

| What | URL |
|---|---|
| Footer link (web page, no sign-in) | `${FRONTEND_URL}/unsubscribe?token=...` |
| `List-Unsubscribe` with `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) | `${API_PUBLIC_URL}/unsubscribe/one-click?token=...` |

Set `API_PUBLIC_URL` (for example `https://api.kanvise.com`) on the API so mail apps get one-click unsubscribe. Without it, `List-Unsubscribe` points at the web page and there is no `List-Unsubscribe-Post` header. The headers are passed to Resend (`headers`), Brevo (`headers`) and Mailjet (`Headers`).

The page itself calls `POST /unsubscribe/lookup`, `POST /unsubscribe` and `POST /unsubscribe/undo` with the token in the JSON body. Opening the link never unsubscribes anyone, because mail scanners open links. The public routes are rate limited per address in each API process.

Notification emails come from "{account name} via Kanvise" using the address in `EMAIL_FROM`. Times in them use the account's timezone with the zone named (`4:00 PM WAT`). Accounts have no timezone setting yet, so this is Africa/Lagos for everyone (`resolveAccountTimeZone` in `api/src/emails/format-email-time.ts`).

## Held messages

A message caused by an action with an Undo toast waits in `held_messages` until the undo window closes (18 NTF-03). The durable job `release_held_messages` runs at the end of the window, and again at once after Undo or when the toast closes early. It sends only the newest held message per subject. Step 1 has no event that is held; later steps register builders in `api/src/notifications/held-messages.ts`.

## Logo

`EMAIL_LOGO_URL` is optional. The default is `${FRONTEND_URL}/kanvise_logo_small_blue.png`, which works because the file is in `web/public`. Verify it in a private browser window after deploying the web app.

To move the logo to R2, upload it to the public bucket (see [Cloudflare R2 public setup](cloudflare-r2-public-setup.md)), confirm it is readable at a stable HTTPS URL, and set `EMAIL_LOGO_URL`. Never use a filesystem path, relative URL, authenticated URL or expiring presigned URL in an email.

## Supabase Auth email

`POST /webhooks/supabase/send-email` (`api/src/routes/webhooks.ts`) verifies the Standard Webhooks signature with `SEND_EMAIL_HOOK_SECRET` and renders the message with `api/src/emails/supabase-auth.tsx`. A missing secret returns 503; a bad signature returns 401. Several secrets can be set separated by `|` to rotate.

In each hosted Supabase project, enable **Authentication → Hooks → Send Email** and point it at `https://<api-host>/webhooks/supabase/send-email`. Whether that is enabled in staging and production is **unverified**.

`supabase/templates/confirm-signup.html` is an older dashboard template for the sign-up code email. It is not referenced by `supabase/config.toml` (which has no `[auth]` section) and is not used while the hook is enabled. It still hard-codes the staging logo host and old positioning copy (DEV-EML-011). `supabase/templates/invite.html` is the invitation equivalent.

## Smoke test

Render every template without sending:

```bash
cd api
npm run email:smoke
```

Send one copy of every template to a controlled staging inbox:

```bash
EMAIL_SMOKE_SEND=true EMAIL_SMOKE_TO=qa@example.com npm run email:smoke
```

Real sending is refused when `NODE_ENV=production`. Use a staging provider key and a dedicated recipient.

## Provider domain setup

1. Add `kanvise.com` in the provider's domain dashboard (for Resend: Domains).
2. Add the SPF and DKIM records the provider shows to the DNS zone in Cloudflare.
3. Wait for the provider to report the domain as verified.
4. Create separate API keys for staging and production.
5. Set the variables above on the API process. Production and staging API environment files live on the Oracle VM (see [Oracle API deployment](oracle-api-deployment.md)).

The application has no placeholder credentials. Missing configuration makes delivery fail explicitly, and the underlying tutor invitation stays available for manual sharing.
