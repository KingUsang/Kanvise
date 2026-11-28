# Kanvise design references

These files are product references, not executable specifications. The written
feature specification and the architecture documents in `docs/` take
precedence whenever a generated flowboard conflicts with implemented security,
data ownership, or backend capability.

- `auth/`: authentication and enrollment behaviour plus its storyboard
- `flows/`: broad product journeys and navigation studies
- `kavi/`: what Kavi (the AI assistant) does, and the brief for the engineer who builds it
- `user-flows/`: end-to-end user flows, state machines, QA test plan and
  proposals for payments and progress, written from the redesign specs
- `dashboard/`: dashboard and timetable composition references
- `landing/`: marketing and waitlist direction
- `email/`: lifecycle-email composition references

Production assets remain under `web/public/`. Do not import these reference
boards into the application bundle.
