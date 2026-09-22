# On-demand PlugNmeet recorder fleet

The recorder fleet is an AWS Auto Scaling Group, not a permanent server. The
Kanvise scheduler sends its desired capacity every minute: one worker for each
overlapping enrolled PlugNmeet recording window, starting ten minutes before
class and retained for 45 minutes after completion so post-transcoding and the
R2 callback can finish. PlugNmeet's recorder protocol automatically balances
recording tasks across active workers.

The launch template must run the official recorder in `both` mode with a local
temporary directory and the `post-transcoding-r2.sh` hook. It must receive its
configuration from SSM Parameter Store: never bake API keys, R2 keys, or the
recorder callback secret into an AMI or this repository.

Required API environment variables:

- `RECORDER_FLEET_CONTROLLER_URL` — Lambda Function URL.
- `RECORDER_FLEET_CONTROLLER_SECRET` — HMAC shared only by API and Lambda.

The Lambda needs only `autoscaling:SetDesiredCapacity` on the one recorder ASG.
Its Function URL must use `AWS_IAM` or a resource policy that limits invocation
to Kanvise's API egress; the HMAC remains the application-level replay barrier.
