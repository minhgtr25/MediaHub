import type { Request } from "express";
import { z } from "zod";
import { ApiError } from "./api-error.js";
import { uuid } from "../validators.js";

export const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).default(""),
  status: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "REVIEWING",
      "QUOTATION_SENT",
      "QUOTATION_ACCEPTED",
      "IN_PROGRESS",
      "WAITING_REVIEW",
      "REVISION",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  service_id: uuid.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type PaginatedQuery<T> = PromiseLike<{
  data: T[] | null;
  error: { code?: string } | null;
  count: number | null;
}> & {
  ilike(column: string, pattern: string): PaginatedQuery<T>;
  range(from: number, to: number): PaginatedQuery<T>;
};

export async function list<T>(
  req: Request,
  query: PaginatedQuery<T>,
  searchField?: string,
) {
  const filters = paging.parse(req.query);
  if (filters.search && searchField) {
    query = query.ilike(
      searchField,
      `%${filters.search.replace(/[%_]/g, "")}%`,
    );
  }

  const { data, error, count } = await query.range(
    (filters.page - 1) * filters.limit,
    filters.page * filters.limit - 1,
  );
  if (error) {
    throw new ApiError(500, "DATABASE_ERROR", "Không thể tải dữ liệu.");
  }
  return {
    items: data,
    total: count,
    page: filters.page,
    limit: filters.limit,
  };
}
