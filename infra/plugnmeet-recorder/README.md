# On-demand PlugNmeet recorder

The recorder is one stopped-by-default EC2 instance, not a permanent server or
an Auto Scaling Group. The Kanvise scheduler requests it from T-10 through the
active class, then switches to the transcoder after the class ends and stops
the instance after the queue is empty. Start Now goes through the same request
before its room is created.

Run two PlugNmeet recorder services on that machine: `recorderOnly` accepts up
to two simultaneous capture jobs; `transcoderOnly` starts only after the last
class and processes one completed job at a time. They share the recorder
directory and NATS connection, so capture is never CPU-starved by FFmpeg.

The instance configuration must use 480p output with the
`post-transcoding-r2.sh` hook and receive its credentials from SSM Parameter
Store: never bake API keys, R2 keys, or the recorder callback secret into an
AMI or this repository.

Keep `plugnmeet-recorder-capture.service` enabled at boot. When capacity drops
to zero, the controller stops (but does not disable) capture before starting
the transcoder and idle-stop worker. Disabling capture here leaves the next
cold boot without a recorder because SSM is not online when the EC2 start
request returns.

Required API environment variables:

- `RECORDER_FLEET_CONTROLLER_URL` — Lambda Function URL for the instance controller.
- `RECORDER_FLEET_CONTROLLER_SECRET` — HMAC shared only by API and Lambda.

The Lambda needs only `ec2:DescribeInstances`, `ec2:StartInstances`, and
`ec2:StopInstances` for the explicit `RECORDER_INSTANCE_ID`. Its Function URL
must be restricted to Kanvise's API egress.

## Request authentication and desired state

The API stores the desired capacity, a version and a command ID in
`recorder_fleet_desired_state`, sends a command only when the state changed,
was never acknowledged, or the last acknowledgement is older than 10 minutes
(class entry forces one), and records the controller's acknowledgement.

Each request carries `X-Kanvise-Recorder-Fleet-Timestamp`,
`X-Kanvise-Recorder-Fleet-Nonce` and `X-Kanvise-Recorder-Fleet-Signature-V2`
(HMAC of `v2.<timestamp>.<nonce>.<body>`). The controller rejects timestamps
more than 5 minutes old, repeated nonces and commands older than one it has
already applied. The nonce and version memory lives in the warm Lambda
container only, so the 5-minute window is the hard bound on replay.

Rollout order, so nothing is rejected mid-deploy:

1. Deploy the new controller. It still accepts the legacy body-only signature.
2. Deploy the API. It sends both the legacy and the V2 signature.
3. Set `RECORDER_FLEET_REQUIRE_FRESHNESS=true` on the controller and
   `RECORDER_FLEET_SEND_LEGACY_SIGNATURE=false` on the API. Until then a
   captured request can be replayed by stripping the V2 headers.

## Readiness timing

Install `heartbeat.sh` as `/usr/local/bin/kanvise-recorder-heartbeat` and the
paired service/timer units. The recorder's existing
`/etc/plugnmeet-recorder.env` supplies `KANVISE_RECORDER_CALLBACK_URL` and
`RECORDER_CALLBACK_SECRET`; then enable the timer. Kanvise records three distinct timestamps: EC2 start requested, capture
service healthy, and the room-specific `recording_proceeded` webhook. Do not
use EC2 `running` as proof that a room can be recorded.
