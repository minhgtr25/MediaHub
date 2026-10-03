import { z } from "zod";

const person = {
  full_name: z.string().trim().min(1).max(150),
  email: z.email().max(254).transform(value => value.toLowerCase()),
  phone: z.string().trim().max(30).default(""),
};
export const businessContactSchema = z.object({
  ...person,
  company: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
}).strict();

const portfolioUrl = z.url().max(2000).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !/[\r\n\u0000]/.test(value);
  } catch { return false; }
}, "Dùng đường dẫn HTTPS không chứa thông tin đăng nhập.")
  .transform(value => new URL(value).href).pipe(z.string().max(2000));
export const creatorApplicationSchema = z.object({
  ...person,
  applicant_type: z.enum(["CREATOR", "STUDENT"]).default("CREATOR"),
  specialty: z.string().trim().min(2).max(200),
  portfolio_urls: z.array(portfolioUrl).min(1).max(5),
  message: z.string().trim().max(5000).default(""),
}).strict();
export const intakeSources = ["CONTACT", "PROJECT_REQUEST", "BUSINESS_CONTACT", "CREATOR_APPLICATION"] as const;
