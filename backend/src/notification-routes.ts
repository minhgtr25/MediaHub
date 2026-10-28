import { Router } from "express";
import { z } from "zod";
import { ApiError, db, result } from "./db.js";
import { send } from "./utils/response.js";
import { uuid } from "./validators.js";

export const notificationRoutes = Router();

notificationRoutes.get("/", async (req, res) => {
  const status = z
    .enum(["ALL", "READ", "UNREAD"])
    .default("ALL")
    .parse(req.query.status);
  const search = z.string().max(100).default("").parse(req.query.search).trim();
  let query = db
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", req.identity.id);
  if (status === "READ") query = query.not("read_at", "is", null);
  if (status === "UNREAD") query = query.is("read_at", null);
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const quoted =
      '"' + pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    query = query.or(`title.ilike.${quoted},message.ilike.${quoted}`);
  }

  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const limit = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .parse(req.query.limit);
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (error) {
    throw new ApiError(500, "DATABASE_ERROR", "Không thể tải thông báo.");
  }
  return send(res, { items: data, total: count, page, limit });
});

notificationRoutes.patch("/read-all", async (req, res) => {
  z.object({}).strict().parse(req.body);
  await result(
    db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", req.identity.id)
      .is("read_at", null),
  );
  return send(res, { success: true });
});

notificationRoutes.patch("/:id", async (req, res) => {
  z.object({}).strict().parse(req.body);
  return send(
    res,
    await result(
      db
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", uuid.parse(req.params.id))
        .eq("user_id", req.identity.id)
        .select()
        .maybeSingle(),
    ),
  );
});
