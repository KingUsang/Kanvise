# Integrations, storage, and asynchronous work

**Status:** Current
**Owner:** Kanvise engineering
**Approved:** 2026-10-30

This standard governs external providers, webhooks, Cloudflare R2, email/push/
notification delivery, payments, media providers, schedulers, and background
work. Telegram is retired and must not be extended.

## Provider boundaries

Every provider has one typed server-side adapter. Feature code depends on a
Kanvise capability interface, not provider HTTP payloads, environment variables,
or SDK objects. Provider names may appear inside the adapter and operational
telemetry; the durable domain stores provider-neutral state plus identifiers
needed for reconciliation.

Configuration is validated at process startup according to enabled features.
Secrets are read through the configuration boundary, never exposed to the
browser, logged, returned in errors, committed, or silently defaulted in
production. Development, staging, and production use separate credentials and
resources unless an explicit time-bounded exception is recorded.

Every network call has:

- a documented deadline and cancellation signal;
- a bounded request/response size;
- safe error classification and redacted logging;
- metrics for latency, outcome, timeout, and rate limiting;
- an idempotency/reconciliation strategy; and
- a deliberate retry policy.

Retry only transient failures and only when the operation is safe or protected
by an idempotency key. Use bounded exponential backoff with jitter and honor
provider retry guidance. Validation, authentication, authorization, and most
not-found failures are not retried. A request path must not perform an unbounded
retry loop or wait indefinitely for a provider.

Provider availability never changes Kanvise's authorization rules. The database
records the intended and confirmed state separately where a remote side effect
can succeed while the response is lost. Reconciliation uses provider references
rather than assuming a timeout means failure.

## Payments and high-consequence effects

Kanvise treats Paystack as payment-event evidence and PostgreSQL as the durable
record of access granted. Amount, currency, reference, account, product, and
provider success are verified server-side before one atomic/idempotent grant.
Client callbacks are never proof of payment.

Webhook delivery, browser return verification, and manual reconciliation may all
observe the same transaction, so they converge through one idempotent use case.
Receipts and notifications may retry independently and must not undo confirmed
payment/access. Store enough provider identifiers and safe event metadata to
audit and reconcile without retaining unnecessary payment data.

Other high-consequence effects—account invites, class access, publication,
recording finalization, and enrolment—follow the same converge-once model.

## Webhooks and service ingress

Webhook endpoints read bounded raw bytes, verify the provider signature/secret
with constant-time comparison where applicable, enforce timestamp/replay rules
when supported, then parse and validate the event. Never log the raw signed body
unless explicitly redacted.

Every effect-bearing webhook is inserted into a durable inbox with a provider
event ID or deterministic deduplication key before acknowledgement. Duplicate
delivery returns success without repeating effects. A worker claims the inbox
row, runs idempotent processing, records attempts/errors/completion, and moves
poison events to a reviewable terminal state after bounded retries.

If a provider requires synchronous acknowledgement, acknowledge immediately
after durable insertion—not before persistence and not after completing a long
workflow. An ingress proxy such as Next.js may verify and forward only when the
architecture requires it; Hono still owns the idempotent business use case.
Internal service endpoints use rotated scoped credentials or request signatures,
not one unscoped shared secret indefinitely.

## Durable jobs and scheduling

Kanvise's approved default for durable background work is PostgreSQL-backed job,
inbox, and transactional-outbox records. A scheduler/worker claims leased
bounded batches, retries with backoff, records terminal failures, and runs
idempotent handlers. The design supports multiple workers, but only one worker
is enabled initially until concurrency is verified. Reassess a dedicated queue
when contention, throughput, delay precision, payload volume, or independent
worker scaling exceeds the documented triggers; a replacement requires a new
ADR and an outbox-compatible migration.

The approval does not make an in-memory scheduler durable or authorize an
implementation by itself. Until the durable implementation is deployed and
verified, existing `node-cron` paths remain subject to their current recovery
limits and must not imply survival across process loss.

A job record contains at least type, stable idempotency key, account/resource
scope, schema-versioned payload, status, priority where needed, available time,
attempt count, maximum attempts, lease owner/expiry, last safe error, created/
started/completed timestamps, and correlation ID. Payloads contain identifiers,
not entire stale domain snapshots or secrets.

Workers claim bounded batches atomically with a lease or queue-native equivalent,
process outside the claim transaction, heartbeat long work, and
complete/fail conditionally on lease ownership. Expired leases are recoverable.
Retries use bounded backoff/jitter; terminal failures enter a dead-letter/review
state and alert according to impact. Replaying or cancelling a job is an audited
operator action.

Use a transactional outbox when a database commit must cause a notification,
provider call, or job. Creating the domain state and outbox row occurs in the
same transaction; delivery is at-least-once, therefore consumers are idempotent.
Exactly-once external delivery is not assumed.

One scheduler/worker process is the initial deployment. Durable claiming makes a
future second worker safe, but horizontal rollout happens only after concurrency,
provider quotas, and database load are tested.

## Notifications

In-app, email, and web push are independent delivery channels behind
one notification intent. The durable intent records event type, account,
recipient, related entity, template/version, and idempotency key. Each channel
has its own attempt/delivery state so one failure does not duplicate successful
channels or roll back the underlying product action.

Recipient resolution is canonical and account-scoped at send time. Respect user
preferences, mandatory/security classifications, quiet-hour policy when adopted,
provider suppression/unsubscribe state, and data minimization. Templates are
versioned/tested; links use safe canonical frontend URLs. Bulk sends are batched
and rate-aware and never block a request for the entire recipient list.

## Storage ownership and upload lifecycle

Use separate private and public R2 buckets per environment. Private files never
have a public domain; public media is served through the configured CDN domain.
Credentials are least-privilege and environment-specific. Object keys use opaque
IDs and verified account/entity context, not user filenames or untrusted path
fragments.

The upload lifecycle is:

1. Hono authorizes account, capability, target resource, allowed content type,
   maximum size, and quota; it creates a short-lived single-purpose upload
   intent and presigned URL.
2. The browser uploads directly to R2.
3. Hono confirms the object using the intent, verifies key/bucket, actual size,
   metadata, extension/MIME/signature, checksum where needed, and target state.
4. Untrusted supported documents are quarantined/scanned according to risk before
   becoming downloadable; active metadata is committed only after required
   checks pass.
5. Replacement commits the new reference before scheduling old-object deletion.

Presigned URLs are short-lived, method-specific, and never treated as durable
application URLs. Private downloads are authorized at request time and return a
short-lived URL; API responses avoid exposing internal keys unless a trusted
client contract genuinely requires them.

Database metadata and object storage cannot transact together. Therefore upload
intents and object lifecycle states make partial outcomes observable. A durable
cleanup job removes expired unconfirmed uploads, failed conversions, replaced/
deleted objects after a safety delay, and verified orphans. Cleanup supports dry
run, bounded batches, tenant/environment guards, metrics, and an audit trail.
Retention and legal/product deletion requirements are explicit per object type.

## Media and long processing

PDF conversion, recording transfer, transcription, summaries, imports, and
similar work run as durable jobs. Requests return `202` with a durable resource/
job status when work cannot complete safely within the request deadline. Clients
poll with backoff or use a supported event channel and can distinguish queued,
running, ready, failed/retryable, and terminal states.

Workers enforce input/output limits, CPU/memory/time bounds, safe temporary-file
handling, and cleanup in success and failure paths. Generated artifacts are
staged, verified, then atomically referenced; partial sets never become ready.
Provider-specific live-room facts remain ephemeral, while scheduled Session,
attendance evidence, recordings, and recap state remain durable in Kanvise.

## Verification

Each integration has adapter contract tests and failure tests for timeout,
rate-limit, malformed response, unavailable provider, ambiguous success, retry,
and redaction. Webhook tests prove signature failure, duplicate delivery,
durable acknowledgement, replay, poison event, and eventual success.

Job tests prove atomic claim, lease expiry, two-worker contention, backoff,
idempotent replay, shutdown, and dead-letter behavior. Storage tests cover wrong
account/context, misleading MIME/extension/signature, oversize, expiry, partial
upload, failed registration, replacement, private denial, and cleanup. Staging
uses disposable provider resources with `finally` cleanup and never production
credentials.
