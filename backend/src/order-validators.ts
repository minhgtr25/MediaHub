import { z } from "zod";
import { uuid } from "./validators.js";
const contractId = z.object({ contract_id: uuid }).strict();
const reason = z.string().trim().min(1).max(2000);
export const orderOperationSchemas = {
  assign: z.object({ assigned_to: uuid, reason }).strict(),
  contract_save: z.object({ title: z.string().trim().min(1).max(200), content: z.string().min(1).max(100000).refine(value => !!value.trim()), valid_until: z.iso.date() }).strict(),
  contract_send: contractId, contract_view: contractId, contract_expire: contractId,
  contract_cancel: contractId.extend({ reason }).strict(),
  contract_reject: contractId.extend({ reason }).strict(),
  contract_acknowledge: contractId.extend({ acknowledge: z.literal(true), content_hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
};
export const orderOperations = Object.keys(orderOperationSchemas) as [keyof typeof orderOperationSchemas, ...(keyof typeof orderOperationSchemas)[]];
export const orderOperatorOperations: string[] = ["assign", "contract_save", "contract_send", "contract_cancel", "contract_expire"];
