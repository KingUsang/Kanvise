#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 77
fi

expected_ip=${1:-}
if [[ -z ${expected_ip} ]]; then
  echo "Usage: sudo bash finalize-kanvise-cutover.sh PUBLIC_IPV4" >&2
  exit 64
fi

for host in api.kanvise.com staging-api.kanvise.com livekit.kanvise.com; do
  resolved=$(getent ahostsv4 "${host}" | awk 'NR == 1 { print $1 }')
  if [[ ${resolved} != "${expected_ip}" ]]; then
    echo "${host} resolves to ${resolved:-nothing}, expected ${expected_ip}. DNS cutover is not ready." >&2
    exit 69
  fi
done

caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl restart caddy

curl --fail --silent --show-error --retry 12 --retry-delay 5 https://api.kanvise.com/health >/dev/null
curl --fail --silent --show-error --retry 12 --retry-delay 5 https://staging-api.kanvise.com/health >/dev/null
curl --silent --show-error --retry 12 --retry-delay 5 --output /dev/null https://livekit.kanvise.com

pm2 save
echo "Public API and LiveKit endpoints are reachable on the replacement VM."
