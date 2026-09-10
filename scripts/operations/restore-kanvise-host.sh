#!/usr/bin/env bash
set -euo pipefail

LIVEKIT_VERSION="1.13.4"
REDIS_IMAGE="redis:7.4.11-alpine"
PM2_VERSION="7.0.3"

usage() {
  echo "Usage: sudo bash restore-kanvise-host.sh /path/to/server-app-state.tar.gz" >&2
  exit 64
}

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 77
fi

archive=${1:-}
[[ -n ${archive} && -f ${archive} ]] || usage

for destination in /root/Kanvise-production /root/Kanvise-staging; do
  if [[ -e ${destination} ]]; then
    echo "Refusing to overwrite existing ${destination}. Use a fresh VM." >&2
    exit 73
  fi
done

case "$(uname -m)" in
  aarch64|arm64)
    livekit_asset="livekit_${LIVEKIT_VERSION}_linux_arm64.tar.gz"
    livekit_sha256="691d34c0d0095a3d5c6dfb9d7e9353a0600a3423d498136037001626d281ad64"
    ;;
  x86_64|amd64)
    livekit_asset="livekit_${LIVEKIT_VERSION}_linux_amd64.tar.gz"
    livekit_sha256="549bcbe07a92685e45dfd98d8e7cbafd0e1c91d3502fd417079162e1a3f18d17"
    ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 69
    ;;
esac

restore_dir=$(mktemp -d /tmp/kanvise-restore.XXXXXX)
chmod 700 "${restore_dir}"
tar -xzf "${archive}" -C "${restore_dir}"

for required in \
  root/Kanvise-production/api/.env \
  root/Kanvise-staging/api/.env \
  root/livekit.yaml \
  root/.pm2/dump.pm2 \
  etc/caddy/Caddyfile; do
  [[ -f ${restore_dir}/${required} ]] || {
    echo "Backup is missing ${required}." >&2
    exit 65
  }
done

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl debian-keyring debian-archive-keyring gnupg git docker.io
systemctl enable --now docker

nodesource_setup="${restore_dir}/nodesource-setup.sh"
curl -fsSL https://deb.nodesource.com/setup_22.x -o "${nodesource_setup}"
bash "${nodesource_setup}"
apt-get install -y nodejs
node -e "if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)"
npm install --global "pm2@${PM2_VERSION}"

install -d -m 0755 /usr/share/keyrings /etc/apt/sources.list.d
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
systemctl stop caddy

cp -a "${restore_dir}/root/Kanvise-production" /root/Kanvise-production
cp -a "${restore_dir}/root/Kanvise-staging" /root/Kanvise-staging
if [[ -d ${restore_dir}/root/Kanvise ]]; then
  cp -a "${restore_dir}/root/Kanvise" /root/Kanvise
fi
install -m 0600 "${restore_dir}/root/livekit.yaml" /root/livekit.yaml
install -d -m 0700 /root/kanvise-egress /root/.pm2
if [[ -f ${restore_dir}/root/kanvise-egress/config.yaml ]]; then
  install -m 0600 "${restore_dir}/root/kanvise-egress/config.yaml" /root/kanvise-egress/config.yaml
fi
install -m 0600 "${restore_dir}/root/.pm2/dump.pm2" /root/.pm2/dump.pm2
install -m 0644 "${restore_dir}/etc/caddy/Caddyfile" /etc/caddy/Caddyfile

livekit_archive="${restore_dir}/${livekit_asset}"
curl -fsSL --retry 4 --retry-delay 2 \
  "https://github.com/livekit/livekit/releases/download/v${LIVEKIT_VERSION}/${livekit_asset}" \
  -o "${livekit_archive}"
echo "${livekit_sha256}  ${livekit_archive}" | sha256sum --check
tar -xzf "${livekit_archive}" -C "${restore_dir}" livekit-server
install -m 0755 "${restore_dir}/livekit-server" /usr/local/bin/livekit-server

redis_source=$(find "${restore_dir}/var/lib/docker/volumes" -type d -name _data -print -quit 2>/dev/null || true)
[[ -n ${redis_source} ]] || {
  echo "The backup does not contain the persisted Redis data." >&2
  exit 65
}
docker volume create kanvise-livekit-redis-data >/dev/null
docker run --rm \
  -v "${redis_source}:/source:ro" \
  -v kanvise-livekit-redis-data:/target \
  alpine:3.22 sh -c 'cp -a /source/. /target/'
docker run -d \
  --name kanvise-livekit-redis \
  --network host \
  --restart unless-stopped \
  -v kanvise-livekit-redis-data:/data \
  "${REDIS_IMAGE}" redis-server --bind 127.0.0.1 --protected-mode yes --appendonly yes >/dev/null

for attempt in {1..30}; do
  if docker exec kanvise-livekit-redis redis-cli ping 2>/dev/null | grep -q PONG; then
    break
  fi
  if [[ ${attempt} -eq 30 ]]; then
    echo "Redis did not become ready." >&2
    exit 70
  fi
  sleep 1
done

cat >/etc/systemd/system/kanvise-livekit.service <<'UNIT'
[Unit]
Description=Kanvise self-hosted LiveKit
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/root
ExecStartPre=/usr/bin/docker exec kanvise-livekit-redis redis-cli ping
ExecStart=/usr/local/bin/livekit-server --config /root/livekit.yaml
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now kanvise-livekit

for checkout in /root/Kanvise-production /root/Kanvise-staging; do
  cd "${checkout}"
  npm ci --workspace=api --include=dev --no-audit --no-fund
  npm run build --workspace=api
done

pm2 resurrect
pm2 save
pm2 startup systemd -u root --hp /root

caddy validate --config /etc/caddy/Caddyfile

curl --fail --silent --show-error --retry 5 --retry-connrefused http://127.0.0.1:3001/health >/dev/null
curl --fail --silent --show-error --retry 5 --retry-connrefused http://127.0.0.1:3002/health >/dev/null
docker exec kanvise-livekit-redis redis-cli ping | grep -q PONG
systemctl is-active --quiet kanvise-livekit

cat <<'NEXT'
Restore verified locally. Caddy remains stopped until DNS points to this VM.

Open these ingress rules in the cloud firewall/security list:
  TCP: 22, 80, 443, 7881
  UDP: 7882

Then run finalize-kanvise-cutover.sh with this VM's public IPv4 address.
NEXT
