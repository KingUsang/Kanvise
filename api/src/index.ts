import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { supabase } from "./lib/supabase";

const app = new Hono();

// Middleware
app.use("/*", cors({
  origin: ["http://localhost:3000"], // Allow local Next.js app
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
app.route("/users", usersRouter);
app.route("/mocks", mocksRouter);
app.route("/enrolments", enrolmentsRouter);
app.route("/payments", paymentsRouter);
app.route("/attendance", attendanceRouter);
app.route("/public", publicRouter);
app.route("/storage", storageRouter);
app.route("/notes", notesRouter);

// Waitlist Route
app.post("/waitlist", async (c) => {
  try {
    const body = await c.req.json();
    const { contact_name, contact_email, centre_name, contact_phone, estimated_student_count } = body;

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

const port = Number(process.env.PORT) || 3001;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
