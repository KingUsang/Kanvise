# PlugNmeet enrolled-class pilot runbook

This pilot routes only enrolled classes through PlugNmeet. Guest/link classes
remain on the existing LiveKit path.

## Enablement

Set these API environment variables after the PlugNmeet server is reachable:

```text
PLUGNMEET_ENROLLED_ENABLED=true
PLUGNMEET_PILOT_SCHOOL_IDS=<one-or-more-school-uuids>
PLUGNMEET_SERVER_URL=https://<plugnmeet-host>
PLUGNMEET_API_KEY=<server-api-key>
PLUGNMEET_API_SECRET=<server-api-secret>
PLUGNMEET_WEBHOOK_SECRET=<webhook-secret>
PLUGNMEET_WEBHOOK_URL=https://<kanvise-api-host>/webhooks/plugnmeet
```

Keep the flag `false` until the provider health check, webhook signature check,
and browser smoke test pass. The API secret is server-only; never add it to
the web application environment.

## PlugNmeet server configuration

The PlugNmeet server must have webhooks enabled. Configure a supported
Insights `ai_text_chat` provider (for example Gemini or OpenAI) because the
native Generate with AI poll composer uses it; transcription and meeting
summarization can remain disabled. If Kanvise supplies a
per-room `webhook_url`, the server must also allow per-meeting webhook URLs:

```yaml
webhook_conf:
  enable: true
  enable_for_per_meeting: true
  url: ""

copyright_conf:
  allow_override: true
```

The server and recorder services should both be active. The installation guide
requires a clean Ubuntu/Debian host with a public IP, TLS, and the PlugNmeet
and TURN subdomains; production guidance calls for at least 4 CPU cores, 4 GB
RAM, and 100 Mbps bandwidth, with 8+ cores/RAM recommended when recording.
The client asset response must be reachable from the Kanvise browser over HTTPS.

The PlugNmeet client is loaded by defining `window.plugNmeetConfig`, creating
`<div id="plugNmeet-app">`, placing the short-lived `pnm_access_token` cookie,
and loading the returned CSS/JS files. The `main-module.*` file must be loaded
as an ES module; no custom `initializePlugNmeet()` call is required.

## Room profile

Enrolled rooms use `max_participants: 0`, analytics, tutor-controlled recording,
whiteboard/PDF support, and polls. Tutors use PlugNmeet's native **Generate with
AI** poll flow: they type a short prompt, edit the generated native poll form,
then create the poll. Screen sharing, file uploads, virtual backgrounds, RTMP,
breakout rooms, transcription, meeting summarization, and E2EE are disabled.
The native AI poll composer is enabled for moderators. The
browser uses adaptive stream, dynacast, simulcast, VP8, h360, camera-off entry,
and device-specific webcam limits.

Transcript-aware question generation, Deepgram, Kanvise-owned Quick Check
editing, and automated summaries are deliberately deferred. They require a
custom PlugNmeet build or a separate audio pipeline and are not prerequisites
for this pilot.

## AWS recorder approval gate

Do not provision the paid recorder automatically. The approved pilot target is
an encrypted, On-Demand `c7a.2xlarge` Ubuntu 24.04 EC2 instance with 40 GiB
root storage, 250 GiB encrypted scratch storage, WireGuard to Azure, and an
initial two-recording limit. No internal recorder port is public.

Before starting it, confirm the AWS region, budget owner, retention policy,
security-group review, and R2 transfer test. Stop the instance when the pilot
is not actively recording.

## Smoke test and rollback

Use one pilot school, one tutor, three enrolled students, and one administrator:

1. Start an enrolled class and confirm the PlugNmeet client loads.
2. Join as an enrolled student; verify camera-off, muted, and data-saver defaults.
3. Attempt the same class as an unenrolled student; expect `NOT_ENROLLED`.
4. Start and stop a tutor-controlled recording after AWS approval.
5. Enable Polls, use PlugNmeet's native Generate with AI flow, edit the draft,
   and run one quiz.
6. End the room and verify webhook idempotency and attendance records.
7. Join a guest/link class and confirm it still uses LiveKit.

Rollback is the reversible operation of setting
`PLUGNMEET_ENROLLED_ENABLED=false` or removing a school from
`PLUGNMEET_PILOT_SCHOOL_IDS`. Existing persisted PlugNmeet classes should be
allowed to finish; do not silently change their provider mid-session.
