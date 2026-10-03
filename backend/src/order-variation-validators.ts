import { z } from "zod";
import { uuid } from "./validators.js";
const variation=z.object({variation_id:uuid}).strict();
export const variationSchemas={
 request:z.object({idempotency_key:uuid,title:z.string().trim().min(1).max(200),description:z.string().trim().min(1).max(5000)}).strict(),
 quote:variation.extend({idempotency_key:uuid,scope:z.string().trim().min(1).max(5000),revision_policy:z.string().trim().min(1).max(2000),amount:z.number().finite().min(0).max(1000000000000).multipleOf(0.01),deadline:z.iso.date(),valid_until:z.iso.date()}).strict(),
 accept:variation.extend({quote_id:uuid,content_hash:z.string().regex(/^[a-f0-9]{64}$/),acknowledge:z.literal(true)}).strict(),
 reject:variation.extend({reason:z.string().trim().min(1).max(2000)}).strict(),
 withdraw:variation.extend({reason:z.string().trim().min(1).max(2000)}).strict(),
};
export const variationOperations=Object.keys(variationSchemas) as [keyof typeof variationSchemas,...(keyof typeof variationSchemas)[]];
