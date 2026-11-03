# ADR 0004: One dashboard server-state model

**Status:** Accepted
**Date:** 2026-10-30
**Owner:** Kanvise engineering

## Context

Dashboard data is currently loaded through server-page fetches, token props,
direct component fetches, `useEffect`, and TanStack Query. Many components also
read/refresh the Supabase session independently. These paths have different
freshness, retry, loading, and error behavior and can duplicate network work.

## Decision

Authenticated dashboard Server Components perform only the verified session
gate and shell composition. Client features load Hono business data through a
single typed API client and TanStack Query. Query keys are account-scoped and
feature-owned; mutations use the query mutation model. Public/SEO pages remain
server-first.

## Alternatives considered

- Fetch all dashboard data in Server Components. This improves initial HTML but
  reintroduces access-token props, mixed caches, and awkward interactive refresh.
- Use direct fetch/effects without a query cache. This minimizes abstraction but
  leaves deduplication, cancellation, retries, invalidation, and state handling
  inconsistent in every screen.
- Proxy all browser calls through Next.js. This adds a second application API
  boundary without solving domain authorization.

## Consequences and rollout

The dashboard has one predictable server-state lifecycle at the cost of a
client-side first fetch. Layout-preserving loaders and appropriate query
freshness mitigate that cost. Existing features migrate incrementally through
the shared client and feature query options; compatibility tests protect each
conversion. Public rendering behavior is unchanged.
