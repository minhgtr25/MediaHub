import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import type { CompanyPortfolioItem } from "./models/commerce.model.js";
import { uuid } from "./validators.js";
import { youtubeEmbedUrl } from "./utils/youtube.js";

export const companyPortfolioRoutes = Router();
const filters = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(12).default(6),
    search: z.string().trim().max(100).default(""),
    category: z.string().trim().max(100).default(""),
    kind: z.enum(["ALL", "PORTFOLIO", "EXCERPT"]).default("ALL"),
  })
  .strict();
// Explicit allowlist also protects responses if the database projection expands later.
async function project(item: CompanyPortfolioItem) {
  const image =
    item.kind === "EXCERPT"
      ? (await result(
          db.storage
            .from("case-study-excerpts")
            .createSignedUrl(item.image_path, 180),
        ))!.signedUrl
      : item.image_url;
  return {
    public_id: item.public_id,
    kind: item.kind,
    title: item.title,
    description: item.description,
    customer_name: item.customer_name,
    category: item.category,
    year: item.year,
    updated_at: item.updated_at,
    image_url: image,
    video_embed_url: youtubeEmbedUrl(item.video_url),
    href:
      item.kind === "EXCERPT"
        ? `/projects/case/${item.public_id}`
        : `/projects/${item.slug}`,
  };
}
companyPortfolioRoutes.get("/company-portfolio", async (req, res) => {
  const f = filters.parse(req.query);
  const data = await result(
    db.rpc("public_company_portfolio", {
      portfolio_page: f.page,
      portfolio_limit: f.limit,
      portfolio_search: f.search,
      portfolio_category: f.category,
      portfolio_kind: f.kind,
    }),
  );
  if (!data)
    throw new ApiError(
      500,
      "INVALID_DATABASE_RESPONSE",
      "Không thể tải danh mục hồ sơ.",
    );
  const items = await Promise.all(data.items.map(project));
  res.json({
    success: true,
    data: { items, total: data.total, page: f.page, limit: f.limit },
  });
});
companyPortfolioRoutes.get("/company-portfolio/case/:id", async (req, res) => {
  // Revocation/name changes are checked for every detail request; previously issued image links expire in 180s.
  res.set("Cache-Control", "no-store");
  const id = uuid.parse(req.params.id),
    data = await result(
      db.rpc("public_company_excerpt", { excerpt_public_id: id }),
    );
  if (!data)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "Hồ sơ này chưa được công khai hoặc đã được gỡ.",
    );
  res.json({ success: true, data: await project(data) });
});
