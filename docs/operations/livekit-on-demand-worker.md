# LiveKit on-demand Azure worker

## Behaviour

- The API VM stays online; the LiveKit VM may be Azure-deallocated.
- A scheduled class warms the worker 5 minutes before its start time. The measured Azure cold start was under a minute, so this retains several minutes of safety margin without paying for a 12-minute idle lead-in.
- "Start now" and "Start class" are also wake-up triggers. The API returns HTTP 202 while Azure starts the VM; the classroom page shows a preparing state and retries automatically.
- Access tokens and the `live` database state are withheld until the public LiveKit health endpoint responds successfully.
- The idle job checks every five minutes. It refuses to stop the VM while a class starts in the next 7 minutes, a start is being prepared, a class started or ended within 15 minutes, or LiveKit reports any actual room. The room query fails closed. LiveKit is authoritative for older rows because missed webhooks have left stale database rows marked `live` even though no room exists.
- Automatic deallocation has a separate feature flag so wake-up can be proven in production before shutdown is enabled.

## Required API environment

```text
LIVEKIT_WORKER_CONTROL_ENABLED=true
LIVEKIT_WORKER_AUTO_DEALLOCATE=false
AZURE_SUBSCRIPTION_ID=90e4e582-a95d-40f0-ad44-db4c4fe5c131
AZURE_LIVEKIT_RESOURCE_GROUP=KANVISE-MIGRATION-SWEDEN
AZURE_LIVEKIT_VM_NAME=kanvise-livekit
```

The API VM uses its system-assigned managed identity. That identity has `Virtual Machine Contributor` scoped to the `kanvise-livekit` VM only; no Azure credential is stored in the repository or environment file.

After a successful stop/start drill, set `LIVEKIT_WORKER_AUTO_DEALLOCATE=true` and restart the production API service.

## Operational checks

```bash
az vm get-instance-view -g KANVISE-MIGRATION-SWEDEN -n kanvise-livekit --query instanceView.statuses[-1].displayStatus -o tsv
curl --fail https://livekit.kanvise.com
```

Azure-deallocation stops compute billing, but attached disk and reserved public-IP charges continue. The static public IP keeps `livekit.kanvise.com` stable across starts.

## Entry-link UX requirement

The internal `/class/:id` address is an authenticated tutor/member entry point. A
guest must use the public `/live/:shareToken` address. The two routes may render
the same classroom after admission, but they must not silently fail into a
login or generic network error when the wrong address is opened. If a guest
opens the internal address, show a clear message asking the tutor for the class
link. The tutor's share-link action should make the public address the obvious
copy/share target.

## Browser readiness transport (planned)

The browser should not rely on a full `router.refresh()` loop to wait for the
worker. Azure can notify the API, but that notification is server-to-server;
it is not a browser webhook. The planned interface is a lightweight readiness
endpoint polled by the browser with bounded backoff:

```text
starting_vm -> booting -> livekit_connecting -> ready | unavailable
```

Once `ready` is returned, the browser requests its LiveKit token and moves into
the separate client connection states (`connecting`, `connected`,
`reconnecting`, `failed`, `ended`).
