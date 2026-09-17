import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SITE_URL: z.url().optional(),
  AUTH_REDIRECT_URL: z.url().optional(),
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
});
export type Environment = z.infer<typeof envSchema>;
export function loadEnvironment(): Environment {
  // Explicit backend overrides root; injected process variables take precedence.
  config({ path: resolve(process.cwd(), ".env"), quiet: true });
  config({ path: resolve(process.cwd(), "..", ".env"), quiet: true });
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
