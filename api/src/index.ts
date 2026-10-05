import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { supabase } from "./lib/supabase";
import { validateProductionPaymentSecrets } from "./config/payment-secrets";
import { resolveCorsOrigin } from "./config/cors";
import { startScheduledJobs } from "./jobs/scheduler";
import { isTelegramEnabled, validateProductionEnvironment } from "./config/runtime-env";

validateProductionPaymentSecrets();
validateProductionEnvironment();

const app = new Hono();

// Middleware
app.use("/*", cors({
  origin: (origin) => resolveCorsOrigin(origin),
  credentials: true,
}));

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
import { telegramRouter, telegramWebhookRouter } from './routes/telegram';
import { pushRouter } from './routes/push';
import { demoAnalysisRouter } from './routes/demo-analysis';

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
app.route("/users/me/push", pushRouter);
app.route("/demo/analyze", demoAnalysisRouter);
if (isTelegramEnabled()) {
  app.route('/telegram', telegramRouter);
  app.route('/telegram', telegramWebhookRouter);
}
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

function clientAddress(c: { req: { header(name: string): string | undefined } }) {
  const forwarded = c.req.header('x-forwarded-for')?.split(',').map((value) => value.trim()).filter(Boolean);
  return c.req.header('cf-connecting-ip')
    || c.req.header('x-real-ip')
    || forwarded?.at(-1)
    || 'unknown';
}

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

app.post("/waitlist", async (c) => {
  try {
    const body = await c.req.json();
    const { contact_name, contact_email, centre_name, contact_phone, estimated_student_count, wants_beta_testing } = body;

    const normalizedName = typeof contact_name === 'string' ? contact_name.trim() : '';
    const normalizedEmail = typeof contact_email === 'string' ? contact_email.trim().toLowerCase() : '';
    const normalizedCentre = typeof centre_name === 'string' ? centre_name.trim() : '';
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    const parsedStudentCount = estimated_student_count === undefined || estimated_student_count === null || estimated_student_count === ''
      ? null
      : Number.parseInt(String(estimated_student_count), 10);

    if (!normalizedEmail || !normalizedName || !normalizedCentre) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    if (!emailLooksValid || normalizedEmail.length > 320 || normalizedName.length > 120 || normalizedCentre.length > 160) {
      return c.json({ error: "Invalid waitlist details" }, 400);
    }
    if (parsedStudentCount !== null && (!Number.isFinite(parsedStudentCount) || parsedStudentCount < 0 || parsedStudentCount > 1_000_000)) {
      return c.json({ error: "Invalid estimated student count" }, 400);
    }

    // Check for duplicate email
    const { data: existingUser, error: checkError } = await supabase
      .from("waitlist_signups")
      .select("id, created_at")
      .ilike("contact_email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      const { count } = await supabase
        .from('waitlist_signups')
        .select('*', { count: 'exact', head: true })
        .lte('created_at', existingUser.created_at);
      return c.json({
        message: "You're already on the list!",
        position: count || 1,
        already_joined: true,
      }, 409);
    }

    if (checkError) {
      console.error("Error checking duplicate:", checkError);
      return c.json({ error: "Failed to verify email." }, 500);
    }

    // Insert new signup
    const { data: signup, error: insertError } = await supabase.from("waitlist_signups").insert([
      {
        contact_name: normalizedName,
        contact_email: normalizedEmail,
        centre_name: normalizedCentre,
        contact_phone: typeof contact_phone === 'string' ? contact_phone.trim().slice(0, 40) || null : null,
        estimated_student_count: parsedStudentCount,
        wants_beta_testing: wants_beta_testing ? true : false,
        status: "pending",
      },
    ]).select('id, created_at').single();

    if (insertError) {
      if (insertError.code === '23505') {
        const { data: duplicate } = await supabase
          .from('waitlist_signups')
          .select('id, created_at')
          .ilike('contact_email', normalizedEmail)
          .maybeSingle();
        if (duplicate) {
          const { count } = await supabase
            .from('waitlist_signups')
            .select('*', { count: 'exact', head: true })
            .lte('created_at', duplicate.created_at);
          return c.json({ message: "You're already on the list!", position: count || 1, already_joined: true }, 409);
        }
      }
      console.error("Error inserting waitlist signup:", insertError);
      return c.json({ error: "Failed to join waitlist. Please try again." }, 500);
    }

    const { count, error: countError } = await supabase
      .from('waitlist_signups')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', signup.created_at);
    if (countError) console.error('Error calculating waitlist position:', countError);

    return c.json({
      message: "Successfully joined the waitlist!",
      position: count || 1,
      already_joined: false,
    }, 201);
  } catch (error) {
    console.error("Waitlist endpoint error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/suggestions", async (c) => {
  try {
    const body = await c.req.json();
    const suggestion = typeof body.suggestion === "string" ? body.suggestion.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : null;

    if (!suggestion) {
      return c.json({ error: "Suggestion text is required" }, 400);
    }

    if (suggestion.length > 2000) {
      return c.json({ error: "Suggestion is too long (max 2000 characters)" }, 400);
    }

    const { error: insertError } = await supabase.from("feature_suggestions").insert([
      {
        suggestion,
        email: email || null,
        status: "pending",
      },
    ]);

    if (insertError) {
      console.error("Error inserting suggestion:", insertError);
      return c.json({ error: "Failed to submit suggestion. Please try again." }, 500);
    }

    return c.json({ message: "Thank you! We've added this to our roadmap." }, 201);
  } catch (error) {
    console.error("Suggestion endpoint error:", error);
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
