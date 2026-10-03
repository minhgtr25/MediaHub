import type { RequestHandler } from "express";
import { db, result, ApiError } from "./db.js";
import type { Identity } from "./models/identity.model.js";
import { isCustomerRole, persistedRoles } from "./domain.js";
export type { Identity } from "./models/identity.model.js";
declare global {
  namespace Express {
    interface Request {
      identity: Identity;
    }
  }
}
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token)
      throw new ApiError(401, "UNAUTHENTICATED", "Vui lòng đăng nhập.");
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user)
      throw new ApiError(401, "UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn.");
    const p = await result(
      db
        .from("profiles")
        .select("*")
        .eq("auth_user_id", data.user.id)
        .maybeSingle(),
    );
    if (!p || !p.active || !persistedRoles.includes(p.role))
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Tài khoản không có quyền truy cập.",
      );
    const c = await result(
      db
        .from("customers")
        .select("id,company_name")
        .eq("profile_id", p.id)
        .maybeSingle(),
    );
    if (isCustomerRole(p.role) && !c)
      throw new ApiError(
        403,
        "ACCOUNT_INCOMPLETE",
        "Tài khoản chưa được thiết lập đầy đủ. Vui lòng liên hệ MediaHub.",
      );
    req.identity = {
      id: p.id,
      auth_user_id: p.auth_user_id,
      role: p.role,
      full_name: p.full_name,
      email: p.email,
      customer_id: c?.id ?? null,
      phone: p.phone,
      avatar_url: p.avatar_url,
      company_name: c?.company_name ?? null,
      notification_preferences: p.notification_preferences,
    };
    next();
  } catch (e) {
    next(e);
  }
};
export const requireRole =
  (role: string | string[]): RequestHandler =>
  (req, _res, next) =>
    (Array.isArray(role) ? role.includes(req.identity.role) : req.identity.role === role)
      ? next()
      : next(
          new ApiError(
            403,
            "FORBIDDEN",
            "Bạn không có quyền thực hiện thao tác này.",
          ),
        );
