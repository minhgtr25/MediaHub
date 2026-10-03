import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { db, result, ApiError } from "./db.js";
import { requireRole } from "./middleware.js";
import { isCustomerRole, supportRoles, customerRoles } from "./domain.js";
import type { Identity } from "./models/identity.model.js";
import type { ServiceRequest } from "./models/commerce.model.js";
import { requestStatuses } from "./models/commerce.model.js";
import { createRequestSchema, packageSchema, requestOperationSchemas } from "./request-validators.js";
import { uuid } from "./validators.js";
import { fileType } from "./file-validation.js";
import { creatorTeamRoutes } from "./creator-team-routes.js";
import { requestCommerceRoutes } from "./request-commerce-routes.js";
import { canReadRequest } from "./request-policy.js";

export const requestRoutes = Router();
export const publicPackageRoutes = Router();
export const adminPackageRoutes = Router();
requestRoutes.use(requireRole(supportRoles));
requestRoutes.use("/:id/commerce", requestCommerceRoutes);
requestRoutes.use("/:id/team", creatorTeamRoutes);
adminPackageRoutes.use(requireRole("ADMIN"));

async function owned(id: string, identity: Identity) {
  const row = await result(db.from("requests").select("*").eq("id", id).maybeSingle());
  if (!row || !canReadRequest(identity, row)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy yêu cầu dịch vụ.");
  return row;
}
function operator(identity: Identity, request: ServiceRequest) {
  if (identity.role !== "ADMIN" && !(identity.role === "STAFF" && request.assigned_to === identity.id)) throw new ApiError(403, "FORBIDDEN", "Chỉ nhân viên phụ trách hoặc quản trị viên được thực hiện.");
}

publicPackageRoutes.get("/services/:id/packages", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const service = await result(db.from("services").select("id").eq("id", id).eq("active", true).maybeSingle());
  if (!service) throw new ApiError(404, "NOT_FOUND", "Dịch vụ chưa được công bố.");
  const packages = await result(db.from("service_packages").select("id,service_id,name,description,starting_price,estimated_days,deliverables").eq("service_id", id).eq("active", true).order("display_order").order("id"));
  res.json({ success: true, data: packages });
});
publicPackageRoutes.get("/creators/options", async (req, res) => {
  const params = z.object({ search: z.string().trim().max(100).default(""), include_id: uuid.optional() }).parse(req.query);
  let query = db.from("creator_profiles").select("id,display_name,slug,title,availability").neq("availability", "UNAVAILABLE").order("display_name").limit(24);
  if (params.search) query = query.ilike("display_name", `%${params.search.replace(/[%_]/g, "")}%`);
  const rows = (await result(query)) ?? [];
  if (params.include_id && !rows.some(row => row.id === params.include_id)) {
    const selected = await result(db.from("creator_profiles").select("id,display_name,slug,title,availability").eq("id", params.include_id).neq("availability", "UNAVAILABLE").maybeSingle());
    if (selected) rows.unshift(selected);
  }
  res.json({ success: true, data: { items: rows } });
});
adminPackageRoutes.get("/", async (req, res) => {
  const params = z.object({ service_id: uuid.optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  let query = db.from("service_packages").select("*", { count: "exact" }).order("display_order").order("id");
  if (params.service_id) query = query.eq("service_id", params.service_id);
  const { data, error, count } = await query.range((params.page - 1) * 20, params.page * 20 - 1);
  if (error) throw new ApiError(500, "DATABASE_ERROR", "Không thể tải gói dịch vụ.");
  res.json({ success: true, data: { items: data, total: count, page: params.page, limit: 20 } });
});
adminPackageRoutes.post("/", async (req, res) => res.status(201).json({ success: true, data: await result(db.rpc("save_service_package", { actor_id: req.identity.id, package_id: null, payload: packageSchema.parse(req.body) })) }));
adminPackageRoutes.patch("/:id", async (req, res) => res.json({ success: true, data: await result(db.rpc("save_service_package", { actor_id: req.identity.id, package_id: uuid.parse(req.params.id), payload: packageSchema.parse(req.body) })) }));

const filters = z.object({
  scope: z.enum(["mine", "queue", "all"]).default("mine"), page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(150).default(""), status: z.enum(requestStatuses).optional(), service_id: uuid.optional(), sort: z.enum(["newest", "deadline"]).default("newest"),
});
requestRoutes.get("/", async (req, res) => {
  const params = filters.parse(req.query), u = req.identity;
  if (isCustomerRole(u.role) && params.scope !== "mine" || u.role === "STAFF" && params.scope === "all") throw new ApiError(403, "FORBIDDEN", "Không có quyền xem phạm vi này.");
  // Queue intentionally omits brief, links, customer/creator identifiers and private notes.
  const queue = params.scope === "queue";
  let query = db.from("requests").select("id,request_number,title,status,service_id,package_id,budget_min,budget_max,deadline,assigned_to,created_at,updated_at", { count: "exact" });
  if (params.sort === "deadline") query = query.order("deadline", { ascending: true, nullsFirst: false });
  query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  if (isCustomerRole(u.role)) query = query.eq("customer_id", u.customer_id!);
  else if (queue) query = query.is("assigned_to", null).eq("status", "UNASSIGNED");
  else if (params.scope === "mine") query = query.eq("assigned_to", u.id);
  if (params.status) query = query.eq("status", params.status);
  if (params.service_id) query = query.eq("service_id", params.service_id);
  if (params.search) query = query.ilike("title", `%${params.search.replace(/[%_]/g, "")}%`);
  const { data, error, count } = await query.range((params.page - 1) * 20, params.page * 20 - 1);
  if (error) throw new ApiError(500, "DATABASE_ERROR", "Không thể tải yêu cầu dịch vụ.");
  const serviceIds = [...new Set((data ?? []).map(r => r.service_id))];
  const assigneeIds = [...new Set((data ?? []).map(r => r.assigned_to).filter((id): id is string => !!id))];
  const [services, assignees] = await Promise.all([
    serviceIds.length ? result(db.from("services").select("id,name").in("id", serviceIds)) : [],
    assigneeIds.length ? result(db.from("profiles").select("id,full_name").in("id", assigneeIds)) : [],
  ]);
  res.json({ success: true, data: { items: (data ?? []).map(r => ({ ...r, service_name: services?.find(s => s.id === r.service_id)?.name, assigned_staff: assignees?.find(p => p.id === r.assigned_to) ?? null })), total: count, page: params.page, limit: 20, scope: params.scope } });
});
requestRoutes.get("/summary", async (req, res) => {
  const u = req.identity;
  let query = db.from("requests").select("status,deadline");
  if (isCustomerRole(u.role)) query = query.eq("customer_id", u.customer_id!);
  else if (u.role === "STAFF") query = query.eq("assigned_to", u.id);
  const rows = await result(query), active = (rows ?? []).filter(r => !["CANCELLED", "CONVERTED"].includes(r.status));
  const businessDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const now = businessDate(new Date()), due = businessDate(new Date(Date.now() + 7 * 86400000));
  let queued = 0;
  if (!isCustomerRole(u.role)) {
    const { count, error } = await db.from("requests").select("id", { count: "exact", head: true }).is("assigned_to", null).eq("status", "UNASSIGNED");
    if (error) throw new ApiError(500, "DATABASE_ERROR", "Không thể tải hàng đợi.");
    queued = count ?? 0;
  }
  res.json({ success: true, data: { total: rows?.length ?? 0, active: active.length, waiting_customer: active.filter(r => r.status === "WAITING_CUSTOMER").length, due_soon: active.filter(r => r.deadline && r.deadline >= now && r.deadline <= due).length, overdue: active.filter(r => r.deadline && r.deadline < now).length, queued } });
});
requestRoutes.get("/agents", requireRole(["STAFF", "ADMIN"]), async (_req, res) => res.json({ success: true, data: await result(db.from("profiles").select("id,full_name,role").in("role", ["STAFF", "ADMIN"]).eq("active", true).order("full_name")) }));
requestRoutes.get("/availability", requireRole(["STAFF", "ADMIN"]), async (req, res) => {
  let query = db.from("requests").select("assigned_to,status").not("assigned_to", "is", null).not("status", "in", "(CONVERTED,CANCELLED)");
  if (req.identity.role === "STAFF") query = query.eq("assigned_to", req.identity.id);
  const rows = (await result(query)) ?? [];
  res.json({ success: true, data: { busy: rows.length > 0, consultations: rows.length, policy: "LONGEST_IDLE", released_on: "QUOTE_ACCEPTED" } });
});
requestRoutes.post("/", requireRole(customerRoles), async (req, res) => res.status(201).json({ success: true, data: await result(db.rpc("request_action", { actor_id: req.identity.id, rid: null, operation: "create", payload: createRequestSchema.parse(req.body) })) }));

requestRoutes.get("/:id", async (req, res) => {
  const request = await owned(uuid.parse(req.params.id), req.identity);
  const customer = await result(db.from("customers").select("profile_id,company_name").eq("id", request.customer_id).single());
  if (!customer) throw new ApiError(409, "ACCOUNT_INCOMPLETE", "Hồ sơ khách hàng chưa đầy đủ.");
  const [service, assignee, customerProfile, preferredCreator, conversation, attachments] = await Promise.all([
    result(db.from("services").select("id,name,slug").eq("id", request.service_id).single()),
    request.assigned_to ? result(db.from("profiles").select("id,full_name,role,active,avatar_url").eq("id", request.assigned_to).maybeSingle()) : null,
    result(db.from("profiles").select("id,full_name,email,phone").eq("id", customer.profile_id).single()),
    request.preferred_creator_id ? result(db.from("creator_profiles").select("id,display_name,slug,title,availability").eq("id", request.preferred_creator_id).maybeSingle()) : null,
    result(db.from("conversations").select("id").eq("request_id", request.id).single()),
    result(db.from("request_attachments").select("id,file_name,file_type,file_size,created_at,uploaded_by").eq("request_id", request.id).order("created_at")),
  ]);
  if (!conversation) throw new ApiError(409, "WORKSPACE_INCOMPLETE", "Hội thoại yêu cầu chưa được thiết lập.");
  const order = request.status === "CONVERTED" ? await result(db.from("orders").select("id,status,order_number").eq("request_id", request.id).maybeSingle()) : null;
  res.json({ success: true, data: { request, service, order, assigned_staff: assignee, customer: { ...customerProfile, company_name: customer.company_name }, preferred_creator: preferredCreator, conversation_id: conversation.id, attachments: attachments ?? [] } });
});
requestRoutes.get("/:id/messages", async (req, res) => {
  const request = await owned(uuid.parse(req.params.id), req.identity);
  const params = z.object({ before: z.iso.datetime({ offset: true }).optional(), before_id: uuid.optional() }).refine(p => !!p.before === !!p.before_id).parse(req.query);
  const conversation = await result(db.from("conversations").select("id").eq("request_id", request.id).single());
  if (!conversation) throw new ApiError(409, "WORKSPACE_INCOMPLETE", "Hội thoại yêu cầu chưa được thiết lập.");
  let query = db.from("conversation_messages").select("id,sender_id,content,kind,event_data,audience,created_at").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(51);
  if (params.before) query = query.or(`created_at.lt.${params.before},and(created_at.eq.${params.before},id.lt.${params.before_id})`);
  const rows = (await result(query)) ?? [], page = rows.slice(0, 50), oldest = page.at(-1);
  const memberRows = (await result(db.from("conversation_members").select("profile_id,last_read_at").eq("conversation_id", conversation.id))) ?? [];
  const ids = [...new Set([...page.map(m => m.sender_id), ...memberRows.map(m => m.profile_id)])];
  const senders = ids.length ? await result(db.from("profiles").select("id,full_name,role").in("id", ids)) : [];
  res.json({ success: true, data: { messages: page.reverse(), members: memberRows.map(m => ({ id: m.profile_id, last_read_at: m.last_read_at })), senders, next_cursor: rows.length > 50 && oldest ? { before: oldest.created_at, before_id: oldest.id } : null } });
});
requestRoutes.get("/:id/notes", async (req, res) => {
  const request = await owned(uuid.parse(req.params.id), req.identity); operator(req.identity, request);
  const [notes, assignments] = await Promise.all([
    result(db.from("request_notes").select("*").eq("request_id", request.id).order("created_at", { ascending: false })),
    result(db.from("request_assignments").select("*").eq("request_id", request.id).order("assigned_at", { ascending: false })),
  ]);
  const ids = [...new Set([...(notes ?? []).map(n => n.author_id), ...(assignments ?? []).flatMap(a => [a.staff_id, a.assigned_by, ...(a.ended_by ? [a.ended_by] : [])])])];
  res.json({ success: true, data: { notes, assignments, people: ids.length ? await result(db.from("profiles").select("id,full_name").in("id", ids)) : [] } });
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 0 } });
requestRoutes.post("/:id/attachments", async (req, _res, next) => {
  try { await owned(uuid.parse(req.params.id), req.identity); next(); } catch (e) { next(e); }
}, upload.single("file"), async (req, res) => {
  if (!req.file) throw new ApiError(422, "FILE_REQUIRED", "Vui lòng chọn tệp.");
  const extension = fileType(req.file), id = uuid.parse(req.params.id);
  const path = `requests/${id}/${randomUUID()}.${extension}`;
  await result(db.storage.from("project-files").upload(path, req.file.buffer, { contentType: req.file.mimetype }));
  try {
    const data = await result(db.rpc("request_action", { actor_id: req.identity.id, rid: id, operation: "attachment", payload: { name: req.file.originalname, path, type: req.file.mimetype, size: req.file.size } }));
    res.status(201).json({ success: true, data });
  } catch (error) { await db.storage.from("project-files").remove([path]); throw error; }
});
requestRoutes.get("/:id/attachments/:fileId/download", async (req, res) => {
  const request = await owned(uuid.parse(req.params.id), req.identity);
  const file = await result(db.from("request_attachments").select("storage_path").eq("id", uuid.parse(req.params.fileId)).eq("request_id", request.id).maybeSingle());
  if (!file) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy tệp tham khảo.");
  res.json({ success: true, data: await result(db.storage.from("project-files").createSignedUrl(file.storage_path, 180, { download: true })) });
});
requestRoutes.post("/:id/:operation", async (req, res) => {
  const id = uuid.parse(req.params.id), operation = z.enum(["claim", "assign", "release", "cancel", "status", "note", "message", "read"]).parse(req.params.operation);
  const payload = requestOperationSchemas[operation].parse(req.body);
  if (operation === "claim") {
    if (!["STAFF", "ADMIN"].includes(req.identity.role)) throw new ApiError(403, "FORBIDDEN", "Không có quyền nhận yêu cầu.");
  } else {
    const request = await owned(id, req.identity);
    if (["assign", "release", "status", "note"].includes(operation)) operator(req.identity, request);
    if (operation === "cancel" && req.identity.role === "STAFF") throw new ApiError(403, "FORBIDDEN", "Nhân viên có thể trả về hàng đợi; khách hàng hoặc admin mới được hủy.");
  }
  res.json({ success: true, data: await result(db.rpc("request_action", { actor_id: req.identity.id, rid: id, operation, payload })) });
});
