import { api, post, patch } from "./api";
import { authClient } from "../lib/supabase";
import { registrationDetails } from "../lib/auth";
import type { Profile } from "../types/auth";
export const authService = {
  me: () => api<Profile>("/auth/me"),
  login: (email: string, password: string) =>
    authClient().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    }),
  register: (
    email: string,
    password: string,
    full_name: string,
    metadata?: { audience: "client" | "creator"; organization?: string },
  ) =>
    authClient().auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          audience: "client",
          ...registrationDetails(full_name, metadata?.organization || ""),
        },
        emailRedirectTo: location.origin + "/login",
      },
    }),
  logout: () => authClient().auth.signOut({ scope: "local" }),
  forgot: (email: string) =>
    authClient().auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: location.origin + "/reset-password",
    }),
  reset: (password: string) => authClient().auth.updateUser({ password }),
};
export const projectService = {
  create: (body: unknown) => post<{ id: string }>("/projects", body),
  action: (id: string, name: string, body: unknown = {}) =>
    post(`/projects/${id}/${name}`, body),
};
export const customerService = { dashboard: () => api("/customer/dashboard") };
export const adminService = {
  status: (id: string, status: string) =>
    patch(`/admin/projects/${id}/status`, { status }),
  save: (resource: string, id: string | undefined, body: unknown) =>
    id
      ? patch(`/admin/${resource}/${id}`, body)
      : post(`/admin/${resource}`, body),
  remove: (resource: string, id: string) =>
    api(`/admin/${resource}/${id}`, { method: "DELETE" }),
};
export const quotationService = {
  send: (id: string, body: unknown) =>
    post(`/admin/projects/${id}/quotation`, body),
};
export const serviceService = { list: () => api("/public/services?limit=100") };
export const reviewService = {
  create: (id: string, body: unknown) => post(`/projects/${id}/reviews`, body),
};
export const uploadService = {
  upload: (path: string, file: File) => {
    if (
      file.size > 50 * 1024 * 1024 ||
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "video/mp4",
        "video/quicktime",
        "application/pdf",
      ].includes(file.type)
    )
      throw new Error("Chỉ hỗ trợ ảnh, MP4, MOV và PDF tối đa 50 MB.");
    const body = new FormData();
    body.append("file", file);
    return api(path, { method: "POST", body });
  },
  download: (id: string, kind: string, fileId: string) =>
    api<{ signedUrl: string }>(`/projects/${id}/download/${kind}/${fileId}`),
};
