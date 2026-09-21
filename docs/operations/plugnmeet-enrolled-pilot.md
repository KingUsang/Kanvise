# PlugNmeet enrolled-class pilot runbook

This pilot uses the repurposed PlugNmeet VM for both classroom profiles.
Enrolled rooms have the learning/recording layer; guest/link rooms are a
restricted PlugNmeet preview profile.

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
PLUGNMEET_GUEST_ENABLED=true
RECORDER_CALLBACK_SECRET=<long-random-shared-secret>
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

The PlugNmeet server is currently the repurposed Azure `kanvise-livekit` VM.
It owns the classroom media stack and TURN (`livekit.kanvise.com` and
`turn.kanvise.com`). The PlugNmeet recorder is intentionally not enabled on
that VM. Recording capture is a separate AWS on-demand worker and is not yet
provisioned; do not treat the Azure VM as a recorder.

The installation guide requires a clean Ubuntu/Debian host with a public IP,
TLS, and the PlugNmeet and TURN subdomains; production guidance calls for at
least 4 CPU cores, 4 GB RAM, and 100 Mbps bandwidth, with 8+ cores/RAM
recommended when recording. The Azure VM meets the classroom requirement;
the AWS recorder remains an infrastructure prerequisite before recording can
be tested end to end.
The client asset response must be reachable from the Kanvise browser over HTTPS.

The PlugNmeet client is loaded by defining `window.plugNmeetConfig`, creating
`<div id="plugNmeet-app">`, placing the short-lived `pnm_access_token` cookie,
and loading the returned CSS/JS files. The `main-module.*` file must be loaded
as an ES module; no custom `initializePlugNmeet()` call is required.

## Room profile

Enrolled rooms use a 1,000-participant infrastructure safety ceiling (the
current PlugNmeet room API rejects zero), analytics, tutor-controlled recording,
whiteboard/PDF support, and polls. Tutors use PlugNmeet's native **Generate with
AI** poll flow: they type a short prompt, edit the generated native poll form,
then create the poll. Screen sharing, file uploads, virtual backgrounds, RTMP,
breakout rooms, transcription, meeting summarization, and E2EE are disabled.
The native AI poll composer is enabled for moderators. The
browser uses adaptive stream, dynacast, simulcast, VP8, h360, camera-off entry,
and device-specific webcam limits.

The recorder's `post_transcoding` hook uploads the finished MP4 directly to
private R2, deletes its local temporary file, and sends an HMAC-signed callback
to `/webhooks/plugnmeet-recording-upload`. Kanvise verifies the R2 object
before marking it playable. Deepgram then reads the R2 object and Gemini makes
a tutor-editable summary draft. A stopped/restarted recording is stored as
segments; PlugNmeet merges them asynchronously before the student-facing R2
recording is published. Guest/link classes do not enter this pipeline.

Install [`post-transcoding-r2.sh`](../../infra/plugnmeet-recorder/post-transcoding-r2.sh)
on the recorder, make it executable, install `curl`, `jq`, and `openssl`, and
configure it as the recorder's long-lived `post_transcoding` script. Set
`KANVISE_RECORDER_CALLBACK_URL=https://<kanvise-api-host>` and the same
`RECORDER_CALLBACK_SECRET` held by the API. The recorder receives one-time
presigned URLs only; it does not receive broad R2 credentials.

## AWS recorder approval gate

Do not provision the paid recorder until AWS credentials, region, budget owner,
and R2/Deepgram provider values are available. The approved pilot target is
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
4. Start and stop a tutor-controlled recording after the AWS recorder is
   provisioned; wait for `recording_proceeded` and the processing job to finish.
5. As the tutor, review and publish the generated summary; as an enrolled
   student, verify the recording and summary are visible. Confirm an
   unenrolled user cannot access either resource.
6. Enable Polls, use PlugNmeet's native Generate with AI flow, edit the draft,
   and run one quiz.
7. End the room and verify webhook idempotency and attendance records.
8. Join a guest/link class and confirm it uses PlugNmeet with recording,
   analytics and summaries unavailable.

Rollback is the reversible operation of setting
`PLUGNMEET_ENROLLED_ENABLED=false` or removing a school from
`PLUGNMEET_PILOT_SCHOOL_IDS`. Existing persisted PlugNmeet classes should be
allowed to finish; do not silently change their provider mid-session.
