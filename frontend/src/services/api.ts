import { supabase } from "../lib/supabase";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = supabase
    ? (await supabase.auth.getSession()).data.session
    : null;
  let response: Response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || "/api"}${path}`,
      {
        ...options,
        headers: {
          ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
          ...options.headers,
        },
      },
    );
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Không thể kết nối máy chủ. Vui lòng thử lại.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success)
    throw new ApiError(
      response.status,
      body?.error?.code ?? "API_ERROR",
      body?.error?.message ?? "Không thể tải dữ liệu. Vui lòng thử lại.",
    );
  return body.data;
}
export const post = <T = unknown>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
