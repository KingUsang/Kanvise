# Scaleway exit plan

Date reviewed: 2026-09-10

## Current workload

`api.kanvise.com` and `staging-api.kanvise.com` resolve to the same Scaleway VM (`scw-hopeful-jackson`). It currently runs:

- production and staging Hono APIs under PM2;
- self-hosted LiveKit as a systemd service;
- Redis with append-only persistence in Docker;
- Caddy and TLS configuration;
- scheduled jobs inside the API process.

The VM has 2 GB RAM and an 8 GB root disk. At inspection it used about 824 MB RAM, 5.6 GB disk and no swap. This is a small single-VM workload; the cheapest migration is to preserve that topology rather than redesign the product during the pilot.

## Local recovery copy

The app-specific server state is backed up locally at:

`.server-backups/scw-hopeful-jackson/2026-09-10/`

It contains the three server checkouts (including Git metadata, untracked files and API environment files), LiveKit/egress configuration, Caddy state, PM2/systemd definitions, firewall and SSH configuration, and the Redis RDB/AOF data. `SHA256SUMS` verifies the archive and manifest. The directory is excluded from Git and its files are mode `0600`.

This is a recovery copy, not an off-device backup. Because it contains production secrets and is not encrypted, copy it only into encrypted storage and never commit or upload it as ordinary cloud-drive data.

## Tonight's replacement

Startup-program approval is useful runway but is not part of the immediate cutover. The overnight target is a self-hosted OCI Always Free VM. LiveKit Cloud is not an acceptable substitute for Kanvise live classes.

Create one Ubuntu ARM64 `VM.Standard.A1.Flex` instance with **2 OCPUs and 12 GB RAM**, a public IPv4 address and at least a 50 GB boot volume. Open TCP `22`, `80`, `443`, `7881` and UDP `7882` in its VCN security list. The current LiveKit configuration uses UDP mux on `7882`, so it does not need the default `50000-60000/UDP` range.

Choose the home region carefully because Oracle does not allow it to be changed. Frankfurt or London offers three availability domains, which gives more places to try when an Always Free A1 shape reports no host capacity. Region latency still needs a real classroom test from Nigeria before production cutover.

The restore scripts are:

- `scripts/operations/restore-kanvise-host.sh`
- `scripts/operations/verify-kanvise-host.sh`
- `scripts/operations/finalize-kanvise-cutover.sh`

They preserve the current single-VM architecture and pin LiveKit `1.13.4`, Redis `7.4.11` and PM2 `7.0.3`. The restore script supports both ARM64 and AMD64 and verifies the downloaded LiveKit binary checksum.

## Credit options after the immediate migration

### First choice: one credited Azure VM

Apply to Microsoft for Startups immediately. Microsoft currently advertises up to **$5,000 in Azure credits without investor backing**, with higher levels available as a startup demonstrates progress. Kanvise should apply as a privately held software company serving education, not as an educational institution. The application documentation says review is typically within three business days.

Use one Ubuntu VM for the same four services. This requires the least code change and preserves LiveKit UDP networking and persistent API jobs. Do not split the system into Kubernetes, managed Redis or multiple app services during the pilot.

- Programme: [Microsoft for Startups](https://www.microsoft.com/startups)
- Eligibility and process: [Microsoft Learn](https://learn.microsoft.com/en-us/azure/signups/startup-help)

### Apply in parallel: Google for Startups

Google's Start tier currently offers early-stage, non-funded startups up to **$2,000 for one year**. Kanvise already has the main prerequisites shown by Google: a working product, public company website and matching company-domain email. A normal Compute Engine VM can preserve the present topology.

- Programme and requirements: [Google for Startups Cloud Program](https://startup.google.com/cloud/)

### Zero-cost host: Oracle Always Free ARM VM

OCI Always Free presently includes Ampere A1 capacity totalling up to 2 OCPUs and 12 GB RAM plus 10 TB/month outbound transfer. On paper this is substantially more memory and transfer than the current Scaleway VM and is the strongest no-credit fallback for self-hosted LiveKit.

Risks must be tested before relying on it: A1 capacity can be unavailable in the chosen home region, the target is ARM64, and free accounts offer weaker operational guarantees. Build the API and run the exact LiveKit ARM64 release in a disposable instance before changing DNS.

- Compute and transfer allowances: [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

### Rejected for live classes: LiveKit Cloud free plan

LiveKit Cloud's free Build plan supports up to 100 simultaneous participants, but its monthly hard caps are only 5,000 WebRTC participant-minutes and 50 GB downstream transfer. A one-hour class with one tutor and 20 students consumes 1,260 participant-minutes before considering transfer, so the minute allowance covers fewer than four such classes. It is useful for migration testing or a short outage, not the whole pilot.

- Current limits: [LiveKit quotas and limits](https://docs.livekit.io/deploy/admin/quotas-and-limits/)

DigitalOcean Hatch advertises much larger credits for selected startups, but acceptance is discretionary. It is worth applying to after the two direct-startup programmes above, not treating it as the migration deadline.

## Migration sequence

1. Reserve an Oracle A1 instance. If Oracle has no capacity tonight, use a new-customer GCP Compute Engine trial VM as the temporary AMD64 target; the ordinary free `e2-micro` is too small for LiveKit.
2. Restore the backup into the replacement VM and keep DNS unchanged.
3. Replace/regenerate server secrets where practical; do not reuse TLS private state when Caddy can issue fresh certificates.
4. Restore Redis, Caddy routes, systemd and PM2 definitions; install the exact Node and LiveKit versions recorded in the manifest.
5. Point staging API and staging LiveKit at the new host first. Verify health, auth email hooks, mock imports, R2 uploads, scheduled jobs and a real mobile LiveKit room.
6. Reduce DNS TTL, sync any changed Redis state, switch production, and monitor webhooks/rooms.
7. Keep Scaleway running for a short rollback window. Cancel it only after production and scheduled jobs have remained healthy and a fresh post-cutover backup exists.

The database and user files do not live on Scaleway: they remain in Supabase and Cloudflare R2. Those services need their own export/recovery procedures; the server archive does not replace them.
