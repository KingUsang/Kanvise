# Email and notification deployment checklist

**Status:** Current (checklist)
**Owner:** Kanvise engineering
**Last verified:** 2026-11-26 against the repository. Items that depend on hosted accounts are marked **unverified**.

Use this checklist separately for staging and production. Never share Supabase, email provider, Paystack or database credentials between environments. Variable details are in [email setup](email-setup.md).

## 1. Database

- Apply all repository migrations to the environment's Supabase project before deploying API code (`deploy.yml` reconciles migrations on `main` deploys).
- Confirm `email_deliveries` exists and has RLS enabled.
- Confirm `confirm_student_payment(text, text, bigint)` is executable only by `service_role`.
- Confirm notification RLS lets authenticated users read their own rows and update only `is_read`.
- Confirm `held_messages`, `notification_preferences` and `unsubscribe_tokens` have RLS enabled and no `anon` or `authenticated` grants.
- Run the Supabase security and performance advisors.

## 2. Supabase Auth URLs

Configure these in Authentication → URL Configuration.

| Environment | Site URL | Redirect URLs | Vercel `NEXT_PUBLIC_SITE_URL` |
|---|---|---|---|
| Staging | `https://staging.kanvise.com` | `https://staging.kanvise.com/api/auth/callback`, `https://staging.kanvise.com/auth/reset-password` | `https://staging.kanvise.com` |
| Production | `https://kanvise.com` | `https://kanvise.com/api/auth/callback`, `https://kanvise.com/auth/reset-password` | `https://kanvise.com` |

Keep `http://localhost:3000/**` only in a development project. Add an explicit, account-scoped Vercel preview pattern only when preview authentication is required.

Also enable the Send Email hook described in [email setup](email-setup.md#supabase-auth-email) and set `SEND_EMAIL_HOOK_SECRET` on the API.

### Runbook: reset email links to localhost

Symptom: password reset or confirmation emails link to `http://localhost:3000/...` although the app passes a correct `redirectTo`.

Cause: Supabase ignores a `redirectTo` that is not on the Redirect URLs allowlist and falls back to the project Site URL. The application code (`web/src/app/auth/forgot-password/page.tsx`, `web/src/config/app.ts`) is not the problem.

Fix, in the Supabase Dashboard for the affected environment:

1. Open the project → **Authentication** → **URL Configuration**.
2. Set **Site URL** to the environment URL from the table above.
3. Add both redirect URLs from the table.
4. Save. This applies to new emails immediately; no redeploy is needed.
5. If the Send Email hook is **not** enabled, check **Authentication → Email Templates → Reset Password** and make sure the link uses `{{ .ConfirmationURL }}` and not `{{ .SiteURL }}/...`. With the hook enabled the API renders the email and the dashboard template is unused.
6. Confirm the frontend deployment sets `NEXT_PUBLIC_SITE_URL` for that environment.
7. Request a fresh reset email. Links sent earlier keep the old target.

## 3. Email provider

- Verify the sending domain per environment and publish the provider's SPF and DKIM records in Cloudflare DNS.
- Use separate restricted API keys for staging and production.
- Set the provider variables, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `FRONTEND_URL`, `SEND_EMAIL_HOOK_SECRET`, `API_PUBLIC_URL` (for one-click unsubscribe) and optional `EMAIL_LOGO_URL` on the API process.
- Confirm the logo URL is publicly reachable without authentication.

## 4. Staging delivery checks

```bash
cd api
npm run email:smoke
EMAIL_SMOKE_SEND=true EMAIL_SMOKE_TO=qa-gmail@example.com npm run email:smoke
EMAIL_SMOKE_SEND=true EMAIL_SMOKE_TO=qa-yahoo@example.com npm run email:smoke
```

Verify receipt, spam placement, sender and reply-to, logo, mobile layout, plain-text fallback, every link, the footer (reason line or Unsubscribe link) and the List-Unsubscribe header in the raw message. Real sending is blocked when `NODE_ENV=production`. No record of a completed Gmail and Yahoo run exists in the repository (DEV-TRK-010-01).

## 5. Monitoring

- `GET /health` on the API is a liveness endpoint with no database or provider dependency (`api/src/routes/health.ts`). Health URLs are in [Oracle API deployment](oracle-api-deployment.md).
- Search API logs (systemd journal on the Oracle VM) for `email.delivery_failed`, `notification.delivery_partial_failure`, `job.execution_failed` and `job.*.item_failed`.
- Sentry is wired through `SENTRY_DSN`, `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` (`api/.env.example`).
- An external uptime monitor and Slack alerting are **unverified**; no configuration exists in the repository (DEV-TRK-010-02, DEV-REL-009).
- Review failed `email_deliveries` rows and Supabase advisors after each deployment.

## 6. Scheduler

- Run scheduled jobs on exactly one API process.
- Set `SCHEDULED_JOBS_ENABLED=false` on any additional web-only API process.
- Check the graceful-shutdown log lines before and after a service restart.
