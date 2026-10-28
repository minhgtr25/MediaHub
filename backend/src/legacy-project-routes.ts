import { Router } from "express";
import { z } from "zod";
import { db, result } from "./db.js";
import { isCustomerRole } from "./domain.js";
import {
  projectSchema,
  reviewSchema,
  revisionSchema,
  uuid,
} from "./validators.js";
import {
  ownedProject,
  projectAction,
  projectList,
} from "./legacy-project-utils.js";
import { requireRole } from "./middleware.js";
import { list } from "./utils/pagination.js";
import { send } from "./utils/response.js";

export const legacyProjectRoutes = Router();
legacyProjectRoutes.get("/", async (req, res) =>
  send(res, await projectList(req)),
);
legacyProjectRoutes.post(
  "/",
  requireRole(["CUSTOMER", "BUSINESS"]),
  async (req, res) => {
    const body = projectSchema.parse(req.body);
    res.status(201);
    send(
      res,
      await result(
        db.rpc("project_action", {
          actor_id: req.identity.id,
          pid: null,
          action: "create",
          payload: body,
        }),
      ),
    );
  },
);
legacyProjectRoutes.get("/:id", async (req, res) => {
  const p = await ownedProject(req);
  const tables = [
    "project_services",
    "quotations",
    "project_files",
    "project_status_history",
    "deliverables",
    "revision_requests",
    "invoices",
    "reviews",
  ] as const;
  const values = await Promise.all(
    tables.map((t) => {
      if (t === "quotations") {
        let q = db
          .from("quotations")
          .select("*,quotation_items(*)")
          .eq("project_id", p.id);
        if (isCustomerRole(req.identity.role)) q = q.neq("status", "DRAFT");
        return result(q);
      }
      if (t === "invoices") {
        let q = db.from("invoices").select("*").eq("project_id", p.id);
        if (isCustomerRole(req.identity.role)) q = q.neq("status", "DRAFT");
        return result(q);
      }
      return result(db.from(t).select("*").eq("project_id", p.id));
    }),
  );
  send(res, {
    ...p,
    ...Object.fromEntries(tables.map((t, i) => [t, values[i]])),
  });
});
legacyProjectRoutes.patch(
  "/:id",
  requireRole(["CUSTOMER", "BUSINESS"]),
  async (req, res) =>
    send(res, await projectAction(req, "edit", projectSchema.parse(req.body))),
);
for (const [path, table] of [
  ["history", "project_status_history"],
  ["files", "project_files"],
  ["deliverables", "deliverables"],
] as const)
  legacyProjectRoutes.get(`/:id/${path}`, async (req, res) => {
    await ownedProject(req);
    send(
      res,
      await list(
        req,
        db
          .from(table)
          .select("*", { count: "exact" })
          .eq("project_id", req.params.id)
          .order("created_at", { ascending: true }),
      ),
    );
  });
for (const [path, name, schema] of [
  ["accept-quotation", "accept", z.object({}).strict()],
  ["reject-quotation", "reject", z.object({}).strict()],
  ["revisions", "revision", revisionSchema],
  ["complete", "complete", z.object({}).strict()],
  ["reviews", "review", reviewSchema],
] as const)
  legacyProjectRoutes.post(
    `/:id/${path}`,
    requireRole(["CUSTOMER", "BUSINESS"]),
    async (req, res) =>
      send(res, await projectAction(req, name, schema.parse(req.body))),
  );
legacyProjectRoutes.post(
  "/:id/approve-deliverable",
  requireRole(["CUSTOMER", "BUSINESS"]),
  async (req, res) =>
    send(
      res,
      await projectAction(
        req,
        "approve-deliverable",
        z.object({ deliverable_id: uuid }).strict().parse(req.body),
      ),
    ),
);
