import { Router, type Request } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { uuid } from "./validators.js";
import { canAccess } from "./domain.js";
import { requireRole } from "./middleware.js";
export const customerRoutes = Router();
export const communicationRoutes = Router();
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});
async function owned(req: Request) {
  const project = await result(
    db
      .from("projects")
      .select("id,customer_id,status,order_id")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (
    !project || project.order_id ||
    !canAccess(req.identity.role, req.identity.customer_id, project.customer_id)
  )
    throw new ApiError(404, "NOT_FOUND", "Project not found.");
  return project;
}
customerRoutes.get("/invoices", async (req, res) => {
  const { page } = pageSchema.parse(req.query);
  const { data, error, count } = await db
    .from("invoices")
    .select("*,projects(title)", { count: "exact" })
    .eq("customer_id", req.identity.customer_id!)
    .neq("status", "DRAFT")
    .order("issued_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error)
    throw new ApiError(500, "DATABASE_ERROR", "Unable to load invoices.");
  res.json({
    success: true,
    data: { items: data, total: count, page, limit: 20 },
  });
});
customerRoutes.get("/invoices/:invoiceId", async (req, res) => {
  const data = await result(
    db
      .from("invoices")
      .select("*,projects(title)")
      .eq("id", uuid.parse(req.params.invoiceId))
      .eq("customer_id", req.identity.customer_id!)
      .neq("status", "DRAFT")
      .maybeSingle(),
  );
  if (!data) throw new ApiError(404, "NOT_FOUND", "Invoice not found.");
  res.json({ success: true, data });
});
customerRoutes.get("/quotations", async (req, res) => {
  const { page } = pageSchema.parse(req.query);
  const { data, error, count } = await db
    .from("quotations")
    .select("*,projects!inner(title,customer_id),quotation_items(*)", {
      count: "exact",
    })
    .eq("projects.customer_id", req.identity.customer_id!)
    .neq("status", "DRAFT")
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error)
    throw new ApiError(500, "DATABASE_ERROR", "Unable to load quotations.");
  res.json({
    success: true,
    data: { items: data, total: count, page, limit: 20 },
  });
});
communicationRoutes.get("/:id/messages", async (req, res) => {
  const project = await owned(req);
  const { page } = pageSchema.parse(req.query);
  const { data, error, count } = await db
    .from("project_messages")
    .select("id,sender_id,message,created_at", { count: "exact" })
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error)
    throw new ApiError(500, "DATABASE_ERROR", "Unable to load messages.");
  res.json({
    success: true,
    data: { items: data, total: count, page, limit: 20 },
  });
});
communicationRoutes.post("/:id/messages", async (req, res) => {
  const project = await owned(req);
  if (["COMPLETED", "CANCELLED"].includes(project.status))
    throw new ApiError(409, "PROJECT_CLOSED", "This project is closed.");
  const body = z
    .object({ message: z.string().trim().min(1).max(5000) })
    .strict()
    .parse(req.body);
  const data = await result(
    db
      .from("project_messages")
      .insert({ ...body, project_id: project.id, sender_id: req.identity.id })
      .select("id")
      .single(),
  );
  res.status(201).json({ success: true, data });
});
communicationRoutes.get("/:id/milestones", async (req, res) => {
  const project = await owned(req);
  const { page } = pageSchema.parse(req.query);
  const { data, error, count } = await db
    .from("project_milestones")
    .select("*", { count: "exact" })
    .eq("project_id", project.id)
    .order("display_order")
    .range((page - 1) * 20, page * 20 - 1);
  if (error)
    throw new ApiError(500, "DATABASE_ERROR", "Unable to load milestones.");
  res.json({
    success: true,
    data: { items: data, total: count, page, limit: 20 },
  });
});
const milestoneSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).default(""),
    due_date: z.iso.date().nullable().default(null),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).default("PENDING"),
    display_order: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
communicationRoutes.post(
  "/:id/milestones",
  requireRole("ADMIN"),
  async (req, res) => {
    const project = await owned(req);
    const body = milestoneSchema.parse(req.body);
    const data = await result(
      db
        .from("project_milestones")
        .insert({ ...body, project_id: project.id })
        .select()
        .single(),
    );
    res.status(201).json({ success: true, data });
  },
);
communicationRoutes.patch(
  "/:id/milestones/:milestoneId",
  requireRole("ADMIN"),
  async (req, res) => {
    const project = await owned(req);
    const body = milestoneSchema.partial().parse(req.body);
    const data = await result(
      db
        .from("project_milestones")
        .update(body)
        .eq("id", uuid.parse(req.params.milestoneId))
        .eq("project_id", project.id)
        .select()
        .maybeSingle(),
    );
    if (!data) throw new ApiError(404, "NOT_FOUND", "Milestone not found.");
    res.json({ success: true, data });
  },
);
