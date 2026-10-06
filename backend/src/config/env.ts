import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const optionalSetting = z.string().optional().transform(value => value?.trim() || undefined);

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SITE_URL: z.url().optional(),
  AUTH_REDIRECT_URL: z.url().optional(),
  SMTP_HOST: optionalSetting,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: optionalSetting,
  SMTP_PASS: z.string().optional().transform(value => value || undefined),
  SMTP_FROM: z.preprocess(value => value === "" ? undefined : value, z.email().optional()),
  INTAKE_NOTIFICATION_EMAIL: z.preprocess(value => value === "" ? undefined : value, z.email().optional()),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1)),
}).superRefine((value, context) => {
  const smtpFields = [value.SMTP_HOST, value.SMTP_USER, value.SMTP_PASS, value.SMTP_FROM, value.INTAKE_NOTIFICATION_EMAIL];
  if (smtpFields.some(Boolean) && !smtpFields.every(Boolean)) {
    context.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM and INTAKE_NOTIFICATION_EMAIL must be configured together." });
  }
});
export type Environment = z.infer<typeof envSchema>;
export function loadEnvironment(): Environment {
  // Explicit backend overrides root; injected process variables take precedence.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_SECRET_KEY
  ) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      `Invalid backend configuration: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ")}. See backend/.env.example.`,
    );
  return parsed.data;
}
