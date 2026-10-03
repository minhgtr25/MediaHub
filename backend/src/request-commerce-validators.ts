import { z } from "zod";
import { uuid, quoteSchema } from "./validators.js";
const money = z.number().min(0).max(1e12).multipleOf(0.01);
const reason = z.string().trim().min(1).max(2000);
const proposalId = z.object({ proposal_id: uuid }).strict();
const quoteId = z.object({ quote_id: uuid }).strict();
export const commerceSchemas = {
  propose: z.object({ creator_id: uuid, reason: z.string().trim().min(1).max(3000), estimated_price: money.nullable().default(null), estimated_days: z.number().int().min(1).max(3650).nullable().default(null) }).strict(),
  proposal_shortlist: proposalId, proposal_select: proposalId,
  proposal_reject: proposalId.extend({ reason }).strict(),
  proposal_withdraw: proposalId.extend({ reason: z.string().trim().max(2000).default("") }).strict(),
  quote_save: quoteSchema.extend({
    items: z.array(z.object({ service_id: uuid, description: z.string().trim().min(1).max(5000), quantity: z.number().int().min(1).max(10000), unit_price: money }).strict()).min(1).max(50),
    discount: money.default(0), tax_rate: z.number().min(0).max(100).multipleOf(0.01).default(0),
    deposit_percent: z.number().min(30).max(100).multipleOf(0.01), revision_policy: z.string().trim().min(1).max(3000),
  }).strict(),
  quote_send: quoteId, quote_cancel: quoteId, quote_expire: quoteId, quote_view: quoteId, quote_accept: quoteId,
  quote_revise: quoteId.extend({ reason }).strict(), quote_reject: quoteId.extend({ reason }).strict(),
};
export const commerceOperations = Object.keys(commerceSchemas) as [keyof typeof commerceSchemas, ...Array<keyof typeof commerceSchemas>];
export const operatorOperations: Array<keyof typeof commerceSchemas> = ["propose", "proposal_withdraw", "quote_save", "quote_send", "quote_cancel", "quote_expire"];
