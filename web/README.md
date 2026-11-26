# Kanvise web workspace

This workspace contains the Kanvise Next.js frontend, public pages, dashboard,
and browser classroom surfaces. Product and repository setup are documented in
the [root README](../README.md); current engineering rules live in the
[engineering index](../docs/engineering/README.md).

## Setup from the repository root

The root workspace owns the single `package-lock.json` and all installation
commands. Use Node.js `22.23.1` with npm `10.9.8`.

```bash
npm install
cp web/.env.example web/.env.local
npm run dev --workspace=web
```

Open [http://localhost:3000](http://localhost:3000). Set the local Supabase and
API values in `web/.env.local`; use the safe placeholders in
[web/.env.example](.env.example).

## Checks

Run these commands from the repository root:

```bash
npm run lint --workspace=web
npm run type-check --workspace=web
npm test --workspace=web
npm run build --workspace=web
```

The web build needs public placeholder values. CI uses
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder-anon-key`,
`NEXT_PUBLIC_API_URL=http://127.0.0.1:3001`, `API_URL`, `NEXT_PUBLIC_SITE_URL`,
`NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_LIVEKIT_URL` (see
[verify.yml](../.github/workflows/verify.yml)). The web app talks to the Hono API
and Supabase; live classes use PlugNMeet. Playwright browser sessions must stay
out of the repository: `web/*-state.json` is ignored.

Do not create a workspace lockfile or install dependencies from `web/` as a
separate project. The [engineering standards](../docs/engineering/README.md)
and [document authority map](../docs/engineering/DOCUMENT_AUTHORITY.md) govern
current frontend and API decisions.
