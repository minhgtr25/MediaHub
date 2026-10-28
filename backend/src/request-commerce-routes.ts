import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { isCustomerRole } from "./domain.js";
import { uuid } from "./validators.js";
import {
  commerceOperations,
  commerceSchemas,
  operatorOperations,
} from "./request-commerce-validators.js";
import { canReadRequest } from "./request-policy.js";
export const requestCommerceRoutes = Router({ mergeParams: true });
async function requestScope(req: import("express").Request) {
  const row = await result(
    db
      .from("requests")
      .select("*")
      .eq("id", uuid.parse(req.params.id))
      .maybeSingle(),
  );
  if (!row || !canReadRequest(req.identity, row))
    throw new ApiError(404, "NOT_FOUND", "Không tìm thấy yêu cầu dịch vụ.");
  return row;
}
requestCommerceRoutes.get("/", async (req, res) => {
  const request = await requestScope(req);
  let quotesQuery = db
    .from("quotations")
    .select("*")
    .eq("request_id", request.id)
    .order("version", { ascending: false });
  if (isCustomerRole(req.identity.role))
    quotesQuery = quotesQuery.not("sent_at", "is", null);
  const [proposals, quotes, order, lockedQuotes] = await Promise.all([
    result(
      db
        .from("creator_proposals")
        .select("*")
        .eq("request_id", request.id)
        .order("created_at")
        .order("id"),
    ),
    result(quotesQuery),
    result(
      db
        .from("orders")
        .select("id,order_number,status,total,request_id")
        .eq("request_id", request.id)
        .maybeSingle(),
    ),
    result(
      db
        .from("quotations")
        .select("id")
        .eq("request_id", request.id)
        .neq("status", "CANCELLED")
        .limit(1),
    ),
  ]);
  const quoteIds = (quotes ?? []).map((q) => q.id);
  const items = quoteIds.length
    ? await result(
        db
          .from("quotation_items")
          .select("*")
          .in("quotation_id", quoteIds)
          .order("id"),
      )
    : [];
  res.json({
    success: true,
    data: {
      proposals: proposals ?? [],
      quotes: (quotes ?? []).map((q) => ({
        ...q,
        items: items?.filter((i) => i.quotation_id === q.id) ?? [],
      })),
      selection_locked: !!lockedQuotes?.length,
      selected_proposal_id: request.selected_proposal_id,
      request_status: request.status,
      order,
    },
  });
});
requestCommerceRoutes.post("/:operation", async (req, res) => {
  const operation = z.enum(commerceOperations).parse(req.params.operation),
    request = await requestScope(req),
    u = req.identity;
  if (operatorOperations.includes(operation)) {
    if (
      u.role !== "ADMIN" &&
      !(u.role === "STAFF" && request.assigned_to === u.id)
    )
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Chỉ người phụ trách hoặc admin được thực hiện.",
      );
  } else if (!isCustomerRole(u.role))
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Chỉ khách hàng được phản hồi đề xuất/báo giá.",
    );
  const payload = commerceSchemas[operation].parse(req.body);
  res.json({
    success: true,
    data: await result(
      db.rpc("request_commerce_action", {
        actor_id: u.id,
        rid: request.id,
        operation,
        payload,
      }),
    ),
  });
});
