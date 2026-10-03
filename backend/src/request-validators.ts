import { z } from "zod";
import { uuid } from "./validators.js";
const amount = z.number().min(0).max(1e12).nullable();
const optionalText = z.string().trim().max(5000).default("");
export const createRequestSchema = z.object({
  service_id: uuid, package_id: uuid.nullable().default(null),
  title: z.string().trim().min(1).max(200), brief: z.string().trim().min(1).max(5000),
  budget_min: amount.default(null), budget_max: amount.default(null), deadline: z.iso.date().nullable().default(null),
  reference_urls: z.array(z.url().max(2000).refine(url => new URL(url).protocol === "https:")).max(10).default([]),
  creator_preference: z.enum(["ADVICE", "PREFERRED"]).default("ADVICE"),
  preferred_creator_id: uuid.nullable().default(null), idempotency_key: uuid,
}).strict().refine(body => body.budget_min === null || body.budget_max === null || body.budget_max >= body.budget_min, "Ngân sách tối đa phải từ ngân sách tối thiểu trở lên.")
  .refine(body => body.creator_preference === "PREFERRED" ? !!body.preferred_creator_id : body.preferred_creator_id === null, "Lựa chọn creator không hợp lệ.");
export const packageSchema = z.object({
  service_id: uuid, name: z.string().trim().min(1).max(150), description: optionalText,
  starting_price: amount.default(null), estimated_days: z.number().int().min(1).max(3650).nullable().default(null),
  deliverables: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  active: z.boolean().default(false), display_order: z.number().int().min(0).default(0),
}).strict();
const reason = z.string().trim().min(1).max(2000);
export const requestOperationSchemas = {
  claim: z.object({}).strict(),
  assign: z.object({ assigned_to: uuid, reason: z.string().trim().max(2000).default("") }).strict(),
  release: z.object({ reason }).strict(), cancel: z.object({ reason }).strict(),
  status: z.object({ status: z.enum(["CONSULTING", "WAITING_CUSTOMER"]) }).strict(),
  note: z.object({ content: z.string().trim().min(1).max(5000) }).strict(),
  message: z.object({ content: z.string().trim().min(1).max(5000), audience: z.enum(["TEAM", "CUSTOMER_STAFF"]).default("TEAM") }).strict(),
  read: z.object({}).strict(),
};
