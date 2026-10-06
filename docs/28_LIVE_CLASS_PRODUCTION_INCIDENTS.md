# Live-class production incidents

## 2026-10-06 — Calendar cannot load live classes in production

**Impact:** The Schedule calendar receives `500` from `GET /live-classes` in
production. The UI displays the API's raw `Failed to fetch classes` message.
That is not acceptable user-facing copy: users must receive a clear recovery
message and never an internal or generic transport error such as `Failed to
fetch`.

**Confirmed cause:** Production is missing
`class_timetable_slots.recurrence_group_id`. The API query requests that
column through the live-class series relation, and Postgres returns `42703`.

**Why staging is unaffected:** Staging successfully applied
`20261001000001_consolidate_live_class_schedule.sql` on 2026-09-30. Production
contains API code that expects the migration but did not apply the migration.
The current deployment workflow only invokes `supabase db push --include-all`
when the triggering commit changes `supabase/migrations/**`; later API-only
deployments therefore cannot repair the already-missing migration.

**Broader migration risk:** The last confirmed production migration deployment
was 2026-09-23. The following later migration files must be treated as pending
until their production history is explicitly reviewed: PlugNmeet-only
classrooms, recorder readiness, independent tutors/direct assignments, live
class schedule consolidation, mock import jobs, direct-link/guest mock subject
selection, video learning materials, landing analytics, and teaching mode.

**Related configuration finding:** Production allows CORS requests from
`https://www.kanvise.com`, but rejects `https://kanvise.com`. Root-domain
visitors can therefore encounter browser request failures even when the API is
healthy. Add the canonical root origin to the production API CORS allow-list
and restart the API only after its intended canonical domain is confirmed.

**PlugNmeet finding:** Both environments use the same PlugNmeet host and all
live classes select PlugNmeet unconditionally; the pilot-school list and
enrolment/guest feature flags are currently not used to select a provider.
Production health checks return HTTP 200, but it lacks automatic classroom-VM
wake configuration and repeatedly logs NATS room-status failures during room
lifecycle reconciliation. Staging has automatic wake enabled but lacks the
dedicated webhook secret. These are separate live-class reliability issues and
do not cause the calendar's SQL error.

**Required remediation:**

1. Apply the pending migration to the production Supabase project using the
   repository's migration workflow, after the production migration plan is
   reviewed and approved.
2. Replace the calendar's raw API-error rendering with contextual recovery
   copy (for example, “We could not load live classes. Please try again.”).
3. Add a regression test for a failed live-classes request and a deployment
   check that flags schema migrations pending on production.

**Evidence:** Production API log entries on 2026-10-06 report
`column class_timetable_slots_1.recurrence_group_id does not exist`; staging's
migration workflow for the same migration completed successfully on
2026-09-30.
