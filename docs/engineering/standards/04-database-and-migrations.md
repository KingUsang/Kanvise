# Database and migrations

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard governs PostgreSQL schema design, Supabase access, migrations,
database functions, generated types, data changes, and safe rollout.

## Source of truth and workflow

Kanvise uses append-only imperative SQL migrations in `supabase/migrations/`.
The ordered migration history is the schema source of truth. Existing applied
migrations are never edited, deleted, renamed, reordered, or repurposed; every
correction is a new forward migration.

Create migrations with the installed Supabase CLI after checking its `--help`.
Filenames use a unique UTC 14-digit timestamp and a descriptive lowercase
snake-case name. One migration represents one coherent change.

Schema changes made in Studio, the SQL editor, `psql`, or application startup
are prohibited outside an incident. An emergency remote change must be
captured immediately in a forward migration, reconciled with migration
history, documented, and verified across environments. Remote migration or
history changes always require explicit authorization.

## Schema design

- Use UUID primary keys for domain records unless a measured access pattern
  justifies another type.
- Use `timestamptz` in UTC for instants, `date` for calendar dates, and `time`
  only for timezone-independent wall-clock schedules.
- Use `text` plus a database `CHECK` for small evolving state sets; use a
  PostgreSQL enum only when its migration cost is justified.
- Use exact `numeric` or integer minor units for money, never floating point.
  A bounded payment flow must use one representation consistently and name any
  conversion at its provider boundary.
- Stable invariants belong in `NOT NULL`, `CHECK`, `UNIQUE`, and foreign-key
  constraints. API validation remains for useful errors, not as the only
  protection against invalid durable state.
- Every foreign-key column and frequent filter/join path is evaluated for an
  index. Composite indexes follow real query order: equality columns first,
  range/order columns later. Partial indexes match stable predicates.
- Indexes have a measured query or integrity purpose; duplicate and unused
  indexes are removed through reviewed migrations.

## Tenant integrity and membership

The database must implement the approved person → tutoring-account membership
model. A person is global; role, status, and account access belong to a unique
membership. Resources remain account-scoped.

Every account-scoped table carries the account identifier (`school_id` is the
legacy name). Relationships between account-scoped records must prevent
cross-account references, preferably with composite uniqueness and composite
foreign keys such as `(account_id, id)`. A plain foreign key to `id` plus a
separate account column is insufficient when mismatched tenants can be stored.

One-to-one Class capacity remains an API transaction rule under the product
standard until evidence justifies a more complex database invariant. Other
stable relationship and state invariants should be enforced in PostgreSQL.

## Transactions and concurrency

Multi-table state changes that must succeed together use a short database
transaction or reviewed database function. External network calls never occur
while database locks are held. Lock rows in a consistent order and prefer
conditional single-statement transitions with `RETURNING`.

Operations exposed to retries—payments, invitations, webhooks, publishing,
imports, and jobs—must be idempotent through unique keys, conditional state
transitions, inbox/outbox records, or equivalent durable controls.

Use row locks for record state and advisory locks only for named coordination
that has no natural row. Locks are bounded and released automatically where
possible. Long backfills are batched and resumable.

## Functions, triggers, views, and privileges

Database functions default to `SECURITY INVOKER`. `SECURITY DEFINER` requires
a documented privilege need, an empty fixed `search_path`, fully qualified
object names, least-privilege ownership, and explicit revocation from
`PUBLIC`, `anon`, and `authenticated`. Grant execution only to the required
server role. Trigger functions follow the same hardening even when not called
directly.

Views in an exposed schema use `security_invoker = true` or have all browser
access revoked. Materialized views and functions are treated as API surfaces,
not harmless implementation details.

All tables in an exposed schema have RLS enabled. Because Hono currently uses
`service_role`, RLS is defense in depth rather than Kanvise's primary tenant
boundary. `anon` and `authenticated` receive no application-table, sequence,
or function access unless a reviewed feature explicitly requires it. Public
browser access normally goes through Hono.

## Safe migration rollout

Migrations roll forward. A deployed change is reversed by a new migration,
not by rewriting history.

Use expand–migrate–contract for incompatible changes:

1. Add compatible nullable columns, tables, functions, or indexes.
2. Deploy code that can read/write both representations when necessary.
3. Backfill in bounded, observable batches.
4. Add and validate constraints safely.
5. Switch all readers and writers.
6. Remove the legacy shape in a later reviewed release.

Destructive operations, large rewrites, blocking constraints, and indexes on
large tables require an explicit lock/runtime assessment, backup/restore plan,
and staged evidence. Migration SQL must not perform uncontrolled external
calls or depend on environment-specific application data.

## Seed and data changes

Development/test fixtures live outside production schema migrations and use
obviously synthetic identities. Production migrations may contain narrowly
scoped deterministic backfills required by the schema change, but not demo
accounts, fake payment details, or sample product content.

Data corrections are idempotent, tenant-scoped, auditable, and include a
verification query. Cleanup scripts require explicit environment guards and
must refuse production unless production execution is the reviewed intent.

## Types and verification

`api/src/lib/database.types.ts` is generated from a local database rebuilt
from the repository migrations, not whichever remote project happens to be
linked. Generated output is committed. CI regenerates it and fails on drift;
new code must not use `as any` to hide missing schema types.

Every database change must pass:

- unique migration filename checks;
- a clean local database rebuild from migration zero;
- database integrity/security tests, including cross-account rejection;
- Supabase security and performance advisors with findings reviewed;
- generated-type drift detection; and
- application tests/builds that consume the changed contract.

Database tests cover constraints, functions, privileges, RLS/grants, replay
behavior, and representative tenant isolation. A dry-run migration plan is
required before remote application, followed by migration-history and schema
verification.
