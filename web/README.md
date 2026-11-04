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

Do not create a workspace lockfile or install dependencies from `web/` as a
separate project. The [engineering standards](../docs/engineering/README.md)
and [document authority map](../docs/engineering/DOCUMENT_AUTHORITY.md) govern
current frontend and API decisions.
