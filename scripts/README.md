# Directory research scripts

## API deployment

`operations/deploy-api-on-oracle.sh` is invoked only by the protected
`staging` and `main` GitHub Actions workflow on the repository-scoped Oracle
runner. It validates the environment-specific target, swaps the verified API
artifact, restarts the matching systemd unit, checks local and public health,
and restores the prior artifact if deployment fails. Operational details live
in `docs/operations/oracle-api-deployment.md`.

Do not run the deployment script manually unless following the documented
recovery procedure and providing all required deployment environment values.

## Research utilities

`superprof-leads.mjs` exports only information displayed in public Superprof search-result cards. It does not sign in, message anyone, collect contact details, or bypass access controls.

```bash
node scripts/superprof-leads.mjs \
  --url 'https://www.superprof.ng/lessons/english/lagos/' \
  --pages 2 \
  --out exports/superprof-lagos-english.csv
```

Use a search URL you are permitted to research, review Superprof's current terms and `robots.txt`, and keep collection modest. The script checks a site-wide `Disallow: /` in `robots.txt`, uses a transparent user agent, caps at ten pages, and waits at least 1.5 seconds between pages. If Superprof presents a bot challenge, it stops rather than attempting to evade it.
