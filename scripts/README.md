# Directory research scripts

`superprof-leads.mjs` exports only information displayed in public Superprof search-result cards. It does not sign in, message anyone, collect contact details, or bypass access controls.

```bash
node scripts/superprof-leads.mjs \
  --url 'https://www.superprof.ng/lessons/english/lagos/' \
  --pages 2 \
  --out exports/superprof-lagos-english.csv
```

Use a search URL you are permitted to research, review Superprof's current terms and `robots.txt`, and keep collection modest. The script checks a site-wide `Disallow: /` in `robots.txt`, uses a transparent user agent, caps at ten pages, and waits at least 1.5 seconds between pages. If Superprof presents a bot challenge, it stops rather than attempting to evade it.
