import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { mapApiError, notFoundHandler, requestIdMiddleware } from "./lib/api-contract";
import * as Sentry from "@sentry/node";
// TypeScript's legacy Node resolution cannot resolve the SDK's runtime-specific
// export, while Node resolves it correctly at runtime.
const { sentry } = require("@sentry/hono/node") as {
  sentry: (app: Hono) => any;
};
import { supabase } from "./lib/supabase";
import { validateProductionPaymentSecrets } from "./config/payment-secrets";
import { resolveCorsOrigin } from "./config/cors";
import { startScheduledJobs } from "./jobs/scheduler";
import { validateProductionEnvironment } from "./config/runtime-env";

validateProductionPaymentSecrets();
validateProductionEnvironment();

const app = new Hono();

// Middleware
// Sentry starts before route middleware so it captures unhandled 5xx responses.
app.use("/*", requestIdMiddleware);
app.use("/*", sentry(app));
// Handled 5xx responses (including intentional 503s) do not throw, so the
// error middleware cannot report them by itself. Capture them after routes
// have produced the response while keeping the response body out of Sentry.
app.use("/*", async (c, next) => {
  await next();
  if (c.res.status === 409 || c.res.status >= 500) {
    Sentry.captureMessage("API request returned a handled failure", {
      level: c.res.status >= 500 ? "error" : "warning",
      tags: {
        http_status: String(c.res.status),
        http_method: c.req.method,
        api_path: c.req.path,
      },
    });
  }
});
app.use("/*", cors({
  origin: (origin) => resolveCorsOrigin(origin),
  credentials: true,
}));
app.onError(mapApiError);
app.notFound(notFoundHandler);

import { authRouter } from "./routes/auth";
import { publicRegistrationRouter } from './routes/public-registration';
import { avatarsRouter } from "./routes/avatars";
import { schoolsRouter } from "./routes/schools";
import { liveClassesRouter } from "./routes/live-classes";
import { publicLiveClassesRouter } from './routes/public-live-classes';
import { webhooksRouter } from "./routes/webhooks";
import { slidesRouter } from "./routes/slides";
import { dashboardRouter } from "./routes/dashboard";
import { programmesRouter } from "./routes/programmes";
import { classesRouter } from './routes/classes';
import { subProgrammesRouter } from "./routes/sub-programmes";
import { coursesRouter } from "./routes/courses";
import { usersRouter } from "./routes/users";
import { mocksRouter } from "./routes/mocks";
import { enrolmentsRouter } from "./routes/enrolments";
import { paymentsRouter } from "./routes/payments";
import { attendanceRouter } from "./routes/attendance";
import { publicRouter } from "./routes/public";
import { storageRouter } from "./routes/storage";
import { notesRouter } from "./routes/notes";
import { internalPaymentsRouter } from "./routes/internal-payments";
import { submissionsRouter } from "./routes/submissions";
import { mockAnswersRouter } from "./routes/mock-answers";
import { healthRouter } from "./routes/health";
import { assignmentsRouter, courseAssignmentsRouter } from "./routes/assignments";
import { directAssignmentsRouter, publicDirectAssignmentsRouter } from './routes/direct-assignments';
import { promosRouter } from "./routes/promos";
import { questionBanksRouter } from "./routes/question-banks";
import { studentMocksRouter } from "./routes/student-mocks";
import { studentSettingsRouter } from "./routes/student-settings";
import { mockAccessRouter, mockOfferAdminRouter } from "./routes/mock-access";
import { studentMembershipsRouter } from "./routes/student-memberships";
import { guestMocksRouter } from './routes/guest-mocks';
import { pushRouter } from './routes/push';
import { demoAnalysisRouter } from './routes/demo-analysis';
import { feedbackResolutionRouter, feedbackRouter } from './routes/feedback';
import { waitlistRouter } from './routes/waitlist';
import { clientAddress } from './lib/ip-rate-limit';
import { suggestionsRouter } from './routes/suggestions';

app.route('/auth', publicRegistrationRouter);
app.route("/auth", authRouter);
app.route("/avatars", avatarsRouter);
app.route("/schools", schoolsRouter);
app.route("/live-classes", liveClassesRouter);
app.route('/public/live-classes', publicLiveClassesRouter);
app.route("/live-classes", slidesRouter);
app.route("/webhooks", webhooksRouter);
app.route("/dashboard", dashboardRouter);
app.route("/programmes", programmesRouter);
app.route('/classes', classesRouter);
app.route("/sub-programmes", subProgrammesRouter);
app.route("/courses", coursesRouter);
app.route("/courses", courseAssignmentsRouter);
app.route("/assignments", assignmentsRouter);
app.route('/direct-assignments', directAssignmentsRouter);
app.route('/public/direct-assignments', publicDirectAssignmentsRouter);
app.route("/users", usersRouter);
app.route("/mocks", mocksRouter);
app.route("/mocks", mockOfferAdminRouter);
app.route("/question-banks", questionBanksRouter);
app.route("/enrolments", enrolmentsRouter);
app.route("/payments", paymentsRouter);
app.route("/attendance", attendanceRouter);
app.route("/public", publicRouter);
app.route("/storage", storageRouter);
app.route("/notes", notesRouter);
app.route("/internal/payments", internalPaymentsRouter);
app.route("/submissions", submissionsRouter);
app.route("/mock-answers", mockAnswersRouter);
app.route("/health", healthRouter);
app.route('/feedback', feedbackRouter);
app.route('/support/feedback', feedbackResolutionRouter);
app.route("/users/me/push", pushRouter);
app.route("/demo/analyze", demoAnalysisRouter);
app.route('/', waitlistRouter);
app.route('/', suggestionsRouter);
// Promo routes are intentionally confined to this prefix. Mounting this router at
// `/` caused its router-wide admin middleware to run for unrelated routes such as
// `/students/me/settings`.
app.route("/schools/me/promos", promosRouter);
app.route("/", mockAccessRouter);
app.route("/students/me", studentMembershipsRouter);
app.route('/', guestMocksRouter);

const landingEventNames = new Set([
  'landing_view',
  'hero_cta_clicked',
  'product_cta_clicked',
  'tool_explored',
  'feature_explored',
  'section_viewed',
  'waitlist_cta_clicked',
  'waitlist_form_started',
  'waitlist_completed',
  'social_clicked',
]);

const landingEventRateLimits = new Map<string, { count: number; resetAt: number }>();

function pruneExpiredRateLimits(now: number) {
  if (landingEventRateLimits.size < 2_000) return;
  for (const [key, value] of landingEventRateLimits) {
    if (value.resetAt <= now) landingEventRateLimits.delete(key);
  }
  if (landingEventRateLimits.size > 5_000) {
    for (const key of landingEventRateLimits.keys()) {
      landingEventRateLimits.delete(key);
      if (landingEventRateLimits.size <= 4_000) break;
    }
  }
}

app.post('/analytics/landing-events', async (c) => {
  try {
    const clientKey = clientAddress(c);
    const now = Date.now();
    pruneExpiredRateLimits(now);
    const bucket = landingEventRateLimits.get(clientKey);
    if (bucket && bucket.resetAt > now && bucket.count >= 120) {
      return c.json({ error: 'Too many analytics events' }, 429);
    }
    landingEventRateLimits.set(clientKey, bucket && bucket.resetAt > now
      ? { ...bucket, count: bucket.count + 1 }
      : { count: 1, resetAt: now + 60_000 });

    const raw = await c.req.text();
    if (raw.length > 4_096) return c.json({ error: 'Analytics payload is too large' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const eventName = typeof body.event_name === 'string' ? body.event_name : '';
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const deviceType = typeof body.device_type === 'string' ? body.device_type : 'unknown';
    const pagePath = typeof body.page_path === 'string' ? body.page_path.slice(0, 255) : '/';
    const referrerHost = typeof body.referrer_host === 'string' ? body.referrer_host.slice(0, 255) : null;
    const properties = body.event_properties && typeof body.event_properties === 'object' && !Array.isArray(body.event_properties)
      ? Object.fromEntries(Object.entries(body.event_properties as Record<string, unknown>)
          .slice(0, 8)
          .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
          .map(([key, value]) => [key.slice(0, 80), typeof value === 'string' ? value.slice(0, 255) : value]))
      : {};

    if (!landingEventNames.has(eventName) || sessionId.length < 16 || sessionId.length > 128) {
      return c.json({ error: 'Invalid analytics event' }, 400);
    }
    if (!['mobile', 'tablet', 'desktop', 'unknown'].includes(deviceType)) {
      return c.json({ error: 'Invalid device type' }, 400);
    }

    const { error } = await supabase.from('landing_analytics_events').insert({
      event_name: eventName,
      session_id: sessionId,
      device_type: deviceType,
      page_path: pagePath,
      referrer_host: referrerHost,
      event_properties: properties as any,
    });
    if (error) {
      console.error('Error recording landing analytics event:', error);
      return c.json({ error: 'Could not record analytics event' }, 500);
    }
    return c.body(null, 204);
  } catch (error) {
    console.error('Landing analytics endpoint error:', error);
    return c.json({ error: 'Invalid analytics event' }, 400);
  }
});

// Waitlist Route
app.get("/waitlist/count", async (c) => {
  try {
    const { count, error } = await supabase
      .from("waitlist_signups")
      .select("*", { count: "exact", head: true });
    
    if (error) {
      console.error("Error fetching waitlist count:", error);
      return c.json({ error: "Failed to fetch count" }, 500);
    }
    
    return c.json({ count: count || 0 }, 200);
  } catch (error) {
    console.error("Waitlist count error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// These student routers contain several top-level paths (/students, /mocks and
// /attempts). Register them last so their router-wide student middleware cannot
// intercept unrelated endpoints such as /payments/summary or /waitlist.
app.route("/", studentMocksRouter);
app.route("/", studentSettingsRouter);

const port = Number(process.env.PORT!);
console.log(`Server is running on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port
});

const scheduledJobs = process.env.SCHEDULED_JOBS_ENABLED === 'false' ? null : startScheduledJobs();
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('server.shutdown_started', { signal });
  if (scheduledJobs) await scheduledJobs.stop();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  console.log('server.shutdown_complete', { signal });
}

process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('SIGINT', () => { void shutdown('SIGINT'); });
