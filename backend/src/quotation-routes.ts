import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { uuid, quoteSchema } from "./validators.js";
export const quotationRoutes = Router();
async function legacyProject(id: unknown) {
  const project = await result(db.from("projects").select("order_id").eq("id", uuid.parse(id)).maybeSingle());
  if (!project || project.order_id) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy dự án theo luồng báo giá cũ.");
}
quotationRoutes.post("/projects/:id/quotation", async (req, res) => {
  await legacyProject(req.params.id);
  const body = quoteSchema.parse(req.body);
  const data = await result(
    db.rpc("save_quotation", {
      actor_id: req.identity.id,
      pid: uuid.parse(req.params.id),
      payload: body,
      send_now: true,
    }),
  );
  res.json({ success: true, data });
});
quotationRoutes.post("/projects/:id/quotation-draft", async (req, res) => {
  await legacyProject(req.params.id);
  const body = quoteSchema.parse(req.body);
  const data = await result(
    db.rpc("save_quotation", {
      actor_id: req.identity.id,
      pid: uuid.parse(req.params.id),
      payload: body,
      send_now: false,
    }),
  );
  res.json({ success: true, data });
});
quotationRoutes.get("/quotations/:id", async (req, res) => {
  const data = await result(
    db
      .from("quotations")
      .select("*,projects(title),quotation_items(*)")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!data || !data.project_id) throw new ApiError(404, "NOT_FOUND", "Quotation not found.");
  res.json({ success: true, data });
});
quotationRoutes.post("/quotations/:id/:operation", async (req, res) => {
  z.object({}).strict().parse(req.body);
  const quotation = await result(db.from("quotations").select("project_id").eq("id", uuid.parse(req.params.id)).maybeSingle());
  if (!quotation?.project_id) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy báo giá dự án.");
  const data = await result(
    db.rpc("manage_quotation", {
      actor_id: req.identity.id,
      qid: uuid.parse(req.params.id),
      operation: z.enum(["send", "cancel"]).parse(req.params.operation),
    }),
  );
  res.json({ success: true, data });
});
