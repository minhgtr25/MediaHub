import { Router } from "express";
import { z } from "zod";
import { ApiError, db, result } from "./db.js";
import { uuid } from "./validators.js";
import { list } from "./utils/pagination.js";
import { send } from "./utils/response.js";

export const publicCatalogRoutes = Router();
const catalogFilters = z.object({
  category: z.string().trim().max(100).optional(),
  featured: z.enum(["true", "false"]).optional(),
});
publicCatalogRoutes.get("/services", async (req, res) => {
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
publicCatalogRoutes.get("/portfolio", async (req, res) => {
  const f = catalogFilters.parse(req.query);
  let query = db
    .from("portfolio")
    .select(
      "id,slug,title,client,description,category,image_url,featured,created_at,year",
      { count: "exact" },
    )
    .eq("published", true)
    .eq("is_demo", false)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  if (f.category) query = query.eq("category", f.category);
  if (f.featured) query = query.eq("featured", f.featured === "true");
  send(res, await list(req, query, "title"));
});
publicCatalogRoutes.get("/testimonials", async (req, res) =>
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
publicCatalogRoutes.get("/home", async (_req, res) => {
  const [
    hero,
    services,
    projects,
    creators,
    testimonials,
    partners,
    projectCount,
  ] = await Promise.all([
    db
      .from("website_settings")
      .select("title,content,image")
      .eq("key", "hero")
      .eq("published", true)
      .maybeSingle(),
    db
      .from("services")
      .select(
        "id,name,slug,description,category,thumbnail_url,starting_price,features",
      )
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("display_order")
      .limit(6),
    db
      .from("portfolio")
      .select("id,slug,title,client,description,category,image_url,year")
      .eq("published", true)
      .eq("is_demo", false)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4),
    db.rpc("public_creator_search", {
      filters: { page: 1, limit: 4, sort: "recommended" },
    }),
    db
      .from("testimonials")
      .select("id,content,published_at")
      .eq("status", "APPROVED")
      .order("published_at", { ascending: false })
      .limit(1),
    db
      .from("partners")
      .select("id,name,logo,website,description,industry")
      .eq("active", true)
      .order("display_order")
      .limit(8),
    db.rpc("public_company_portfolio", {
      portfolio_page: 1,
      portfolio_limit: 1,
      portfolio_search: "",
      portfolio_category: "",
      portfolio_kind: "ALL",
    }),
  ]);
  const sources = {
    hero,
    services,
    projects,
    creators,
    testimonials,
    partners,
    projectCount,
  };
  for (const [name, response] of Object.entries(sources)) {
    if (response.error)
      console.error(
        "Homepage data source failed",
        name,
        response.error.code ?? "UNKNOWN",
      );
  }
  send(res, {
    hero: hero.data ?? null,
    services: services.data ?? [],
    projects: projects.data ?? [],
    creators: creators.data?.items ?? [],
    testimonials: testimonials.data ?? [],
    partners: partners.data ?? [],
    stats: {
      creators: creators.data?.total ?? 0,
      projects: projectCount.data?.total ?? 0,
    },
  });
});
publicCatalogRoutes.get("/portfolio/:id", async (req, res) => {
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
      .eq("is_demo", false)
      .maybeSingle(),
  );
  if (!p) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy dự án.");
  send(res, p);
});
publicCatalogRoutes.get("/services/:slug", async (req, res) => {
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
publicCatalogRoutes.get("/partners/:id", async (req, res) => {
  const partner = await result(
    db
      .from("partners")
      .select("id,name,logo,website,description,industry")
      .eq("id", uuid.parse(req.params.id))
      .eq("active", true)
      .maybeSingle(),
  );
  if (!partner)
    throw new ApiError(404, "NOT_FOUND", "Đối tác chưa được công bố.");
  send(res, partner);
});
