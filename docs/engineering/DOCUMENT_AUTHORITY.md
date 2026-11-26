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
| `docs/engineering/AUDIT_COVERAGE.md`, `docs/engineering/CODE_AUDIT_LEDGER.md` | Current audit evidence | Audit scope and findings only; not authority for new behavior |
| `docs/engineering/EXECUTION_SLICES.md` | Proposed execution breakdown | Planning evidence only; does not approve product or architecture changes |
| `docs/deviations.md` | Current evidence register | Known conflicts; does not authorize implementation |
| `docs/engineering/ADOPTION_PLAN.md` | Current execution order | Standards-conformance sequencing |
| `docs/runbooks/*` | Current only when individually marked Current and verified | Operational response, not architecture/product policy |
| `docs/archive/*` | Archived (superseded or historical) | Moved here by the repository documentation clean-up. Never authority. Each file starts with a "Superseded by" or "Archived tracker" header. Holds former `01_*` to `09_*` (including duplicate variants), the former root copies (`Api spec.md`, `System Architecture Overview.md`, `Technical Stack Decision.md`, `Multi Tenanacy Arvhitecture.md`, `Authentication And authorizations.md`) and the folded trackers `14_*`, `16_*`, `26_*`, `27_*`, `28_*` |
| `17_*` | Superseded for cross-cutting authority | Historical intent and feature discovery only; verify against standards/code/migrations |
| `docs/archive/07_KANVISE_LiveKit_Integration_Contract.md`, `kanvise-live-class-architecture-v3.md`, `docs/operations/livekit-*` | Historical | Retired LiveKit-era evidence; do not extend current PlugNMeet behavior from it |
| `plugnmeet-integration-reference.md`, `plugnmeet-phase-0-validation-plan.md`, `docs/operations/plugnmeet-enrolled-pilot.md` | Reference/audit evidence | Verify current provider contract and configuration before use |
| `10_*`, `11_*`, `12_*`, `13_*`, `19_*`, `21_*`, `25_*`, `29_*`, `30_*`, `31_*`, `32_*`, `33_*`, `34_*` | Progress, audit, incident, plan, or test evidence | Useful inputs; not standing architecture or conventions |
| `15_*`, `18_*` and other Mock-named plans | Historical/superseded terminology | Mine behavior only after translating to the Quiz domain |
| `*:Zone.Identifier` | Repository artifact | Never authority; remove through scoped repository cleanup |

The numbered documents may contain still-valid feature details. Before treating
one as a current feature contract, give it an explicit status/owner/verification
date, align terminology and dependencies with the standards, link it here, and
record or resolve every conflict. Until then, implementation and migrations are
evidence—not permission to reproduce a deviation.
