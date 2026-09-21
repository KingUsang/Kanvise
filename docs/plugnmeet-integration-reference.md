# plugNmeet Integration Reference — for implementation agents

Compiled directly from plugnmeet.org official docs (fetched, not from training memory or search snippets). Every section below is sourced; anything not verified is marked as such at the bottom.

## Authentication

All API calls are `POST` requests with a JSON body, to `{PLUGNMEET_SERVER_URL}/auth/{method-path}`.

Required headers:
- `Content-Type: application/json`
- `API-KEY`: your server API key
- `HASH-SIGNATURE`: HMAC-SHA256 of the **raw JSON body string**, using your API secret as the key, hex-encoded, lowercase

```ts
import { createHmac } from 'crypto';
const body = JSON.stringify({ room_id: "room01" });
const signature = createHmac("sha256", API_SECRET).update(body).digest("hex");
```

Official SDKs exist for PHP and JS (Node/Deno), plus a community Python SDK.
For Kanvise, use one small, tested REST client around the documented API so
newer endpoints are not blocked by an SDK release lag. The client must stringify
the body once, sign those exact bytes, and send those same bytes.

## Full Endpoint Map

| Category | Endpoint |
|---|---|
| Room | `/room/create`, `/room/getJoinToken`, `/room/isActive`, `/room/getActiveRoomInfo`, `/room/getActiveRoomsInfo`, `/room/broadcastToRoom`, `/room/uploadWhiteboardFile`, `/room/fetchPastRooms`, `/room/createPoll`, `/room/end` |
| Recording | `/recording/fetch`, `/recording/info`, `/recording/getDownloadToken`, `/recording/delete`, `/recording/updateMetadata`, `/recording/mergeRecordings` |
| Artifact | `/artifact/fetch`, `/artifact/info`, `/artifact/getDownloadToken`, `/artifact/delete` |
| Analytics | **Deprecated** — see Analytics section below for the current path |
| Client | `/getClientFiles` |

Keep endpoint paths in one typed client and contract-test them against the
pinned plugNmeet server version. Do not derive REST paths from SDK method names.

## Create Room — `/room/create`

```json
{
  "room_id": "live_class_uuid",
  "max_participants": 0,
  "empty_timeout": 0,
  "metadata": {
    "room_title": "string",
    "welcome_message": "string",
    "webhook_url": "https://api.kanvise.ng/webhooks/plugnmeet",
    "logout_url": "string",
    "room_features": { "...": "see below" },
    "default_lock_settings": { "...": "optional" },
    "copyright_conf": { "display": false },
    "extra_data": { "school_id": "uuid", "course_id": "uuid" }
  }
}
```

`room_id` is reusable once a session ends — confirms the plan to set it to `live_class.id` directly, no separate mapping table needed.

The current PlugNmeet room-create validator rejects `max_participants: 0`.
Kanvise therefore uses `max_participants: 1000` as an infrastructure safety
ceiling rather than a product admission cap; there is no
application-level room cap. It does not imply infinite infrastructure capacity;
monitor bandwidth, CPU, packet loss, and recorder/egress load and scale the
deployment before saturation.

`webhook_url` can be set **per room** here, or globally in the server's `config.yml`. Per-room is the right call for Kanvise — lets the payload route by `room_id` back to the right `live_class`.

### `room_features` — Kanvise defaults

Every sub-object below is marked `Yes` (required) or `No` (optional) per the docs — omitted required objects will likely fail validation, so send all of them even when disabling.

```json
{
  "allow_webcams": true,
  "mute_on_start": true,
  "allow_screen_share": false,
  "admin_only_webcams": false,
  "allow_view_other_webcams": true,
  "allow_view_other_users_list": true,
  "enable_analytics": true,
  "allow_virtual_bg": false,
  "allow_raise_hand": true,
  "auto_gen_user_id": false,
  "room_duration": 0,
  "recording_features": {
    "is_allow": true,
    "is_allow_cloud": true,
    "is_allow_local": false,
    "enable_auto_cloud_recording": false,
    "only_record_admin_webcams": false
  },
  "chat_features": {
    "is_allow": true,
    "is_allow_file_upload": false
  },
  "shared_note_pad_features": { "is_allow": false },
  "whiteboard_features": { "is_allow": true },
  "external_media_player_features": { "is_allow": false },
  "external_broadcasting_features": { "is_allow": false, "is_allow_rtmp": false },
  "waiting_room_features": { "is_active": false },
  "breakout_room_features": { "is_allow": false },
  "display_external_link_features": { "is_allow": false },
  "ingress_features": { "is_allow": false },
  "polls_features": { "is_allow": true },
  "insights_features": {
    "is_allow": true,
    "transcription_features": { "is_allow": false },
    "ai_features": {
      "is_allow": true,
      "ai_text_chat_features": { "is_allow": true },
      "meeting_summarization_features": { "is_allow": false }
    }
  },
  "sip_dial_in_features": { "is_allow": false },
  "end_to_end_encryption_features": { "is_enabled": false }
}
```

Notes tying this to decisions already made:
- `enable_analytics: true` is **required** for the post-class attendance reconciliation (see Analytics section) — default in the docs is `false`, don't forget this.
- `mute_on_start: true` preserves Kanvise's current student-muted entry
  behaviour. The tutor can unmute after joining as moderator.
- `allow_screen_share: false` — per your call, whiteboard's PDF/office upload already covers materials.
- `insights_features.is_allow: true` enables PlugNmeet's native Generate-with-AI
  poll composer. Its transcription and meeting-summarization subfeatures stay
  disabled; Kanvise runs Deepgram post-recording and Gemini summary generation
  in its own API job.
- `waiting_room_features.is_active: false` — Kanvise gates enrolled users and
  guest-demo links before issuing a join token.
- `chat_features.is_allow_file_upload: false` — files shared there bypass R2 and aren't tracked in Kanvise's system (flagged earlier as your call; defaulting off per "start minimal").
- `end_to_end_encryption_features.is_enabled: false` — confirmed reason now, not just caution: per their docs, when E2EE uses self-inserted keys, **all audio-based AI features are automatically disabled server-side, because the server never has the key**. This would also block LiveKit Track Egress from getting decodable audio for the Deepgram pipeline, not just their own insights layer. Leave off.

### Room-profile overrides

The JSON above is the **enrolled-class profile**. Guest demo rooms deliberately
override the expensive/persistent learning features:

| Setting | Enrolled class | Guest demo class |
|---|---:|---:|
| `max_participants` | `0` (no app cap) | `0` (no app cap) |
| `enable_analytics` | `true` | `false` |
| `recording_features.is_allow` | `true` | `false` |
| `recording_features.enable_auto_cloud_recording` | `false` | `false` |
| Kanvise transcription / Quick Check / recap | enabled | disabled |

Both profiles are still created server-side by Kanvise and use short-lived join
tokens. The guest profile is not a public PlugNmeet API surface.

## Low-bandwidth client defaults

Kanvise uses an audio-first client profile for students on mobile data. These
are supported `window.plugNmeetConfig` options and must be set before loading
the plugNmeet client scripts:

```js
window.plugNmeetConfig = {
  // serverUrl and staticAssetsPath are also required by the integration.
  enableAdaptiveStream: true,
  enableDynacast: true,
  enableSimulcast: true,
  videoCodec: "vp8",
  defaultWebcamResolution: "h360",
  defaultAudioPreset: "speech",
  stopMicTrackOnMute: true,
  focusActiveSpeakerWebcam: true,
  maxNumDisplayWebcams: {
    desktop: 6,
    tablet: 4,
    mobile: 2,
  },
};
```

Product defaults around those settings:

- Camera is off on entry for tutor and students. A user deliberately enables
  it; joining a room never begins video publication automatically.
- Student microphones remain muted on entry. Audio is the priority when the
  network degrades.
- Students should not receive a grid of every participant. Active-speaker
  focus plus the device-specific webcam limit bounds downstream media.
- Screen sharing, virtual backgrounds, external media, and chat file uploads
  stay disabled. Whiteboard/PDF remains the materials-sharing path.
- Do not disable LiveKit audio RED merely to save bytes. It adds bandwidth but
  improves speech under packet loss; validate the trade-off on Nigerian mobile
  networks before overriding it.
- Cache versioned plugNmeet JS/CSS assets at the edge so reconnecting or joining
  another class does not repeatedly download the full client bundle.
- Tutor material should be compressed before upload. Begin with a 10 MiB
  whiteboard-file limit and revise only from measured classroom need.

`vp8` is the compatibility-first baseline because it is plugNmeet's documented
default. Phase 0 must compare it with H.264 on the target Android and iOS device
set before changing codecs; apparent codec efficiency is not useful if a
student device falls back to software decoding or fails to publish.

These are default constraints, not a substitute for measurement. The target
steady-state student data budgets, excluding the first cached application load
and deliberate file downloads, are:

- audio-only class: at most 50 MB per student-hour;
- one tutor webcam at 360p plus audio: at most 300 MB per student-hour.

Phase 0 records actual upstream/downstream bytes and either confirms these
budgets or documents why they must change.

## Create Poll — `/room/createPoll` (Quick Check delivery)

This is better suited to Quick Check than a plain poll — it has a **built-in quiz mode**:

```json
{
  "room_id": "live_class_uuid",
  "question": "string",
  "options": [
    { "id": 1, "text": "string", "is_correct": true },
    { "id": 2, "text": "string" }
  ],
  "is_quiz": true,
  "is_anonymous": false,
  "duration": 120
}
```

With `is_quiz: true`: correct answer is hidden while the poll runs and revealed automatically after it closes — plugNmeet handles that state machine, Kanvise doesn't need to. `is_anonymous: false` is required if per-student tracking matters, since `true` means individual choices are never stored per-user at all. Room must be currently active or the call fails outright — matches the manual, in-class trigger design.

Update to the Quick Check flow already designed: use `is_quiz: true` with the correct option flagged, instead of a plain poll — get the hide/reveal behavior for free.

Response: `{ status, msg, poll_id, status_code }` — store `poll_id` on the `quick_checks` row as already planned.

## Webhooks

Configured via `webhook_url` (per-room or global `config.yml`). Per-room delivery
also requires `webhook_conf.enable_for_per_meeting: true` in the server config.
Events are sent as `POST`, `Content-Type: application/webhook+json`, signed using
`Authorization` and `Hash-Token` headers with a JWT containing the payload hash.

Every event: `{ id, createdAt, event, room, ...event-specific fields }`.

| Event | Extra fields | Notes |
|---|---|---|
| `room_created` | `room` | |
| `room_started` | `room` | Don't trigger egress here — no guarantee tutor's track exists yet |
| `room_finished` | `room` | |
| `participant_joined` | `room`, `participant` | **This is plugNmeet's own relay of the underlying LiveKit event, not a separate reconciled signal** — confirmed no debounce/grace-period logic here. Good for a live presence indicator, not for final billing-grade attendance. |
| `participant_left` | `room`, `participant` | Same caveat as above |
| `track_published` | `room`, `participant`, `track` (only `sid`/`identity`/`name` populated) | **This is emitted by plugNmeet itself**, not just LiveKit — meaning Hono doesn't need a separate direct LiveKit webhook subscription for the egress trigger. One `webhook_url` covers it. |
| `track_unpublished` | same shape as above | |
| `start_recording` / `end_recording` / `recording_proceeded` | `room`, `recording_info` | |
| `start_rtmp` / `end_rtmp` | `room`, `recording_info` | Not used — RTMP is off |
| `artifact_created` | `room`, `room_artifact` | Unified event replacing older individual artifact webhooks. Check `room_artifact.type` — see Analytics section, this is also how the reconciled attendance report arrives. |
| `analytics_proceeded` | `room`, `analytics` | Fired when the post-session analytics computation finishes |

**Architecture correction from the earlier draft:** the doc currently describes subscribing to LiveKit's webhook directly, in parallel with plugNmeet's, specifically to get `participant_joined/left` and `track_published`. That's no longer necessary — plugNmeet re-emits all three itself. **One webhook subscription (plugNmeet's) covers live presence, the egress trigger, and recording/analytics lifecycle.** Simplifies the room lifecycle sequence — drop the separate LiveKit webhook subscription unless a future need for LiveKit-only event types shows up.

## Analytics (attendance reconciliation)

The dedicated Analytics REST API (`/api/analytics/fetch`) is marked
**Deprecated** in current docs. Analytics is generated as a JSON artifact after
the session ends. Locate it via `/artifact/fetch`, request a one-time token via
`/artifact/getDownloadToken`, then download it from
`/download/artifact/{token}`. The `analytics_proceeded` webhook signals that
processing has completed.

Confirmed field list in the generated report:

**Room-level:** `room_id`, `room_title`, `room_creation`, `room_ended`, `room_duration`, `room_total_users`, `enabled_e2ee`, `recording_status`, `rtmp_status`, `speech_service_total_usage`, `external_media_player_status`, `etherpad_status`, `external_display_link_status`, `ingress_created`, `breakout_room`

**Per-user:** `name`, `user_id`, `is_admin`, `duration`, `joined`, `left`, `mic_status`, `mic_muted`, `talked`, `talked_duration`, `webcam_status`, `raise_hand`, `voted_poll`, `whiteboard_annotated`, `whiteboard_files`, `screen_share_status`, `speech_services_usage`, `public_chat`, `private_chat`, `chat_files`, `interface_invisible`, `connection_quality`

This confirms two things directly relevant to open items:
- `duration`, `joined`, `left` per user is exactly the reconciled attendance figure needed — one field, already computed, no need to sum LiveKit's raw join/leave event pairs yourself.
- `voted_poll` exists per-user — worth checking this field's actual shape (boolean vs. which-option-selected) against a real generated report before assuming it resolves the parked per-student Quick Check tracking question. Promising lead, not confirmed to the level of detail needed yet.

Requires `enable_analytics: true` in `room_features` at room creation — it's off by default.

## Branding / White-Label

Two independent mechanisms, both real, both usable together:

**1. Design tokens**, set via `window.plugNmeetConfig.designCustomization` (or the legacy `window.DESIGN_CUSTOMIZATION`) before their scripts load — fits directly into the `getClientFiles` injection flow already planned:

```js
window.plugNmeetConfig = {
  designCustomization: {
    primary_color: "#hex",
    primary_btn_bg_color: "#hex",
    primary_btn_text_color: "#hex",
    secondary_color: "#hex",
    header_bg_color: "#hex",
    footer_bg_color: "#hex",
    side_panel_bg_color: "#hex",
    background_color: "#hex",
    background_image: "https://...",   // must be HTTPS
    custom_logo: "https://...",        // must be HTTPS
    custom_css_url: "https://..."      // must be HTTPS, loaded last, wins on specificity
  }
};
```

Colour tokens only apply to light theme — dark mode falls back to their defaults unless overridden via `custom_css_url`.

**2. Copyright/attribution line**, set per-room in `metadata.copyright_conf`:

```json
{ "display": false }
```

This is the actual "Powered by plugNmeet" removal switch — no CSS hacking needed. `display: true` with custom `text` (limited HTML: `b`, `i`, `em`, `strong`, `a`) also works if partial attribution is wanted. Only available if the server's own `config.yaml` has `client.copyright_conf.allow_override: true` — confirm this is set during server setup.

## Get Client Files — `/getClientFiles`

Returns `{ css_files: [...], js_files: [...] }` — filenames to construct `<link>`/`<script>` tags against `{PLUGNMEET_SERVER_URL}/assets/{css|js}/{filename}`. Their own example code explicitly recommends this be the only thing on the page it's injected into, to avoid conflicts — matches the "dedicated route" decision already made.

The page must define `window.plugNmeetConfig.staticAssetsPath` before loading
the scripts and provide `<div id="plugNmeet-app"></div>` as the client mount.
Guest demo classes use this standalone shell directly. Enrolled classes use the
same shell plus Kanvise's authenticated overlay for Quick Check controls.

## Join Token — `/room/getJoinToken`

```json
{
  "room_id": "live_class_uuid",
  "user_info": {
    "name": "Display Name",
    "user_id": "kanvise_user_or_guest_id",
    "is_admin": false,
    "is_hidden": false,
    "client_type": "WEB",
    "user_metadata": {
      "profile_pic": "https://...",
      "extra_data": {
        "school_id": "uuid",
        "access_profile": "enrolled"
      },
      "lock_settings": {
        "lock_screen_sharing": true,
        "lock_chat_file_share": true
      }
    }
  }
}
```

The assigned tutor uses `is_admin: true`. Enrolled students, observers, and
guest-demo participants use `is_admin: false`. With `auto_gen_user_id: false`,
`user_id` is the stable Kanvise identity; a second connection using the same ID
disconnects the first. Join tokens are short-lived and should be consumed
immediately, never stored as reusable credentials.

## Not yet verified — check before building on these

- Whether `voted_poll` in the analytics report contains per-option detail or just a boolean.
- The `RoomArtifactWebhookEvent` and `AnalyticsEvent` payload shapes are defined in their protobuf files (linked from the webhooks page: `plugnmeet-protocol` repo) rather than the prose docs — worth pulling those directly if an agent needs to parse them precisely rather than inferring from the JS example in the webhooks guide.
