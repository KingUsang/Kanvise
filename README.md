# Kanvise

Kanvise is a tutoring workspace for Tutors, Learners, and tutoring accounts.
Tutoring accounts manage Classes, Subjects, assignments, live sessions, learner
progress, and account operations from one product.

**Website:** [kanvise.com](https://kanvise.com)

## Repository layout

```text
Kanvise
├── web/                    # Next.js 16 + React 19 frontend
│   ├── src/app/            # App Router pages and route handlers
│   └── src/components/     # Public, dashboard, and classroom UI
└── api/                    # Hono + TypeScript API on Node.js 22
    ├── src/routes/         # Domain API routes
    ├── src/middleware/     # Auth, profile, role, and account middleware
    └── src/lib/            # Supabase and shared backend utilities
```

The repository is an npm workspace. The root `package-lock.json` is the single
lockfile and root commands own installation and orchestration. The web app and
API run as separate workspaces.

## Current topology

- Next.js runs the web application and dashboard on Vercel.
- Hono runs the API and separately owned scheduler/worker roles on persistent
  compute.
- Supabase owns Auth and PostgreSQL; Cloudflare R2 owns application objects.
- PlugNMeet owns live-room media. Its recorder capacity uses AWS infrastructure.
- Paystack provides payment-provider integration for supported enrolment flows.

See the [engineering index](docs/engineering/README.md) for current standards,
accepted decisions, runbooks, and the document authority map. Historical
topology documents are evidence, not instructions for new work.

## Prerequisites and setup

Use Node.js `22.23.1` and npm `10.9.8` (the supported Node 22/npm 10 toolchain).
The repository declares the same policy in `package.json` and `.nvmrc`.

```bash
git clone https://github.com/KingUsang/Kanvise.git
cd Kanvise
npm install
cp web/.env.example web/.env.local
cp api/.env.example api/.env
```

Fill the local placeholders with disposable development credentials. The API
example is the configuration inventory for the typed runtime contract; never
commit real secrets. Browser-visible web configuration belongs in
`web/.env.local`, while API secrets stay server-side in `api/.env`.

## Root commands

```bash
npm run dev                         # run web and API together
npm run build                       # build both workspaces
npm test --workspace=api            # API tests
npm run lint --workspace=web        # web lint
npm run type-check --workspace=web  # web TypeScript check
npm test --workspace=web            # web tests
```

The web app defaults to [http://localhost:3000](http://localhost:3000) and the
API to [http://localhost:3001](http://localhost:3001). Workspace environment
templates are [web/.env.example](web/.env.example) and
[api/.env.example](api/.env.example).

## Engineering entrypoints

- [Engineering standards and authority](docs/engineering/README.md)
- [Current document authority map](docs/engineering/DOCUMENT_AUTHORITY.md)
- [Implementation deviations](docs/deviations.md)
- [API runtime environment contract](api/src/config/runtime-env.ts)
- [Web workspace instructions](web/README.md)

Keep changes focused, preserve unrelated worktree changes, and report the
exact commit and commands used for verification.
