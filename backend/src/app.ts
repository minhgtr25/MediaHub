import { supportRoutes } from './support-routes.js';
import { paymentRoutes } from './payment-routes.js';
import { quotationRoutes } from "./quotation-routes.js";
import { seoRoutes } from "./seo-routes.js";
import { fileType } from "./file-validation.js";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, result, ApiError } from "./db.js";
import { authenticate, requireRole } from "./middleware.js";
import { canAccess } from "./domain.js";
import {
  uuid,
  projectSchema,
  quoteSchema,
  reviewSchema,
  revisionSchema,
  statusSchema,
  resources,
} from "./validators.js";
import type { Json } from "./models/database.types.js";
import { env } from "./config/database.js";
import { adminAccountRoutes } from "./admin-account-routes.js";
import { publicContentRoutes, adminContentRoutes } from "./content-routes.js";
import { customerRoutes, communicationRoutes } from "./customer-routes.js";
import { publicLeadRoutes, adminLeadRoutes } from "./lead-routes.js";
import { creatorRoutes } from "./creator-routes.js";
import { messagingRoutes } from "./messaging-routes.js";
export const app = express();
export default app;
app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api/public", (req, res, next) => {
  if (req.method === "GET") res.set("Cache-Control", "public, max-age=60");
  next();
});
app.use(
  helmet(),
  cors({ origin: env.CORS_ORIGIN }),
  express.json({ limit: "1mb" }),
  rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: "RATE_LIMIT", message: "Vui lòng thử lại sau." },
    },
  }),
);
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () =>
    console.info(req.method, req.path, res.statusCode, Date.now() - start),
  );
  next();
});
const send = (res: Response, data: unknown) =>
  res.json({ success: true, data });
const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).default(""),
  status: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "REVIEWING",
      "QUOTATION_SENT",
      "QUOTATION_ACCEPTED",
      "IN_PROGRESS",
      "WAITING_REVIEW",
      "REVISION",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  service_id: uuid.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
type ListQuery<T> = PromiseLike<{
  data: T[] | null;
  error: { code?: string } | null;
  count: number | null;
}> & {
  ilike(column: string, pattern: string): ListQuery<T>;
  range(from: number, to: number): ListQuery<T>;
};
async function list<T>(
  req: Request,
  query: ListQuery<T>,
  searchField?: string,
) {
  const f = paging.parse(req.query);
  if (f.search && searchField)
    query = query.ilike(searchField, `%${f.search.replace(/[%_]/g, "")}%`);
  const { data, error, count } = await query.range(
    (f.page - 1) * f.limit,
    f.page * f.limit - 1,
  );
  if (error)
    throw new ApiError(500, "DATABASE_ERROR", "Không thể tải dữ liệu.");
  return { items: data, total: count, page: f.page, limit: f.limit };
}
async function owned(req: Request) {
  const id = uuid.parse(req.params.id);
  const p = await result(
    db.from("projects").select("*").eq("id", id).maybeSingle(),
  );
  if (
    !p ||
    !canAccess(req.identity.role, req.identity.customer_id, p.customer_id)
  )
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Không tìm thấy dự án.");
  return p;
}
async function action(req: Request, name: string, payload: Json = {}) {
  await owned(req);
  return result(
    db.rpc("project_action", {
      actor_id: req.identity.id,
      pid: uuid.parse(req.params.id),
      action: name,
      payload,
    }),
  );
}
app.get("/api/health", (_req, res) => send(res, { status: "ok" }));
app.get("/api/ready", async (_req, res) => {
  const { error, status } = await db.from("services").select("id").limit(1);
  if (error || status !== 200) {
    res.status(503).json({
      success: false,
      error: { code: "NOT_READY", message: "Database is unavailable." },
    });
    return;
  }
  send(res, { status: "ready" });
});
const catalogFilters = z.object({
  category: z.string().trim().max(100).optional(),
  featured: z.enum(["true", "false"]).optional(),
});
app.get("/api/public/services", async (req, res) => {
  const f = catalogFilters.parse(req.query);
  let query = db
    .from("services")
    .select(
      "id,name,slug,description,category,starting_price,estimated_days,thumbnail_url,featured,features,deliverables,price_max,seo_title,seo_description",
      { count: "exact" },
    )
    .eq("active", true)
    .order("display_order")
    .order("created_at", { ascending: false });
  if (f.category) query = query.eq("category", f.category);
  if (f.featured) query = query.eq("featured", f.featured === "true");
  send(res, await list(req, query, "name"));
});
app.get("/api/public/portfolio", async (req, res) => {
  const f = catalogFilters.parse(req.query);
  let query = db
    .from("portfolio")
    .select(
      "id,slug,title,client,description,category,image_url,featured,created_at,year",
      { count: "exact" },
    )
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (f.category) query = query.eq("category", f.category);
  if (f.featured) query = query.eq("featured", f.featured === "true");
  send(res, await list(req, query, "title"));
});
app.get("/api/public/testimonials", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("testimonials")
        .select("id,content,published_at", { count: "exact" })
        .eq("status", "APPROVED")
        .order("published_at", { ascending: false }),
    ),
  ),
);
app.get("/api/public/home", async (_req, res) => {
  const client = db as any;
  const [hero, services, projects, creators, testimonials, partners, creatorCount, projectCount] = await Promise.all([
    client.from("website_settings").select("title,content,image").eq("key", "hero").eq("published", true).maybeSingle(),
    client.from("services").select("id,name,slug,description,category,thumbnail_url,starting_price,features").eq("active", true).order("featured", { ascending: false }).order("display_order").limit(6),
    client.from("portfolio").select("id,slug,title,client,description,category,image_url,year").eq("published", true).order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(4),
    client.from("creator_profiles").select("id,slug,display_name,title,avatar_url,location,rating,completed_projects,verified,creator_skills(skills(id,name,slug))").order("featured", { ascending: false }).order("rating", { ascending: false, nullsFirst: false }).limit(4),
    client.from("testimonials").select("id,content,published_at").eq("status", "APPROVED").order("published_at", { ascending: false }).limit(1),
    client.from("partners").select("id,name,logo,website").eq("active", true).order("display_order").limit(8),
    client.from("creator_profiles").select("id", { count: "exact", head: true }),
    client.from("portfolio").select("id", { count: "exact", head: true }).eq("published", true),
  ]);
  const sources = { hero, services, projects, creators, testimonials, partners, creatorCount, projectCount };
  for (const [name, response] of Object.entries(sources)) {
    if (response.error) console.error("Homepage data source failed", name, response.error.code ?? "UNKNOWN");
  }
  send(res, {
    hero: hero.data ?? null,
    services: services.data ?? [],
    projects: projects.data ?? [],
    creators: creators.data ?? [],
    testimonials: testimonials.data ?? [],
    partners: partners.data ?? [],
    stats: {
      creators: creatorCount.count ?? creators.data?.length ?? 0,
      projects: projectCount.count ?? projects.data?.length ?? 0,
      satisfaction: 98,
      experience: 5,
    },
  });
});
app.get("/api/public/portfolio/:id", async (req, res) => {
  const p = await result(
    db
      .from("portfolio")
      .select(
        "id,slug,title,client,description,category,image_url,industry,year,duration,challenge,solution,result,gallery,deliverables,seo_title,seo_description",
      )
      .eq(
        uuid.safeParse(req.params.id).success ? "id" : "slug",
        z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .max(200)
          .parse(req.params.id),
      )
      .eq("published", true)
      .maybeSingle(),
  );
  if (!p) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy dự án.");
  send(res, p);
});
app.use("/api/public", publicLeadRoutes, publicContentRoutes, creatorRoutes, seoRoutes);
app.get("/api/public/services/:slug", async (req, res) => {
  const slug = z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(200)
    .parse(req.params.slug);
  const service = await result(
    db
      .from("services")
      .select(
        "id,name,slug,description,category,starting_price,estimated_days,thumbnail_url,featured,features,deliverables,price_max,seo_title,seo_description",
      )
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle(),
  );
  if (!service) throw new ApiError(404, "NOT_FOUND", "Service not found.");
  send(res, service);
});
app.use("/api", authenticate);
app.use('/api/support', supportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/messages', messagingRoutes);
// Staff have a dedicated support surface. Existing admin/customer APIs stay restricted.
app.use('/api',(req,_res,next)=>{
 if(req.identity.role==='STAFF' && !/^\/(auth\/me|notifications)(\/|$)/.test(req.path)) return next(new ApiError(403,'FORBIDDEN','Chỉ có quyền truy cập khu vực hỗ trợ.'));
 next();
});
app.use("/api/customer", requireRole(["CUSTOMER", "BUSINESS"]), customerRoutes);
app.use("/api/projects", communicationRoutes);
app.get("/api/auth/me", (req, res) => send(res, req.identity));
app.patch("/api/auth/me", async (req, res) => {
  const body = z
    .object({
      full_name: z.string().trim().min(1).max(150),
      phone: z.string().max(30).default(""),
      company_name: z.string().max(200).optional(),
      avatar_url: z
        .union([z.literal(""), z.url().refine((v) => v.startsWith("https://"))])
        .optional(),
      notification_preferences: z
        .object({ email: z.boolean(), in_app: z.boolean() })
        .strict()
        .optional(),
    })
    .strict()
    .parse(req.body);
  send(
    res,
    await result(
      db.rpc("update_profile", { actor_id: req.identity.id, payload: body }),
    ),
  );
});
app.get("/api/notifications", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("user_id", req.identity.id)
        .order("created_at", { ascending: false }),
    ),
  ),
);
app.patch("/api/notifications/:id", async (req, res) => {
  z.object({}).strict().parse(req.body);
  send(
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
app.get("/api/customer/dashboard", requireRole(["CUSTOMER", "BUSINESS"]), async (req, res) =>
  send(
    res,
    await result(db.rpc("dashboard_report", { actor_id: req.identity.id })),
  ),
);
async function projectList(req: Request) {
  const f = paging.parse(req.query);
  let q = db
    .from("projects")
    .select(
      "*,customers(company_name,profiles(full_name,email)),project_services!inner(service_id)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (req.identity.role === "CUSTOMER")
    q = q.eq("customer_id", req.identity.customer_id!);
  if (f.status) q = q.eq("status", f.status);
  if (f.service_id) q = q.eq("project_services.service_id", f.service_id);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to)
    q = q.lt(
      "created_at",
      new Date(new Date(f.to).getTime() + 86400000).toISOString(),
    );
  return list(req, q, "title");
}
app.get("/api/projects", async (req, res) => send(res, await projectList(req)));
app.post("/api/projects", requireRole(["CUSTOMER", "BUSINESS"]), async (req, res) => {
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
});
app.get("/api/projects/:id", async (req, res) => {
  const p = await owned(req);
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
        if (req.identity.role === "CUSTOMER") q = q.neq("status", "DRAFT");
        return result(q);
      }
      if (t === "invoices") {
        let q = db.from("invoices").select("*").eq("project_id", p.id);
        if (req.identity.role === "CUSTOMER") q = q.neq("status", "DRAFT");
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
app.patch("/api/projects/:id", requireRole(["CUSTOMER", "BUSINESS"]), async (req, res) =>
  send(res, await action(req, "edit", projectSchema.parse(req.body))),
);
for (const [path, table] of [
  ["history", "project_status_history"],
  ["files", "project_files"],
  ["deliverables", "deliverables"],
] as const)
  app.get(`/api/projects/:id/${path}`, async (req, res) => {
    await owned(req);
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
  app.post(
    `/api/projects/:id/${path}`,
    requireRole(["CUSTOMER", "BUSINESS"]),
    async (req, res) =>
      send(res, await action(req, name, schema.parse(req.body))),
  );
app.post(
  "/api/projects/:id/approve-deliverable",
  requireRole(["CUSTOMER", "BUSINESS"]),
  async (req, res) =>
    send(
      res,
      await action(
        req,
        "approve-deliverable",
        z.object({ deliverable_id: uuid }).strict().parse(req.body),
      ),
    ),
);
app.use("/api/admin", requireRole("ADMIN"));
app.use(
  "/api/admin",
  adminLeadRoutes,
  adminContentRoutes,
  adminAccountRoutes,
  quotationRoutes,
);
app.post("/api/admin/projects/:id/issue-invoice", async (req, res) =>
  send(
    res,
    await action(
      req,
      "issue-invoice",
      z.object({ due_date: z.iso.date() }).strict().parse(req.body),
    ),
  ),
);
app.patch("/api/admin/projects/:id/revisions/:revisionId", async (req, res) =>
  send(
    res,
    await action(req, "revision-status", {
      ...z
        .object({ status: z.enum(["IN_PROGRESS", "RESOLVED", "CANCELLED"]) })
        .strict()
        .parse(req.body),
      revision_id: uuid.parse(req.params.revisionId),
    }),
  ),
);
app.get("/api/admin/quotations", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("quotations")
        .select("*,projects(title),quotation_items(*)", { count: "exact" })
        .order("created_at", { ascending: false }),
    ),
  ),
);
app.get("/api/admin/invoices/:id", async (req, res) => {
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

app.patch("/api/admin/projects/:id", async (req, res) => {
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
app.get("/api/admin/files", async (req, res) => {
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
app.get("/api/admin/projects", async (req, res) =>
  send(res, await projectList(req)),
);
for (const path of ["dashboard", "revenue"])
  app.get(`/api/admin/${path}`, async (req, res) =>
    send(
      res,
      await result(db.rpc("dashboard_report", { actor_id: req.identity.id })),
    ),
  );
app.get("/api/admin/customers", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("customers")
        .select("*,profiles!inner(full_name,email,role)", { count: "exact" })
        .eq("profiles.role", "CUSTOMER")
        .order("created_at", { ascending: false }),
      "company_name",
    ),
  ),
);
app.get("/api/admin/customers/:id", async (req, res) => {
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
app.get("/api/admin/invoices", async (req, res) =>
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
app.patch("/api/admin/projects/:id/status", async (req, res) =>
  send(res, await action(req, "status", statusSchema.parse(req.body))),
);
app.post("/api/admin/projects/:id/paid", async (req, res) =>
  send(res, await action(req, "paid", z.object({}).strict().parse(req.body))),
);
app.get("/api/admin/employees/:id", async (req, res) => {
  const data = await result(
    db
      .from("employees")
      .select("*")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!data) throw new ApiError(404, "NOT_FOUND", "Record not found.");
  send(res, data);
});
app.get("/api/admin/employees", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("employees")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false }),
      "name",
    ),
  ),
);
app.post("/api/admin/employees", async (req, res) => {
  const body = resources.employees.strict().parse(req.body);
  send(
    res,
    await result(
      db
        .from("employees")
        .insert({ ...body })
        .select()
        .single(),
    ),
  );
});
app.patch("/api/admin/employees/:id", async (req, res) => {
  const body = resources.employees.partial().strict().parse(req.body);
  send(
    res,
    await result(
      db
        .from("employees")
        .update({ ...body })
        .eq("id", uuid.parse(req.params.id))
        .select()
        .single(),
    ),
  );
});
app.delete("/api/admin/employees/:id", async (req, res) => {
  await result(
    db.from("employees").delete().eq("id", uuid.parse(req.params.id)),
  );
  send(res, { deleted: true });
});
app.get("/api/admin/services/:id", async (req, res) => {
  const data = await result(
    db
      .from("services")
      .select("*")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!data) throw new ApiError(404, "NOT_FOUND", "Record not found.");
  send(res, data);
});
app.get("/api/admin/services", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("services")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false }),
      "name",
    ),
  ),
);
app.post("/api/admin/services", async (req, res) => {
  const body = resources.services.strict().parse(req.body);
  send(
    res,
    await result(
      db
        .from("services")
        .insert({ ...body })
        .select()
        .single(),
    ),
  );
});
app.patch("/api/admin/services/:id", async (req, res) => {
  const body = resources.services.partial().strict().parse(req.body);
  send(
    res,
    await result(
      db
        .from("services")
        .update({ ...body })
        .eq("id", uuid.parse(req.params.id))
        .select()
        .single(),
    ),
  );
});
app.delete("/api/admin/services/:id", async (req, res) => {
  await result(
    db.from("services").delete().eq("id", uuid.parse(req.params.id)),
  );
  send(res, { deleted: true });
});
app.get("/api/admin/portfolio/:id", async (req, res) => {
  const data = await result(
    db
      .from("portfolio")
      .select("*")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!data) throw new ApiError(404, "NOT_FOUND", "Record not found.");
  send(res, data);
});
app.get("/api/admin/portfolio", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("portfolio")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false }),
      "title",
    ),
  ),
);
app.post("/api/admin/portfolio", async (req, res) => {
  const body = resources.portfolio.strict().parse(req.body);
  send(
    res,
    await result(
      db
        .from("portfolio")
        .insert({ ...body })
        .select()
        .single(),
    ),
  );
});
app.patch("/api/admin/portfolio/:id", async (req, res) => {
  const body = resources.portfolio.partial().strict().parse(req.body);
  send(
    res,
    await result(
      db
        .from("portfolio")
        .update({ ...body })
        .eq("id", uuid.parse(req.params.id))
        .select()
        .single(),
    ),
  );
});
app.delete("/api/admin/portfolio/:id", async (req, res) => {
  await result(
    db.from("portfolio").delete().eq("id", uuid.parse(req.params.id)),
  );
  send(res, { deleted: true });
});
app.get("/api/admin/testimonials/:id", async (req, res) => {
  const data = await result(
    db
      .from("testimonials")
      .select("*")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!data) throw new ApiError(404, "NOT_FOUND", "Record not found.");
  send(res, data);
});
app.get("/api/admin/testimonials", async (req, res) =>
  send(
    res,
    await list(
      req,
      db
        .from("testimonials")
        .select("*", { count: "exact" })
        .order("published_at", { ascending: false }),
      "content",
    ),
  ),
);
app.post("/api/admin/testimonials", async (req, res) => {
  const body = resources.testimonials.strict().parse(req.body);
  send(
    res,
    await result(
      db
        .from("testimonials")
        .insert({
          ...body,
          published_at:
            body.status === "APPROVED" ? new Date().toISOString() : null,
        })
        .select()
        .single(),
    ),
  );
});
app.patch("/api/admin/testimonials/:id", async (req, res) => {
  const body = resources.testimonials.partial().strict().parse(req.body);
  send(
    res,
    await result(
      db
        .from("testimonials")
        .update({
          ...body,
          ...(body.status
            ? {
                published_at:
                  body.status === "APPROVED" ? new Date().toISOString() : null,
              }
            : {}),
        })
        .eq("id", uuid.parse(req.params.id))
        .select()
        .single(),
    ),
  );
});
app.delete("/api/admin/testimonials/:id", async (req, res) => {
  await result(
    db.from("testimonials").delete().eq("id", uuid.parse(req.params.id)),
  );
  send(res, { deleted: true });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0 },
});
for (const [path, bucket, name] of [
  ["/api/projects/:id/files", "project-files", "file"],
  ["/api/admin/projects/:id/deliverables", "deliverables", "deliverable"],
] as const)
  app.post(path, upload.single("file"), async (req, res) => {
    const p = await owned(req);
    if (bucket === "deliverables" && req.identity.role !== "ADMIN")
      throw new ApiError(403, "FORBIDDEN", "Không có quyền tải lên.");
    if (!req.file)
      throw new ApiError(422, "FILE_REQUIRED", "Vui lòng chọn tệp.");
    const ext = fileType(req.file);
    const path = `${p.id}/${randomUUID()}.${ext}`;
    await result(
      db.storage
        .from(bucket)
        .upload(path, req.file.buffer, { contentType: req.file.mimetype }),
    );
    try {
      await action(req, name, {
        name: req.file.originalname,
        path,
        type: req.file.mimetype,
        size: req.file.size,
      });
    } catch (e) {
      await db.storage.from(bucket).remove([path]);
      throw e;
    }
    send(res, { path });
  });
app.get("/api/projects/:id/download/:kind/:fileId", async (req, res) => {
  await owned(req);
  const kind = z.enum(["files", "deliverables"]).parse(req.params.kind);
  const row = await result(
    db
      .from(kind === "files" ? "project_files" : "deliverables")
      .select("file_url")
      .eq("id", uuid.parse(req.params.fileId))
      .eq("project_id", req.params.id)
      .maybeSingle(),
  );
  if (!row) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy tệp.");
  send(
    res,
    await result(
      db.storage
        .from(kind === "files" ? "project-files" : "deliverables")
        .createSignedUrl(row.file_url, 300, { download: true }),
    ),
  );
});
app.post("/api/admin/media", upload.single("file"), async (req, res) => {
  if (!req.file) throw new ApiError(422, "FILE_REQUIRED", "Vui lòng chọn ảnh.");
  const ext = fileType(req.file);
  if (!req.file.mimetype.startsWith("image/"))
    throw new ApiError(422, "INVALID_FILE", "Vui lòng chọn ảnh.");
  const path = `${randomUUID()}.${ext}`;
  await result(
    db.storage
      .from("portfolio")
      .upload(path, req.file.buffer, { contentType: req.file.mimetype }),
  );
  send(res, {
    url: db.storage.from("portfolio").getPublicUrl(path).data.publicUrl,
  });
});
app.use((_req, _res, next) =>
  next(new ApiError(404, "NOT_FOUND", "Không tìm thấy đường dẫn.")),
);
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  let status = 500,
    code = "INTERNAL_ERROR",
    message = "Có lỗi xảy ra. Vui lòng thử lại.";
  if (err instanceof z.ZodError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Thông tin không hợp lệ. Vui lòng kiểm tra các trường.";
  } else if (err instanceof ApiError) {
    ({ status, code, message } = err);
  } else if (err instanceof multer.MulterError) {
    status = 422;
    code = "INVALID_UPLOAD";
    message = "Tệp quá lớn hoặc yêu cầu tải lên không hợp lệ.";
  } else if (err instanceof SyntaxError) {
    status = 400;
    code = "INVALID_JSON";
    message = "Dữ liệu gửi lên không hợp lệ.";
  } else
    console.error(
      "Unhandled API error",
      err instanceof Error ? err.name : "unknown",
    );
  res.status(status).json({ success: false, error: { code, message } });
});
