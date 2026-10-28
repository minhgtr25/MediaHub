import { Router } from "express";
import { ApiError, db, result } from "./db.js";
import { resources, uuid } from "./validators.js";
import { list } from "./utils/pagination.js";
import { send } from "./utils/response.js";

export const adminResourceRoutes = Router();
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
