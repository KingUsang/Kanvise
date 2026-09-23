#!/usr/bin/env bash
set -euo pipefail

idle=0
while :; do
  # A fresh capture request owns the machine; never stop it from this monitor.
  if systemctl is-active --quiet plugnmeet-recorder-capture.service; then
    exit 0
  fi
  if systemctl is-active --quiet plugnmeet-recorder-transcoder.service || pgrep -x ffmpeg >/dev/null; then
    idle=0
  else
    idle=$((idle + 1))
  fi
  if [ "$idle" -ge 3 ]; then
    systemctl stop plugnmeet-recorder-transcoder.service
    metadata_token=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')
    instance_id=$(curl -fsS -H "X-aws-ec2-metadata-token: ${metadata_token}" http://169.254.169.254/latest/meta-data/instance-id)
    aws ec2 stop-instances --region eu-north-1 --instance-ids "$instance_id"
    exit 0
  fi
  sleep 300
done
