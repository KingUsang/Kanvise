# Live-class lifecycle redesign

**Status:** implementation contract — staging validation required before production

## Decision

`live_classes` remains the single durable record for one scheduled Kanvise live
class and its one PlugNmeet room identifier. We are **not** adding a second
sessions table. A separate table would only be useful if Kanvise deliberately
allowed several independent deliveries of the same scheduled lesson; that is
not a current product behaviour.

PlugNmeet rooms are temporary. The Kanvise record is the durable schedule and
audit record; PlugNmeet is the authority on whether the temporary room is
currently reachable. A browser click is never evidence that a class started.

## States

The existing `status` field is expanded so the product never calls a prepared
or uncertain room “live”.

| State | Meaning | User-facing treatment |
| --- | --- | --- |
| `scheduled` | No active room attempt. | Can edit, cancel, or start. |
| `starting` | Kanvise has claimed the start request and is creating/recovering the room. | Starting classroom; do not create another room. |
| `ready` | PlugNmeet room/token path is prepared but Kanvise has not received proof that anyone joined. | Tutor can enter; learners wait for the tutor. |
| `live` | PlugNmeet reported `room_started` or a participant joined. | In progress; learners can join. |
| `ending` | Tutor asked to end; provider confirmation is pending. | Ending classroom; re-entry is blocked. |
| `completed` | PlugNmeet reported room finished, or reconciliation proved the live/ending room is inactive. | Ended. |
| `interrupted` | The maximum class window elapsed and Kanvise cannot verify a provider state. | Ended with an operational warning, never shown as live. |
| `cancelled` | Cancelled before a room attempt. | Cancelled. |

`started_at` is written only by a provider event (`room_started` or first
participant join), never by the Start button. `ended_at` is written only after
`room_finished` or a successful inactive-room reconciliation.

## Commands and idempotency

1. Start atomically changes `scheduled → starting`. Only the caller that wins
   that compare-and-set may call PlugNmeet `createRoom`.
2. A successful create changes `starting → ready`; returning a join token is
   then safe to retry without creating another room.
3. Any concurrent Start request sees `starting`, `ready`, or `live` and
   resumes the same room instead of issuing another creation command.
4. End changes `ready/live → ending`, calls PlugNmeet idempotently, and waits
   for provider evidence before completing the record. An end retry remains
   safe.

This prevents a lost browser response, refresh, or double-click from making a
new session or falsely declaring the class started.

## Provider evidence and recovery

- Webhooks are durably inserted before processing and are idempotent by
  provider event ID.
- `room_started` and `participant_joined` promote a prepared class to `live`.
- `room_finished` completes `ready`, `live`, or `ending` classes and closes
  any open attendance records.
- A five-minute reconciler checks `ready`, `live`, and `ending` room IDs using
  PlugNmeet's authenticated `isRoomActive` API. It can prove an inactive
  provider room ended, but it must not call a merely-created empty room live.
- If provider checks fail, the row records `provider_room_status=unavailable`.
  After the scheduled duration plus a bounded grace period, an unverified
  class becomes `interrupted`, not a permanently false `live` class.

The room creation request contains the room-level webhook URL and the server
has global/per-meeting webhook delivery enabled. This provides prompt evidence;
the reconciler is recovery only.

## VM lifecycle

The classroom VM is warm only for classes scheduled in the next ten minutes.
It may deallocate only after lifecycle reconciliation has run and there are no
`starting`, `ready`, `live`, or `ending` rooms, no recently ended processing
work, and no scheduled class in that future window. Historic scheduled rows
must never keep the VM running.

An `interrupted` historical record is not treated as an active classroom. It
has already exceeded the maximum allowed class duration and will not block
cost control.

## Whiteboard boundary

This redesign prevents Kanvise from accidentally replacing an active provider
room. It does not make PlugNmeet's native freehand whiteboard durable after a
room is finished/recreated. A separate product decision is required for
durable board history: either Kanvise-owned snapshots/storage or a persisted
Kanvise board. Existing presentation/PDF annotations remain separately stored.

## Rollout checks

1. Apply the migration to staging.
2. Start, refresh, double-start, join, disconnect/rejoin, end, and provider
   room timeout tests must pass with redacted webhook fixtures.
3. Verify one real staging webhook reaches the inbox and drives the state.
4. Verify the idle VM controller deallocates after a completed class and does
   not deallocate an active one.
5. Only then deploy the migration and code to production.
