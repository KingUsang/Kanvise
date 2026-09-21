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
PLUGNMEET_BRIDGE_SIGNING_SECRET=<transcription-bridge-secret>
PLUGNMEET_BRIDGE_URL=https://<transcription-bridge-host>
```

Keep the flag `false` until the provider health check, webhook signature check,
and browser smoke test pass. The API secret is server-only; never add it to
the web application environment.

## PlugNmeet server configuration

The PlugNmeet server must have webhooks enabled. If Kanvise supplies a
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
whiteboard/PDF support, and polls. Screen sharing, file uploads, virtual
backgrounds, RTMP, breakout rooms, Insights, and E2EE are disabled. The
browser uses adaptive stream, dynacast, simulcast, VP8, h360, camera-off entry,
and device-specific webcam limits.

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
5. Generate a Quick Check from tutor audio only and publish it as three quizzes.
6. End the room and verify webhook idempotency and attendance records.
7. Publish the tutor-reviewed recap; verify only course-enrolled students receive it.
8. Join a guest/link class and confirm it still uses LiveKit.

Rollback is the reversible operation of setting
`PLUGNMEET_ENROLLED_ENABLED=false` or removing a school from
`PLUGNMEET_PILOT_SCHOOL_IDS`. Existing persisted PlugNmeet classes should be
allowed to finish; do not silently change their provider mid-session.
