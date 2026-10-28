import { Router } from "express";
import { db, result } from "./db.js";
import { env } from "./config/database.js";
export const seoRoutes = Router();
const xml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );
seoRoutes.get("/sitemap.xml", async (_req, res) => {
  const origin = env.SITE_URL ?? env.CORS_ORIGIN[0];
  const paths = [
    "/",
    "/about",
    "/services",
    "/portfolio",
    "/process",
    "/partners",
    "/contact",
    "/request-project",
    "/privacy",
    "/terms",
  ];
  for (let offset = 0; ; offset += 1000) {
    const rows = await result(
      db
        .from("services")
        .select("slug")
        .eq("active", true)
        .order("id")
        .range(offset, offset + 999),
    );
    paths.push(
      ...(rows ?? []).map((row) => `/services/${encodeURIComponent(row.slug)}`),
    );
    if (!rows || rows.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const rows = await result(
      db
        .from("portfolio")
        .select("slug")
        .eq("published", true)
        .eq("is_demo", false)
        .order("id")
        .range(offset, offset + 999),
    );
    paths.push(
      ...(rows ?? []).map(
        (row) => `/portfolio/${encodeURIComponent(row.slug)}`,
      ),
    );
    if (!rows || rows.length < 1000) break;
  }
  res
    .type("application/xml")
    .set("Cache-Control", "public, max-age=300")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${xml(new URL(path, origin).href)}</loc></url>`).join("")}</urlset>`,
    );
});
seoRoutes.get("/robots.txt", (_req, res) =>
  res
    .type("text/plain")
    .send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /customer\nDisallow: /login\nDisallow: /register\nSitemap: ${new URL("/sitemap.xml", env.SITE_URL ?? env.CORS_ORIGIN[0]).href}\n`,
    ),
);
