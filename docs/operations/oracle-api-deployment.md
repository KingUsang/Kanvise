# Oracle API deployment

Last verified: 15 October 2026

## Current topology

The production and staging Hono APIs share one Oracle Cloud ARM64 VM in
Frankfurt. They remain isolated at the process, directory, port, environment
file, database, and public-domain layers.

| Environment | Directory | systemd unit | Local port | Health URL |
| --- | --- | --- | --- | --- |
| Staging | `/opt/kanvise-staging` | `kanvise-api-staging` | `3002` | `https://staging-api.kanvise.com/health` |
| Production | `/opt/kanvise-production` | `kanvise-api-production` | `3001` | `https://api.kanvise.com/health` |

Both services run as the unprivileged `ubuntu` user. Their secret environment
files remain on the VM at `api/.env`; GitHub Actions never downloads or
replaces them.

## Deployment flow

1. Feature branches are created from `origin/staging` in separate worktrees.
2. Pull requests merge into `staging` for pre-production verification.
3. GitHub-hosted runners test and build the API and apply reviewed staging
   migrations.
4. The repository-scoped runner `kanvise-api-oracle` downloads the verified
   `api-dist` artifact and runs
   `scripts/operations/deploy-api-on-oracle.sh` locally on the VM.
5. The script validates the target, installs production API dependencies only
   when package manifests changed, swaps `api/dist`, restarts the correct
   systemd unit, and checks both local and public health endpoints.
6. A failed restart or health check restores the previous artifact and package
   manifests before restarting the previous release.
7. After staging has been tested, a `staging` to `main` pull request promotes
   the same commits to production.

## Runner and network security

The self-hosted runner connects outbound to GitHub over HTTPS. GitHub-hosted
runners do not SSH into the VM, so Oracle does not need a public SSH rule for
GitHub's changing IP ranges.

The runner is repository-scoped and labelled `self-hosted`, `Linux`, `ARM64`,
`oracle`, and `kanvise-api`. Deployment workflows run only after pushes to the
protected `staging` or `main` branches. Pull-request code must never execute on
this runner.

SSH port 22 should remain restricted to explicit administrator `/32` addresses.
Ports 80 and 443 are public. Remove temporary administrator SSH rules after
maintenance or update them when the administrator's public address changes.

## Public form rate-limit secret

The waitlist, suggestion and landing-analytics limits in the API key on the
visitor address (DEV-PUB-004). Browsers reach these endpoints through the
Next.js route handlers on Vercel, which forward the visitor address (Vercel's
`x-real-ip`, or the first `x-forwarded-for` entry) in `X-Kanvise-Client-Ip`
together with `X-Kanvise-Proxy-Secret`.

- Set the same random value (32+ characters) as `KANVISE_PROXY_SECRET` in the
  API `api/.env` on the VM (staging and production separately) and in the
  matching Vercel environment (server-only, no `NEXT_PUBLIC_` prefix). Restart
  the API unit after editing `.env`.
- The API compares the secret in constant time and ignores
  `X-Kanvise-Client-Ip` without a match.
- Without the secret, or before it is set on both sides, the API keys on the
  last `X-Forwarded-For` entry, which Caddy on this VM appends from the
  connecting peer, then on the socket address. It never trusts
  `cf-connecting-ip` or `x-real-ip` because Caddy passes those through from the
  caller. Until the secret is set, all web-proxied submissions share the
  Vercel server's bucket, as before this change.

## Operational checks

```bash
sudo systemctl status kanvise-api-staging
sudo systemctl status kanvise-api-production
curl --fail http://127.0.0.1:3002/health
curl --fail http://127.0.0.1:3001/health
curl --fail https://staging-api.kanvise.com/health
curl --fail https://api.kanvise.com/health
```

Do not deploy by editing files inside `/opt/kanvise-*` manually. Do not copy
`.env` files into GitHub, runner workspaces, build artifacts, or repository
commits.
