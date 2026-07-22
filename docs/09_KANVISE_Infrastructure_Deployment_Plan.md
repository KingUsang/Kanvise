# Kanvise — Infrastructure & Deployment Plan
**Version:** 1.0  
**Prepared by:** Architecture Team  
**Date:** June 2026  
**Status:** Approved — DevOps Reference Document

---

## Purpose

This document defines the complete infrastructure setup for the Kanvise platform — every server, every service, every environment, how deployments are triggered, how the system is monitored, and how it recovers from failures. Every developer and every DevOps-adjacent team member must understand this document before touching anything in production.

---

## 1. Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION TOPOLOGY                          │
│                                                                      │
│  ┌──────────────────┐    ┌─────────────────────────────────────┐    │
│  │     VERCEL       │    │            SCALEWAY                  │    │
│  │                  │    │                                      │    │
│  │  Next.js App     │    │  ┌─────────────┐  ┌─────────────┐  │    │
│  │  kanvise.com      │    │  │  Hono API   │  │  LiveKit    │  │    │
│  │                  │    │  │  Node.js    │  │  Server     │  │    │
│  │  - SSR/SSG       │◄──►│  │  PM2        │  │             │  │    │
│  │  - Edge CDN      │    │  │             │◄─►│             │  │    │
│  │  - Auto deploy   │    │  │  Port 3001  │  │  Port 443   │  │    │
│  │    from GitHub   │    │  └──────┬──────┘  └─────────────┘  │    │
│  └──────────────────┘    │         │ Private Network           │    │
│                          │         │                           │    │
│  ┌──────────────────┐    └─────────┼─────────────────────────-┘    │
│  │   CLOUDFLARE     │              │                                 │
│  │                  │    ┌─────────▼──────────────────────────┐    │
│  │  R2 Storage      │    │            SUPABASE                 │    │
│  │  CDN             │◄──►│                                     │    │
│  │  DNS             │    │  PostgreSQL Database                │    │
│  │                  │    │  Supabase Auth                      │    │
│  └──────────────────┘    │  Connection Pooling (PgBouncer)     │    │
│                          └─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Environments

Kanvise runs three environments. Each is completely isolated — no environment shares infrastructure with another.

| Environment | Purpose | Domain | Deploy Trigger |
|---|---|---|---|
| **Local** | Developer machines | `localhost` | Manual |
| **Staging** | Pre-production testing | `staging.kanvise.com` | Push to `staging` branch |
| **Production** | Live platform | `kanvise.com` | Push to `main` branch |

### Environment Isolation Rules

Production database and staging database are separate Supabase projects — they never share data. A migration tested on staging is applied to production separately. Staging data is never real user data.

Production R2 bucket and staging R2 bucket are separate. Production secrets never appear in staging configuration and vice versa.

All three environments use the same Scaleway region for consistency: **Paris (fr-par)**. This is the closest Scaleway region with good connectivity to Nigeria via undersea cables.

---

## 3. Vercel — Next.js Deployment

### 3.1 Project Setup

The Next.js repository is connected to Vercel via GitHub integration. Vercel automatically deploys on every push.

**Branch to environment mapping:**
```
main    → Production (kanvise.com)
staging → Staging (staging.kanvise.com)
feature/* → Preview deployments (auto-generated URLs)
```

Every pull request gets an automatic preview deployment at a unique Vercel URL. This allows reviewers to test changes live before merging.

### 3.2 Vercel Configuration

**`vercel.json` at the repository root:**
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "regions": ["lhr1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

**Region:** `lhr1` (London) is chosen as the Vercel edge region. London provides the best latency to Nigeria from Vercel's available regions.

### 3.3 Environment Variables on Vercel

Set in the Vercel dashboard under Project → Settings → Environment Variables. Each variable is scoped to the correct environment (Production, Preview, Development).

Variables with `NEXT_PUBLIC_` prefix are embedded in the client bundle — only safe, non-secret values get this prefix.

See Document 17 (Environment Configuration) for the complete variable list.

### 3.4 Custom Domain Configuration

**Production:**
- Root domain `kanvise.com` → Vercel
- `www.kanvise.com` → redirects to `kanvise.com` (301)
- `cdn.kanvise.com` → Cloudflare R2 public bucket

**Staging:**
- `staging.kanvise.com` → Vercel staging deployment

DNS is managed through Cloudflare. Cloudflare is set to "DNS only" (grey cloud) for the Vercel domains to let Vercel handle SSL. Cloudflare's proxy (orange cloud) is only active for `cdn.kanvise.com` which serves R2 files.

### 3.5 Vercel Build Settings

**Build command:** `npm run build`
**Install command:** `npm ci` (not `npm install` — `ci` is faster and more deterministic in CI)
**Node.js version:** 20.x (LTS)

**`next.config.js` key settings:**
```javascript
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.kanvise.com' }
    ]
  },
  experimental: {
    serverActions: { allowedOrigins: ['kanvise.com', 'staging.kanvise.com'] }
  }
}
```

---

## 4. Scaleway — Hono API Server

### 4.1 Server Specification

**Instance type:** DEV1-M (3 vCPU, 4GB RAM) for MVP launch.

This specification is sufficient for the expected MVP load — up to 50 concurrent tutorial centres with up to 300 students each. The Hono API is stateless and CPU-light. Most operations are I/O-bound (database queries, external API calls). RAM usage is dominated by the Node.js process and PM2 overhead.

**Upgrade path:** When concurrent live classes increase significantly, scale to GP1-S (4 vCPU, 16GB RAM). LiveKit is on a separate instance and scales independently.

**Operating system:** Ubuntu 24.04 LTS.

**Region:** Paris (fr-par-1) — same zone as the LiveKit server so private network latency is minimal.

### 4.2 Server Setup Steps

The following steps are performed once on a fresh Scaleway instance. They are documented here so any team member can reproduce the setup.

**1. System update:**
```bash
apt update && apt upgrade -y
```

**2. Install Node.js 20 via NodeSource:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version  # Should output v20.x.x
```

**3. Install PM2 globally:**
```bash
npm install -g pm2
```

**4. Create application user (do not run app as root):**
```bash
adduser --disabled-password --gecos "" kanvise
usermod -aG sudo kanvise
```

**5. Install Nginx as reverse proxy:**
```bash
apt install -y nginx
```

**6. Install Certbot for SSL:**
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.kanvise.com
```

**7. Configure UFW firewall:**
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 4.3 Nginx Configuration

Nginx sits in front of the Hono process. It handles SSL termination and proxies requests to Hono on port 3001.

**`/etc/nginx/sites-available/kanvise-api`:**
```nginx
server {
    listen 443 ssl;
    server_name api.kanvise.com;

    ssl_certificate /etc/letsencrypt/live/api.kanvise.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.kanvise.com/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name api.kanvise.com;
    return 301 https://$server_name$request_uri;
}
```

**Notes:**
- `client_max_body_size` is set to 10M. Files are uploaded directly to R2 via presigned URLs — the Hono server does not receive file bodies. The 10M limit covers JSON payloads only.
- `proxy_read_timeout 60s` allows long-running operations (payment verification, bulk notifications) to complete without Nginx timing out.

### 4.4 PM2 Process Management

PM2 manages the Hono process, handles crashes, and restarts the process after server reboots.

**`ecosystem.config.js` in the Hono repository root:**
```javascript
module.exports = {
  apps: [
    {
      name: 'kanvise-api',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/kanvise/api-error.log',
      out_file: '/var/log/kanvise/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
```

**Why `instances: 1` and `exec_mode: fork`:**
The node-cron background jobs must only run once. Running multiple PM2 instances in cluster mode would cause each instance to run the cron jobs independently — mocks would be published multiple times and emails would be sent multiple times. Fork mode with one instance is the correct MVP choice. Post-MVP, background jobs should be extracted to a dedicated worker process before switching to cluster mode.

**Starting and saving PM2 configuration:**
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # Generates systemd startup command — run the output
```

### 4.5 Hono Deployment Process

API deployments are automated by `.github/workflows/deploy.yml`. A push that changes `api/**` deploys `staging` to the staging Scaleway environment and `main` to production. Tests and a TypeScript build must pass before the workflow connects to the server. After deployment it verifies the environment's `/health` endpoint.

The repository uses GitHub Environments named `Preview` (the `staging` branch) and `Production` (the `main` branch). Configure `SCALEWAY_HOST`, `SCALEWAY_USER`, `SCALEWAY_SSH_KEY`, and optional `SCALEWAY_PORT` as secrets separately in each environment. Do not leave Scaleway credentials only at repository level because that would let staging and production resolve to the same server credentials. Configure these ordinary environment variables separately in each environment:

- `API_HEALTH_URL`: API origin without `/health`
- `FRONTEND_URL`: canonical frontend origin used for links and redirects
- `CORS_ALLOWED_ORIGINS`: comma-separated additional exact frontend origins

The deployment passes the frontend-origin variables to PM2 and restarts it with `--update-env`, so future CORS changes do not require manually editing Scaleway. Other sensitive application variables remain in the API process environment on the server. The checked-out repository must be at `~/Kanvise` for the deployment user.

**Deployment time:** Typically 2–4 minutes from push to live. The Hono server has zero-downtime restarts via PM2's graceful reload — in-flight requests complete before the process restarts.

**Rollback:** Revert the bad commit on the affected branch and push the revert. The same verified deployment pipeline will deploy that known Git state; do not put the server into a detached or untracked state with a manual checkout.

### 4.6 Log Management

Logs are written to `/var/log/kanvise/`. Log rotation is configured via `logrotate` to prevent disk space exhaustion:

**`/etc/logrotate.d/kanvise`:**
```
/var/log/kanvise/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 kanvise kanvise
}
```

This retains 14 days of compressed logs. Logs older than 14 days are automatically deleted.

---

## 5. Scaleway — LiveKit Server

### 5.1 Server Specification

LiveKit runs on a dedicated Scaleway instance separate from the Hono API. Video processing is CPU and bandwidth intensive — it must not compete with the API server for resources.

**Instance type:** GP1-S (4 vCPU, 16GB RAM) for MVP launch. This supports approximately 50–80 concurrent participants across all rooms.

**Network:** LiveKit communicates with the Hono server over Scaleway's private network (no public internet between them). Port 7880 (LiveKit API) is only accessible on the private network. Ports 443 and 7881 (WebRTC/TURN) are publicly accessible.

LiveKit setup and configuration is the responsibility of the live class developer. The Hono API server needs the following from the LiveKit setup:

- The LiveKit server URL: `wss://livekit.kanvise.com`
- The LiveKit API key and secret (stored in Hono's environment)
- The LiveKit webhook secret (for verifying webhook payloads)
- The private network IP of the LiveKit server (for Hono to call LiveKit's internal API)

---

## 6. Supabase — Database & Auth

### 6.1 Project Setup

Two separate Supabase projects are created:
- **Production:** `kanvise-production`
- **Staging:** `kanvise-staging`

Each project has its own PostgreSQL database, Auth configuration, and API keys.

### 6.2 Database Configuration

**Connection pooling:** Always use the pooled connection string (port 6543, PgBouncer) in the Hono server. Never use the direct connection string (port 5432) from Hono — direct connections are reserved for migrations only.

**Connection string format:**
```
postgresql://postgres:[password]@[project-ref].pooler.supabase.com:6543/postgres
```

**Database extensions required:**
```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable the pg_cron extension for any server-side scheduled tasks (optional)
-- Not used for MVP — cron runs in Hono process
```

### 6.3 Migration Strategy

Database migrations are written as sequential numbered SQL files:

```
/apps/api/supabase/migrations/
  0001_create_schools.sql
  0002_create_user_profiles.sql
  0003_create_kanvise_id_sequences.sql
  0004_create_programmes.sql
  ...
```

Migrations are applied using the Supabase CLI:

```bash
# Apply all pending migrations to the target project
supabase db push --project-ref [project-ref]
```

**Migration rules:**
- Migrations are append-only — never modify an existing migration file
- Every schema change requires a new migration file
- Migration files are reviewed as part of the pull request process
- Staging migrations are applied first and tested before production

### 6.4 Supabase Auth Configuration

The following settings are configured in the Supabase dashboard under Authentication → Settings:

**Email settings:**
- Enable email confirmations: ON
- Secure email change: ON (requires confirmation from both old and new email — post-MVP)
- Password minimum length: 8
- Password requirements: uppercase letters, numbers

**JWT settings:**
- JWT expiry: 3600 seconds (1 hour)
- Refresh token rotation: ON
- Refresh token reuse interval: 10 seconds

**Email templates:** Supabase's default email templates are used for MVP. Custom branded templates (with Kanvise logo and colours) are post-MVP.

**Redirect URLs (allowed list):**
```
https://kanvise.com/api/auth/callback
https://staging.kanvise.com/api/auth/callback
http://localhost:3000/api/auth/callback
```

### 6.5 Database Backups

Supabase Pro plan includes automatic daily backups retained for 7 days. This is the backup strategy for MVP.

**Backup schedule:** Daily at 03:00 UTC.

**Restore process:** Via the Supabase dashboard → Settings → Backups → Restore. A restore creates a new database instance — it does not overwrite the current database. The Hono environment variable `DATABASE_URL` must be updated to point to the restored instance.

**Manual backup before major migrations:**
```bash
supabase db dump --project-ref [project-ref] > backup_$(date +%Y%m%d).sql
```

---

## 7. Cloudflare — R2 & CDN

### 7.1 R2 Bucket Setup

Two R2 buckets are created:

| Bucket | Purpose | Access |
|---|---|---|
| `kanvise-production` | Production file storage | Mixed (see below) |
| `kanvise-staging` | Staging file storage | Mixed |

Within each bucket, access is split by folder:

**Public folder** (`/public/`) — accessible without authentication:
- School logos, banners, promo images, tutor profile photos

**Private folder** (`/private/`) — accessible only via presigned URLs:
- Student submissions, assignment attachments, notes

**Actual R2 folder structure** (from Document 04):
```
kanvise-production/
├── schools/{school_id}/profile/     → PUBLIC
├── schools/{school_id}/promos/      → PUBLIC
├── schools/{school_id}/notes/       → PRIVATE
├── schools/{school_id}/assignments/ → PRIVATE
├── schools/{school_id}/submissions/ → PRIVATE
├── avatars/{user_id}/               → PUBLIC (avatar render)
└── tutors/{tutor_id}/               → PUBLIC (profile photos)
```

### 7.2 R2 Public Access Configuration

The R2 bucket does not have blanket public access. Public files are served through a Cloudflare custom domain `cdn.kanvise.com` which is configured as an R2 public bucket domain in the Cloudflare dashboard.

Only the `/public/` prefix path is served through `cdn.kanvise.com`. The `/private/` prefix path requires presigned URLs.

### 7.3 Cloudflare DNS Configuration

All DNS records are managed in Cloudflare. The following records are configured:

| Type | Name | Value | Proxy |
|---|---|---|---|
| A/CNAME | `kanvise.com` | Vercel | DNS only |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only |
| CNAME | `api` | Scaleway server IP | DNS only |
| CNAME | `livekit` | LiveKit server IP | DNS only |
| CNAME | `cdn` | R2 bucket domain | Proxied (orange cloud) |
| CNAME | `staging` | Vercel staging | DNS only |

**Why DNS only for Vercel and Scaleway:** Vercel and Scaleway handle their own SSL. Cloudflare proxying (orange cloud) would interfere with their SSL certificates.

**Why proxied for CDN:** Cloudflare's proxy is enabled for `cdn.kanvise.com` to benefit from Cloudflare's global CDN caching for public files. Files uploaded to R2 are automatically cached at Cloudflare's edge nodes closest to Nigerian users.

### 7.4 R2 API Access

The Hono server accesses R2 using the AWS S3 SDK with Cloudflare R2 credentials:

```javascript
import { S3Client } from '@aws-sdk/client-s3'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})
```

R2 credentials are scoped to the specific bucket using Cloudflare's R2 token permissions — not the root account credentials.

---

## 8. CI/CD Pipeline

### 8.1 Repository Structure

The Kanvise codebase is a monorepo with two main applications:

```
kanvise/
├── apps/
│   ├── web/          (Next.js frontend)
│   └── api/          (Hono backend)
├── packages/
│   └── shared/       (Shared types, utilities)
├── .github/
│   └── workflows/
│       ├── deploy-web.yml
│       └── deploy-api.yml
└── package.json      (Workspace root)
```

### 8.2 GitHub Actions Workflows

**Frontend (Next.js) — Auto-deployed by Vercel:**
Vercel's GitHub integration handles frontend deployments automatically. No custom GitHub Action is needed for the frontend — Vercel detects pushes to `main` and `staging` and deploys automatically.

**Backend (Hono API) — Custom GitHub Action:**
Defined in `.github/workflows/deploy.yml` (shown in Section 4.5).

The workflow is path-filtered — it only triggers when files inside `apps/api/` change. A frontend-only change does not trigger an API deployment.

### 8.3 Pre-Deployment Checks

Before any deployment to production, the following checks must pass automatically:

```yaml
- name: Type check
  run: npm run type-check

- name: Lint
  run: npm run lint

- name: Run tests
  run: npm run test
```

If any check fails, the deployment is blocked. No code reaches production without passing type checking, linting, and tests.

### 8.4 Deployment Flow Summary

```
Developer pushes to feature branch
         │
         ▼
GitHub Actions runs type-check, lint, tests
         │
Tests pass → Pull request created
         │
         ▼
Vercel creates preview deployment automatically
Reviewer tests on the preview URL
         │
         ▼
Pull request approved → Merge to staging
         │
         ▼
Vercel deploys to staging.kanvise.com (frontend)
GitHub Action deploys to Scaleway staging (backend)
         │
Staging tested and verified
         │
         ▼
Merge staging to main
         │
         ▼
Vercel deploys to kanvise.com (frontend — automatic)
GitHub Action deploys to Scaleway production (backend)
         │
         ▼
Production deployment complete
```

### 8.1 Frontend API environment

The Vercel frontend project must define `NEXT_PUBLIC_API_URL=https://api.kanvise.com` for every environment that builds Kanvise, including Preview deployments for the staging branch. This is a build-time variable, so redeploy after adding or changing it.

The Hono process on Scaleway must also allow every stable frontend hostname that makes browser-side API requests:

```env
# Canonical public frontend used in email links and redirects
FRONTEND_URL=https://kanvise.com

# Additional exact browser origins, comma-separated and without paths
CORS_ALLOWED_ORIGINS=https://staging.kanvise.com,https://app.kanvise.com
```

When a frontend subdomain is added, add its full origin to `CORS_ALLOWED_ORIGINS` in the Scaleway API process environment and restart the Hono process. DNS configuration alone does not authorize the origin. Vercel preview URLs under HTTPS `*.vercel.app` and local development at `http://localhost:3000` are handled by the application.

---

## 9. Monitoring & Alerting

### 9.1 Uptime Monitoring

**Tool:** Vercel Analytics (built-in) for the frontend. A free UptimeRobot monitor checks `api.kanvise.com/health` every 5 minutes for the backend.

**Health check endpoint:** Hono exposes `GET /health` which returns `200 { status: "ok", timestamp: "..." }`. This endpoint requires no authentication and performs no database query — it is a pure liveness check.

**Alerting:** UptimeRobot sends an SMS and email alert to the team when the health check fails for 2 consecutive checks (10 minutes of downtime).

### 9.2 Error Tracking

**Tool:** Sentry is integrated into both Next.js and Hono.

**Next.js integration:** `@sentry/nextjs` wraps the app in `next.config.js`. Unhandled errors in Server Components, route handlers, and client components are captured.

**Hono integration:** A Sentry middleware is added to the Hono middleware stack after the rate limiter. Unhandled errors in route handlers are captured with the user's `kanvise_user_id` and `school_id` as context.

All errors are sent to the team Slack channel via Sentry's Slack integration.

### 9.3 Server Monitoring

PM2 provides basic process monitoring via `pm2 monit` on the Scaleway server. This shows real-time CPU and memory usage for the Hono process.

For more detailed server metrics (CPU, RAM, disk, network over time), Scaleway's built-in monitoring dashboard is used. Alerts are configured for:
- CPU usage above 80% for more than 5 minutes
- RAM usage above 80%
- Disk usage above 70%

### 9.4 Database Monitoring

Supabase's built-in dashboard shows:
- Active connections (must stay below PgBouncer limit)
- Query performance (slow queries are flagged)
- Database size growth
- Auth user counts

Weekly check of the Supabase dashboard is part of the operations routine.

---

## 10. Scaling Plan

The following scaling steps are taken as usage grows. Each step is triggered by the thresholds listed.

| Threshold | Action |
|---|---|
| Hono CPU consistently above 70% | Upgrade Scaleway instance to GP1-S |
| Database connections near limit | Enable Supabase connection pooling (already on PgBouncer, increase pool size) |
| R2 egress costs significant | Evaluate Cloudflare CDN caching coverage — already handled |
| 100+ concurrent live class participants | Evaluate LiveKit horizontal scaling (additional LiveKit node) |
| Background jobs causing API latency | Extract background jobs to separate Scaleway worker instance |
| API response times above 500ms p95 | Add Redis caching layer for frequently read public page data |

**Hono cluster mode:** When the API instance is upgraded, switch PM2 to cluster mode ONLY after background jobs have been extracted to a separate worker process. Running cluster mode with embedded cron jobs causes duplicate job execution.

---

## 11. Disaster Recovery

### 11.1 Scenarios and Responses

**Scenario: Vercel outage**
Impact: Frontend inaccessible. API and database unaffected.
Response: Vercel's SLA covers this. No manual action required — Vercel auto-recovers. ETA: typically under 30 minutes for major outages.

**Scenario: Scaleway instance failure (Hono API)**
Impact: All API operations fail. Frontend public pages still load (data cached at edge). Live classes already in progress are unaffected (LiveKit is independent).
Response: PM2 auto-restarts the process on the same instance within seconds for process crashes. For full instance failure, launch a new Scaleway instance, run the setup steps (Section 4.2), deploy the latest code, update DNS. ETA: 30–60 minutes.

**Scenario: Supabase database outage**
Impact: All data operations fail. Frontend public pages may still load from Vercel cache.
Response: Supabase's SLA covers this. No manual action. ETA: typically under 1 hour.

**Scenario: Database corruption or accidental data deletion**
Impact: Data loss.
Response: Restore from Supabase daily backup (Section 6.5). Update `DATABASE_URL` in Hono environment to point to restored instance. Restart Hono. ETA: 1–3 hours depending on restore size.

**Scenario: R2 file loss**
Impact: Files (notes, submissions, images) inaccessible.
Response: R2 does not have automatic backup for MVP. Files are not replicated. In case of R2 data loss, the database records remain but file keys point to non-existent files. Users must re-upload. Post-MVP: enable R2 object replication to a second location.

### 11.2 Runbook Location

Detailed step-by-step runbooks for each failure scenario are maintained in the team's Notion under **Engineering → Runbooks**. This document provides the overview — Notion runbooks provide the exact commands.

---

## 12. SSL Certificate Renewal

**Vercel:** Handles SSL automatically. No action required.

**Scaleway (Nginx/Certbot):** Let's Encrypt certificates expire every 90 days. Certbot auto-renews them via a systemd timer installed by Certbot. Verify auto-renewal is working:
```bash
certbot renew --dry-run
```

This should be verified monthly. If the certificate expires, the Hono API becomes inaccessible over HTTPS.

---

## 13. Cost Estimation at MVP Launch

Estimated monthly infrastructure cost assuming 10 active tutorial centres with an average of 80 students each (800 total students).

| Service | Plan | Est. Monthly Cost |
|---|---|---|
| Vercel | Pro | ~$20 |
| Scaleway API Server (DEV1-M) | Pay-as-you-go | ~$15 |
| Scaleway LiveKit Server (GP1-S) | Pay-as-you-go | ~$45 |
| Supabase | Pro | ~$25 |
| Cloudflare R2 | Pay-as-you-go (10GB storage, minimal egress) | ~$5 |
| Resend | Free tier (3,000 emails/month) | $0 |
| Sentry | Free tier | $0 |
| UptimeRobot | Free tier | $0 |
| **Total** | | **~$110/month** |

**Notes:**
- LiveKit cost is the largest line item because it requires a more powerful instance for video processing
- R2 egress costs are near-zero thanks to Cloudflare's CDN caching
- Resend free tier covers approximately 100 emails/day — sufficient for MVP
- These costs scale with usage — specifically LiveKit costs increase with concurrent live class participants

---

*End of Document — Version 1.0*
