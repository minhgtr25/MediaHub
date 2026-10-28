import { Router } from "express";
import { z } from "zod";
import { ApiError, db, result } from "./db.js";
import { resources, uuid } from "./validators.js";
import { list } from "./utils/pagination.js";
import { send } from "./utils/response.js";
import { creatorLocations } from "./creator-filter-options.js";

export const adminResourceRoutes = Router();
const secureImageUrl = z.union([
  z.literal(""),
  z
    .url()
    .max(2000)
    .refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    }, "Image must use a public HTTPS URL."),
]);
const hasSafeText = (value: string) =>
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const plainText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(hasSafeText, "Control characters are not allowed.");
const showcaseTags = (limit: number, length: number) =>
  z
    .array(z.string().trim().min(1).max(length).refine(hasSafeText))
    .max(limit)
    .refine(
      (items) =>
        new Set(items.map((item) => item.toLocaleLowerCase())).size ===
        items.length,
      "Duplicate entries are not allowed.",
    );
const showcasePayload = z
  .object({
    display_name: z.string().trim().min(2).max(150).refine(hasSafeText),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(2).max(200).refine(hasSafeText),
    bio: plainText(5000),
    avatar_url: secureImageUrl,
    cover_url: secureImageUrl,
    location: z.enum(creatorLocations),
    university: plainText(200),
    major: plainText(200),
    experience_level: z.enum(["STUDENT", "JUNIOR", "MID", "SENIOR", "LEAD"]),
    price_from: z.number().int().min(0).max(1_000_000_000_000).nullable(),
    tools: showcaseTags(30, 60),
    languages: showcaseTags(20, 50),
    category_ids: z
      .array(uuid)
      .max(10)
      .refine((items) => new Set(items).size === items.length),
    skill_ids: z
      .array(uuid)
      .max(30)
      .refine((items) => new Set(items).size === items.length),
    featured: z.boolean(),
    is_demo: z.boolean(),
    published: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.published &&
      (value.bio.length < 30 ||
        value.category_ids.length === 0 ||
        value.skill_ids.length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Published profiles need a 30-character bio, one category and one skill.",
      });
    }
    if (value.featured && !value.published) {
      ctx.addIssue({
        code: "custom",
        message: "Only published profiles can be featured.",
      });
    }
  });
async function saveCreatorShowcase(
  actorId: string,
  operation: "create" | "update" | "delete",
  payload: import("./models/database.types.js").Json,
) {
  const { data, error } = await db.rpc("admin_manage_creator_showcase", {
    actor_id: actorId,
    operation,
    payload,
  });
  if (error) {
    console.error("Creator showcase database error", {
      code: error.code,
      message: error.message,
    });
    if (["PGRST202", "PGRST204", "42703"].includes(error.code ?? "")) {
      throw new ApiError(
        503,
        "CREATOR_SHOWCASE_SCHEMA_NOT_READY",
        "Database chưa được cập nhật cho tính năng Creator. Hãy áp dụng migration mới nhất rồi thử lại.",
      );
    }
    if (error.code === "P0001")
      throw new ApiError(409, "INVALID_CREATOR_SHOWCASE", error.message);
    if (error.code === "23505")
      throw new ApiError(
        409,
        "DUPLICATE_CREATOR_SLUG",
        "Đường dẫn này đã được sử dụng.",
      );
    throw new ApiError(
      500,
      "CREATOR_SHOWCASE_SAVE_FAILED",
      "Không lưu được hồ sơ Creator. Vui lòng thử lại.",
    );
  }
  return data;
}
adminResourceRoutes.get("/creator-showcase/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const data = await result(
    db
      .from("creator_profiles")
      .select("*")
      .eq("id", id)
      .eq("admin_managed", true)
      .maybeSingle(),
  );
  if (!data)
    throw new ApiError(404, "NOT_FOUND", "Creator showcase not found.");
  const rawDb = db as unknown as { from: (table: string) => any };
  const [categories, skills] = await Promise.all([
    result<{ category_id: string }[]>(
      rawDb
        .from("creator_categories")
        .select("category_id")
        .eq("creator_id", id),
    ),
    result<{ skill_id: string }[]>(
      rawDb.from("creator_skills").select("skill_id").eq("creator_id", id),
    ),
  ]);
  send(res, {
    ...data,
    category_ids: (categories ?? []).map(
      (x: { category_id: string }) => x.category_id,
    ),
    skill_ids: (skills ?? []).map((x: { skill_id: string }) => x.skill_id),
  });
});
adminResourceRoutes.get("/creator-showcase", async (req, res) => {
  const page = Number(req.query.page ?? 1),
    search = String(req.query.search ?? "");
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    search.length > 100
  )
    throw new ApiError(422, "INVALID_FILTER", "Invalid Creator filter.");
  let query = db
    .from("creator_profiles")
    .select(
      "id,slug,display_name,title,avatar_url,location,experience_level,featured,is_demo,published,updated_at",
      { count: "exact" },
    )
    .eq("admin_managed", true)
    .order("updated_at", { ascending: false })
    .range((page - 1) * 12, page * 12 - 1);
  if (search.trim())
    query = query.or(
      `display_name.ilike.%${search.replace(/[%,()]/g, " ")}%,title.ilike.%${search.replace(/[%,()]/g, " ")}%`,
    );
  const { data, error, count } = await query;
  if (error) {
    console.error("Creator showcase list query failed", {
      code: error.code,
      message: error.message,
    });
    if (["PGRST204", "42703"].includes(error.code ?? "")) {
      throw new ApiError(
        503,
        "CREATOR_SHOWCASE_SCHEMA_NOT_READY",
        "Database chưa được cập nhật cho tính năng Creator. Hãy áp dụng migration mới nhất rồi thử lại.",
      );
    }
    throw new ApiError(
      500,
      "DATABASE_ERROR",
      "Unable to load Creator showcase.",
    );
  }
  send(res, { items: data ?? [], total: count ?? 0, page, limit: 12 });
});
adminResourceRoutes.post("/creator-showcase", async (req, res) => {
  const payload = showcasePayload.parse(req.body);
  const data = await saveCreatorShowcase(req.identity.id, "create", payload);
  res.status(201);
  send(res, data);
});
adminResourceRoutes.patch("/creator-showcase/:id", async (req, res) => {
  const payload = showcasePayload.parse(req.body);
  const data = await saveCreatorShowcase(req.identity.id, "update", {
    ...payload,
    id: uuid.parse(req.params.id),
  });
  send(res, data);
});
adminResourceRoutes.delete("/creator-showcase/:id", async (req, res) => {
  const data = await result(
    db.rpc("admin_manage_creator_showcase", {
      actor_id: req.identity.id,
      operation: "delete",
      payload: { id: uuid.parse(req.params.id) },
    }),
  );
  send(res, data);
});
adminResourceRoutes.get("/employees/:id", async (req, res) => {
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
adminResourceRoutes.get("/employees", async (req, res) =>
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
adminResourceRoutes.post("/employees", async (req, res) => {
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
adminResourceRoutes.patch("/employees/:id", async (req, res) => {
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
adminResourceRoutes.delete("/employees/:id", async (req, res) => {
  await result(
    db.from("employees").delete().eq("id", uuid.parse(req.params.id)),
  );
  send(res, { deleted: true });
});
adminResourceRoutes.get("/services/:id", async (req, res) => {
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
adminResourceRoutes.get("/services", async (req, res) =>
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
adminResourceRoutes.post("/services", async (req, res) => {
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
adminResourceRoutes.patch("/services/:id", async (req, res) => {
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
adminResourceRoutes.delete("/services/:id", async (req, res) => {
  await result(
    db.from("services").delete().eq("id", uuid.parse(req.params.id)),
  );
  send(res, { deleted: true });
});
adminResourceRoutes.get("/portfolio/:id", async (req, res) => {
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
adminResourceRoutes.get("/portfolio", async (req, res) =>
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
adminResourceRoutes.post("/portfolio", async (req, res) => {
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
adminResourceRoutes.patch("/portfolio/:id", async (req, res) => {
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
adminResourceRoutes.delete("/portfolio/:id", async (req, res) => {
  await result(
    db.from("portfolio").delete().eq("id", uuid.parse(req.params.id)),
  );
  send(res, { deleted: true });
});
adminResourceRoutes.get("/testimonials/:id", async (req, res) => {
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
adminResourceRoutes.get("/testimonials", async (req, res) =>
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
adminResourceRoutes.post("/testimonials", async (req, res) => {
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
adminResourceRoutes.patch("/testimonials/:id", async (req, res) => {
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
adminResourceRoutes.delete("/testimonials/:id", async (req, res) => {
  await result(
    db.from("testimonials").delete().eq("id", uuid.parse(req.params.id)),
  );
  send(res, { deleted: true });
});
