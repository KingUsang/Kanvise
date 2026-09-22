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

while IFS= read -r hook; do
  # PlugNmeet gives post_transcoding hooks the *directory* in input_path and
  # the transcoded filename separately. Hook-manager reads one JSON document
  # per line, so every response below must be compact JSON.
  input_dir="$(jq -r '.input_path // empty' <<<"$hook")"
  file_name="$(jq -r '.file_name // empty' <<<"$hook")"
  room_id="$(jq -r '.room_id // empty' <<<"$hook")"
  recording_id="$(jq -r '.recording_id // empty' <<<"$hook")"
  input_path="${input_dir%/}/${file_name}"
  if [[ -z "$input_dir" || -z "$file_name" || -z "$room_id" || -z "$recording_id" || ! -f "$input_path" ]]; then
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
