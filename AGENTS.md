# Kanvise engineering rule

Before proposing or changing product behaviour, routes, dashboard UI, database
schema, authentication, tenancy, or deployment, read the relevant architectural
documents in `docs/` first. Treat them as the source of truth over assumptions
or generic framework conventions.

At a minimum, consult:

- `docs/02_KANVISE_System_Architecture_Overview.md` for system boundaries and
  data ownership.
- `docs/01_KANVISE_Technical_Stack_Decision.md` for rendering and client-data
  conventions.
- The feature-specific document in `docs/` before changing an established
  workflow.

When the implementation and the documents conflict, identify the conflict
explicitly before extending the implementation. Do not make remote database or
deployment changes based on an assumption.
