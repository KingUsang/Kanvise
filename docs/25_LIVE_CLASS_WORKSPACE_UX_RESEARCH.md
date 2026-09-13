# Kanvise Live Class Workspace: Code Audit and UX Recommendation

**Status:** Research and implementation brief
**Date:** 10 September 2026
**Scope:** Whiteboard/presentation switching, realtime state, reconnection, and weak-network UX. This document does not implement changes.

## Executive decision

Whiteboard and Presentation should be two reversible views of one persistent lesson workspace. Selecting either view must preserve the other view exactly. It must not close a presentation, discard an active material, recreate a blank board, or make the tutor depend on another connected browser for recovery.

The current behavior is not an isolated rendering bug. Three design choices combine to produce it:

1. `PresentationStage` conditionally renders either the Excalidraw board or the PDF stage, so changing modes unmounts one workspace and mounts the other.
2. The Whiteboard control calls `closePresentation()`. The API then clears `is_active` from every PDF, so “go to whiteboard” is modeled as a destructive close rather than a reversible view change.
3. The blank whiteboard has no durable store. It broadcasts the complete scene at most every 50 ms using lossy LiveKit packets and asks the tutor currently in the room for a scene when it mounts.

The correct design is a durable server snapshot plus small realtime changes. LiveKit should make updates feel immediate; the Kanvise API/database should make them recoverable. Pointer/laser movement may be lossy. Completed drawing operations, mode changes, and recovery messages must not rely on lossy delivery.

## What the code actually does

### Switching to Whiteboard is currently “close presentation”

The top Whiteboard button invokes `closePresentation()` when the class is in presentation mode (`web/src/components/classroom/PresentationControls.tsx`, lines 7–12). The same operation is used by the red **Close presentation** button on the PDF stage (`PresentationStage.tsx`, line 287).

`closePresentation()`:

- calls `POST /presentations/close`;
- changes the client mode to `whiteboard`;
- marks every client-side material inactive; and
- broadcasts `PRESENTATION_CLOSE` reliably.

The API mirrors that destructive meaning: it sets `is_active = false` on every class presentation and then sets `live_classes.teaching_mode = 'whiteboard'` (`api/src/routes/slides.ts`, lines 323–329).

**Finding:** The UI visually presents a mode switch, but the underlying command is a close/deactivation command. This mismatch explains why returning to the PDF does not simply resume where the tutor left it.

### The two workspaces are mounted as alternatives

`PresentationStage` returns `<CollaborativeWhiteboard />` whenever the mode is whiteboard. Otherwise it returns a separate PDF stage (`web/src/components/classroom/PresentationStage.tsx`, lines 245–304). React therefore unmounts Excalidraw on entry to Presentation and creates a new Excalidraw instance on return.

The Excalidraw API, current slide reference, remote-update guard, and scene-request flag all live inside `CollaborativeWhiteboard`. There is no `initialData` prop and no parent-owned scene supplied at remount. Excalidraw officially exposes `initialData` for restoring a scene and `onChange` for tracking its elements, app state, and files; Kanvise only uses `onChange`. [Excalidraw component types](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts)

**Finding:** Blank-board drawings are held only inside the mounted component and remote participants. Unmounting removes the only local copy.

### Whiteboard recovery depends on a currently connected tutor

On mount, each board sends one reliable `REQUEST_SCENE`. A host who receives it replies with the current in-memory scene. There is no API read and no database column/table for a whiteboard document. The presentation migration stores PDF page and annotations, but nothing equivalent for the blank board (`supabase/migrations/20260901002332_add_live_class_presentations.sql`).

This creates several deterministic failure cases:

- The tutor switches Whiteboard → Presentation → Whiteboard: the new tutor board asks for state, but the old tutor board that held it has already unmounted.
- The tutor reloads or reconnects after the LiveKit session is exhausted: no durable board exists to restore.
- A student joins while the host is briefly disconnected: nobody can provide the board.
- The request or response occurs while a participant is disconnected: LiveKit does not buffer data packets for later delivery.

**Finding:** `REQUEST_SCENE` is useful as a fast peer recovery optimization, but it cannot be the source of truth.

### The whiteboard uses the wrong payload and reliability combination

Every Excalidraw change causes Kanvise, at most every 50 ms, to serialize **all non-slide elements** and publish the complete JSON scene with `{ reliable: false }` (`CollaborativeWhiteboard.tsx`, lines 231–254).

LiveKit currently documents:

- Reliable packets are ordered and retransmitted, but are still best-effort: a disconnected receiver misses them because packets are not buffered on the server.
- Reliable user payloads should be no larger than 15 KiB.
- Lossy packets should be about 1,300 bytes or smaller. Larger messages are fragmented; losing one fragment loses the entire message.

[LiveKit data packet documentation](https://docs.livekit.io/transport/data/packets/)

Even a small freehand Excalidraw scene can exceed 1,300 bytes. As the lesson continues, every new full-scene transmission becomes larger and more fragile. On a weak connection, a student may receive an older full scene, miss newer ones, and have no revision check that detects the gap.

**Finding:** LiveKit itself is not simply “unreliable.” Kanvise explicitly selected lossy delivery for an ever-growing, authoritative full-scene payload. That specific use is unreliable by design.

### PDF progress is partly durable, but continuity is still broken

PDF `current_page` and per-page completed annotation strokes are persisted by API PATCH requests. Their realtime events are also sent with reliable packets. The existing route test confirms that an API reload returns a stored page and annotations (`api/src/routes/slides.test.ts`, lines 129–141).

However:

- switching to Whiteboard clears the active PDF selection;
- returning requires selecting a material again;
- zoom is component-local and resets to 100% when the active material changes;
- scroll position is component-local and disappears on unmount;
- a stroke in progress is not committed until pointer-up;
- the UI has no visible Saving/Saved/Offline state.

**Finding:** Stored PDF annotations should survive reactivation, so their deletion is not supported by the intended persistence code. If completed annotations disappear after explicitly selecting the same PDF again, that is a separate bug or failed request that needs a reproduction trace. The broader “I lost my place/progress” complaint is nonetheless explained by active selection, zoom, scroll, in-progress ink, and blank-board state being discarded or hidden.

### Reconnection exists, but the classroom does not explain or fully recover from it

The installed LiveKit client has automatic retry delays ranging from immediate retries through repeated delays of roughly seven seconds. LiveKit documents resume/ICE restart and, when required, a full reconnect sequence with `Reconnecting` and `Reconnected` events. It recommends exposing reconnection state; connection quality can signal a lost peer connection earlier. [LiveKit connection and reconnection](https://docs.livekit.io/intro/basics/connect/)

Kanvise reloads PDF session state when the LiveKit connection becomes connected, which is good. But it does not show a classroom-level reconnecting banner or connection-quality warning. `ClientClassroom` navigates to the dashboard on final `onDisconnected` regardless of whether the tutor ended the class, the student intentionally left, or retries were exhausted.

The service worker is intentionally push-only and has no fetch cache. The blank board has no IndexedDB outbox. Therefore local drawing work is not protected across prolonged connection loss, refresh, or browser closure.

## Best UX for Kanvise

### Tutor controls

Use one compact segmented control:

`Whiteboard | Presentation`

- Selecting a segment switches the shared stage immediately.
- Returning to Whiteboard restores its exact elements and tutor viewport.
- Returning to Presentation restores the last selected PDF, shared page, and annotations. It may restore the tutor’s local zoom/scroll without forcing that viewport on students.
- Keep **End presentation** or **Remove material** as explicit menu actions. They must not be aliases for selecting Whiteboard.
- If no PDF has ever been selected, Presentation opens the materials drawer. If one was previously selected, it resumes that PDF; the drawer remains a separate **Materials** action.

This matches the mental model already implied by the current segmented UI. It also follows established collaboration UX: Miro supports moving from slides to the board and back, while Microsoft’s meeting whiteboards close without being deleted and can be reopened later. [Miro interactive presentation mode](https://help.miro.com/hc/en-us/articles/8512850754962-Interactive-Presentation-Mode) [Microsoft: collaborate on a whiteboard](https://support.microsoft.com/en-gb/office/collaborate-on-a-whiteboard-04e71bfd-c95f-4a1d-a1e2-5195258f68af)

### Saving and network feedback

Place a quiet status beside the mode control:

- **Saved** — latest durable revision acknowledged by the API.
- **Saving…** — local changes are being debounced or uploaded.
- **Offline — changes kept on this device** — changes are in IndexedDB and will retry.
- **Reconnecting…** — LiveKit is recovering; keep the stage visible and editable for the tutor.
- **Back online — synced** — short confirmation after recovery.

Never clear the board, navigate away, or disable drawing merely because the realtime connection is interrupted. Figma’s official offline UX uses local change storage, an offline indicator, and later synchronization; that is the right behavioral reference even though Kanvise needs a much smaller single-tutor implementation. [Figma offline and autosave behavior](https://help.figma.com/hc/en-us/articles/360040328553-What-can-I-do-offline-in-Figma)

For students:

- Keep the last successfully rendered board/PDF visible during reconnection.
- Show a small non-modal banner: **Connection interrupted — showing the last update. Reconnecting…**
- After recovery, fetch the latest durable revision before applying newer realtime changes.
- Offer an explicit **Audio only / Low data** preference. It should stop tutor video subscription while retaining audio, page changes, and drawings.

### Shared state versus local state

| State | Owner | Durability | Synchronization |
|---|---|---|---|
| Current teaching mode | Shared class state | API/database | Reliable event containing revision |
| Last selected PDF ID | Shared class state | API/database | Included in mode/state snapshot |
| Current PDF page | Shared presentation state | API/database | Reliable event + API write |
| Completed PDF annotations | Shared presentation state | API/database | Reliable final operation + API write |
| Whiteboard elements/files | Shared board document | API/database or private object storage | Small final operations + periodic snapshots |
| Cursor/laser position | Ephemeral | None | Lossy, small, latest value wins |
| Tutor zoom/pan/scroll | Tutor-local preference | Memory; optional local storage | Do not broadcast |
| Student zoom/pan | Student-local preference | Memory | Do not broadcast |
| Pending tutor edits | Tutor-local outbox | IndexedDB | Retry idempotently after reconnect |

## Recommended technical model

Kanvise currently has one writer—the assigned tutor—and view-only students. That means a CRDT is unnecessary for the first correct implementation. A versioned single-writer document is simpler and safer.

### Durable state

Add a live-class workspace record (or equivalent columns) containing:

- `teaching_mode`;
- `last_active_presentation_id`, nullable but **not cleared** when viewing Whiteboard;
- `whiteboard_snapshot` or a private object key;
- `whiteboard_revision` (monotonic integer);
- `whiteboard_updated_at`.

Continue storing each PDF’s page and annotations on its presentation record. Decouple “selected material” from “currently visible mode”; the existing `is_active` field currently conflates them.

### Write path

1. Excalidraw changes update the tutor’s local scene immediately.
2. Capture durable element changes (including deletions) with operation IDs. Pointer/drag previews may be sent lossy only when they are small enough.
3. Send completed element operations reliably for realtime student rendering. Do not send the entire scene 20 times per second.
4. Debounce a durable snapshot write to the API, for example after 1–2 seconds of idle and on pointer-up/shape completion. Also flush on mode switch, backgrounding, and graceful leave.
5. The API accepts `base_revision`, applies a single-writer update, increments the revision, and returns it. Duplicate operation IDs are harmless.
6. Store unsent operations in IndexedDB. Retry with bounded backoff when the API or network returns.

Excalidraw’s own official collaboration implementation uses incremental scene broadcasts, periodic full-scene broadcasts, and separately throttled durable saves rather than treating one lossy full-scene stream as storage. This is architectural evidence, not a requirement to copy its Firebase/socket stack. [Excalidraw collaboration source](https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/collab/Collab.tsx)

### Read and recovery path

1. On classroom entry or LiveKit reconnection, call the Kanvise API for the latest workspace snapshot and revision.
2. Render that snapshot before depending on peer messages.
3. Apply realtime operations only when their revision is the next expected revision.
4. If a revision is skipped, stop applying uncertain operations and refetch the snapshot.
5. A reliable LiveKit event may carry `{ mode, documentId, revision }`; keep the large scene in Kanvise storage. LiveKit itself recommends storing large state in an application database and sharing an identifier. [LiveKit room metadata guidance](https://docs.livekit.io/transport/data/state/room-metadata/)

Room metadata can expose a small current workspace ID/revision to participants, but it should not contain the full scene. The Kanvise database remains the source of truth.

### Mode switch transaction

The tutor’s selection of another mode should perform this logical transaction:

1. Commit or enqueue the latest durable operation in the current workspace.
2. PATCH only `teaching_mode` and, when choosing a PDF, `last_active_presentation_id`.
3. Keep both workspace documents intact.
4. Broadcast `MODE_CHANGED { mode, activePresentationId, revision }` reliably.
5. Let peers refetch if their revision does not match.

The UI may switch optimistically, but it must retain the unsaved local document if the API fails. A persistent **Saving/Offline** status is preferable to blocking a tutor mid-explanation.

Keeping both React components mounted but visually hidden would preserve short-lived component state and make switching feel faster. It is a useful UI optimization, not the fix: it cannot survive refresh, device failure, prolonged disconnection, or a different tutor browser.

## Bandwidth implications

The current algorithm grows roughly with `scene size × change frequency × recipients`. Because it resends the whole scene up to 20 times per second, a 50 KiB scene could attempt about 1 MiB/s of outbound application data before WebRTC overhead, with every lossy update far beyond LiveKit’s 1,300-byte recommendation. This is an illustrative calculation, not a measured production trace.

The recommended algorithm grows with `changed operation size × operation frequency`, plus an occasional snapshot sent once to the API. A pointer packet can remain under a few hundred bytes and lossy. A completed stroke may need chunking or direct API persistence if it exceeds the reliable packet limit. Measure encoded byte length before publishing and never assume JSON element arrays fit.

Kanvise already caps tutor video at 360p with a 180p simulcast layer and enables adaptive stream/dynacast. That is a good starting configuration, although adaptive stream only saves subscriber bandwidth when tracks are attached in the SDK-supported way. It does not repair whiteboard state loss. [LiveKit adaptive stream](https://docs.livekit.io/transport/media/subscribe/#adaptive-stream)

## Confirmed low-data media direction

The classroom is **audio-first**, not a conventional video-call grid.

- Publish tutor speech with an explicit 24 Kbps Opus speech preset, DTX enabled, and RED enabled. Do not leave the installed LiveKit client's 48 Kbps music preset as the effective default.
- The camera starts off. Turning it on is a deliberate tutor action, not something class entry does automatically.
- When enabled, tutor video is a circular, centre-cropped floating tile: **96 px diameter on phones** and **112 px on larger screens**. This keeps approximately the same visual area as the current 108 × 68 px mobile rectangle while adopting the familiar WhatsApp video-note treatment without covering the teaching surface with a literal chat-sized video note.
- If an active student is temporarily shown, use a **72 px circular tile** and return to the tutor automatically. Do not add a participant video grid.
- With no camera track, use the same circle for the avatar, initials, speaking ring, muted state, and connection state so the layout does not jump.
- Keep the tile away from bottom controls and Android safe areas. It may be draggable, but its resting position must be deterministic and recoverable.
- Offer an enforced **Audio only** class mode in addition to the default camera-off state. In that mode, the server-issued media permission must prohibit camera publication; hiding the camera button alone is insufficient.

For planning only, a 24 Kbps tutor speech stream with WebRTC, RED, and network overhead should be budgeted at roughly **20–30 MB per listening student-hour** until production telemetry proves otherwise. The implementation must collect WebRTC bytes sent/received and validate the estimate with a 60-minute weak-network test. It must not advertise an unmeasured data figure to users.

## Cloudflare media-hosting option

Cloudflare can reduce pilot infrastructure cost, but “Cloudflare has no egress fees” applies to **R2 objects**, not universally to live WebRTC media.

- Continue using R2 for PDFs, images, durable whiteboard snapshots, and eventual recording files. Direct R2 delivery has no Internet egress fee.
- Cloudflare Realtime SFU currently includes 1,000 GB/month per account and then charges $0.05/GB of data sent from Cloudflare to clients. Client uploads are free. This makes it a credible low-cost pilot media plane, not unlimited free bandwidth. [Cloudflare Realtime SFU pricing](https://developers.cloudflare.com/realtime/sfu/pricing/) [Cloudflare Realtime limits](https://developers.cloudflare.com/realtime/sfu/limits/)
- At the provisional 20–30 MB audio-only student-hour range, the included 1,000 GB represents roughly **33,000–50,000 listening student-hours per month** before paid SFU egress. This is a planning calculation, not a vendor guarantee or measured Kanvise result.
- Raw Realtime SFU is not a drop-in LiveKit endpoint. Kanvise would have to replace LiveKit rooms/tokens, React hooks, participant events, chat/data channels, attendance webhooks, reconnection handling, and recording integration. Cloudflare's raw SFU does not supply LiveKit-compatible rooms; room/presence coordination remains application work.
- RealtimeKit provides more of the meeting/session layer, but its current audio-only price is $0.0005 per participant-minute and therefore does not use the raw SFU's per-GB economics. At 100 listeners for one hour, that is $3 for the live meeting before recording/export. [Cloudflare RealtimeKit pricing](https://developers.cloudflare.com/realtime/realtimekit/pricing/)

**Recommendation:** keep the current LiveKit implementation during the immediate UX and reliability repair. In parallel, build a narrow Cloudflare Realtime SFU proof of concept containing one tutor Opus track, listen-only students, reconnect, and measured bytes. Migrate only if that pilot passes Android/mobile-network tests. Do not attempt an untested provider rewrite as part of the classroom UI fix.

## Required acceptance tests

The current test suite checks that the Whiteboard button calls `closePresentation`; that test enshrines the wrong behavior. Replace it with user-outcome tests.

1. Tutor draws on Whiteboard, opens PDF, annotates page 3, returns to Whiteboard, and sees the original board unchanged.
2. Tutor returns to Presentation and sees the same PDF, page 3, and completed annotations without selecting the file again.
3. Switching modes while a save is in flight never loses the operation.
4. Tutor refreshes and restores the board, mode, selected PDF, page, and completed annotations from the API.
5. A student joining late sees the latest durable state even if no tutor data packet arrives.
6. Drop one realtime operation/revision; the student detects the gap and reloads the snapshot.
7. Simulate offline tutor drawing, reload only after reconnection, and verify the IndexedDB outbox syncs without duplicates.
8. During LiveKit `Reconnecting`, the last stage stays visible and a clear banner appears. `Reconnected` reconciles state. Final unexpected disconnect shows a retry/rejoin screen rather than silently sending the student to the dashboard.
9. A mode-change packet sent while a student is disconnected is recovered from the API on return.
10. Payload tests reject or chunk any LiveKit reliable message above 15 KiB and keep lossy packets at or below the recommended 1,300 bytes.
11. Test on Android Chrome using throttled high-latency/packet-loss profiles and a real Wi-Fi-to-cellular handoff.

## Implementation order

### Phase 1 — stop destructive switching

- Add a real `setTeachingMode()` API/client action.
- Preserve the last active presentation when changing to Whiteboard.
- Separate **switch mode** from **close/remove presentation**.
- Preserve local viewport state per mode.

This fixes the most visible continuity problem but does not yet make the blank board durable.

### Phase 2 — durable whiteboard and recovery

- Add versioned whiteboard snapshots and an API read/write path.
- Restore Excalidraw through `initialData`.
- Save on a short debounce and important lifecycle boundaries.
- Reconcile from the API on join/reconnect/revision gaps.
- Add Saving/Saved/Offline states.

### Phase 3 — efficient realtime operations

- Replace 50 ms full-scene lossy packets with small operations.
- Keep only pointer/laser previews lossy.
- Add payload-size enforcement, idempotent operation IDs, IndexedDB outbox, and reconnection tests.

### Phase 4 — low-data classroom controls

- Add visible connection quality/reconnecting UX.
- Apply the explicit 24 Kbps speech + DTX + RED configuration and verify real received-byte reductions.
- Make the classroom camera-off by default, add the enforced Audio only mode, and render optional video in the audited circular 96/112 px treatment.
- Instrument packet sizes, snapshot sizes, save latency, revision-gap recovery, reconnect duration, and failure rate.

### Phase 5 — media-provider cost validation

- Build a disposable Cloudflare Realtime SFU proof of concept; do not mix it into the main classroom until it passes the gate.
- Test one tutor and representative listen-only students on Android Chrome, including Wi-Fi-to-cellular handoff, packet loss, and TURN fallback.
- Compare reconnect success, audio continuity, measured student bytes, operational complexity, and recording path with the repaired LiveKit implementation.
- Choose the provider from measured outcomes and total operating cost, not egress price alone.

## What should not be done

- Do not fix this only by keeping Excalidraw mounted.
- Do not change the full scene stream from lossy to reliable at 20 Hz; that risks head-of-line blocking, retransmission pressure, and the 15 KiB packet ceiling.
- Do not store a growing Excalidraw scene directly in LiveKit room metadata.
- Do not require a currently connected host to restore a late joiner.
- Do not introduce a multi-writer CRDT until students or multiple tutors are allowed to edit simultaneously.
- Do not label a control **Whiteboard** if it executes a destructive **Close presentation** command.

## Confidence and remaining unknowns

Confidence is high on the root causes above because they follow directly from the render branches, API mutation, migration schema, and LiveKit delivery contract.

Two items require runtime measurement rather than code inference:

- the actual whiteboard payload-size distribution during a typical 60–90 minute lesson;
- whether the user-observed loss of **completed PDF annotations after reselecting the same material** is an API failure/race, a stale deployment, or a separate rendering defect.

Instrument those two areas during implementation. They do not change the UX decision: each workspace must persist independently, and switching views must be reversible.
