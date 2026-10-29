import { Router } from "express";
import { z } from "zod";
import { ApiError, db, result } from "./db.js";
import { customerRoles } from "./domain.js";
import { statusSchema, uuid } from "./validators.js";
import {
  ownedProject,
  projectAction,
  projectList,
} from "./legacy-project-utils.js";
import { list } from "./utils/pagination.js";
import { send } from "./utils/response.js";

export const legacyAdminRoutes = Router();
legacyAdminRoutes.get("/mediahub-mv-bills", async (req, res) =>
  send(
    res,
    await result(
      db.rpc("admin_mediahub_mv_bill_report", { actor_id: req.identity.id }),
    ),
  ),
);
legacyAdminRoutes.post("/projects/:id/issue-invoice", async (req, res) =>
  send(
    res,
    await projectAction(
      req,
      "issue-invoice",
      z.object({ due_date: z.iso.date() }).strict().parse(req.body),
    ),
  ),
);
legacyAdminRoutes.patch(
  "/projects/:id/revisions/:revisionId",
  async (req, res) =>
    send(
      res,
      await projectAction(req, "revision-status", {
        ...z
          .object({ status: z.enum(["IN_PROGRESS", "RESOLVED", "CANCELLED"]) })
          .strict()
          .parse(req.body),
        revision_id: uuid.parse(req.params.revisionId),
      }),
    ),
);
legacyAdminRoutes.get("/quotations", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("quotations")
        .select("*,projects(title),quotation_items(*)", { count: "exact" })
        .not("project_id", "is", null)
        .order("created_at", { ascending: false }),
    ),
  ),
);
legacyAdminRoutes.get("/invoices/:id", async (req, res) => {
  const data = await result(
    db
      .from("invoices")
      .select("*,projects(title)")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!data) throw new ApiError(404, "NOT_FOUND", "Invoice not found.");
  send(res, data);
});

legacyAdminRoutes.patch("/projects/:id", async (req, res) => {
  await ownedProject(req);
  const body = z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().min(1).max(5000),
      scope: z.string().max(10000),
      progress: z.number().int().min(0).max(100),
      deadline: z.iso.date().nullable(),
    })
    .strict()
    .parse(req.body);
  send(
    res,
    await result(
      db.rpc("edit_project", {
        actor_id: req.identity.id,
        pid: uuid.parse(req.params.id),
        payload: body,
      }),
    ),
  );
});
legacyAdminRoutes.get("/files", async (req, res) => {
  const kind = z
    .enum(["files", "deliverables"])
    .default("files")
    .parse(req.query.kind);
  send(
    res,
    await list<unknown>(
      req,
      kind === "files"
        ? db
            .from("project_files")
            .select("id,project_id,file_name,file_type,file_size,created_at", {
              count: "exact",
            })
            .order("created_at", { ascending: false })
        : db
            .from("deliverables")
            .select("id,project_id,name,version,status,created_at", {
              count: "exact",
            })
            .order("created_at", { ascending: false }),
    ),
  );
});
legacyAdminRoutes.get("/projects", async (req, res) =>
  send(res, await projectList(req)),
);
for (const path of ["dashboard", "revenue"])
  legacyAdminRoutes.get(`/${path}`, async (req, res) => {
    const report = await result(
      db.rpc("dashboard_report", { actor_id: req.identity.id }),
    );
    if (!report)
      throw new ApiError(500, "REPORT_UNAVAILABLE", "Không thể tải báo cáo.");
    if (path === "revenue") return send(res, report);
    const completedShowcase = await result(
      db
        .from("portfolio")
        .select("id,slug,title,category")
        .in("slug", [
          "mediahub-mv-remake-cau-hon",
          "mediahub-mv-remake-toi-cho-em",
          "mediahub-mv-remake-loi-tam-biet-chua-noi",
        ])
        .eq("published", true)
        .eq("is_demo", false),
    );
    const showcased = completedShowcase ?? [];
    const statusCounts = report.by_status.filter(
      (item) => item.status !== "COMPLETED",
    );
    const completedCount =
      (report.by_status.find((item) => item.status === "COMPLETED")?.count ??
        0) + showcased.length;
    return send(res, {
      ...report,
      total_projects: report.total_projects + showcased.length,
      completed_projects: report.completed_projects + showcased.length,
      by_status: completedCount
        ? [...statusCounts, { status: "COMPLETED", count: completedCount }]
        : statusCounts,
      showcase_completed_projects: showcased,
    });
  });
legacyAdminRoutes.get("/customers", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("customers")
        .select("*,profiles!inner(full_name,email,role)", { count: "exact" })
        .in("profiles.role", customerRoles)
        .order("created_at", { ascending: false }),
      "company_name",
    ),
  ),
);
legacyAdminRoutes.get("/customers/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  send(res, {
    customer: await result(
      db
        .from("customers")
        .select("*,profiles(full_name,email,phone)")
        .eq("id", id)
        .single(),
    ),
    projects: await list(
      req,
      db
        .from("projects")
        .select("*", { count: "exact" })
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
    ),
  });
});
legacyAdminRoutes.get("/invoices", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("invoices")
        .select("*,projects(title)", { count: "exact" })
        .order("issued_at", { ascending: false }),
    ),
  ),
);
legacyAdminRoutes.patch("/projects/:id/status", async (req, res) =>
  send(res, await projectAction(req, "status", statusSchema.parse(req.body))),
);
legacyAdminRoutes.post("/projects/:id/paid", async (req, res) =>
  send(
    res,
    await projectAction(req, "paid", z.object({}).strict().parse(req.body)),
  ),
);
