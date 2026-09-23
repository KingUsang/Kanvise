#!/usr/bin/env bash
# Long-lived plugNmeet recorder post_transcoding hook.
# Required env: KANVISE_RECORDER_CALLBACK_URL, RECORDER_CALLBACK_SECRET.
# It asks Kanvise for a one-time R2 upload URL, uploads the final MP4, confirms
# delivery, then removes the recorder-local temporary file.
set -u -o pipefail

sign_body() {
  printf '%s' "$1" | openssl dgst -sha256 -hmac "$RECORDER_CALLBACK_SECRET" -hex | sed 's/^.* //'
}

post_json() {
  local path="$1" body="$2" signature
  signature="$(sign_body "$body")"
  curl --silent --show-error --fail --request POST \
    --header 'Content-Type: application/json' \
    --header "X-Kanvise-Recorder-Signature: ${signature}" \
    --data "$body" \
    "${KANVISE_RECORDER_CALLBACK_URL%/}${path}"
}

hook_buffer=''
while IFS= read -r hook_line; do
  # The recorder currently writes pretty-printed JSON to long-lived hooks.
  # Accumulate lines until there is one complete document, then compact it.
  hook_buffer+="${hook_line}"$'\n'
  if ! hook="$(jq -ce '.' <<<"$hook_buffer" 2>/dev/null)"; then
    continue
  fi
  hook_buffer=''
  # PlugNmeet gives post_transcoding hooks the complete transcoded file path in
  # input_path. Older recorder builds may also provide file_name; support both.
  input_path="$(jq -r '.input_path // empty' <<<"$hook")"
  file_name="$(jq -r '.file_name // empty' <<<"$hook")"
  room_id="$(jq -r '.room_id // empty' <<<"$hook")"
  recording_id="$(jq -r '.recording_id // empty' <<<"$hook")"
  if [[ -n "$file_name" && -d "$input_path" ]]; then input_path="${input_path%/}/${file_name}"; fi
  if [[ -z "$input_path" || -z "$room_id" || -z "$recording_id" || ! -f "$input_path" ]]; then
    echo 'Recording hook did not include a valid transcoded file, room_id, and recording_id' >&2
    jq -c '.' <<<"$hook"
    continue
  fi

  file_size_bytes="$(stat --format='%s' "$input_path")"
  prepare_body="$(jq -nc --arg room_id "$room_id" --arg recording_id "$recording_id" --arg content_type 'video/mp4' --argjson file_size_bytes "$file_size_bytes" '{room_id:$room_id,recording_id:$recording_id,content_type:$content_type,file_size_bytes:$file_size_bytes}')"
  if ! prepare_response="$(post_json '/webhooks/plugnmeet-recording-upload/prepare' "$prepare_body")"; then
    echo 'Kanvise did not issue a recording upload URL; retaining local recording for retry' >&2
    jq -c '.' <<<"$hook"
    continue
  fi
  upload_url="$(jq -r '.data.presigned_url // empty' <<<"$prepare_response")"
  r2_file_key="$(jq -r '.data.r2_file_key // empty' <<<"$prepare_response")"
  if [[ -z "$upload_url" || -z "$r2_file_key" ]] || ! curl --silent --show-error --fail --request PUT --header 'Content-Type: video/mp4' --upload-file "$input_path" "$upload_url"; then
    echo 'R2 upload failed; retaining local recording for retry' >&2
    jq -c '.' <<<"$hook"
    continue
  fi

  delivered_body="$(jq -nc --arg room_id "$room_id" --arg recording_id "$recording_id" --arg r2_file_key "$r2_file_key" --arg content_type 'video/mp4' --argjson file_size_bytes "$file_size_bytes" '{room_id:$room_id,recording_id:$recording_id,r2_file_key:$r2_file_key,content_type:$content_type,file_size_bytes:$file_size_bytes}')"
  if ! post_json '/webhooks/plugnmeet-recording-upload' "$delivered_body" >/dev/null; then
    echo 'R2 upload succeeded but Kanvise confirmation failed; retaining local recording for retry' >&2
    jq -c '.' <<<"$hook"
    continue
  fi
  rm -f -- "$input_path"
  jq -c --arg output_path "$r2_file_key" '. + {output_path: $output_path, should_cleanup: false}' <<<"$hook"
done
