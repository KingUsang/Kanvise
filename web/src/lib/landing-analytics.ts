export type LandingEventName =
  | "landing_view"
  | "hero_cta_clicked"
  | "product_cta_clicked"
  | "tool_explored"
  | "feature_explored"
  | "section_viewed"
  | "waitlist_cta_clicked"
  | "waitlist_form_started"
  | "waitlist_completed"
  | "social_clicked";

type EventProperties = Record<string, string | number | boolean | null>;

function sessionId() {
  const key = "kanvise_landing_session";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created =
    globalThis.crypto?.randomUUID?.() ??
    `landing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(key, created);
  return created;
}

function deviceType() {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function referrerHost() {
  if (!document.referrer) return null;
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return null;
  }
}

export function trackLandingEvent(
  eventName: LandingEventName,
  properties: EventProperties = {},
) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    event_name: eventName,
    session_id: sessionId(),
    device_type: deviceType(),
    page_path: window.location.pathname,
    referrer_host: referrerHost(),
    event_properties: properties,
  });

  void fetch("/api/analytics/landing-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
