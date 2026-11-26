# ADR 0003: Evolve the API contract compatibly

**Status:** Accepted
**Date:** 2026-10-30
**Owner:** Kanvise engineering

## Context

The Hono API has hundreds of route handlers and the frontend already consumes
the documented top-level `{ data, message }` and `{ error, code }` conventions.
The implementation builds most responses and validation by hand, has no shared
runtime schema library, and often returns raw exception messages. Replacing the
envelope wholesale would create a large coordinated migration without fixing
the underlying inconsistency.

## Decision

Retain and complete the compatible top-level envelope. Success responses use
`data` plus optional `message` and `meta`. Errors use a safe string `error`, a
required stable `code`, optional bounded `details`, and correlation
`request_id`. Standardize boundary validation on Zod-compatible schemas and
centralize typed error mapping. Adopt generated/validated OpenAPI incrementally
from those schemas.

## Alternatives considered

- Replace all errors with an RFC 9457 Problem Details body immediately. This is
  a sound standard but would force a broad frontend migration for limited near-
  term value.
- Keep route-local manual checks and catches. This has the lowest immediate
  effort but preserves the drift and unsafe error leakage found in the audit.
- Infer validation from TypeScript types. Types do not exist at runtime and
  cannot make untrusted HTTP input safe.

## Consequences and rollout

New or touched routes use the standard immediately. Shared primitives, typed
errors, request IDs, and a top-level mapper are introduced first; modules then
migrate behind compatibility tests. Old response shapes may remain behind
explicit adapters during expand–contract. A future envelope replacement needs
a separate versioning ADR and consumer migration plan.
