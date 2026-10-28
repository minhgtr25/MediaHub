import { money } from "../../components/ui";
import type { RequestSummary } from "../../types/requests";

export const formatRequestDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "Chưa xác định";

export const formatRequestBudget = (
  request: Pick<RequestSummary, "budget_min" | "budget_max">,
) =>
  request.budget_min === null && request.budget_max === null
    ? "Cần tư vấn ngân sách"
    : `${request.budget_min === null ? "" : `Từ ${money(request.budget_min)}`}${request.budget_max === null ? "" : ` · Tối đa ${money(request.budget_max)}`}`;
