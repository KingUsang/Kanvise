#!/usr/bin/env bash
set -euo pipefail

deploy_environment=${DEPLOY_ENVIRONMENT:?DEPLOY_ENVIRONMENT is required}
artifact_dir=${DEPLOY_ARTIFACT_DIR:?DEPLOY_ARTIFACT_DIR is required}
release_sha=${RELEASE_SHA:?RELEASE_SHA is required}

case "${deploy_environment}" in
  staging)
    deploy_root=/opt/kanvise-staging
    service_name=kanvise-api-staging
    app_port=3002
    public_health_url=https://staging-api.kanvise.com/health
    ;;
  production)
    deploy_root=/opt/kanvise-production
    service_name=kanvise-api-production
    app_port=3001
    public_health_url=https://api.kanvise.com/health
    ;;
  *)
    echo "Unsupported deployment environment: ${deploy_environment}" >&2
    exit 64
    ;;
esac

case "${release_sha}" in
  *[!0-9a-f]*|'') echo "Invalid release SHA" >&2; exit 64 ;;
esac

test -f "${artifact_dir}/index.js"
test -f "${GITHUB_WORKSPACE}/package.json"
test -f "${GITHUB_WORKSPACE}/package-lock.json"
test -f "${GITHUB_WORKSPACE}/api/package.json"
test -f "${deploy_root}/api/.env"
# Email and notification links throw without FRONTEND_URL, so refuse to deploy without it.
grep -Eq '^[[:space:]]*(export[[:space:]]+)?FRONTEND_URL=[^[:space:]#]' "${deploy_root}/api/.env" \
  || { echo "FRONTEND_URL must be set in ${deploy_root}/api/.env" >&2; exit 66; }

exec 9>"/tmp/kanvise-${deploy_environment}-deploy.lock"
flock -n 9 || { echo "Another ${deploy_environment} deployment is running" >&2; exit 75; }

next_dist="${deploy_root}/api/dist.next-${release_sha}"
previous_dist="${deploy_root}/api/dist.previous-${release_sha}"
manifest_backup=$(mktemp -d "/tmp/kanvise-${deploy_environment}-manifests.XXXXXX")
dependencies_changed=false

cleanup() {
  rm -rf "${next_dist}" "${manifest_backup}"
}
trap cleanup EXIT

rm -rf "${next_dist}" "${previous_dist}"
install -d -m 0755 "${next_dist}"
cp -a "${artifact_dir}/." "${next_dist}/"
test -f "${next_dist}/index.js"
printf '{"release_sha":"%s","environment":"%s"}\n' "${release_sha}" "${deploy_environment}" > "${next_dist}/release.json"

verify_health() {
  local health_url=$1
  local body
  body=$(curl --fail --silent --show-error --retry 8 --retry-connrefused --retry-delay 2 "${health_url}") || {
    echo "Health check failed: ${health_url} did not return a successful response" >&2
    return 1
  }
  HEALTH_BODY=${body} node -e '
    let health;
    try {
      health = JSON.parse(process.env.HEALTH_BODY || "");
    } catch {
      console.error("Health check failed: response was empty or not valid JSON");
      process.exit(1);
    }
    if (health.status !== "ok" || health.release_sha !== process.argv[1] || health.environment !== process.argv[2]) {
      console.error("Health check failed: unexpected payload " + JSON.stringify(health));
      process.exit(1);
    }
  ' "${release_sha}" "${deploy_environment}"
}

# Best-effort diagnosis before rollback. Assumes the runner user ("ubuntu") may
# run `sudo -n systemctl`, as the restart below already requires. journalctl
# first tries `sudo -n` (works when sudoers allows it) and falls back to a plain
# call (works when the user is in the adm or systemd-journal group). Nothing
# here may fail the deployment script itself.
print_service_diagnosis() {
  echo "::group::Diagnosis for ${service_name}" >&2
  sudo -n systemctl status "${service_name}" --no-pager --full >&2 || true
  { sudo -n journalctl -u "${service_name}" -n 50 --no-pager \
    || journalctl -u "${service_name}" -n 50 --no-pager; } >&2 \
    || echo "Could not read the journal for ${service_name} (no sudo or group access)" >&2
  echo "::endgroup::" >&2
}

for manifest in package.json package-lock.json api/package.json; do
  install -D -m 0644 "${deploy_root}/${manifest}" "${manifest_backup}/${manifest}"
  if ! cmp -s "${GITHUB_WORKSPACE}/${manifest}" "${deploy_root}/${manifest}"; then
    dependencies_changed=true
  fi
done

restore_manifests() {
  for manifest in package.json package-lock.json api/package.json; do
    install -D -m 0644 "${manifest_backup}/${manifest}" "${deploy_root}/${manifest}"
  done
}

if [[ ${dependencies_changed} == true ]]; then
  for manifest in package.json package-lock.json api/package.json; do
    install -D -m 0644 "${GITHUB_WORKSPACE}/${manifest}" "${deploy_root}/${manifest}"
  done
  if ! npm ci --prefix "${deploy_root}" --workspace=api --omit=dev --ignore-scripts --no-audit --no-fund; then
    restore_manifests
    npm ci --prefix "${deploy_root}" --workspace=api --omit=dev --ignore-scripts --no-audit --no-fund || true
    exit 1
  fi
fi

mv "${deploy_root}/api/dist" "${previous_dist}"
mv "${next_dist}" "${deploy_root}/api/dist"

if ! sudo -n systemctl restart "${service_name}" \
  || ! verify_health "http://127.0.0.1:${app_port}/health" \
  || ! verify_health "${public_health_url}"; then
  print_service_diagnosis
  rm -rf "${deploy_root}/api/dist"
  mv "${previous_dist}" "${deploy_root}/api/dist"
  if [[ ${dependencies_changed} == true ]]; then
    restore_manifests
    npm ci --prefix "${deploy_root}" --workspace=api --omit=dev --ignore-scripts --no-audit --no-fund || true
  fi
  sudo -n systemctl restart "${service_name}"
  exit 1
fi

rm -rf "${previous_dist}"
echo "Deployed ${release_sha} to ${deploy_environment}"
