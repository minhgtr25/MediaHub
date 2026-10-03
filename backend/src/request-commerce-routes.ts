import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { isCustomerRole, supportRoles } from "./domain.js";
import { requireRole } from "./middleware.js";
import { uuid } from "./validators.js";
import { commerceOperations, commerceSchemas, operatorOperations } from "./request-commerce-validators.js";
import { canReadRequest } from "./request-policy.js";
import { orderStatuses, type ServiceOrder } from "./models/commerce.model.js";
import { orderOperations, orderOperationSchemas, orderOperatorOperations } from "./order-validators.js";
import { orderPaymentOperations, orderPaymentSchemas } from "./order-payment-validators.js";
import { productionOperations, productionSchemas } from "./order-production-validators.js";

export const requestCommerceRoutes = Router({ mergeParams: true });
export const orderRoutes = Router();
orderRoutes.use(requireRole(supportRoles));
async function requestScope(req: import("express").Request) {
  const row = await result(db.from("requests").select("*").eq("id", uuid.parse(req.params.id)).maybeSingle());
  if (!row || !canReadRequest(req.identity, row)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy yêu cầu dịch vụ.");
  return row;
}
requestCommerceRoutes.get("/", async (req, res) => {
  const request = await requestScope(req);
  let quotesQuery = db.from("quotations").select("*").eq("request_id", request.id).order("version", { ascending: false });
  if (isCustomerRole(req.identity.role)) quotesQuery = quotesQuery.not("sent_at", "is", null);
  const [proposals, quotes, order, lockedQuotes] = await Promise.all([
    result(db.from("creator_proposals").select("*").eq("request_id", request.id).order("created_at").order("id")),
    result(quotesQuery),
    result(db.from("orders").select("id,order_number,status,total,request_id").eq("request_id", request.id).maybeSingle()),
    result(db.from("quotations").select("id").eq("request_id", request.id).neq("status", "CANCELLED").limit(1)),
  ]);
  const quoteIds = (quotes ?? []).map(q => q.id);
  const items = quoteIds.length ? await result(db.from("quotation_items").select("*").in("quotation_id", quoteIds).order("id")) : [];
  res.json({ success: true, data: { proposals: proposals ?? [], quotes: (quotes ?? []).map(q => ({ ...q, items: items?.filter(i => i.quotation_id === q.id) ?? [] })), selection_locked: !!lockedQuotes?.length, selected_proposal_id: request.selected_proposal_id, request_status: request.status, order } });
});
requestCommerceRoutes.post("/:operation", async (req, res) => {
  const operation = z.enum(commerceOperations).parse(req.params.operation), request = await requestScope(req), u = req.identity;
  if (operatorOperations.includes(operation)) {
    if (u.role !== "ADMIN" && !(u.role === "STAFF" && request.assigned_to === u.id)) throw new ApiError(403, "FORBIDDEN", "Chỉ người phụ trách hoặc admin được thực hiện.");
  } else if (!isCustomerRole(u.role)) throw new ApiError(403, "FORBIDDEN", "Chỉ khách hàng được phản hồi đề xuất/báo giá.");
  const payload = commerceSchemas[operation].parse(req.body);
  res.json({ success: true, data: await result(db.rpc("request_commerce_action", { actor_id: u.id, rid: request.id, operation, payload })) });
});
function canReadOrder(u: import("./models/identity.model.js").Identity, order: ServiceOrder) {
  return u.role === "ADMIN" || (u.role === "STAFF" && order.assigned_to === u.id) || (isCustomerRole(u.role) && !!u.customer_id && order.customer_id === u.customer_id);
}
async function orderScope(req: import("express").Request) {
  const order = await result(db.from("orders").select("*").eq("id", uuid.parse(req.params.id)).maybeSingle());
  if (!order || !canReadOrder(req.identity, order)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy đơn dịch vụ.");
  return order;
}
orderRoutes.get("/:id/contracts", async (req, res) => {
  const order = await orderScope(req);
  let contractsQuery = db.from("order_contracts").select("*").eq("order_id", order.id).order("version", { ascending: false });
  if (isCustomerRole(req.identity.role)) contractsQuery = contractsQuery.not("sent_at", "is", null);
  const [contracts, acknowledgment] = await Promise.all([
    result(contractsQuery), result(db.from("contract_acknowledgments").select("*").eq("order_id", order.id).maybeSingle()),
  ]);
  res.json({ success: true, data: { contracts: contracts ?? [], acknowledgment, payment_eligible: !!acknowledgment && order.status === "WAITING_PAYMENT" } });
});
orderRoutes.get("/:id/payments", async (req, res) => {
  const order = await orderScope(req);
  const [payments, receipts, acknowledgment, bank, funds] = await Promise.all([
    result(db.from("order_payment_requests").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).order("id", { ascending: false })),
    result(db.from("order_payment_receipts").select("id,payment_request_id,amount,received_at,verification_method").eq("order_id", order.id).order("created_at", { ascending: false })),
    result(db.from("contract_acknowledgments").select("contract_id").eq("order_id", order.id).maybeSingle()),
    result(db.from("payment_settings").select("enabled,bank_name,account_number,account_name").eq("id", "default").maybeSingle()),
    result(db.from("order_final_funds_confirmations").select("confirmed_by,amount,confirmed_at").eq("order_id", order.id).maybeSingle()),
  ]);
  const collected = (receipts ?? []).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100;
  const pending = (payments ?? []).filter(p => ["PENDING", "AWAITING_VERIFICATION"].includes(p.status)).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100;
  const remaining = Math.round((Number(order.total) - collected) * 100) / 100;
  const eligible = !!acknowledgment && ["WAITING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "WAITING_ACCEPTANCE"].includes(order.status);
  res.json({ success: true, data: {
    payments: (payments ?? []).map(({ request_input: _input, idempotency_key: _key, ...p }) => p), receipts: receipts ?? [],
    total: order.total, collected, pending, remaining, available: Math.round((remaining - pending) * 100) / 100,
    required_to_confirm: Number(order.deposit_amount) > 0 ? order.deposit_amount : order.total,
    payment_eligible: eligible, bank_configured: !!(bank?.enabled && bank.bank_name.trim() && bank.account_name.trim() && bank.account_number.trim()), bank_enabled: !!bank?.enabled,
    final_funds: funds, can_confirm_final: eligible && remaining === 0 && collected > 0 && req.identity.id === order.assigned_to && ["STAFF", "ADMIN"].includes(req.identity.role),
  } });
});
orderRoutes.post("/:id/payments/:operation", async (req, res) => {
  const order = await orderScope(req), operation = z.enum(orderPaymentOperations).parse(req.params.operation), u = req.identity;
  if (["confirm", "reject"].includes(operation)) {
    if (u.role !== "ADMIN" && !(u.role === "STAFF" && order.assigned_to === u.id)) throw new ApiError(403, "FORBIDDEN", "Chỉ người phụ trách/Admin được đối soát khoản nhận.");
  } else if (operation === "report") {
    if (!isCustomerRole(u.role)) throw new ApiError(403, "FORBIDDEN", "Chỉ chủ đơn được báo chuyển khoản.");
  } else if (u.role !== "ADMIN" && !(u.role === "STAFF" && order.assigned_to === u.id)) throw new ApiError(403, "FORBIDDEN", "Chỉ người phụ trách/admin được quản lý yêu cầu thu.");
  const payload = orderPaymentSchemas[operation].parse(req.body);
  res.json({ success: true, data: await result(db.rpc("order_payment_action", { actor_id: u.id, oid: order.id, operation, payload })) });
});
orderRoutes.post("/:id/final-funds", async (req, res) => {
  const order = await orderScope(req), u = req.identity;
  if (u.id !== order.assigned_to || !["STAFF", "ADMIN"].includes(u.role)) throw new ApiError(403, "FORBIDDEN", "Chỉ người đang phụ trách xác nhận thu đủ.");
  const payload = z.object({ verified: z.literal(true), note: z.string().trim().min(1).max(2000) }).strict().parse(req.body);
  res.json({ success: true, data: await result(db.rpc("confirm_order_final_funds", { actor_id: u.id, oid: order.id, payload })) });
});
orderRoutes.get("/:id/production", async (req, res) => {
  const order = await orderScope(req);
  const [project, acknowledgment, receipts] = await Promise.all([
    result(db.from("projects").select("id,order_id,title,description,scope,deadline,production_status,created_at").eq("order_id", order.id).maybeSingle()),
    result(db.from("contract_acknowledgments").select("contract_id").eq("order_id", order.id).maybeSingle()),
    result(db.from("order_payment_receipts").select("amount").eq("order_id", order.id)),
  ]);
  const [milestones, history] = project ? await Promise.all([
    result(db.from("project_milestones").select("*").eq("project_id", project.id).order("display_order").order("created_at").order("id")),
    result(db.from("project_status_history").select("id,status,note,created_at").eq("project_id", project.id).order("created_at", { ascending: false }).order("id", { ascending: false })),
  ]) : [[], []];
  const collected = (receipts ?? []).reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0) / 100;
  const threshold = Number(order.deposit_amount) > 0 ? Number(order.deposit_amount) : Number(order.total);
  res.json({ success: true, data: { project, milestones: milestones ?? [], history: history ?? [], creator: order.creator_snapshot, team_snapshot: order.team_snapshot ?? [], can_create: !project && order.status === "CONFIRMED" && !!acknowledgment && collected > 0 && collected >= threshold } });
});
orderRoutes.post("/:id/production/:operation", async (req, res) => {
  const order = await orderScope(req), operation = z.enum(productionOperations).parse(req.params.operation), u = req.identity;
  if (u.role !== "ADMIN" && !(u.role === "STAFF" && order.assigned_to === u.id)) throw new ApiError(403, "FORBIDDEN", "Chỉ người phụ trách/Admin quản lý sản xuất.");
  const payload = productionSchemas[operation].parse(req.body);
  res.json({ success: true, data: await result(db.rpc("order_production_action", { actor_id: u.id, oid: order.id, operation, payload })) });
});
orderRoutes.post("/:id/:operation", async (req, res) => {
  const order = await orderScope(req), operation = z.enum(orderOperations).parse(req.params.operation), u = req.identity;
  if (orderOperatorOperations.includes(operation)) {
    if (u.role !== "ADMIN" && !(u.role === "STAFF" && order.assigned_to === u.id)) throw new ApiError(403, "FORBIDDEN", "Chỉ người phụ trách hoặc admin được thực hiện.");
  } else if (!isCustomerRole(u.role)) throw new ApiError(403, "FORBIDDEN", "Chỉ chủ đơn được phản hồi điều khoản.");
  const payload = orderOperationSchemas[operation].parse(req.body);
  res.json({ success: true, data: await result(db.rpc("order_action", { actor_id: u.id, oid: order.id, operation, payload })) });
});
orderRoutes.get("/", async (req, res) => {
  const params = z.object({ page: z.coerce.number().int().min(1).default(1), status: z.enum(orderStatuses).optional(), search: z.string().trim().max(100).default("") }).parse(req.query);
  let query = db.from("orders").select("id,order_number,request_id,assigned_to,status,total,deposit_amount,remaining_amount,created_at", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (isCustomerRole(req.identity.role)) query = query.eq("customer_id", req.identity.customer_id!);
  else if (req.identity.role === "STAFF") query = query.eq("assigned_to", req.identity.id);
  if (params.status) query = query.eq("status", params.status);
  if (params.search) query = query.ilike("order_number", `%${params.search.replace(/[%_]/g, "")}%`);
  const { data, error, count } = await query.range((params.page - 1) * 20, params.page * 20 - 1);
  if (error) throw new ApiError(500, "DATABASE_ERROR", "Không thể tải đơn dịch vụ.");
  const assignees = [...new Set((data ?? []).map(o => o.assigned_to))], requestIds = (data ?? []).map(o => o.request_id);
  const [people, requests] = await Promise.all([
    assignees.length ? result(db.from("profiles").select("id,full_name").in("id", assignees)) : [],
    requestIds.length ? result(db.from("requests").select("id,title,request_number").in("id", requestIds)) : [],
  ]);
  res.json({ success: true, data: { items: (data ?? []).map(o => ({ ...o, assigned_staff: people?.find(p => p.id === o.assigned_to), request: requests?.find(r => r.id === o.request_id) })), page: params.page, total: count, limit: 20 } });
});
orderRoutes.get("/:id", async (req, res) => {
  const order = await orderScope(req);
  const [items, request, staff] = await Promise.all([
    result(db.from("order_items").select("*").eq("order_id", order.id).order("id")),
    result(db.from("requests").select("id,title,request_number,deadline").eq("id", order.request_id).single()),
    result(db.from("profiles").select("id,full_name,active").eq("id", order.assigned_to).single()),
  ]);
  res.json({ success: true, data: { order, items, request, assigned_staff: staff } });
});
