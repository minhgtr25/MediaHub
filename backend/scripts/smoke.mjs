import { once } from "node:events";
import { app } from "../dist/app.mjs";
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
try {
  for (const path of [
    "/api/health",
    "/api/ready",
    "/api/public/services",
    "/api/public/home",
    "/api/public/creators",
    "/api/public/creators/filters",
    "/api/public/portfolio",
    "/api/public/testimonials",
    "/api/public/partners",
    "/api/public/process",
    "/api/public/settings",
    "/api/public/pages/about",
    "/api/public/sitemap.xml",
    "/api/public/robots.txt",
  ]) {
    const response = await fetch(base + path);
    if (response.status !== 200)
      throw new Error(`${path} returned ${response.status}`);
    if (!path.endsWith(".xml") && !path.endsWith(".txt")) {
      const body = await response.json();
      if (body.success !== true)
        throw new Error(`${path} has invalid API response`);
    }
    console.log(`PASS ${path}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
}
