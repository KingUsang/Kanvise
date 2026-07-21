# Kanvise — LiveKit Integration API Contract
**Version:** 1.0  
**Prepared by:** Architecture Team  
**Date:** June 2026  
**Status:** Approved — Shared with Live Class Developer

---

## Purpose

This document is the formal interface contract between the Kanvise backend (Hono on Scaleway) and the self-hosted LiveKit server (also on Scaleway). It defines every point of contact between the two systems — what Hono calls on LiveKit, what LiveKit sends back to Hono, the exact payload shapes, authentication methods, and the conventions both sides must follow.

This document is written for two audiences. The Kanvise backend developer needs it to implement the LiveKit-facing routes in Hono. The live class developer building and configuring the LiveKit server needs it to understand what Kanvise expects from LiveKit and what LiveKit can expect from Kanvise.

Both teams build independently using this document as the shared contract. Neither team should need to ask the other for clarification if this document is read carefully.

---

## 1. Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCALEWAY SERVER                           │
│                                                                  │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │     Hono API Server      │  │     LiveKit Server           │ │
│  │     Port: 3000           │  │     Port: 7880 (WebRTC)      │ │
│  │     Public: Yes          │  │     Port: 7881 (HTTPS API)   │ │
│  │                          │  │     Port: 7882 (webhook out) │ │
│  │  Manages:                │  │     Public: Yes (WebRTC)     │ │
│  │  - Room creation         │◄─┤                              │ │
│  │  - Token generation      │  │  Manages:                    │ │
│  │  - Attendance recording  │  │  - WebRTC routing            │ │
│  │  - Class state           │  │  - Video/audio streams       │ │
│  │                          │─►│  - Chat relay                │ │
│  │  Webhooks received from  │  │  - Participant state         │ │
│  │  LiveKit on private net  │  │  - Room lifecycle            │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
│                                                                  │
│         Private network — direct communication, no internet      │
└─────────────────────────────────────────────────────────────────┘

                               │ WebRTC (public internet)
                    ┌──────────▼──────────┐
                    │   Student/Tutor     │
                    │   Browser           │
                    │   LiveKit JS SDK    │
                    └─────────────────────┘
```

LiveKit and Hono run on the same Scaleway instance and communicate over the private network (localhost or local IP). The LiveKit WebRTC ports are exposed to the public internet so browsers can connect. The LiveKit HTTP API port (7881) is not exposed to the public internet — only Hono can reach it over the private network.

---

## 2. Naming Conventions

Both sides must use these conventions consistently. Mismatched names will break the attendance tracking system.

### 2.1 Room Names

LiveKit rooms are named using the Kanvise live class ID:

```
kanvise-class-{live_class_id}

Example:
kanvise-class-550e8400-e29b-41d4-a716-446655440000
```

This naming convention means the Hono webhook handler can extract the `live_class_id` directly from the room name in any LiveKit webhook event — no additional lookup needed.

### 2.2 Participant Identity

Every participant in a LiveKit room is identified by their Kanvise user ID:

```
{kanvise_user_id}

Examples:
KNV-TUT-00042   (tutor)
KNV-STU-00387   (student)
```

This means attendance records can be written directly using the participant identity as the lookup key — no token-to-user mapping table needed.

### 2.3 Room Metadata

When Hono creates a LiveKit room, it passes room metadata as a JSON string:

```json
{
  "live_class_id": "uuid",
  "course_id": "uuid",
  "school_id": "uuid",
  "scheduled_at": "ISO timestamp",
  "duration_minutes": 60
}
```

This metadata is available to LiveKit and can be read by the LiveKit developer for any server-side logic they need.

### 2.4 Participant Metadata

When Hono generates a participant token, it embeds participant metadata:

```json
{
  "kanvise_user_id": "KNV-STU-00387",
  "role": "tutor | student",
  "first_name": "string",
  "last_name": "string",
  "avatar_config": {
    "skin_tone": "s3",
    "face_shape": "f1",
    "hair_style": "h4",
    "hair_colour": "hc1",
    "outfit_colour": "oc2",
    "accessory": null,
    "headwear": null
  },
  "school_id": "uuid"
}
```

LiveKit transports this metadata but does not render the camera-off placeholder.
The Kanvise classroom frontend reads `avatar_config` and renders the same layered
SVG avatar used elsewhere in the application. No generated avatar image or CDN
upload is required.

---

## 3. Hono → LiveKit: Room Management

Hono calls the LiveKit server HTTP API to create and close rooms. These calls go over the private network to `http://localhost:7881` (or the LiveKit server's private IP).

### 3.1 Create Room

Called when a tutor clicks Start Class.

**LiveKit API call from Hono:**
```javascript
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk'

const roomService = new RoomServiceClient(
  process.env.LIVEKIT_API_URL,      // http://localhost:7881
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
)

const room = await roomService.createRoom({
  name: `kanvise-class-${liveClassId}`,
  emptyTimeout: 300,          // Close room after 5 min if empty
  maxParticipants: 500,       // Hard cap — adjust based on LiveKit capacity
  metadata: JSON.stringify({
    live_class_id: liveClassId,
    course_id: courseId,
    school_id: schoolId,
    scheduled_at: scheduledAt,
    duration_minutes: durationMinutes
  })
})
```

**On success:** Hono updates the `live_classes` record: `{ status: 'live', livekit_room_name: 'kanvise-class-{id}', started_at: now() }`.

**On failure:** Hono returns `500` to the frontend with code `LIVEKIT_ROOM_CREATION_FAILED`. The class status remains `scheduled`.

### 3.2 Close Room

Called when a tutor clicks End Class.

```javascript
await roomService.deleteRoom(`kanvise-class-${liveClassId}`)
```

**On success:** Hono updates the `live_classes` record: `{ status: 'completed', ended_at: now() }`. All participants are disconnected by LiveKit automatically when the room is deleted.

**On failure:** Room closure failure is logged but does not block the class from being marked as completed. The room will auto-close when it is empty (via the `emptyTimeout` setting).

---

## 4. Hono → LiveKit: Token Generation

Hono generates access tokens for participants. Tokens are signed using the LiveKit API secret. The frontend never communicates with LiveKit directly to get a token — it always goes through Hono.

### 4.1 Host Token (Tutor)

Generated when a tutor calls `POST /live-classes/:id/start`.

```javascript
const generateHostToken = (liveClassId, tutorProfile) => {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: tutorProfile.kanvise_user_id,
      ttl: '4h',
      metadata: JSON.stringify({
        kanvise_user_id: tutorProfile.kanvise_user_id,
        role: 'tutor',
        first_name: tutorProfile.first_name,
        last_name: tutorProfile.last_name,
        avatar_config: tutorProfile.avatar_config,
        school_id: tutorProfile.school_id
      })
    }
  )

  at.addGrant({
    roomJoin: true,
    room: `kanvise-class-${liveClassId}`,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: true,       // Allows tutor to mute participants, end class
    roomRecord: false      // Recording is post-MVP
  })

  return at.toJwt()
}
```

### 4.2 Participant Token (Student)

Generated when a student calls `POST /live-classes/:id/join`.

```javascript
const generateParticipantToken = (liveClassId, studentProfile) => {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: studentProfile.kanvise_user_id,
      ttl: '4h',
      metadata: JSON.stringify({
        kanvise_user_id: studentProfile.kanvise_user_id,
        role: 'student',
        first_name: studentProfile.first_name,
        last_name: studentProfile.last_name,
        avatar_config: studentProfile.avatar_config,
        school_id: studentProfile.school_id
      })
    }
  )

  at.addGrant({
    roomJoin: true,
    room: `kanvise-class-${liveClassId}`,
    canPublish: true,      // Student can share camera/mic
    canSubscribe: true,
    canPublishData: true,  // Student can send chat messages
    roomAdmin: false
  })

  return at.toJwt()
}
```

**Token TTL:** 4 hours. This covers the longest expected class duration with headroom. Tokens are not revocable for MVP — if a student is removed mid-class post-MVP, a token revocation mechanism will need to be added.

---

## 5. LiveKit → Hono: Webhook Events

LiveKit sends webhook events to Hono when participant or room state changes. This is the primary mechanism for attendance tracking.

### 5.1 Webhook Endpoint

```
POST http://localhost:3000/webhooks/livekit
```

This endpoint is on the private Scaleway network. It is not accessible from the public internet. LiveKit sends webhooks to this address over the local network.

### 5.2 Webhook Authentication

LiveKit signs every webhook payload with the LiveKit API secret using a JWT in the `Authorization` header. Hono must verify this before processing any event.

```javascript
import { WebhookReceiver } from 'livekit-server-sdk'

const webhookReceiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
)

app.post('/webhooks/livekit', async (ctx) => {
  const body = await ctx.req.text()
  const authHeader = ctx.req.header('Authorization')

  try {
    const event = webhookReceiver.receive(body, authHeader)
    await processLiveKitEvent(event)
    return ctx.json({ received: true }, 200)
  } catch (error) {
    // Invalid signature or malformed payload
    return ctx.json({ error: 'Invalid webhook' }, 400)
  }
})
```

**Hono must always return 200 to LiveKit, even if processing fails.** If Hono returns a non-200, LiveKit will retry the webhook. Processing failures must be handled internally (logged, queued for retry) without returning an error status to LiveKit.

### 5.3 Events Hono Handles

#### participant_joined

Fired when any participant (tutor or student) joins a room.

**LiveKit webhook payload:**
```json
{
  "event": "participant_joined",
  "room": {
    "name": "kanvise-class-550e8400-e29b-41d4-a716-446655440000",
    "sid": "room-sid",
    "metadata": "{\"live_class_id\":\"uuid\",\"school_id\":\"uuid\",...}"
  },
  "participant": {
    "sid": "participant-sid",
    "identity": "KNV-STU-00387",
    "name": "John Doe",
    "metadata": "{\"role\":\"student\",\"school_id\":\"uuid\",...}",
    "joined_at": 1718700000
  }
}
```

**Hono processing:**
```javascript
const handleParticipantJoined = async (event) => {
  const roomName = event.room.name
  const liveClassId = roomName.replace('kanvise-class-', '')
  const participantIdentity = event.participant.identity
  const joinedAt = new Date(event.participant.joined_at * 1000)
  const participantMeta = JSON.parse(event.participant.metadata)

  // Skip if participant is the tutor — tutors are not recorded in attendance
  // Attendance is for students only
  if (participantMeta.role === 'tutor') return

  // Look up student by kanvise_user_id
  const { data: student } = await supabase
    .from('user_profiles')
    .select('id, school_id')
    .eq('kanvise_user_id', participantIdentity)
    .single()

  if (!student) {
    console.error(`Attendance: unknown participant identity ${participantIdentity}`)
    return
  }

  // Create attendance record
  await supabase.from('attendance_records').insert({
    school_id: student.school_id,
    live_class_id: liveClassId,
    student_id: student.id,
    joined_at: joinedAt,
    left_at: null,
    duration_seconds: null
  })
}
```

#### participant_left

Fired when any participant leaves a room.

**LiveKit webhook payload:**
```json
{
  "event": "participant_left",
  "room": {
    "name": "kanvise-class-550e8400-e29b-41d4-a716-446655440000",
    "sid": "room-sid"
  },
  "participant": {
    "sid": "participant-sid",
    "identity": "KNV-STU-00387",
    "metadata": "{\"role\":\"student\",\"school_id\":\"uuid\",...}",
    "joined_at": 1718700000,
    "left_at": 1718703240
  }
}
```

**Hono processing:**
```javascript
const handleParticipantLeft = async (event) => {
  const liveClassId = event.room.name.replace('kanvise-class-', '')
  const participantIdentity = event.participant.identity
  const participantMeta = JSON.parse(event.participant.metadata)

  if (participantMeta.role === 'tutor') return

  const leftAt = new Date(event.participant.left_at * 1000)
  const joinedAt = new Date(event.participant.joined_at * 1000)
  const durationSeconds = Math.floor((leftAt - joinedAt) / 1000)

  const { data: student } = await supabase
    .from('user_profiles')
    .select('id, school_id')
    .eq('kanvise_user_id', participantIdentity)
    .single()

  if (!student) return

  // Find the most recent open attendance record for this student in this class
  // (student may have joined/left multiple times)
  const { data: record } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('live_class_id', liveClassId)
    .eq('student_id', student.id)
    .is('left_at', null)
    .order('joined_at', { ascending: false })
    .limit(1)
    .single()

  if (!record) return

  await supabase
    .from('attendance_records')
    .update({
      left_at: leftAt,
      duration_seconds: durationSeconds
    })
    .eq('id', record.id)
}
```

#### room_finished

Fired when a LiveKit room closes (either because Hono deleted it, or because it emptied and the `emptyTimeout` elapsed).

**LiveKit webhook payload:**
```json
{
  "event": "room_finished",
  "room": {
    "name": "kanvise-class-550e8400-e29b-41d4-a716-446655440000",
    "sid": "room-sid"
  }
}
```

**Hono processing:**
```javascript
const handleRoomFinished = async (event) => {
  const liveClassId = event.room.name.replace('kanvise-class-', '')

  // Close any attendance records that are still open
  // This handles the case where left_at was not received
  // (participant disconnected without a clean leave event)
  const now = new Date()

  const { data: openRecords } = await supabase
    .from('attendance_records')
    .select('id, joined_at')
    .eq('live_class_id', liveClassId)
    .is('left_at', null)

  for (const record of openRecords) {
    const durationSeconds = Math.floor(
      (now - new Date(record.joined_at)) / 1000
    )
    await supabase
      .from('attendance_records')
      .update({ left_at: now, duration_seconds: durationSeconds })
      .eq('id', record.id)
  }

  // Mark class as completed if it is not already
  await supabase
    .from('live_classes')
    .update({ status: 'completed', ended_at: now })
    .eq('id', liveClassId)
    .neq('status', 'completed')
}
```

### 5.4 Events LiveKit Sends That Hono Ignores

The following LiveKit events are received but not processed at MVP. Hono acknowledges them with 200 and discards:

- `room_started` — Hono already knows the room started because it created it
- `track_published` — not needed at MVP
- `track_unpublished` — not needed at MVP
- `egress_started`, `egress_updated`, `egress_ended` — recording is post-MVP

---

## 6. Frontend ↔ LiveKit: Client Integration

This section is for the Next.js developer implementing the live classroom UI.

### 6.1 Flow to Enter a Room

```
1. Tutor clicks Start Class OR Student clicks Join Class
2. Frontend calls Hono: POST /live-classes/:id/start OR /join
3. Hono returns:
   {
     "livekit_room_name": "kanvise-class-uuid",
     "access_token": "eyJ...",
     "livekit_url": "wss://livekit.kanvise.com"
   }
4. Frontend connects using LiveKit JS SDK:

   import { Room } from 'livekit-client'

   const room = new Room({
     adaptiveStream: true,
     dynacast: true
   })

   await room.connect(livekitUrl, accessToken)

5. Room is now connected — render the classroom UI
```

### 6.2 LiveKit Client SDK Import

The LiveKit client SDK must be imported as a **client-side only** import in Next.js. It cannot be used in Server Components or SSR contexts.

```javascript
// In a Client Component only
'use client'
import { Room, RoomEvent, Track, Participant } from 'livekit-client'
```

Use Next.js dynamic imports with `ssr: false` if the classroom component needs to be in a page that also renders server-side content:

```javascript
const LiveClassroom = dynamic(
  () => import('@/components/LiveClassroom'),
  { ssr: false }
)
```

### 6.3 Avatar as Camera-Off Placeholder

When a participant's camera is off, the Kanvise frontend shows the avatar
described by the JSON configuration embedded in participant metadata.

```javascript
room.on(RoomEvent.ParticipantConnected, (participant) => {
  const metadata = JSON.parse(participant.metadata || '{}')
  const avatarConfig = metadata.avatar_config

  // Render <Avatar config={avatarConfig} /> when the camera is off.
})

// Listen for camera track changes
participant.on(ParticipantEvent.TrackMuted, (publication) => {
  if (publication.track?.kind === Track.Kind.Video) {
    // Camera turned off — show avatar
  }
})
```

### 6.4 Raise Hand (Data Messages)

The raise hand button sends a data message to all participants in the room:

```javascript
// Student sends raise hand
const data = JSON.stringify({ type: 'raise_hand', student_id: 'KNV-STU-00387' })
await room.localParticipant.publishData(
  new TextEncoder().encode(data),
  { reliable: true }
)

// All participants receive it
room.on(RoomEvent.DataReceived, (payload, participant) => {
  const message = JSON.parse(new TextDecoder().decode(payload))
  if (message.type === 'raise_hand') {
    // Show raise hand indicator on participant's tile
  }
})
```

### 6.5 Chat Messages

Chat is also implemented via LiveKit data messages:

```javascript
// Send chat message
const message = JSON.stringify({
  type: 'chat',
  sender_name: 'Jane Doe',
  text: 'Can you repeat that?',
  sent_at: Date.now()
})
await room.localParticipant.publishData(
  new TextEncoder().encode(message),
  { reliable: true }
)
```

Chat messages are ephemeral — they are not stored in the Kanvise database at MVP.

### 6.6 Disconnection Handling

```javascript
room.on(RoomEvent.Disconnected, (reason) => {
  switch (reason) {
    case DisconnectReason.ROOM_DELETED:
      // Tutor ended the class — show "Class has ended" screen
      break
    case DisconnectReason.CLIENT_INITIATED:
      // User left intentionally — go to dashboard
      break
    default:
      // Unexpected disconnect — show reconnect prompt
      break
  }
})
```

---

## 7. LiveKit Server Configuration Requirements

This section is for the LiveKit developer configuring the LiveKit server on Scaleway.

### 7.1 Required Configuration

The LiveKit server must be configured with the following settings. These directly affect how Hono integrates with it.

```yaml
# livekit.yaml

port: 7880            # WebRTC port — must be publicly accessible
bind_addresses:
  - 0.0.0.0

rtc:
  tcp_port: 7881      # TCP fallback for WebRTC
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true   # Required for Scaleway public IP

keys:
  # API key and secret — must match LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Hono env
  {LIVEKIT_API_KEY}: {LIVEKIT_API_SECRET}

webhook:
  api_key: {LIVEKIT_API_KEY}
  urls:
    - http://localhost:3000/webhooks/livekit   # Hono webhook endpoint on private network

logging:
  level: info
  json: true
```

### 7.2 Webhook Configuration

The LiveKit server must be configured to send webhooks to Hono's private network address. The URL `http://localhost:3000/webhooks/livekit` assumes Hono and LiveKit run on the same Scaleway instance. If they run on separate instances within the same private network, use the private IP of the Hono server.

### 7.3 Events to Enable

The LiveKit developer must ensure the following events are enabled in the webhook configuration:

- `participant_joined` — **Required** for attendance tracking
- `participant_left` — **Required** for attendance tracking  
- `room_finished` — **Required** for cleanup and attendance finalisation
- `room_started` — Optional, Hono acknowledges and discards
- All other events — Optional

### 7.4 External IP for Nigerian Users

Because the Scaleway server is not in Nigeria, the `use_external_ip: true` setting is critical. Without it, LiveKit may advertise its internal IP to browsers for WebRTC ICE negotiation, causing connection failures for users outside the Scaleway network.

Additionally, the LiveKit developer should configure a **TURN server** to ensure connectivity for students on restricted networks (common in Nigerian institutional networks). Recommended: use Cloudflare's TURN service or a self-hosted Coturn instance.

---

## 8. Environment Variables

### Hono (Scaleway):
```
LIVEKIT_API_URL=http://localhost:7881
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_WEBHOOK_SECRET=same-as-api-secret
```

### Next.js (Vercel — browser-safe):
```
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.kanvise.com
```

The `NEXT_PUBLIC_LIVEKIT_URL` is the public WebSocket URL the browser connects to for the WebRTC session. This is the Scaleway server's public domain with the LiveKit WebRTC port. A domain name with SSL is required — browsers will not connect to a bare IP over WebSocket for WebRTC.

---

## 9. Error Scenarios & Handling

| Scenario | Who Detects | How Handled |
|---|---|---|
| Hono fails to create LiveKit room | Hono | Return 500 to frontend, log error, class stays `scheduled` |
| Student tries to join before class is live | Hono | Return 404 `CLASS_NOT_LIVE` before reaching LiveKit |
| Student not enrolled tries to join | Hono | Return 403 `NOT_ENROLLED` before reaching LiveKit |
| LiveKit fails to receive participant_joined webhook | LiveKit retries | Hono processes on retry — idempotent insert |
| participant_left webhook arrives with no matching joined record | Hono | Log warning, skip — student may have had a phantom join |
| room_finished fires before tutor clicked End Class | Hono | Mark class completed, close all open attendance records |
| Browser loses connection mid-class | LiveKit | Fires participant_left — attendance is finalised |
| Browser reconnects after losing connection | LiveKit | Fires participant_joined again — new attendance record created, duration accumulated |
| Token expires mid-class (4hr TTL) | LiveKit | Participant is disconnected — frontend must detect and re-fetch token from Hono |

### Idempotency for Attendance Records

The `participant_joined` handler must be idempotent. If LiveKit retries a webhook and Hono receives `participant_joined` twice for the same participant in the same class:

```javascript
// Check if a recent open record already exists before inserting
const { data: existingRecord } = await supabase
  .from('attendance_records')
  .select('id')
  .eq('live_class_id', liveClassId)
  .eq('student_id', student.id)
  .is('left_at', null)
  .gte('joined_at', new Date(joinedAt.getTime() - 5000)) // within 5 seconds
  .single()

if (existingRecord) return  // Already recorded — skip
```

---

## 10. What the Live Class Developer Does Not Need to Build

The live class developer's responsibility is the LiveKit server configuration and the browser-side classroom UI using the LiveKit JS SDK. The following are explicitly handled by Kanvise Hono and are not the live class developer's concern:

- User authentication — handled by Hono before any LiveKit token is issued
- Enrolment verification — Hono checks enrolment before generating a student token
- Attendance recording — Hono handles all attendance logic via webhooks
- Class scheduling — Hono owns the schedule and notifies students
- Avatar configuration lookup — Hono embeds the JSON configuration in the token;
  the classroom frontend renders the layered SVG avatar
- Chat persistence — not in scope for MVP

---

## 11. Testing the Integration

### 11.1 Local Testing

For local development, the LiveKit developer can run a local LiveKit server using Docker:

```bash
docker run --rm \
  -p 7880:7880 \
  -p 7881:7881 \
  -p 7882:7882 \
  -e LIVEKIT_KEYS="devkey: devsecret" \
  livekit/livekit-server \
  --dev
```

Update Hono's `LIVEKIT_API_URL` to `http://localhost:7881`, `LIVEKIT_API_KEY` to `devkey`, and `LIVEKIT_API_SECRET` to `devsecret` for local development.

### 11.2 Webhook Testing Locally

Since webhooks require a reachable URL, use ngrok or a similar tunnelling tool to expose the local Hono server during development:

```bash
ngrok http 3000
```

Update the LiveKit webhook URL in `livekit.yaml` to the ngrok URL during local testing.

### 11.3 Attendance Verification Test

A complete integration test should:
1. Create a live class via Hono API
2. Start the class (creates LiveKit room)
3. Join as a student (gets participant token)
4. Wait for `participant_joined` webhook to arrive at Hono
5. Verify attendance record exists in database: `joined_at` set, `left_at` null
6. Disconnect the student
7. Wait for `participant_left` webhook
8. Verify attendance record updated: `left_at` set, `duration_seconds` calculated
9. End the class
10. Verify `room_finished` webhook received and any open records closed

---

*End of Document — Version 1.0*
