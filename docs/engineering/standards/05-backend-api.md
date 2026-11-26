# Backend and API conventions

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard governs the Hono API, HTTP contracts, middleware, validation,
authorization placement, database access, and failure handling. It extends the
architecture, auth/tenancy, and database standards; it does not weaken them.

## API ownership and module shape

Hono is the authoritative application API. Next.js route handlers remain
limited to the exceptions in the architecture standard and must not reproduce
Hono business rules.

Organize code by product capability, not by technical dumping ground. A module
may contain its router, boundary schemas, use-case/service code, queries, and
tests. Route handlers should perform HTTP work only: read validated input,
invoke the use case, and translate its result. Simple single-record operations
may remain local; workflows with branching rules, multiple writes, provider
calls, reuse, or substantial mapping must be extracted from the router.

Do not introduce a generic repository layer that merely renames Supabase
methods. Extract a query or service when it centralizes an invariant, tenant
scope, transaction, reusable read model, or external boundary.

## Route contract

- Use plural resource nouns and standard HTTP methods. Actions that are real
  state transitions may use a subordinate verb such as `/publish` or `/submit`.
- Paths, query keys, and JSON fields use one stable spelling. New product-facing
  contracts use the approved domain language; adapters may preserve legacy
  persistence names internally.
- All timestamps are ISO 8601 UTC instants. IDs are opaque strings to clients.
- `GET` and `HEAD` are safe. `PUT` is replace/idempotent; `PATCH` is partial;
  retry-sensitive `POST` operations require an idempotency mechanism.
- `201` is used for creation, `202` only for accepted durable asynchronous work,
  and `204` has no response body.
- Lists are bounded. Cursor pagination is the default for mutable or unbounded
  collections; offset pagination is acceptable for small, stable admin lists.
- Existing unversioned routes remain compatible through expand–contract.
  Introduce a versioned surface before knowingly supporting external API
  consumers or making an unavoidable breaking contract change.

Success JSON uses `{ "data": ..., "message"?: ..., "meta"?: ... }`. The
`data` property is present even for arrays and scalar results. Compatibility
may require old shapes temporarily, but new shapes follow this envelope.

Errors use the existing compatible envelope:

```json
{
  "error": "Safe human-readable message",
  "code": "STABLE_MACHINE_CODE",
  "details": {},
  "request_id": "opaque-correlation-id"
}
```

`code` is required and stable; `details` is optional, bounded, and safe for the
caller. Never return database/provider messages, stack traces, secrets, SQL,
or arbitrary `error.message`. Validation errors use a single code and
field-addressable details. Unknown routes return the same envelope.

Use status codes consistently: `400` malformed/invalid input, `401` missing or
invalid authentication, `403` authenticated but forbidden, `404` absent or
not visible in the active account, `409` state/uniqueness conflict, `422` only
when the API deliberately distinguishes semantic validation, `429` rate
limited, and `500`/`502`/`503` for safe server/upstream failures.

## Input and output validation

Every route validates path parameters, query parameters, headers it consumes,
and body at the boundary with shared runtime schemas. Kanvise standardizes on
Zod-compatible schemas integrated with Hono; validation must not rely on
TypeScript casts or destructuring unchecked JSON.

Schemas reject or deliberately strip unknown keys, normalize only documented
representations, apply size/count/range limits, and distinguish omitted values
from explicit `null`. UUIDs, enums, URLs, email addresses, money, pagination,
and dates use shared primitives. The server never trusts client-supplied role,
account, owner, price, completion, or provider-status fields.

Response schemas cover public and security-sensitive contracts. Never serialize
raw database rows when they contain internal, provider, tenant, or secret
fields. Contract/schema changes and their compatibility behavior are reviewed
with the consuming frontend in the same change.

## Standard request pipeline

Each route declares one policy: public, user-authenticated, account-scoped, or
service/webhook. Account-scoped routes run the approved sequence:

1. attach request ID and request context;
2. enforce coarse abuse controls and body-size limits;
3. verify JWT and resolve the current person;
4. resolve active account and current membership from canonical storage;
5. enforce named capability;
6. validate request input;
7. authorize the target resource within that account;
8. execute the use case; and
9. map/log the result through the common response/error layer.

This pipeline is composed centrally or through one reviewed helper. Router-wide
middleware must be scoped so it cannot intercept sibling routes after mounting.
Onboarding exceptions, public routes, internal service calls, and webhooks have
explicit alternative stacks; path-string exceptions inside generic middleware
are prohibited.

Roles are inputs to capability resolution, not the route vocabulary. Resource
authorization stays server-side and includes ownership, assignment, enrolment,
visibility, and account scope. A caller must not learn that another account's
record exists; return `404` where disclosure would cross an account boundary.

## Database and provider access

Every account-scoped query derives the account from verified request context,
never request JSON alone. Reads and writes include account scope even when a
preceding lookup appeared to prove it. Cross-account or platform operations use
a separately named, audited service policy.

Multi-write invariants use the transaction/function rules in the database
standard. Check-then-insert is not concurrency control: use a constraint plus
conflict mapping, a transaction, or an atomic function. Do not perform external
network calls while a database transaction holds locks.

Provider clients live behind typed boundaries. Set deadlines; classify provider
failures; retry only safe/idempotent operations; preserve provider identifiers
for reconciliation; and map failures to Kanvise codes without leaking provider
payloads. Webhooks verify authenticity against raw bytes before parsing and use
a durable inbox/idempotency key before side effects.

## Error handling and observability

Use typed application errors for expected domain, authorization, validation,
conflict, and provider failures. A single top-level error handler maps known
errors and turns unknown errors into `INTERNAL_ERROR`. Routes must not repeat
broad `try/catch` blocks merely to return a 500.

Every request receives or generates a request ID and returns it in a response
header and error body. Structured logs contain event name, request ID, route
template, method, status, duration, actor/person ID, account ID, and safe error
classification. Do not log tokens, cookies, raw request bodies, invite/share
tokens, payment details, or sensitive learner data. Unexpected errors are sent
to Sentry once, with the same correlation context.

Public and mutation endpoints receive explicit rate/abuse controls suitable to
their risk. In-memory counters are development or single-process protection
only; security or scale-sensitive limits require shared coordination.

## Contract documentation and verification

Boundary schemas should generate or validate an OpenAPI contract so code and
documentation cannot drift. Until that is implemented, route contract tests are
the executable source and the handwritten API document is historical guidance,
not an exhaustive current endpoint registry.

Each endpoint change tests:

- the declared auth policy and middleware order;
- malformed, oversized, and unknown input;
- capability and account/resource isolation;
- success envelope and status;
- stable error code and safe failure envelope;
- database/provider failure mapping;
- idempotency or concurrency behavior where relevant; and
- compatibility with its current frontend consumer.
