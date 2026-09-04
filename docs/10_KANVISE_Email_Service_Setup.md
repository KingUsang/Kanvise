# Kanvise Email Service Setup

Kanvise sends platform email through Resend from the Hono API. Supabase Auth remains responsible for account-verification and password-reset email.

## Required API environment variables

```env
RESEND_API_KEY=re_...
EMAIL_FROM=Kanvise <noreply@kanvise.com>
EMAIL_REPLY_TO=support@kanvise.com
FRONTEND_URL=https://kanvise.com
```

Scheduled notification jobs start with the API by default. Set the following only
for a process that must serve HTTP without running schedulers (for example, a
second horizontally scaled web-only instance):

```env
SCHEDULED_JOBS_ENABLED=false
```

`EMAIL_LOGO_URL` is optional. By default, email templates use:

```text
https://kanvise.com/kanvise_logo_small_blue.png
```

That URL works because `kanvise_logo_small_blue.png` is stored in `web/public`; Next.js publishes files in that directory from the root of the deployed website. Verify the URL in a private browser window after deploying the web application.

To move the logo to Cloudflare R2 later:

1. Upload the PNG to the public branding prefix in the Kanvise R2 bucket.
2. Confirm it is publicly readable at a stable HTTPS URL such as `https://cdn.kanvise.com/public/branding/kanvise-logo.png`.
3. Set `EMAIL_LOGO_URL` to that URL on the Hono server.
4. Send a staging email and verify the logo in Gmail and Yahoo with remote images enabled.

Do not use a filesystem path, relative URL, authenticated URL, or expiring presigned URL in an email template.

## Staging smoke test

Render all nine templates without sending email:

```bash
cd api
npm run email:smoke
```

To deliver one copy of every template to a controlled staging inbox, configure
the normal staging email variables and run:

```bash
EMAIL_SMOKE_SEND=true EMAIL_SMOKE_TO=qa@example.com npm run email:smoke
```

Real smoke delivery is refused when `NODE_ENV=production`. Use a staging Resend
key and a dedicated test recipient.

## Resend domain setup

1. Add `kanvise.com` in the Resend Domains dashboard.
2. Add the provided SPF and DKIM records to the domain's DNS configuration.
3. Wait for Resend to report the domain as verified.
4. Create separate API keys for staging and production.
5. Configure the environment variables above on the Hono deployment.

The application intentionally has no placeholder email credentials. Missing required configuration causes delivery to fail explicitly while the underlying tutor invite remains available for manual sharing.
