# Kanvise Email and Notification Deployment Checklist

Use this checklist separately for staging and production. Never share Supabase,
Resend, Paystack, or database credentials between environments.

## 1. Database

- Apply every migration listed in `10_EMAIL_IMPLEMENTATION_PROGRESS.md`.
- Confirm `email_deliveries` exists and has RLS enabled.
- Confirm `confirm_student_payment(text, text, bigint)` is executable only by
  `service_role`.
- Confirm notification RLS allows authenticated users to read their own rows and
  update only `is_read`.
- Run Supabase security and performance advisors.

## 2. Supabase Auth URLs

Configure these in Authentication → URL Configuration.

### Staging

- Site URL: `https://staging.kanvise.com`
- Redirect URL: `https://staging.kanvise.com/api/auth/callback`
- Redirect URL: `https://staging.kanvise.com/auth/reset-password`
- Vercel environment: `NEXT_PUBLIC_SITE_URL=https://staging.kanvise.com`

### Production

- Site URL: `https://kanvise.com`
- Redirect URL: `https://kanvise.com/api/auth/callback`
- Redirect URL: `https://kanvise.com/auth/reset-password`
- Vercel environment: `NEXT_PUBLIC_SITE_URL=https://kanvise.com`

Keep `http://localhost:3000/**` only in the development project. Use an explicit,
account-scoped Vercel preview pattern only when preview authentication is required.
Ensure confirmation/reset templates use `RedirectTo` when application code supplies
`emailRedirectTo` or `redirectTo`.

If an email still points to localhost after the application environment is correct,
the hosted Auth project's Site URL or template is still using `{{ .SiteURL }}`.
Update the hosted project in the Supabase Dashboard; changing a local `.env` file
does not change Supabase's hosted email templates.

### Runbook: reset email links to localhost

Symptom: password reset (or confirmation) emails link to `http://localhost:3000/...`
even though the app passes a correct `redirectTo`.

Cause: Supabase silently ignores a `redirectTo` that is not on the Redirect URLs
allowlist and falls back to the project Site URL. The application code
(`web/src/app/auth/forgot-password/page.tsx`, `web/src/config/app.ts`) is not the
problem.

Fix, in the Supabase Dashboard for the affected environment's project:

1. Open the project → **Authentication** → **URL Configuration**.
2. Set **Site URL** to the environment URL from the table above (never localhost).
3. Under **Redirect URLs**, add both entries from the table above.
4. Save. Takes effect immediately for new emails — no redeploy required.
5. **Authentication** → **Email Templates** → *Reset Password*: the link must use
   `{{ .ConfirmationURL }}`, not `{{ .SiteURL }}/...`.
6. Confirm the frontend deployment sets `NEXT_PUBLIC_SITE_URL` for that environment.
7. Request a fresh reset email to verify — links sent before the change still point
   to localhost.

## 3. Resend

- Verify the sending domain separately for staging and production.
- Publish and verify Resend's SPF and DKIM records in Cloudflare DNS.
- Use separate restricted API keys for staging and production.
- Set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `FRONTEND_URL`, and optional
  `EMAIL_LOGO_URL` on the Hono process.
- Confirm the logo URL is publicly reachable without authentication.

## 4. Staging delivery checks

Render all templates without delivery:

```bash
cd api
npm run email:smoke
```

Then send all templates to controlled Gmail and Yahoo inboxes, one run at a time:

```bash
EMAIL_SMOKE_SEND=true EMAIL_SMOKE_TO=qa-gmail@example.com npm run email:smoke
EMAIL_SMOKE_SEND=true EMAIL_SMOKE_TO=qa-yahoo@example.com npm run email:smoke
```

Verify receipt, spam placement, sender/reply-to, logo, mobile layout, plain-text
fallback, and every link. Real smoke sending is blocked when `NODE_ENV=production`.

## 5. Monitoring

- Configure UptimeRobot to request `GET https://api.kanvise.com/health` every five
  minutes and alert after two consecutive failures.
- Capture PM2 logs containing `email.delivery_failed`,
  `notification.delivery_partial_failure`, `job.execution_failed`, and
  `job.*.item_failed`.
- Configure Sentry DSNs and Slack alerts when the infrastructure-wide Sentry setup
  is installed.
- Configure Scaleway CPU, RAM, and disk alerts from the infrastructure plan.
- Review failed `email_deliveries` records and Supabase advisors after deployment.

## 6. Scheduler

- Run scheduled jobs on exactly one MVP API process.
- Set `SCHEDULED_JOBS_ENABLED=false` on additional web-only API processes.
- Verify graceful shutdown logs before and after a PM2 restart.
