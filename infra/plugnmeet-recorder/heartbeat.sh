#!/usr/bin/env bash
set -euo pipefail

# Installed on the private recorder VM. It makes an outbound HTTPS heartbeat
# only after the capture daemon is active; it never opens a port on the VM.
source /etc/plugnmeet-recorder.env
if ! systemctl is-active --quiet plugnmeet-recorder-capture.service; then
  exit 0
fi

body='{"state":"healthy"}'
signature=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$RECORDER_CALLBACK_SECRET" -hex | awk '{print $2}')
curl --fail --silent --show-error --max-time 10 \
  -H 'Content-Type: application/json' \
  -H "X-Kanvise-Recorder-Signature: ${signature}" \
  --data "$body" \
  "${KANVISE_RECORDER_CALLBACK_URL%/}/webhooks/recorder/heartbeat" >/dev/null
