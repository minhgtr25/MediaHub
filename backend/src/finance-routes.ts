import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { requireRole } from "./middleware.js";
import { uuid } from "./validators.js";

export const financeRoutes = Router();
financeRoutes.use(requireRole(["STAFF", "ADMIN"]));
financeRoutes.get("/staff", requireRole(["ADMIN"]), async (_req, res) => {
  // Include former/suspended Staff with historical attribution, for Admin only.
  const [staff, closed] = await Promise.all([
    result(db.from("profiles").select("id,full_name,active").in("role", ["STAFF", "ADMIN"]).order("full_name")),
    result(db.from("orders").select("closed_by").not("closed_by", "is", null)),
  ]);
  const ids = [...new Set((closed ?? []).map(o => o.closed_by).filter((id): id is string => !!id))];
  const historical = ids.length ? await result(db.from("profiles").select("id,full_name,active").in("id", ids)) : [];
  res.json({ success: true, data: [...(staff ?? []), ...(historical ?? []).filter(p => !staff?.some(s => s.id === p.id))] });
});
financeRoutes.get("/report", async (req, res) => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const input = z.object({
    year: z.coerce.number().int().min(2020).max(2100).default(now.getFullYear()),
    month: z.coerce.number().int().min(0).max(12).default(now.getMonth() + 1),
    staff_id: uuid.optional(), page: z.coerce.number().int().min(1).max(100000).default(1),
  }).strict().parse(req.query);
  if (req.identity.role === "STAFF" && input.staff_id && input.staff_id !== req.identity.id)
    throw new ApiError(403, "FORBIDDEN", "Staff chỉ xem thống kê của mình.");
  res.json({ success: true, data: await result(db.rpc("commerce_finance_report", {
    actor_id: req.identity.id, report_year: input.year, report_month: input.month,
    staff_filter: input.staff_id ?? null, report_page: input.page,
  })) });
});
