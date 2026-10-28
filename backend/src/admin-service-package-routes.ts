import { Router } from "express";
import { z } from "zod";
import { ApiError, db, result } from "./db.js";
import { requireRole } from "./middleware.js";
import { packageSchema } from "./request-validators.js";
import { uuid } from "./validators.js";

export const adminServicePackageRoutes = Router();
adminServicePackageRoutes.use(requireRole("ADMIN"));

adminServicePackageRoutes.get("/", async (req, res) => {
  const params = z
    .object({
      service_id: uuid.optional(),
      page: z.coerce.number().int().min(1).default(1),
    })
    .parse(req.query);
  let query = db
    .from("service_packages")
    .select("*", { count: "exact" })
    .order("display_order")
    .order("id");
  if (params.service_id) query = query.eq("service_id", params.service_id);
  const { data, error, count } = await query.range(
    (params.page - 1) * 20,
    params.page * 20 - 1,
  );
  if (error)
    throw new ApiError(500, "DATABASE_ERROR", "Không thể tải gói dịch vụ.");
  res.json({
    success: true,
    data: { items: data, total: count, page: params.page, limit: 20 },
  });
});
adminServicePackageRoutes.post("/", async (req, res) =>
  res.status(201).json({
    success: true,
    data: await result(
      db.rpc("save_service_package", {
        actor_id: req.identity.id,
        package_id: null,
        payload: packageSchema.parse(req.body),
      }),
    ),
  }),
);
adminServicePackageRoutes.patch("/:id", async (req, res) =>
  res.json({
    success: true,
    data: await result(
      db.rpc("save_service_package", {
        actor_id: req.identity.id,
        package_id: uuid.parse(req.params.id),
        payload: packageSchema.parse(req.body),
      }),
    ),
  }),
);
