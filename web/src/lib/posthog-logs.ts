import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const posthogConfig =
  posthogKey && posthogHost ? { key: posthogKey, host: posthogHost } : null;

if (!posthogConfig && process.env.NODE_ENV !== "production") {
  if (!posthogKey) {
    console.warn(
      "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured",
    );
  }
  if (!posthogHost) {
    console.warn(
      "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
    );
  }
}

export const posthogLogProvider = posthogConfig
  ? new LoggerProvider({
      resource: resourceFromAttributes({
        "service.name": "kanvise-web",
        "deployment.environment":
          process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: new URL("/i/v1/logs", posthogConfig.host).toString(),
            headers: {
              Authorization: `Bearer ${posthogConfig.key}`,
              "Content-Type": "application/json",
            },
            timeoutMillis: 2_000,
          }),
          exportTimeoutMillis: 2_000,
        }),
      ],
    })
  : null;

export const posthogLog = posthogLogProvider?.getLogger("kanvise.posthog.logs");

export async function flushPostHogLogs() {
  await posthogLogProvider?.forceFlush().catch(() => {});
}

let shutdownRegistered = false;

export function registerPostHogLogShutdown() {
  if (!posthogLogProvider || shutdownRegistered) return;

  shutdownRegistered = true;
  process.once("SIGTERM", () => void posthogLogProvider.shutdown().catch(() => {}));
  process.once("SIGINT", () => void posthogLogProvider.shutdown().catch(() => {}));
}
