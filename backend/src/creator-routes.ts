import { Router } from "express";
import { z } from "zod";
import { db, result } from "./db.js";
import { ApiError } from "./utils/api-error.js";

export const creatorRoutes = Router();
const filters = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(6),
  search: z.string().trim().max(100).default(""),
  category: z.string().trim().max(80).optional(),
  skill: z.string().trim().max(80).optional(),
  location: z.string().trim().max(80).optional(),
  experience: z.enum(["STUDENT", "JUNIOR", "MID", "SENIOR", "LEAD"]).optional(),
  availability: z.enum(["AVAILABLE", "LIMITED", "BUSY", "UNAVAILABLE"]).optional(),
  verified: z.enum(["true", "false"]).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  price_max: z.coerce.number().min(0).max(1e12).optional(),
  sort: z.enum(["recommended", "rating", "projects", "price"]).default("recommended"),
}).strict();

creatorRoutes.get("/creators/filters", async (_req, res) => {
  const client = db as any;
  const [categories, skills] = await Promise.all([
    client.from("categories").select("id,name,slug").eq("active", true).order("display_order"),
    client.from("skills").select("id,name,slug").eq("active", true).order("name"),
  ]);
  if (categories.error || skills.error) throw new ApiError(500, "DATABASE_ERROR", "Không thể tải bộ lọc Creator.");
  res.json({ success: true, data: { categories: categories.data, skills: skills.data } });
});

creatorRoutes.get("/creators", async (req, res) => {
  const f = filters.parse(req.query);
  const data=await result(db.rpc('public_creator_search',{filters:f}));
  res.json({success:true,data});
});

creatorRoutes.get("/creators/:slug", async (req, res) => {
  const slug = z.string().regex(/^[a-z0-9-]+$/).max(100).parse(req.params.slug);
  const data=await result(db.rpc('public_creator_detail',{creator_slug:slug}));
  if(!data)throw new ApiError(404,'NOT_FOUND','Không tìm thấy Creator.');
  res.json({success:true,data});
});
