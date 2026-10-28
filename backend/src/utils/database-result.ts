import { ApiError } from "./api-error.js";
type DatabaseError = { code?: string; message: string };
export async function result<T>(
  query: PromiseLike<{ data: T; error: DatabaseError | null }>,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    console.error("Database error", {
      code: error.code,
      message: error.message,
    });
    if (["PGRST202", "PGRST204", "42703"].includes(error.code ?? ""))
      throw new ApiError(
        503,
        "DATABASE_SCHEMA_NOT_READY",
        "Cơ sở dữ liệu chưa được cập nhật cho chức năng này. Hãy áp dụng migration mới nhất rồi thử lại.",
      );
    if (error.code === "23505")
      throw new ApiError(
        409,
        "DUPLICATE_RECORD",
        "Thông tin này đã tồn tại. Vui lòng kiểm tra lại.",
      );
    if (error.code === "23503")
      throw new ApiError(
        409,
        "RECORD_IN_USE",
        "Thông tin đang được sử dụng hoặc liên kết không còn tồn tại.",
      );
    if (["23514", "22003", "22P02", "23502"].includes(error.code ?? ""))
      throw new ApiError(
        422,
        "INVALID_DATA",
        "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường.",
      );
    throw new ApiError(
      error.code === "P0001" ? 409 : 500,
      error.code === "P0001" ? "INVALID_WORKFLOW" : "DATABASE_ERROR",
      error.code === "P0001"
        ? error.message
        : "Không thể xử lý dữ liệu. Vui lòng thử lại.",
    );
  }
  return data;
}
