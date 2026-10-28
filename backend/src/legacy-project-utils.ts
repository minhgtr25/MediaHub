import type { Request } from "express";
import { ApiError, db, result } from "./db.js";
import { canAccess, isCustomerRole } from "./domain.js";
import type { Json } from "./models/database.types.js";
import { uuid } from "./validators.js";
import { list, paging } from "./utils/pagination.js";
export async function ownedProject(req: Request) {
  const id = uuid.parse(req.params.id);
  const p = await result(
    db.from("projects").select("*").eq("id", id).maybeSingle(),
  );
  if (
    !p ||
    p.order_id ||
    !canAccess(req.identity.role, req.identity.customer_id, p.customer_id)
  )
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Không tìm thấy dự án.");
  return p;
}
export async function projectAction(
  req: Request,
  name: string,
  payload: Json = {},
) {
  await ownedProject(req);
  return result(
    db.rpc("project_action", {
      actor_id: req.identity.id,
      pid: uuid.parse(req.params.id),
      action: name,
      payload,
    }),
  );
}
export async function projectList(req: Request) {
  const f = paging.parse(req.query);
  let q = db
    .from("projects")
    .select(
      "*,customers(company_name,profiles(full_name,email)),project_services!inner(service_id)",
      { count: "exact" },
    )
    .is("order_id", null)
    .order("created_at", { ascending: false });
  if (isCustomerRole(req.identity.role))
    q = q.eq("customer_id", req.identity.customer_id!);
  if (f.status) q = q.eq("status", f.status);
  if (f.service_id) q = q.eq("project_services.service_id", f.service_id);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to)
    q = q.lt(
      "created_at",
      new Date(new Date(f.to).getTime() + 86400000).toISOString(),
    );
  return list(req, q, "title");
}
