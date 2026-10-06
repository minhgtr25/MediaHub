import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "http://127.0.0.1:59999";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-real-key";
const { notifyIntake } = await import("../dist/intake-email.js");

const settings = {
  SMTP_HOST: "smtp.example.invalid", SMTP_PORT: 587, SMTP_SECURE: "false",
  SMTP_USER: "mailer@example.invalid", SMTP_PASS: "test-only-password",
  SMTP_FROM: "mailer@example.invalid", INTAKE_NOTIFICATION_EMAIL: "team@example.invalid",
  SITE_URL: "https://mediahub.example.invalid/",
};

test("business intake notification uses configured SMTP and replies to the lead", async () => {
  let transportOptions, message;
  const sent = await notifyIntake({
    id: "lead-123", source: "BUSINESS_CONTACT", full_name: "A <script>alert(1)</script>",
    email: "lead@example.invalid", company: "Example Co", message: "Need a campaign",
  }, options => {
    transportOptions = options;
    return { sendMail: async value => { message = value; return { messageId: "fake-message" }; } };
  }, settings);

  assert.equal(sent, true);
  assert.deepEqual(transportOptions.auth, { user: settings.SMTP_USER, pass: settings.SMTP_PASS });
  assert.equal(transportOptions.port, 587);
  assert.equal(transportOptions.secure, false);
  assert.equal(message.to, settings.INTAKE_NOTIFICATION_EMAIL);
  assert.equal(message.replyTo.address, "lead@example.invalid");
  assert.match(message.html, /&lt;script&gt;/);
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.text, /https:\/\/mediahub\.example\.invalid\/admin\/leads\/lead-123/);
  assert.equal(Object.hasOwn(message, "attachments"), false);
});

test("creator notice lists portfolio and points to the private Admin CV", async () => {
  let message;
  await notifyIntake({
    id: "creator-123", source: "CREATOR_APPLICATION", full_name: "Creator",
    email: "creator@example.invalid", applicant_type: "STUDENT", specialty: "Video",
    portfolio_urls: ["https://portfolio.example.invalid/work"], message: "Portfolio application",
  }, () => ({ sendMail: async value => { message = value; } }), settings);
  assert.match(message.text, /portfolio\.example\.invalid/);
  assert.match(message.text, /CV.*(?:riÃªng tÆ°|riêng tư)/);
  assert.match(message.html, /admin\/leads\/creator-123/);
  assert.equal(Object.hasOwn(message, "attachments"), false);
});

test("intake remains recorded without attempting mail when SMTP is not configured", async () => {
  let attempted = false;
  const sent = await notifyIntake({ id: "lead-456", source: "BUSINESS_CONTACT", full_name: "Name", email: "lead@example.invalid" }, () => {
    attempted = true;
    throw new Error("Should not attempt SMTP");
  }, {});
  assert.equal(sent, false);
  assert.equal(attempted, false);
});

test("unrelated project-request leads do not get mislabeled as business intake", async () => {
  let attempted = false;
  const sent = await notifyIntake({ id: "lead-789", source: "PROJECT_REQUEST", full_name: "Name", email: "lead@example.invalid" }, () => {
    attempted = true;
    throw new Error("Should not attempt SMTP");
  }, settings);
  assert.equal(sent, false);
  assert.equal(attempted, false);
});
