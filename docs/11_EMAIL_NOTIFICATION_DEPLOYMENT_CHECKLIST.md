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

### Production

- Site URL: `https://kanvise.com`
- Redirect URL: `https://kanvise.com/api/auth/callback`
- Redirect URL: `https://kanvise.com/auth/reset-password`

Keep `http://localhost:3000/**` only in the development project. Use an explicit,
account-scoped Vercel preview pattern only when preview authentication is required.
Ensure confirmation/reset templates use `RedirectTo` when application code supplies
`emailRedirectTo` or `redirectTo`.

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
