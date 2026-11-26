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
