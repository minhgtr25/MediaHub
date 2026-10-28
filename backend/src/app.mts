import { serviceChatRoutes } from "./service-chat-routes.js";
import { legacyProjectRoutes } from "./legacy-project-routes.js";
import { legacyAdminRoutes } from "./legacy-admin-routes.js";
import { ownedProject, projectAction } from "./legacy-project-utils.js";
import { publicCatalogRoutes } from "./public-catalog-routes.js";
import { adminResourceRoutes } from "./admin-resource-routes.js";
import { notificationRoutes } from "./notification-routes.js";
import { supportRoutes } from "./support-routes.js";
import { paymentRoutes } from "./payment-routes.js";
import { quotationRoutes } from "./quotation-routes.js";
import { seoRoutes } from "./seo-routes.js";
import { fileType } from "./file-validation.js";
import { profileRoutes } from "./profile-routes.js";
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
import { customerRoles, commerceRoles } from "./domain.js";
import { uuid } from "./validators.js";
import { env } from "./config/database.js";
import { send } from "./utils/response.js";
import { adminAccountRoutes } from "./admin-account-routes.js";
import { publicContentRoutes, adminContentRoutes } from "./content-routes.js";
import { customerRoutes, communicationRoutes } from "./customer-routes.js";
import { publicLeadRoutes, adminLeadRoutes } from "./lead-routes.js";
import { creatorProfileRoutes } from "./creator-profile-routes.js";
import { creatorRoutes } from "./creator-routes.js";
import { messagingRoutes } from "./messaging-routes.js";
import { executionRoutes } from "./execution-routes.js";
import { variationRoutes } from "./order-variation-routes.js";
import { orderRoutes } from "./order-routes.js";
import { creatorWorkspaceRoutes } from "./creator-team-routes.js";
import { creatorOnboardingRoutes } from "./creator-onboarding-routes.js";
import { financeRoutes } from "./finance-routes.js";
import { companyPortfolioRoutes } from "./company-portfolio-routes.js";
import {
  orderFeedbackRoutes,
  caseStudyAdminRoutes,
  publicFeedbackRoutes,
} from "./order-feedback-routes.js";
import { deliveryRoutes } from "./delivery-routes.js";
import { requestRoutes } from "./request-routes.js";
import { publicServiceRoutes } from "./public-service-routes.js";
import { adminServicePackageRoutes } from "./admin-service-package-routes.js";
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
export const apiLimiter = rateLimit({
  windowMs: 60000,
  limit: 180,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMIT", message: "Vui lòng thử lại sau." },
  },
});
app.use(
  helmet(),
  cors({ origin: env.CORS_ORIGIN }),
  express.json({ limit: "1mb" }),
  apiLimiter,
);
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () =>
    console.info(req.method, req.path, res.statusCode, Date.now() - start),
  );
  next();
});
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
app.use("/api/public", publicCatalogRoutes);
app.use(
  "/api/public",
  publicServiceRoutes,
  publicLeadRoutes,
  publicContentRoutes,
  creatorRoutes,
  publicFeedbackRoutes,
  companyPortfolioRoutes,
  seoRoutes,
);
app.use("/api", authenticate);
app.use("/api/auth", profileRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/messages", messagingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/service-chat", serviceChatRoutes);
app.use("/api/creator/profile", creatorProfileRoutes);
app.use("/api/creator", creatorWorkspaceRoutes);
app.use("/api/admin/creators", creatorOnboardingRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/order-feedback", orderFeedbackRoutes);
app.use("/api/admin/case-studies", caseStudyAdminRoutes);
app.use("/api/order-variations", variationRoutes);
app.use("/api/execution", executionRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin/service-packages", adminServicePackageRoutes);
// Staff have a dedicated support surface. Existing admin/customer APIs stay restricted.
app.use("/api", (req, _res, next) => {
  if (
    req.identity.role === "STAFF" &&
    !/^\/(auth\/me|notifications)(\/|$)/.test(req.path)
  )
    return next(
      new ApiError(
        403,
        "FORBIDDEN",
        "Nhân viên chỉ có thể truy cập các API dành riêng cho hỗ trợ.",
      ),
    );
  next();
});
app.use("/api/customer", requireRole(customerRoles), customerRoutes);
app.use("/api/projects", requireRole(commerceRoles));
app.use("/api/projects", communicationRoutes);
app.use("/api/projects", legacyProjectRoutes);
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
app.get(
  "/api/customer/dashboard",
  requireRole(["CUSTOMER", "BUSINESS"]),
  async (req, res) =>
    send(
      res,
      await result(db.rpc("dashboard_report", { actor_id: req.identity.id })),
    ),
);
app.use("/api/admin", requireRole("ADMIN"));
app.use(
  "/api/admin",
  adminLeadRoutes,
  adminContentRoutes,
  adminAccountRoutes,
  quotationRoutes,
  adminResourceRoutes,
  legacyAdminRoutes,
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0 },
});
for (const [path, bucket, name] of [
  ["/api/projects/:id/files", "project-files", "file"],
  ["/api/admin/projects/:id/deliverables", "deliverables", "deliverable"],
] as const)
  app.post(path, upload.single("file"), async (req, res) => {
    const p = await ownedProject(req);
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
      await projectAction(req, name, {
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
  await ownedProject(req);
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
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
});
app.post("/api/admin/media", mediaUpload.single("file"), async (req, res) => {
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
