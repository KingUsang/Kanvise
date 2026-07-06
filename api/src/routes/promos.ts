import { Hono } from "hono";
import { tenantMiddleware, requireRole } from "../middleware/auth";
import { createClient } from "@supabase/supabase-js";

export const promosRouter = new Hono<{ Variables: { user: any; jwt_payload?: any } }>();

const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_key"
);

// Require tenant auth and admin role for all promo routes
promosRouter.use("*", tenantMiddleware);
promosRouter.use("*", requireRole("admin"));

// ---------------------------------------------------------------------------
// 1. POST /schools/me/promos - Create a Promotional Banner
// ---------------------------------------------------------------------------
promosRouter.post("/schools/me/promos", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { title, image_key, link_type, link_id, order_index } = body;

  if (!title || !image_key) {
    return c.json({ error: "title and image_key are required", code: "MISSING_PARAMS" }, 400);
  }

  const { data: promo, error } = await supabase
    .from("school_promos")
    .insert({
      school_id: user.school_id,
      title,
      image_key,
      link_type: link_type || null,
      link_id: link_id || null,
      order_index: order_index !== undefined ? Number(order_index) : 0,
      is_active: true
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: promo }, 201);
});

// ---------------------------------------------------------------------------
// 2. GET /schools/me/promos - List all Promos for Admin's School
// ---------------------------------------------------------------------------
promosRouter.get("/schools/me/promos", async (c) => {
  const user = c.get("user");
  const { data: promos, error } = await supabase
    .from("school_promos")
    .select("*")
    .eq("school_id", user.school_id)
    .order("order_index", { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: promos || [] }, 200);
});

// ---------------------------------------------------------------------------
// 3. PATCH /schools/me/promos/reorder - Reorder Promos Carousel
// ---------------------------------------------------------------------------
promosRouter.patch("/schools/me/promos/reorder", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { order } = body;

  if (!Array.isArray(order)) {
    return c.json({ error: "order must be an array of promo UUIDs", code: "INVALID_PARAMS" }, 400);
  }

  // Update order_index for each promo item sequentially
  await Promise.all(
    order.map(async (id: string, index: number) => {
      await supabase
        .from("school_promos")
        .update({ order_index: index })
        .eq("id", id)
        .eq("school_id", user.school_id);
    })
  );

  return c.json({ message: "Promos reordered successfully" }, 200);
});

// ---------------------------------------------------------------------------
// 4. PATCH /:id - Update an Existing Promo
// ---------------------------------------------------------------------------
promosRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();

  // Tenant check: ensure promo belongs to school
  const { data: existing, error: findErr } = await supabase
    .from("school_promos")
    .select("id")
    .eq("id", id)
    .eq("school_id", user.school_id)
    .single();

  if (findErr || !existing) {
    return c.json({ error: "Promo banner not found in this tutorial centre", code: "NOT_FOUND" }, 404);
  }

  const { data: updated, error } = await supabase
    .from("school_promos")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: updated }, 200);
});

// ---------------------------------------------------------------------------
// 5. DELETE /:id - Delete a Promo
// ---------------------------------------------------------------------------
promosRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const { error } = await supabase
    .from("school_promos")
    .delete()
    .eq("id", id)
    .eq("school_id", user.school_id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ message: "Promo banner deleted successfully" }, 200);
});
