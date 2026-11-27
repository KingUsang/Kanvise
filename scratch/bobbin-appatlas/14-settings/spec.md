# Settings and billing

Routes: `/settings/*`, including Billing.

Settings navigation covers lesson, email, safeguarding, AI-content style, general, billing, activity log, API, webhooks, Studybugs, data export, and beta areas. Every route now has loaded-state evidence, including populated audit history and empty integration states.

Lesson policies cover report approvals, recording notice/retention/viewers, recording-consent defaults, tutor visibility, classroom entry, completed-report access, and generated-insight selection/order. Settings search and Jump-to navigation were exercised. AI style comparison shows Detailed, Structured, and Concise examples side by side. General timezone options, activity filters, API-key creation, webhook endpoint creation, beta feedback, Studybugs credentials, and GDPR export forms were opened without submitting secrets or external actions.

The API page separately governs the OAuth MCP server, tutor-assistant write access, connected assistants, and REST API keys. The create-key dialog makes write scope immutable after creation; no key was generated. Data export was not submitted because it would enqueue and email a real personal-data export.

## Billing

Billing presents trial status and hours, regional currency, optional promotion code, Starter/Plus/Pro/Enterprise plans, and usage. Selecting a paid plan redirects to Stripe Checkout. The Stripe page was reached but no payment data was entered or checkout completed.
