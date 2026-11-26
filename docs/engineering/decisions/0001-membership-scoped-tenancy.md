# ADR 0001: Membership-scoped multi-account tenancy

**Status:** Accepted
**Approved:** 2026-11-04 by the product owner
**Owner:** Kanvise engineering
**Date:** 2026-10-30
**Last verified:** 2026-10-30

## Approval evidence

The product owner's explicit approval for this named tenancy decision was
carried in the Batch D Slice 25 durable brief and recorded by the OpenRig
handoff `qitem-20261104221028-9c475820b2cd2d2a` on 2026-11-04. This evidence
authorizes implementation of ADR 0001 only; it does not infer approval for any
other ADR or for a remote database/deployment operation.

## Context

The original model stores one global role and `school_id` on `user_profiles`
and copies them into JWT metadata. Later work added Learner memberships, but
selecting an account still mutates the global profile and JWT. Kanvise needs
people to participate in multiple tutoring accounts soon, potentially with a
different role in each.

## Decision

One Supabase identity represents one Kanvise person. Access to a tutoring
account is represented by a separate active membership carrying the role for
that account. Every protected API request selects an account context and Hono
verifies the current membership from PostgreSQL before authorization.

JWT metadata is not the source of current membership. A remembered active
account is a client preference, not a security credential. The UI will use an
account switcher; subdomains are not required.

## Alternatives

- Separate Auth accounts per tutoring account: rejected because it fragments a
  person's identity and sessions.
- A single mutable `school_id` in the profile/JWT: rejected because it is stale
  and cannot model concurrent membership.
- Account subdomains as the security boundary: rejected because routing does
  not prove membership and adds deployment complexity.

## Consequences

- A person can be an Admin, Tutor, or Learner in different accounts without
  duplicate Auth identities.
- Removing one membership does not delete the person or their other access.
- Membership removal is effective on the next protected request.
- The current global-role/profile schema and account-selection endpoint require
  a migration designed in the database slice.
- Each request pays for one canonical membership resolution. Optimization is
  deferred until measurement; a future cache may be at most 60 seconds stale
  and must support revocation invalidation.
