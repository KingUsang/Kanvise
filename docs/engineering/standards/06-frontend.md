# Frontend conventions

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard governs the Next.js application, rendering boundaries, frontend
state, API calls, forms, routing, component structure, and browser persistence.
Visual and accessibility rules are defined in the next standard.

## Rendering and ownership

Use the App Router. A component is a Server Component unless it needs browser
state, effects, event handlers, or a browser-only API; place `use client` at the
smallest useful interactive boundary.

- Public, SEO, and shareable pages fetch public Hono data server-first and
  render useful HTML. Apply an explicit cache/revalidation policy.
- Authenticated dashboard layouts verify the session server-side and render the
  shell. Dashboard business data is fetched in Client Components through
  TanStack Query.
- Server Components never pass access tokens into Client Components and do not
  fetch authenticated dashboard business data.
- Next.js route handlers do not become a second application-data client. They
  follow the architecture exceptions only.
- Client code may use Supabase for Auth/session operations. It never queries
  application tables directly.

Server and client modules use explicit names or folders where ambiguity could
leak server-only code, secrets, or Node dependencies into a client bundle.
Environment access is centralized and validated. `NEXT_PUBLIC_*` values are
assumed visible to every visitor and never contain secrets.

## State model

Choose state by ownership:

- **Server state:** Hono data lives in TanStack Query, not duplicated in
  `useState`, Context, or ad hoc effects.
- **Shareable navigation state:** search, filter, sort, selected tab when
  meaningful, and pagination belong in typed URL parameters.
- **Local interaction state:** open panels, temporary selection, and draft UI
  state stay near the component that owns them.
- **Cross-tree UI state:** Context is acceptable for stable presentation state,
  not as a substitute for the query cache.
- **Durable server-owned state:** never relies on browser storage.
- **Browser persistence:** only non-sensitive preferences or deliberately
  recoverable drafts use local/session storage, with a versioned key, schema,
  expiry/cleanup policy, and SSR-safe access.

Do not mirror props or query results into local state unless editing a deliberate
snapshot. Derive values during render; use effects only to synchronize with an
external system. Fetching application data in `useEffect` is prohibited for new
or touched dashboard code.

## API client and session behavior

All browser-to-Hono calls use one typed client built on
`authenticatedApiFetch`. Feature components do not call `getSession`, construct
Authorization headers, refresh tokens, or parse the common response/error
envelope themselves. The client:

- obtains the current access token at request time;
- performs the single coordinated refresh/retry defined by the auth standard;
- attaches request metadata and content headers;
- parses the standard API envelope;
- throws a typed error containing safe status, code, details, and request ID;
- supports cancellation through `AbortSignal`; and
- does not retry non-idempotent work implicitly.

Direct `fetch` remains appropriate for public URLs and presigned R2 transfers;
the surrounding Hono presign/confirm calls still use the shared client.

Feature API functions and runtime schemas live with the feature. UI components
consume domain-shaped results rather than transport responses or raw database
rows. Contract changes update backend schema, frontend type/schema, and tests in
one compatible change; generated OpenAPI types should replace duplication when
the backend contract is available.

## TanStack Query

TanStack Query is the only dashboard server-state cache. Each capability owns a
query-key factory and reusable query/mutation options. Keys include active
account and every parameter that changes the result. Never share cached
account-scoped data across account switches; cancel and clear/invalidate the
appropriate scope during a switch or sign-out.

Every query declares freshness based on the resource. A global five-minute
default must not silently govern live sessions, invitations, payments, or other
time-sensitive state. Automatic retries are limited to transient, idempotent
reads; do not retry authorization, validation, or not-found failures.

Writes use `useMutation`, prevent duplicate submission, surface the typed error,
and update the cache deliberately through an exact invalidation, returned-data
update, or rollback-capable optimistic update. Do not manually refetch unrelated
screens or reload the page after a normal mutation.

Independent queries may run in parallel and remain separately cached. Use one
backend aggregate endpoint when a screen requires a coherent read model or when
many tightly coupled round trips are measurably harmful. Do not hide several
unrelated resources inside one `Promise.all` query merely to make fetching look
centralized, and avoid sequential request waterfalls when inputs are already
known.

## Routes, loading, empty, and failure states

Each route segment defines appropriate `loading.tsx`, `error.tsx`, and
`not-found.tsx` behavior, or delegates clearly to a feature-level state
component. Every query-driven view distinguishes:

- first load;
- background refresh without blanking existing content;
- empty data with a relevant next action;
- recoverable failure with retry;
- forbidden/not found/session ended; and
- mutation pending/success/failure.

Never show raw `Error.message` unless it originated from the typed safe API
error. Session-ended behavior is centralized and returns the user to sign-in
with a safe continuation. Error boundaries report unexpected render failures
once and offer a controlled reset. Loading UI should preserve the eventual
layout rather than replace an entire dashboard with a spinner.

## Component and feature structure

Route files compose a page and route metadata; they do not contain an entire
feature implementation. Organize feature code by capability, with colocated API
functions, schemas/types, query options, components, and tests. Shared UI is
promoted only after genuine reuse and must not absorb feature-specific rules.

Split a component when it owns multiple workflows, contains separable panels,
mixes transport with rendering, or cannot be tested without exercising unrelated
behavior. File length is a review signal rather than a target, but multi-thousand
line client components are outside the standard. Prefer explicit composition
over boolean-heavy universal components and avoid barrel exports that create
unclear server/client or circular dependencies.

Lists use stable domain IDs as keys. Components do not mutate props, use array
indexes for reorderable records, or perform side effects during render. Expensive
memoization is evidence-led; do not wrap routine values and callbacks by default.

## Forms and user input

Small forms may use controlled inputs or `FormData`. Multi-step, dynamic, or
validation-heavy forms use a shared form approach integrated with the same
runtime schema as the API contract. Browser constraints improve interaction but
never replace server validation.

Forms preserve user input after recoverable failure, show field-level errors
and a form summary where useful, focus the first invalid field, prevent duplicate
submission, and clearly represent pending/success state. Dates and money are
converted in named boundary functions; components do not scatter ad hoc parsing
or timezone assumptions.

## Frontend verification

Every new or materially changed flow verifies:

- server/client and public/dashboard boundary rules;
- authenticated calls use the shared client with no token prop;
- query keys, account switching, freshness, invalidation, and cancellation;
- initial loading, background refresh, empty, error, retry, and session expiry;
- mutation deduplication and failure recovery;
- URL state and browser back/forward behavior where applicable;
- runtime input/output handling at the API boundary; and
- component behavior at the smallest useful integration boundary.
