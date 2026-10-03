import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { env } from "./config/database.js";
import { uuid } from "./validators.js";
import { customerRoles, roles, persistedRoles } from "./domain.js";
export const adminAccountRoutes = Router();
adminAccountRoutes.get("/leads/:id/customer", async (req, res) => {
  const lead = await result(
    db
      .from("leads")
      .select("email,source")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!lead) throw new ApiError(404, "NOT_FOUND", "Enquiry not found.");
  if (lead.source === "CREATOR_APPLICATION") { res.json({ success: true, data: null }); return; }
  const profile = await result(
    db
      .from("profiles")
      .select("id,full_name,email")
      .eq("email", lead.email)
      .in("role", customerRoles)
      .eq("active", true)
      .maybeSingle(),
  );
  const customer = profile
    ? await result(
        db
          .from("customers")
          .select("id,company_name")
          .eq("profile_id", profile.id)
          .maybeSingle(),
      )
    : null;
  res.json({
    success: true,
    data:
      profile && customer
        ? { ...customer, full_name: profile.full_name, email: profile.email }
        : null,
  });
});
adminAccountRoutes.get("/users", async (req, res) => {
  const { page, search } = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      search: z.string().max(100).default(""),
    })
    .parse(req.query);
  const { data, error, count } = await db
    .from("profiles")
    .select("id,full_name,email,role,active,created_at", { count: "exact" })
    .ilike("full_name", `%${search.replace(/[%_]/g, "")}%`)
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error) throw new ApiError(500, "DATABASE_ERROR", "Unable to load users.");
  res.json({
    success: true,
    data: { items: data, total: count, page, limit: 20 },
  });
});
adminAccountRoutes.patch("/users/:id", async (req, res) => {
  const body = z
    .object({ role: z.enum(persistedRoles), active: z.boolean() })
    .strict()
    .parse(req.body);
  if (!(roles as readonly string[]).includes(body.role)) {
    const existing = await result(db.from("profiles").select("role").eq("id", uuid.parse(req.params.id)).maybeSingle());
    if (!existing || existing.role !== body.role) throw new ApiError(422, "LEGACY_ROLE", "Chỉ cấp quyền Khách hàng, Staff, Creator hoặc Admin. Vai trò cũ chỉ được giữ nguyên trong giai đoạn chuyển đổi.");
  }
  const data = await result(
    db.rpc("manage_user", {
      actor_id: req.identity.id,
      target_id: uuid.parse(req.params.id),
      new_role: body.role,
      new_active: body.active,
    }),
  );
  res.json({ success: true, data });
});
adminAccountRoutes.post("/customers/invite", async (req, res) => {
  const body = z
    .object({
      email: z
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      full_name: z.string().trim().min(1).max(150),
      role: z.enum(["CUSTOMER", "STAFF"]).default("CUSTOMER"),
    })
    .strict()
    .parse(req.body);
  const existing = await result(
    db.from("profiles").select("id").eq("email", body.email).maybeSingle(),
  );
  if (existing)
    throw new ApiError(
      409,
      "ACCOUNT_EXISTS",
      "An account already exists for this email.",
    );
  const { error } = await db.auth.admin.inviteUserByEmail(body.email, {
    data: { full_name: body.full_name },
    redirectTo: env.AUTH_REDIRECT_URL,
  });
  if (error)
    throw new ApiError(
      409,
      "INVITATION_FAILED",
      "Unable to invite this account. Check whether it already exists and verify email delivery configuration.",
    );
  if (body.role === "STAFF") {
    const profile = await result(
      db.from("profiles").select("id").eq("email", body.email).single(),
    );
    if (!profile)
      throw new ApiError(
        503,
        "PROFILE_PENDING",
        "Invitation was created but the profile is not ready. Please retry shortly.",
      );
    await result(
      db.rpc("manage_user", {
        actor_id: req.identity.id,
        target_id: profile.id,
        new_role: "STAFF",
        new_active: true,
      }),
    );
  }
  res.status(201).json({ success: true, data: { invited: true } });
});
adminAccountRoutes.post("/leads/:id/convert", async (req, res) => {
  const body = z.object({ customer_id: uuid }).strict().parse(req.body);
  const lead = await result(db.from("leads").select("source").eq("id", uuid.parse(req.params.id)).maybeSingle());
  if (!lead) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy liên hệ.");
  if (lead.source === "CREATOR_APPLICATION") throw new ApiError(409, "APPLICATION_NOT_CUSTOMER", "Hồ sơ Creator được xét hợp tác, không chuyển thành khách hàng. Chỉ cấp tài khoản sau hợp đồng công ty.");
  const data = await result(
    db.rpc("convert_lead", {
      actor_id: req.identity.id,
      lid: uuid.parse(req.params.id),
      cid: body.customer_id,
    }),
  );
  res.json({ success: true, data });
});
