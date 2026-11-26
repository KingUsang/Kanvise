# Kanvise operational runbooks

Only current, executable operational procedures belong here. Existing files in
`docs/operations/` will be reviewed during the deployment and operations slice;
they are not moved or treated as current automatically.

## Staging real journey gate: real devices

`.github/workflows/staging-e2e.yml` skips BrowserStack real-device testing by
default because Kanvise has no BrowserStack account yet. All other provider
configuration, preflight checks, journeys and cleanup remain required.

To turn real-device testing on once an account exists:

1. Add the `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` secrets to the
   `Staging E2E` GitHub environment. Both are needed; one alone fails the gate.
2. Optionally set the `Staging E2E` environment variable
   `E2E_REQUIRE_REAL_DEVICES=true` so a later loss of the secrets fails
   certification instead of silently skipping real devices.

The rules live in `scripts/staging-certification-lib.mjs` (`realDeviceMode`)
and are covered by `scripts/staging-certification-lib.test.mjs`.
