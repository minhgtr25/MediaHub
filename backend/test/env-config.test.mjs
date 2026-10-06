import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const { envSchema } = await import("../dist/config/env.js");

const base = {
  NODE_ENV: "production",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-not-a-real-key",
  CORS_ORIGIN: "https://mediahub.example.invalid",
};

test("SMTP remains optional and blank example values are accepted", () => {
  const result = envSchema.safeParse({ ...base, SMTP_HOST: "", SMTP_PORT: "587", SMTP_SECURE: "false", SMTP_USER: "", SMTP_PASS: "", SMTP_FROM: "", INTAKE_NOTIFICATION_EMAIL: "" });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.SMTP_HOST, undefined);
});

test("SMTP configuration requires every credential and both email addresses", () => {
  const partial = envSchema.safeParse({ ...base, SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_SECURE: "false" });
  assert.equal(partial.success, false);
  const configured = envSchema.safeParse({
    ...base, SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_SECURE: "false",
    SMTP_USER: "mailer@example.invalid", SMTP_PASS: "test-only-password",
    SMTP_FROM: "mailer@example.invalid", INTAKE_NOTIFICATION_EMAIL: "team@example.invalid",
  });
  assert.equal(configured.success, true);
});
