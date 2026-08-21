# Kanvise

> B2B edtech infrastructure for Nigerian tutorial centres and tutors.

**Website:** [kanvise.com](https://kanvise.com)

Kanvise helps tutorial centres run core learning operations in one place: live classes, programmes and courses, mock-exam workflows, student progress, and payment flows. The platform is designed as a multi-tenant application, with an organisation or school providing the boundary for data access.

## What is in this repository

- A Next.js web application for the public site, authentication, onboarding, dashboards, and virtual classrooms.
- A Hono API that provides authenticated, tenant-aware backend routes.
- Supabase integration for authentication and application data.
- LiveKit server routes for room hosting, token issuance, webhooks, and session-ending flows.
- Paystack integration points for enrolment payments and webhook handling.
- Routes for schools, users, programmes, sub-programmes, courses, enrolments, live classes, mock exams, and storage.

## Architecture

```text
Kanvise
├── web/                    # Next.js 15 + React 19 frontend
│   ├── src/app/            # App Router pages and server routes
│   └── src/components/     # Landing, classroom, and shared UI
└── api/                    # Hono + TypeScript backend
    ├── src/routes/         # Domain API routes
    ├── src/middleware/     # JWT, profile, role, and tenant middleware
    └── src/lib/            # Supabase and shared backend utilities
```

The frontend and API run as separate workspaces. Tenant middleware resolves the active school context before protected domain routes are handled, helping keep organisation data isolated.

## Tech stack

- Next.js 15, React 19, TypeScript, and Tailwind CSS
- Hono and Node.js for the API
- Supabase for authentication and data
- LiveKit for live video-classroom capabilities
- Paystack for payment workflows
- Cloudflare R2-compatible storage integration

## Run locally

### Prerequisites

- Node.js 18 or newer
- A Supabase project
- A LiveKit project or self-hosted LiveKit server
- Paystack test credentials for payment flows

### Installation

```bash
git clone https://github.com/KingUsang/Kanvise.git
cd Kanvise
npm install
```

Create environment files for the web app and API with credentials appropriate to your local environment. The application expects variables in this family:

```bash
# web
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
PAYSTACK_SECRET_KEY=

# api
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
PAYSTACK_SECRET_KEY=
PORT=3001
```

Run the web application and API together:

```bash
npm run dev
```

The web app starts on [http://localhost:3000](http://localhost:3000) and the API defaults to port `3001`.

### Production build

```bash
npm run build
```

## Engineering highlights

- **Tenant-aware backend:** protected routes use JWT, profile-resolution, role, and tenant middleware before accessing school data.
- **Real-time classroom foundation:** the web app includes LiveKit token, host, webhook, and room-control routes alongside collaborative classroom components.
- **Payment-aware enrolment:** enrolment flows initialize Paystack transactions, while webhooks support server-side payment events.
- **Separation of concerns:** a workspace layout keeps UI concerns in Next.js and domain API responsibilities in Hono.

## Security

Environment files are ignored by Git. Do not commit credentials, service-role keys, payment secrets, or LiveKit secrets. Use test credentials for local development and rotate any key that is ever exposed.
