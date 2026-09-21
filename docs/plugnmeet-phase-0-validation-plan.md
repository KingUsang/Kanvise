# Kanvise plugNmeet Phase 0 Validation Plan

**Status:** Required before implementation planning

**Scope:** Evidence-gathering only; no production traffic or irreversible migration

**Architecture:** `kanvise-live-class-architecture-v3.md`

**API reference:** `plugnmeet-integration-reference.md`

## 1. Objective

Phase 0 converts the remaining architectural assumptions into observed,
repeatable facts. It ends with either:

- **GO** — every blocking contract is proven and the implementation backlog can
  be estimated; or
- **NO-GO** — at least one blocker has no acceptable workaround, with the
  failure and alternatives documented.

The spike must not silently turn into production implementation. Temporary
code, rooms, recordings, infrastructure, and test data should be clearly
labelled and removable.

## 2. Decisions already locked

Do not reopen these during the spike unless evidence shows they are technically
impossible:

- Enrolled classes migrate to plugNmeet first.
- Guest-link classes remain on the current classroom during the first rollout.
- A later guest migration uses the standalone plugNmeet client profile while
  keeping Kanvise share-token validation and server-issued join tokens.
- Only enrolled classes receive transcription, Quick Check, recording,
  reconciled attendance, recap generation, and recap notifications.
- There is no Kanvise-configured participant cap (`max_participants: 0`).
- Recording runs on a separate AWS EC2 Recorder VM.
- The Live Class VM remains on Azure.
- The browser never receives plugNmeet API credentials.
- Kanvise uses the documented REST API through one typed, HMAC-signing adapter.
- R2 remains the canonical application storage for published recordings and
  transcripts unless a validated storage-hook design changes this explicitly.

## 3. Required test environment

Use an isolated non-production environment with:

- one Azure Live Class VM;
- one App VM or isolated App-VM process for Hono and the Bridge;
- one temporary AWS EC2 Recorder VM;
- separate test Redis instances for the plugNmeet realtime stack and Kanvise
  durable jobs/transcript buffers, plus NATS, MariaDB, LiveKit, LiveKit Egress,
  plugNmeet server/client, and plugNmeet Recorder;
- a test R2 bucket/prefix;
- non-production Deepgram and LLM credentials with spending limits;
- two test tutors, three enrolled test students, one admin observer, and two
  guest identities;
- desktop Chrome/Firefox plus one Android Chrome and one iOS Safari device.

All secrets must be held server-side. Logs and saved payloads must redact API
keys, signatures, join tokens, cookies, student names, and transcript content.

## 4. Version matrix

Record exact versions and immutable image/package identifiers before the first
test. A test result without this matrix is not reusable evidence.

| Component | Version/tag | Image digest or lockfile | Configuration commit | Verified date |
|---|---|---|---|---|
| plugNmeet server | TBD | TBD | TBD | TBD |
| plugNmeet client | TBD | TBD | TBD | TBD |
| plugNmeet Recorder | TBD | TBD | TBD | TBD |
| LiveKit server | TBD | TBD | TBD | TBD |
| LiveKit Egress | TBD | TBD | TBD | TBD |
| plugNmeet protocol definitions | TBD | TBD | TBD | TBD |
| Node.js | TBD | N/A | TBD | TBD |
| Deepgram streaming API/model | TBD | N/A | TBD | TBD |

Do not use `latest` tags in the implementation plan. After Phase 0 passes,
upgrades require the contract suite from this plan to pass again.

## 5. Experiment A — Room control and identity contract

### Questions

- Do `/room/create`, `/room/getJoinToken`, `/room/isActive`, and `/room/end`
  behave exactly as documented on the pinned version?
- Does `max_participants: 0` remove the configured room cap?
- Can Kanvise UUIDs be used unchanged as `room_id` and `user_id`?
- What happens on duplicate create, duplicate end, tutor refresh, and two active
  connections using the same `user_id`?
- Are tutor, student, and admin-observer permissions correct?

### Procedure

1. Implement a temporary typed REST probe that stringifies a body once, signs
   the exact bytes, and sends those same bytes.
2. Create one enrolled test room with the complete enrolled room profile.
3. Call `isActive`, create the same room again, and capture both responses.
4. Generate tokens for tutor, student, and admin observer using stable Kanvise
   IDs. Join from separate browsers.
5. Refresh the tutor, then join from a second tutor device using the same ID.
6. End the room twice and confirm all clients disconnect.
7. Repeat with the guest-demo room profile, without changing the production
   guest route.

### Pass criteria

- Every request/response schema is captured as a redacted contract fixture.
- Only the assigned tutor has moderator privileges.
- Students and observers cannot obtain moderator capabilities by changing the
  browser request.
- Duplicate start/end behaviour is understood and can be made idempotent by
  Hono.
- Stable identity behaviour is suitable for attendance and reconnects.
- No API secret appears in browser traffic, HTML, logs, or source maps.

## 6. Experiment B — Dedicated web-client route

### Questions

- Can `getClientFiles` be loaded reliably in a dedicated Next.js route without
  conflicting with React, navigation, CSP, or the existing application shell?
- Can Kanvise branding and a tutor-only overlay coexist with the standalone
  plugNmeet client?
- Where does the short-lived join token live, and can it leak through history,
  referrers, analytics, error reporting, or screenshots?
- Does the client reconnect correctly on mobile network changes?

### Procedure

1. Build a disposable route containing only the required
   `window.plugNmeetConfig`, `staticAssetsPath`, styles/scripts, and
   `#plugNmeet-app` mount.
2. Load the enrolled profile with a small Kanvise overlay that does not depend
   on plugNmeet's internal component tree.
3. Verify direct navigation, refresh, back navigation, leave/end redirects,
   token expiry, and client cleanup.
4. Exercise microphone/camera permissions, mute-on-entry, chat, whiteboard,
   PDF/office upload, polls, raise hand, participant moderation, and reconnect.
5. Test desktop Chrome/Firefox, Android Chrome, and iOS Safari at narrow and
   rotated viewports.
6. Repeat a 60-minute representative lesson under unrestricted, 4G-like, and
   constrained profiles. Include at least 150 ms RTT, 2% packet loss, and a
   1 Mbps down/300 kbps up profile. Measure bytes transferred for audio-only,
   one tutor webcam, whiteboard use, background tabs, and reconnect.
7. Verify Adaptive Stream, Dynacast, and Simulcast are active; confirm offscreen
   webcams stop consuming meaningful downstream bandwidth and the tutor webcam
   begins at 360p or below.
8. Inspect network requests, browser history, referrer headers, console output,
   CSP reports, and error-monitoring payloads for token leakage.

### Pass criteria

- The route mounts once, cleans up on exit, and survives refresh/reconnect.
- Students enter muted; only the tutor receives moderator controls.
- Required classroom functions work on every target browser/device.
- Branding is acceptable in light and dark themes.
- The overlay remains accessible and usable without fragile selectors into
  plugNmeet's DOM.
- Join tokens are not retained or sent to unrelated origins.
- Camera never turns on without a deliberate user action and students enter
  with microphone muted.
- Tutor speech remains intelligible on the constrained profile and video
  degrades or pauses without disconnecting the student.
- Excluding first-load assets and deliberate file downloads, measured usage is
  at most 50 MB per student-hour for audio-only and 300 MB per student-hour for
  one tutor webcam at 360p plus audio, or a revised budget is explicitly
  approved with evidence.
- A reconnect uses cached versioned client assets rather than downloading the
  entire bundle again.

## 7. Experiment C — Webhooks and attendance reconciliation

### Questions

- Do webhook signatures verify using the pinned protocol implementation?
- What are the exact payloads for room, participant, track, recording, artifact,
  and analytics events?
- Are webhook events duplicated, retried, delayed, or delivered out of order?
- What is the actual structure of `voted_poll`, `joined`, and `left`?

### Procedure

1. Enable global webhook delivery and per-meeting delivery explicitly; use only
   the intended URL in the final test to check for duplicate configuration.
2. Receive the raw `application/webhook+json` body and verify both security
   headers before parsing.
3. Persist the webhook event ID before dispatching work. Replay each captured
   event and confirm the second delivery is a no-op.
4. Run join/leave/rejoin, abrupt browser termination, tutor disconnect, normal
   end, and forced server-end scenarios.
5. Fetch the resulting `MEETING_ANALYTICS` artifact through
   `/artifact/fetch` and `/artifact/getDownloadToken`.
6. Compare its per-user results with observed session times and the current
   `attendance_records` semantics.
7. Record real `track_published`, `recording_proceeded`, `artifact_created`, and
   `analytics_proceeded` fixtures from the pinned version.

### Pass criteria

- Invalid signatures are rejected; valid events are acknowledged quickly.
- Duplicate delivery cannot duplicate attendance, jobs, recordings, or egress.
- Tutor/admin/guest identities cannot be written as enrolled-student
  attendance.
- Rejoined students reconcile to a documented duration and timestamp model.
- The analytics artifact can authoritatively update enrolled attendance.
- `voted_poll` is classified as either sufficient or insufficient for future
  per-student Quick Check results.

## 8. Experiment D — Tutor audio egress and transcription

### Questions

- Does the plugNmeet `track_published` payload contain enough information to
  select the assigned tutor's microphone track safely?
- What PCM sample rate reaches the Bridge when using the current `StartEgress`
  WebSocket output?
- Can the system recover from mute/unmute, track republish, tutor reconnect,
  duplicate webhooks, Deepgram disconnect, Bridge restart, and backpressure?
- Is tutor-only audio sufficient for the intended Quick Check and recap quality?

### Procedure

1. Start egress only after validating enrolled-class mode, tutor identity,
   audio kind/source, and an idempotency lock.
2. Require a short-lived signed Bridge URL containing class, track, expiry, and
   nonce. Test invalid, expired, and replayed signatures.
3. Capture the effective audio format/sample rate and configure Deepgram to
   match it exactly.
4. Speak a fixed script containing names, numbers, subject terminology,
   silence, mute/unmute, and a deliberate tutor reconnect.
5. Interrupt Deepgram and restart the Bridge while audio is active.
6. Persist finalized transcript chunks with timestamps and provider result IDs;
   verify deduplication and ordering.
7. Generate a Quick Check and recap from the known script and score factual
   accuracy manually.

### Pass criteria

- At most one active egress/transcription session exists per tutor track.
- Unauthorized Bridge connections are rejected.
- Audio is intelligible and the sample-rate contract is explicit.
- Final chunks survive process restart and can be assembled deterministically.
- A tutor reconnect resumes transcription without duplicate transcript spans.
- Quick Check candidates are grounded in the transcript and contain exactly one
  validated correct answer.
- The team explicitly accepts tutor-only capture or changes the architecture to
  mixed-room audio before planning implementation.

## 9. Experiment E — AWS Recorder and recording storage

### Initial EC2 candidate

Use this as the Phase 0 sizing hypothesis, not as a production capacity claim:

| Item | Pilot choice |
|---|---|
| Instance | `c7a.2xlarge` (x86_64, compute optimized) |
| CPU/RAM | 8 physical AMD EPYC cores, 16 GiB RAM |
| OS | Current Ubuntu LTS supported by the pinned recorder release |
| Root disk | 30–40 GiB encrypted gp3 |
| Recording scratch | Separate 200–300 GiB encrypted gp3 volume, mounted as the recorder's local `temporary_dir` |
| Recorder mode | `both` for the first end-to-end spike |
| Initial `max_limit` | `2`, increased only from observed CPU, memory, dropped-frame, and transcode-lag data |
| Purchase model | On-Demand during validation; do not use Spot for an active live recorder |

This workload uses Chrome, Xvfb, PulseAudio, and FFmpeg and is sustained
compute/video-encoding work. Do not use burstable `t*` instances: CPU-credit
behaviour can degrade a long recording. Do not choose Graviton/ARM for the first
deployment until the exact Chrome, FFmpeg, plugNmeet Recorder image, and hooks
have passed an ARM compatibility test. A GPU instance is not required for the
baseline software-encoding path.

Place the instance in the AWS region with the lowest measured latency to the
Azure Live Class VM, not merely the region geographically closest to users.
Media reaches the Recorder from LiveKit, so Azure-to-AWS latency and transfer
cost are the relevant placement inputs.

For production, prefer horizontal scaling over one oversized machine:

- add another `recorderOnly` instance when simultaneous live recordings exceed
  the validated per-node limit;
- add independent `transcoderOnly` instances when the post-processing queue
  grows even though live capture remains healthy;
- keep at least one spare recorder slot if recording must survive a node loss;
- use PlugNmeet's recorder load balancing with a unique recorder ID per node.

### Questions

- Can the AWS Recorder VM securely reach the required Azure LiveKit/NATS
  services with acceptable latency and reliability?
- Can the recorder and plugNmeet server satisfy their shared/external storage
  contract across clouds?
- Can a completed MP4 reach R2 without being buffered through Hono?
- What are the real compute, Azure egress, AWS egress, and storage costs?

### Procedure

1. Establish an authenticated private tunnel or narrowly allow-listed encrypted
   connection between the AWS Recorder VM and required Azure services.
2. Deny all unrelated inbound traffic and prove that the recorder still works.
3. Record 5-, 30-, and 60-minute sessions with camera changes, whiteboard,
   chat-panel activity, and tutor reconnect.
4. Capture recording lifecycle webhooks and fetch metadata using
   `/recording/fetch` and `/recording/info`.
5. Test the preferred plugNmeet upload/download storage hook with R2. If the
   hook is unsuitable, stream from the one-time recording URL to R2 without
   buffering the entire file.
6. Verify size and checksum in R2, then delete the plugNmeet source and prove
   that retrying the job does not duplicate the recording.
7. Measure recorder CPU/RAM, processing delay, transfer throughput, and
   cross-cloud traffic cost.

### Pass criteria

- The recorder is isolated from the public internet except for required paths.
- A 60-minute recording completes and becomes available in R2 reliably.
- Hono memory remains bounded during transfer.
- Recording jobs are idempotent by `record_id` and recover after interruption.
- A documented storage mechanism replaces any assumed cross-cloud shared disk.
- Measured monthly cost is acceptable for the expected recording volume.
- The final per-node `max_limit` is based on measured headroom rather than the
  initial value of `2`.

## 10. Experiment F — Lifecycle, shutdown safety, and uncapped load

### Questions

- Does Azure readiness mean the entire classroom stack is ready, not merely
  LiveKit's HTTP endpoint?
- Can VM deallocation occur without destroying transcripts or interrupting
  analytics, recording, artifact, or recap work?
- What load can the current VM sustain even though Kanvise configures no room
  participant cap?
- Can enrolled classes roll back to the current LiveKit classroom quickly?

### Procedure

1. Create an aggregate readiness check for LiveKit, Egress, plugNmeet, Redis,
   NATS, MariaDB, and required Recorder availability.
2. Start from a deallocated Azure VM and measure time until the first tutor and
   student can join successfully.
3. End a recorded/transcribed class, then attempt deallocation during each
   post-class processing phase. Confirm the guard refuses until durable work is
   safe.
4. Kill individual services and verify fail-closed behaviour, alerting, retries,
   and recovery.
5. Load-test stepped concurrent participants and simultaneous rooms while
   measuring CPU, RAM, bandwidth, packet loss, reconnects, egress latency, and
   recording completion. Stop before infrastructure saturation harms other
   environments.
6. Enable and disable the enrolled-class plugNmeet feature flag while keeping
   current guest classes unchanged.

### Pass criteria

- Join tokens are issued only when the complete required stack is ready.
- VM shutdown cannot destroy the sole copy of any transcript or pending job.
- All asynchronous work has observable states, bounded retries, and a terminal
  failure path.
- The load test produces a documented safe operating envelope and scaling
  trigger. This is operational guidance, not an application room cap.
- The feature flag restores the existing enrolled classroom path without a
  database rollback.

## 11. Required evidence package

Each experiment owner must add:

- exact versions and configuration hashes;
- redacted request, response, and webhook fixtures;
- commands or automated tests needed to reproduce the result;
- logs and screenshots for success and failure cases;
- measured timings, resource usage, and cost assumptions;
- measured per-student upstream/downstream bytes for each bandwidth profile;
- discovered deviations from the architecture/reference docs;
- a clear PASS, CONDITIONAL PASS, or FAIL verdict.

Store fixtures under a future `api/src/integrations/plugnmeet/__fixtures__`
directory only when implementation begins. During Phase 0, keep sensitive raw
captures outside Git and commit only sanitized evidence.

## 12. Final go/no-go gate

Phase 0 is complete only when all of the following are true:

- Experiments A–F have recorded verdicts and reproducible evidence.
- Every implementation endpoint and webhook payload used by Kanvise has a
  redacted contract fixture.
- The version matrix is complete and pinned.
- The AWS/Azure recording path has passed a 60-minute test.
- Attendance reconciliation has passed a join/leave/rejoin test.
- Transcription has passed reconnect and Bridge-restart tests.
- The dedicated client route has passed the target desktop and mobile matrix.
- Azure deallocation cannot race any post-class job.
- Security, privacy, retention, and deletion decisions are recorded.
- The rollback feature flag is demonstrated.
- No unresolved item can change the database schema, infrastructure topology,
  security boundary, or user-visible classroom behaviour.

After this gate, create the implementation plan in dependency order:

1. infrastructure and pinned deployment;
2. typed plugNmeet adapter and contract tests;
3. webhook inbox and background-job state machine;
4. database migrations and RLS;
5. enrolled-class room lifecycle;
6. dedicated classroom route;
7. attendance reconciliation;
8. transcription and Quick Check;
9. AWS recording and R2 publication;
10. recap review/publication;
11. observability, load tests, staged rollout, and rollback rehearsal;
12. optional later migration of guest classes to the standalone profile.
