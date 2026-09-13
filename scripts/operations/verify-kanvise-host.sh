#!/usr/bin/env bash
set -euo pipefail

failures=0
check() {
  local label=$1
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS %s\n' "${label}"
  else
    printf 'FAIL %s\n' "${label}" >&2
    failures=$((failures + 1))
  fi
}

check "production API localhost" curl --fail --silent --max-time 8 http://127.0.0.1:3001/health
check "staging API localhost" curl --fail --silent --max-time 8 http://127.0.0.1:3002/health
check "Redis persistence service" docker exec kanvise-livekit-redis redis-cli ping
check "LiveKit systemd service" systemctl is-active --quiet kanvise-livekit
check "LiveKit API listener" bash -c 'ss -lnt | grep -q ":7880"'
check "LiveKit TCP fallback" bash -c 'ss -lnt | grep -q ":7881"'
check "LiveKit UDP mux" bash -c 'ss -lnu | grep -q ":7882"'
check "PM2 production process" pm2 describe kanvise-api
check "PM2 staging process" pm2 describe kanvise-staging
check "Caddy configuration" caddy validate --config /etc/caddy/Caddyfile

if (( failures > 0 )); then
  echo "${failures} migration check(s) failed." >&2
  exit 1
fi

echo "All replacement-host checks passed."
