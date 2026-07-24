import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { supabase } from "./lib/supabase";
import { validateProductionPaymentSecrets } from "./config/payment-secrets";
import { resolveCorsOrigin } from "./config/cors";
import { startScheduledJobs } from "./jobs/scheduler";

validateProductionPaymentSecrets();

const app = new Hono();

// Middleware
app.use("/*", cors({
  origin: (origin) => resolveCorsOrigin(origin),
  credentials: true,
}));

import { authRouter } from "./routes/auth";
import { avatarsRouter } from "./routes/avatars";
import { schoolsRouter } from "./routes/schools";
import { liveClassesRouter } from "./routes/live-classes";
import { webhooksRouter } from "./routes/webhooks";
import { slidesRouter } from "./routes/slides";
import { dashboardRouter } from "./routes/dashboard";
import { programmesRouter } from "./routes/programmes";
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
import { promosRouter } from "./routes/promos";
import { questionBanksRouter } from "./routes/question-banks";
import { studentMocksRouter } from "./routes/student-mocks";
import { studentSettingsRouter } from "./routes/student-settings";
import { marketplaceRouter } from "./routes/marketplace";

app.route("/auth", authRouter);
app.route("/avatars", avatarsRouter);
app.route("/schools", schoolsRouter);
app.route("/live-classes", liveClassesRouter);
app.route("/live-classes", slidesRouter);
app.route("/webhooks", webhooksRouter);
app.route("/dashboard", dashboardRouter);
app.route("/programmes", programmesRouter);
app.route("/sub-programmes", subProgrammesRouter);
app.route("/courses", coursesRouter);
app.route("/courses", courseAssignmentsRouter);
app.route("/assignments", assignmentsRouter);
app.route("/users", usersRouter);
app.route("/mocks", mocksRouter);
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
// Promo routes are intentionally confined to this prefix. Mounting this router at
// `/` caused its router-wide admin middleware to run for unrelated routes such as
// `/students/me/settings`.
app.route("/schools/me/promos", promosRouter);
app.route("/", marketplaceRouter);

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

    // Basic validation
    if (!contact_email || !contact_name || !centre_name) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Check for duplicate email
    const { data: existingUser, error: checkError } = await supabase
      .from("waitlist_signups")
      .select("id")
      .eq("contact_email", contact_email)
      .single();

    if (existingUser) {
      return c.json({ message: "You're already on the list! We will be in touch soon." }, 409);
    }

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking duplicate:", checkError);
      return c.json({ error: "Failed to verify email." }, 500);
    }

    // Insert new signup
    const { error: insertError } = await supabase.from("waitlist_signups").insert([
      {
        contact_name,
        contact_email,
        centre_name,
        contact_phone: contact_phone || null,
        estimated_student_count: estimated_student_count ? parseInt(estimated_student_count, 10) : null,
        wants_beta_testing: wants_beta_testing ? true : false,
        status: "pending",
      },
    ]);

    if (insertError) {
      console.error("Error inserting waitlist signup:", insertError);
      return c.json({ error: "Failed to join waitlist. Please try again." }, 500);
    }

    return c.json({ message: "Successfully joined the waitlist!" }, 201);
  } catch (error) {
    console.error("Waitlist endpoint error:", error);
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
