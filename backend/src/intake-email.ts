import nodemailer from "nodemailer";
import { env } from "./config/database.js";
import type { Environment } from "./config/env.js";

export type Intake = {
  id: string;
  source: string;
  full_name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  specialty?: string | null;
  applicant_type?: string | null;
  portfolio_urls?: string[] | null;
  message?: string | null;
};
type MailSettings = Pick<Environment, "SMTP_HOST" | "SMTP_PORT" | "SMTP_SECURE" | "SMTP_USER" | "SMTP_PASS" | "SMTP_FROM" | "INTAKE_NOTIFICATION_EMAIL" | "SITE_URL">;

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]!));

export async function notifyIntake(input: Intake, createTransport = nodemailer.createTransport, settings: MailSettings = env): Promise<boolean> {
  if (input.source !== "BUSINESS_CONTACT" && input.source !== "CREATOR_APPLICATION") return false;
  const { SMTP_HOST: host, SMTP_PORT: configuredPort, SMTP_SECURE: configuredSecure, SMTP_USER: user, SMTP_PASS: pass, SMTP_FROM: from, INTAKE_NOTIFICATION_EMAIL: to } = settings;
  if (!host || !user || !pass || !from || !to) return false;

  const isCreator = input.source === "CREATOR_APPLICATION";
  const fields: [string, unknown][] = [
    ["Họ tên", input.full_name], ["Email", input.email], ["Điện thoại", input.phone],
    ...(!isCreator ? [["Doanh nghiệp", input.company] as [string, unknown]] : [["Phân loại hồ sơ", input.applicant_type], ["Chuyên môn", input.specialty]] as [string, unknown][]),
    ["Nội dung", input.message],
  ];
  const portfolios = (input.portfolio_urls ?? []).filter(url => /^https:\/\//i.test(url));
  const adminUrl = settings.SITE_URL ? `${settings.SITE_URL.replace(/\/$/, "")}/admin/leads/${encodeURIComponent(input.id)}` : "";
  const text = [
    `${isCreator ? "Hồ sơ ứng tuyển Creator" : "Liên hệ doanh nghiệp mới"} trên MediaHub`,
    ...fields.map(([label, value]) => `${label}: ${value || "—"}`),
    ...(portfolios.length ? ["Portfolio:", ...portfolios] : []),
    ...(adminUrl ? [isCreator ? `CV được lưu riêng tư; mở hồ sơ trong trang Admin: ${adminUrl}` : `Mở hồ sơ trong trang Admin: ${adminUrl}`] : [`Mã hồ sơ Admin: ${input.id}`]),
  ].join("\n");
  const html = `<h2>${isCreator ? "Hồ sơ ứng tuyển Creator mới" : "Liên hệ doanh nghiệp mới"}</h2><dl>${fields.map(([label, value]) => `<dt><strong>${escapeHtml(label)}</strong></dt><dd>${escapeHtml(value || "—").replace(/\n/g, "<br>")}</dd>`).join("")}</dl>${portfolios.length ? `<h3>Portfolio</h3><ul>${portfolios.map(url => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`).join("")}</ul>` : ""}<p>${isCreator ? "CV được lưu riêng tư; tải xuống sau khi đăng nhập trang Admin." : ""}${adminUrl ? ` <a href="${escapeHtml(adminUrl)}">Mở hồ sơ trong trang Admin</a>` : ` Mã hồ sơ Admin: ${escapeHtml(input.id)}`}</p>`;
  const transporter = createTransport({
    host,
    port: configuredPort ?? 587,
    secure: configuredSecure === "true" || (configuredSecure === undefined && configuredPort === 465),
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  await transporter.sendMail({
    from: { name: "MediaHub · Thông báo biểu mẫu", address: from },
    to,
    replyTo: { name: input.full_name, address: input.email },
    subject: `[MediaHub] ${isCreator ? "Hồ sơ ứng tuyển Creator" : "Liên hệ doanh nghiệp"} — ${input.full_name}`,
    text,
    html,
  });
  return true;
}
