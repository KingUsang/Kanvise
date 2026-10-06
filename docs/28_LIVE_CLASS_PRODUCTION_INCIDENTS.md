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
