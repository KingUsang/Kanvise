# Document authority map

**Status:** Current
**Owner:** Kanvise engineering
**Last verified:** 2026-11-26

This map prevents filename age or an old `Approved` label from outranking the
engineering standards. It classifies document families without rewriting or
deleting historical evidence.

| Document/family | Classification | Use |
|---|---|---|
| `docs/engineering/standards/*` | Current authority | Cross-cutting engineering rules |
| `docs/engineering/decisions/*` where ADR status is `Accepted` | Current authority | Accepted architectural decisions and tradeoffs |
| `docs/engineering/decisions/*` where ADR status is `Proposed` or `Rejected` | Non-authoritative | Pending or rejected decisions and evidence only; do not use for new behavior |
| `docs/engineering/DECISION_LEDGER.md` | Current authority | Approval state and decision index |
| `docs/engineering/AUDIT_COVERAGE.md`, `docs/engineering/CODE_AUDIT_LEDGER.md` | Current audit evidence | Audit scope and findings only; not authority for new behavior. The ledger cites documents by their pre-move paths; see the move map below |
| `docs/engineering/EXECUTION_SLICES.md` | Proposed execution breakdown | Planning evidence only; does not approve product or architecture changes |
| `docs/engineering/ADOPTION_PLAN.md` | Current execution order | Standards-conformance sequencing |
| `docs/engineering/README.md`, `docs/engineering/DOCUMENT_AUTHORITY.md` | Current | Index and this map |
| `docs/deviations.md` | Current evidence register | Known conflicts and carried-over tracker items; does not authorize implementation |
| `docs/runbooks/*` | Current only when individually marked Current and verified | Operational response, not architecture/product policy |
| `docs/operations/email-setup.md`, `email-notification-deployment-checklist.md`, `cloudflare-r2-public-setup.md`, `pwa-and-web-push-deployment.md`, `oracle-api-deployment.md` | Current setup and deployment guides | Each carries a "Last verified" date. Facts about hosted accounts or environments that the repository cannot show are marked unverified in the file |
| `docs/operations/plugnmeet-integration-reference.md`, `docs/operations/plugnmeet-enrolled-pilot.md` | Reference | Verify the current provider contract and configuration before use; the reference lists what was checked against code |
| `docs/operations/livekit-on-demand-worker.md`, `docs/operations/scaleway-exit-plan.md` | Historical | Retired LiveKit and Scaleway topology; do not extend current PlugNMeet or Oracle behavior from them (DEV-REL-009) |
| `docs/design/*` | Product reference | Generated flowboards and images; implemented security, data ownership and the standards take precedence |
| `docs/archive/*` | Archived (superseded or historical) | Never authority. Each file starts with a "Superseded by", "Archived tracker" or "Archived. Historical" header. Holds the former `01_*` to `09_*` architecture set (including duplicates and root copies), the folded trackers `10_*`, `12_*`, `14_*`, `16_*`, `25_*`, `26_*`, `27_*`, `28_*`, `29_*`, `30_*`, the superseded plans `15_*`, `17_*`, `18_*`, the LiveKit-era `kanvise-live-class-architecture-v3.md` and `plugnmeet-phase-0-validation-plan.md`, the root product documents (`JOINKANVISE.md`, `THE KANVISE EXPERIENCE.md`, `kanvise_class_model_context.md`, the product email library specification) and the root copies of the privacy policy and terms |
| `supabase/templates/*.html` | Reference artifact | Supabase Auth email templates; unused while the Send Email hook is enabled (see email setup) |
| `web/public/privacy-policy.md`, `web/public/terms-of-service.md` | Published text, pending legal review | The only copies the site serves (DEV-DOC-002) |
| `*:Zone.Identifier` | Repository artifact | Never authority; remove through scoped repository cleanup |

## Move map

Documents moved by the documentation canonical-set clean-up. Older audit text and
register rows may still cite the old paths.

| Former path | Now |
|---|---|
| `docs/10_KANVISE_Email_Service_Setup.md` | `docs/operations/email-setup.md` |
| `docs/11_EMAIL_NOTIFICATION_DEPLOYMENT_CHECKLIST.md` | `docs/operations/email-notification-deployment-checklist.md` |
| `docs/13_CLOUDFLARE_PUBLIC_R2_SETUP.md` | `docs/operations/cloudflare-r2-public-setup.md` |
| `docs/21_PWA_AND_WEB_PUSH_DEPLOYMENT.md` | `docs/operations/pwa-and-web-push-deployment.md` |
| `docs/plugnmeet-integration-reference.md` | `docs/operations/plugnmeet-integration-reference.md` |
| `docs/supabase-confirm-signup-template.html` | `supabase/templates/confirm-signup.html` |
| `docs/10_EMAIL_IMPLEMENTATION_PROGRESS.md`, `12_*`, `15_*`, `17_*`, `18_*`, `25_*`, `29_*`, `30_*`, `kanvise-live-class-architecture-v3.md`, `plugnmeet-phase-0-validation-plan.md` | Same file name under `docs/archive/` |
| Root `JOINKANVISE.md`, `THE KANVISE EXPERIENCE.md`, `kanvise_class_model_context.md`, `KANVISE -Product Email Library & Design Specification.md`, `privacy-policy.md`, `terms-of-service.md` | Same file name under `docs/archive/` |

`docs/` now contains only `deviations.md`, `engineering/`, `runbooks/`, `operations/`, `design/` and `archive/`.

Archived documents may contain still-valid feature details. Before treating one as
a current feature contract, give it an explicit status/owner/verification date,
align terminology and dependencies with the standards, link it here, and record
or resolve every conflict. Until then, implementation and migrations are
evidence, not permission to reproduce a deviation.
