import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { uuid } from "./validators.js";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { fileType } from "./file-validation.js";
import { authenticate, requireRole } from "./middleware.js";
import { customerRoles } from "./domain.js";
import { businessContactSchema, creatorApplicationSchema, intakeSources } from "./intake-validators.js";

export const leadSchema = z
  .object({
    full_name: z.string().trim().min(1).max(150),
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    phone: z.string().trim().max(30).default(""),
    company: z.string().trim().max(200).default(""),
    service_id: uuid.nullable().default(null),
    project_type: z.string().trim().max(100).default(""),
    message: z.string().trim().min(1).max(5000),
    budget_range: z.string().trim().max(100).default(""),
    deadline: z.iso.date().nullable().default(null),
    source: z.enum(["CONTACT", "PROJECT_REQUEST"]),
  })
  .strict();
export const publicLeadRoutes = Router();
export const intakeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMIT", message: "Bạn đã gửi nhiều liên hệ. Vui lòng thử lại sau." } },
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldSize: 32768 },
});
publicLeadRoutes.post(
  ["/leads", "/business-contact", "/creator-applications"],
  intakeLimiter,
  upload.single("attachment"),
  (req, res, next) => {
    const input = typeof req.body?.payload === "string" ? JSON.parse(req.body.payload) : req.body;
    if (req.path === "/business-contact") {
      req.body = { ...businessContactSchema.parse(input), source: "BUSINESS_CONTACT" };
      return next();
    }
    if (req.path === "/creator-applications") {
      req.body = { ...creatorApplicationSchema.parse(input), source: "CREATOR_APPLICATION" };
      return next();
    }
    const body = leadSchema.parse(input);
    req.body = body;
    if (body.source === "CONTACT") return next();
    // A public contact enquiry is not an authenticated service request.
    void authenticate(req, res, (error) => {
      if (error) return next(error);
      return requireRole(customerRoles)(req, res, next);
    });
  },
  async (req, res) => {
    const body = req.body;
    if (body.source === "PROJECT_REQUEST") {
      // Contact fields cannot impersonate another customer after login.
      body.email = req.identity.email.toLowerCase();
      body.full_name = req.identity.full_name;
    }
    if (body.service_id) {
      const service = await result(
        db
          .from("services")
          .select("id")
          .eq("id", body.service_id)
          .eq("active", true)
          .maybeSingle(),
      );
      if (!service)
        throw new ApiError(
          422,
          "INVALID_SERVICE",
          "Please choose an available service.",
        );
    }
    if (body.source === "CREATOR_APPLICATION") {
      if (!req.file) throw new ApiError(422, "CV_REQUIRED", "Vui lòng gửi CV dạng PDF, tối đa 10 MB.");
      try {
        if (fileType(req.file) !== "pdf") throw new Error("Not PDF");
      } catch { throw new ApiError(422, "INVALID_CV", "CV cần là tệp PDF hợp lệ, tối đa 10 MB."); }
      if (!body.message) body.message = "Ứng tuyển hợp tác Creator";
    }
    if (req.file && req.file.originalname.length > 255) throw new ApiError(422, "INVALID_ATTACHMENT_NAME", "Tên tệp tối đa 255 ký tự.");
    const id = randomUUID();
    let attachment_path: string | null = null;
    if (req.file) {
      const ext = fileType(req.file);
      if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(ext ?? ""))
        throw new ApiError(
          422,
          "INVALID_ATTACHMENT",
          "Use a PDF or image under 10 MB.",
        );
      attachment_path = `${id}/${randomUUID()}.${ext}`;
      await result(
        db.storage
          .from("lead-attachments")
          .upload(attachment_path, req.file.buffer, {
            contentType: req.file.mimetype,
          }),
      );
    }
    try {
      await result(
        db
          .from("leads")
          .insert({
            ...body,
            id,
            attachment_path,
            attachment_name: req.file?.originalname ?? null,
            attachment_size: req.file?.size ?? null,
          }),
      );
    } catch (error) {
      if (attachment_path)
        await db.storage.from("lead-attachments").remove([attachment_path]);
      throw error;
    }
    res
      .status(201)
      .json({
        success: true,
        data: { message: "MediaHub đã nhận thông tin của bạn." },
      });
  },
);

export const adminLeadRoutes = Router();
adminLeadRoutes.get("/leads/:id/attachment", async (req, res) => {
  const lead = await result(
    db
      .from("leads")
      .select("attachment_path")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!lead?.attachment_path)
    throw new ApiError(404, "NOT_FOUND", "Attachment not found.");
  const data = await result(
    db.storage
      .from("lead-attachments")
      .createSignedUrl(lead.attachment_path, 300, { download: true }),
  );
  res.json({ success: true, data });
});
adminLeadRoutes.get("/leads", async (req, res) => {
  const params = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      search: z.string().max(100).default(""),
      source: z.enum(intakeSources).optional(),
      status: z
        .enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"])
        .optional(),
    })
    .parse(req.query);
  let query = db
    .from("leads")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (params.search)
    query = query.ilike("full_name", `%${params.search.replace(/[%_]/g, "")}%`);
  if (params.status) query = query.eq("status", params.status);
  if (params.source) query = query.eq("source", params.source);
  const { data, error, count } = await query.range(
    (params.page - 1) * 20,
    params.page * 20 - 1,
  );
  if (error)
    throw new ApiError(500, "DATABASE_ERROR", "Unable to load enquiries.");
  res.json({
    success: true,
    data: { items: data, total: count, page: params.page, limit: 20 },
  });
});
adminLeadRoutes.get("/leads/:id", async (req, res) => {
  const data = await result(
    db
      .from("leads")
      .select("*")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!data) throw new ApiError(404, "NOT_FOUND", "Enquiry not found.");
  res.json({ success: true, data });
});
adminLeadRoutes.patch("/leads/:id", async (req, res) => {
  const body = z
    .object({
      status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "LOST"]),
      notes: z.string().trim().max(10000),
    })
    .strict()
    .parse(req.body);
  const data = await result(
    db
      .from("leads")
      .update(body)
      .eq("id", uuid.parse(req.params.id))
      .neq("status", "CONVERTED")
      .select()
      .maybeSingle(),
  );
  if (!data)
    throw new ApiError(
      409,
      "INVALID_LEAD",
      "Enquiry is missing or has already been converted.",
    );
  res.json({ success: true, data });
});
