# Kanvise engineering rule

Before proposing or changing product behaviour, routes, dashboard UI, database
schema, authentication, tenancy, or deployment, read the relevant documents in
`docs/` first. Treat the current ones as the source of truth over assumptions or
generic framework conventions.

Start with:

- `docs/engineering/DOCUMENT_AUTHORITY.md` to learn which documents are current,
  evidence, or archived. Documents under `docs/archive/` are superseded or
  historical and are never authority.
- `docs/engineering/README.md` and `docs/engineering/standards/` for the current
  rules (system architecture, auth and tenancy, database, API, frontend,
  deployment).
- `docs/engineering/decisions/` for accepted architectural decisions.
- `docs/deviations.md` for known conflicts between code and standards. It does
  not authorize implementation.
- The matching guide in `docs/operations/` (setup and deployment) or
  `docs/runbooks/` (incident response) before changing an established workflow.

Current stack: Next.js (`web/`) on Vercel, Hono API (`api/`) on Oracle behind
systemd, Supabase (Auth and PostgreSQL), Cloudflare R2 storage and PlugNMeet for
live classes. The repository is an npm workspace with one root `package-lock.json`.

When the implementation and the documents conflict, identify the conflict
explicitly before extending the implementation. Do not make remote database or
deployment changes based on an assumption. Work goes through a pull request into
`staging` before `main`.
