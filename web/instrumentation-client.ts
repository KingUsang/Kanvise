import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
