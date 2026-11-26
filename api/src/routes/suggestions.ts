import { Hono } from "hono";
import { supabase } from "../lib/supabase";
import { clientAddress, createIpRateLimiter, type IpRateLimiter } from "../lib/ip-rate-limit";

export const suggestionsRouter = new Hono();

// Public endpoint behind the web proxy, so keep the per-address limit generous.
let suggestionLimiter: IpRateLimiter = createIpRateLimiter({ limit: 20, windowMs: 10 * 60_000 });
/** Test hook: replace the limiter state. */
export function resetSuggestionLimiter(limiter?: IpRateLimiter) {
  suggestionLimiter = limiter ?? createIpRateLimiter({ limit: 20, windowMs: 10 * 60_000 });
}
const suggestionEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

suggestionsRouter.post("/suggestions", async (c) => {
  try {
    const retryAfter = suggestionLimiter.hit(clientAddress(c));
    if (retryAfter !== null) {
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: "Too many suggestions. Please try again later.", code: "RATE_LIMITED" }, 429);
    }

    const body = await c.req.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ error: "Invalid suggestion payload" }, 400);
    }
    if ((body.suggestion !== undefined && typeof body.suggestion !== "string")
      || (body.email !== undefined && body.email !== null && typeof body.email !== "string")) {
      return c.json({ error: "Invalid suggestion payload" }, 400);
    }
    const suggestion = typeof body.suggestion === "string" ? body.suggestion.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : null;

    if (!suggestion) {
      return c.json({ error: "Suggestion text is required" }, 400);
    }

    if (suggestion.length > 2000) {
      return c.json({ error: "Suggestion is too long (max 2000 characters)" }, 400);
    }

    if (email && (email.length > 320 || !suggestionEmailPattern.test(email))) {
      return c.json({ error: "Enter a valid email address" }, 400);
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
