import { Router } from "express";
import { z } from "zod";
import { ApiError, db, result } from "./db.js";
import { uuid } from "./validators.js";

export const publicServiceRoutes = Router();

publicServiceRoutes.get("/services/:id/packages", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const service = await result(
    db
      .from("services")
      .select("id")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle(),
  );
  if (!service)
    throw new ApiError(404, "NOT_FOUND", "Dịch vụ chưa được công bố.");
  const packages = await result(
    db
      .from("service_packages")
      .select(
        "id,service_id,name,description,starting_price,estimated_days,deliverables",
      )
      .eq("service_id", id)
      .eq("active", true)
      .order("display_order")
      .order("id"),
  );
  res.json({ success: true, data: packages });
});
publicServiceRoutes.get("/creators/options", async (req, res) => {
  const params = z
    .object({
      search: z.string().trim().max(100).default(""),
      include_id: uuid.optional(),
    })
    .parse(req.query);
  let query = db
    .from("creator_profiles")
    .select("id,display_name,slug,title,availability")
    .neq("availability", "UNAVAILABLE")
    .order("display_name")
    .limit(24);
  if (params.search)
    query = query.ilike(
      "display_name",
      `%${params.search.replace(/[%_]/g, "")}%`,
    );
  const rows = (await result(query)) ?? [];
  if (params.include_id && !rows.some((row) => row.id === params.include_id)) {
    const selected = await result(
      db
        .from("creator_profiles")
        .select("id,display_name,slug,title,availability")
        .eq("id", params.include_id)
        .neq("availability", "UNAVAILABLE")
        .maybeSingle(),
    );
    if (selected) rows.unshift(selected);
  }
  res.json({ success: true, data: { items: rows } });
});
