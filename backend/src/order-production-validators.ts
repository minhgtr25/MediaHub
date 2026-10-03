import { z } from "zod";
import { uuid } from "./validators.js";
const reason = z.string().trim().min(1).max(2000);
export const productionSchemas = {
  create: z.object({}).strict(),
  status: z.object({ status: z.enum(["READY", "IN_PROGRESS", "ON_HOLD"]), reason }).strict(),
  milestone_save: z.object({ milestone_id: uuid.nullable().default(null), idempotency_key: uuid, title: z.string().trim().min(1).max(200), description: z.string().trim().max(5000).default(""), due_date: z.iso.date(), display_order: z.number().int().min(0).max(10000).default(0) }).strict(),
  milestone_status: z.object({ milestone_id: uuid, status: z.enum(["IN_PROGRESS", "COMPLETED"]), reason }).strict(),
};
export const productionOperations = Object.keys(productionSchemas) as [keyof typeof productionSchemas, ...(keyof typeof productionSchemas)[]];
