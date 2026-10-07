const Sentry = require("@sentry/hono/node") as typeof import("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE ?? process.env.GITHUB_SHA,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address;
      if (!event.user.id) event.user = undefined;
    }
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    return event;
  },
});
