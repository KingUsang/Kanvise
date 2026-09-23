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

Required API environment variables:

- `RECORDER_FLEET_CONTROLLER_URL` — Lambda Function URL for the instance controller.
- `RECORDER_FLEET_CONTROLLER_SECRET` — HMAC shared only by API and Lambda.

The Lambda needs only `ec2:DescribeInstances`, `ec2:StartInstances`, and
`ec2:StopInstances` for the explicit `RECORDER_INSTANCE_ID`. Its Function URL
must be restricted to Kanvise's API egress; the HMAC remains the application-
level replay barrier.
