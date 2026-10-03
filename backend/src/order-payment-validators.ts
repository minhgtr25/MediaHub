import { z } from "zod";
import { uuid } from "./validators.js";
const money = z.number().positive().max(1e12).multipleOf(0.01);
const reason = z.string().trim().min(1).max(2000);
const paymentId = z.object({ payment_id: uuid }).strict();
export const orderPaymentSchemas = {
  create: z.object({
    kind: z.enum(["DEPOSIT", "FULL", "MILESTONE", "REMAINING"]),
    amount: money.nullable().default(null), percentage: z.number().positive().max(100).multipleOf(0.01).nullable().default(null),
    due_date: z.iso.date(), note: z.string().trim().max(2000).default(""), idempotency_key: uuid,
  }).strict().superRefine((input, context) => {
    const count = Number(input.amount !== null) + Number(input.percentage !== null);
    if ((input.kind === "MILESTONE" && count !== 1) || (input.kind !== "MILESTONE" && count !== 0))
      context.addIssue({ code: "custom", message: "Theo mốc cần đúng số tiền hoặc phần trăm; các loại khác được tính từ đơn.", path: ["amount"] });
  }),
  report: paymentId.extend({ transfer_note: reason }).strict(),
  confirm: paymentId.extend({ verified: z.literal(true), received_amount: money, bank_transaction_reference: z.string().trim().min(1).max(120), received_at: z.iso.datetime({ offset: true }), reason }).strict(),
  reject: paymentId.extend({ reason }).strict(), cancel: paymentId.extend({ reason }).strict(), expire: paymentId,
};
export const orderPaymentOperations = Object.keys(orderPaymentSchemas) as [keyof typeof orderPaymentSchemas, ...(keyof typeof orderPaymentSchemas)[]];
