import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { db, env } from "../dist/config/database.js";

if (!process.argv.includes("--apply")) throw new Error("Use --apply to provision the four canonical local test identities.");
const directory = new URL("../../.qa/", import.meta.url);
const manifestPath = new URL("role-accounts.json", directory);
const documentPath = new URL("ROLE_TEST_ACCOUNTS.md", directory);
const roles = ["CUSTOMER", "STAFF", "CREATOR", "ADMIN"];
const legacyRoles = ["BUSINESS", "STUDENT_CREATOR"];
// Explicitly requested by the developer of this local project for role testing.
const password = process.env.MEDIAHUB_QA_PASSWORD;
if (!password || password.length < 10) throw new Error("Set MEDIAHUB_QA_PASSWORD (at least 10 characters) before provisioning test accounts.");
const projectHost = new URL(env.SUPABASE_URL).host;
await fs.mkdir(directory, { recursive: true });
let manifest;
try { manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  manifest = { purpose: "mediahub-local-role-tests", projectHost, accounts: roles.map(role => ({ role, email: `${role.toLowerCase().replaceAll("_", ".")}.test@example.com`, password, authId: null, profileId: null, verified: false })) };
}
if (manifest.purpose !== "mediahub-local-role-tests" || manifest.projectHost !== projectHost ||
    !roles.every(role => manifest.accounts.some(account => account.role === role)) ||
    new Set(manifest.accounts.map(account => account.role)).size !== manifest.accounts.length ||
    manifest.accounts.some(account => ![...roles, ...legacyRoles].includes(account.role)))
  throw new Error("Test manifest belongs to another project or batch; refusing account changes.");
// Retain IDs/history of extra test identities, but do not provision/activate them.
manifest.retiredAccounts = [...(manifest.retiredAccounts ?? []), ...manifest.accounts.filter(account => legacyRoles.includes(account.role))];
manifest.accounts = manifest.accounts.filter(account => roles.includes(account.role));
const save = () => fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
await save();
const checked = response => { if (response.error) throw new Error(response.error.message); return response.data; };
const admin = checked(await db.from("profiles").select("id").eq("role", "ADMIN").eq("active", true).order("created_at").limit(1).maybeSingle());
if (!admin) throw new Error("An existing active administrator is required to assign roles through manage_user.");
const login = createClient(env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
for (const account of manifest.accounts) {
  if (!roles.includes(account.role) || account.email !== `${account.role.toLowerCase().replaceAll("_", ".")}.test@example.com`)
    throw new Error("Unexpected identity in the test manifest.");
  if (!account.authId) {
    const { user } = checked(await db.auth.admin.createUser({ email: account.email, password, email_confirm: true, user_metadata: { full_name: `MediaHub Test ${account.role}`, qa_purpose: manifest.purpose } }));
    if (!user) throw new Error(`Could not create ${account.role}.`);
    account.authId = user.id;
    await save();
  } else {
    const { user } = checked(await db.auth.admin.getUserById(account.authId));
    if (user?.email !== account.email || user.user_metadata?.qa_purpose !== manifest.purpose)
      throw new Error("Existing account is not owned by this test batch; refusing changes.");
    checked(await db.auth.admin.updateUserById(account.authId, { password, email_confirm: true }));
  }
  account.password = password;
  const profile = checked(await db.from("profiles").select("id,role,active").eq("auth_user_id", account.authId).single());
  account.profileId = profile.id;
  await save();
  if (profile.role !== account.role || !profile.active)
    checked(await db.rpc("manage_user", { actor_id: admin.id, target_id: profile.id, new_role: account.role, new_active: true }));
  const verified = checked(await db.from("profiles").select("role,active").eq("id", profile.id).single());
  if (verified.role !== account.role || !verified.active) throw new Error(`Role verification failed for ${account.role}.`);
  if (account.role === "CUSTOMER") {
    const customer = checked(await db.from("customers").select("id").eq("profile_id", profile.id).single());
    account.customerId = customer.id;
  }
  const signedIn = checked(await login.auth.signInWithPassword({ email: account.email, password }));
  if (signedIn.user?.id !== account.authId || !signedIn.session) throw new Error(`Login verification failed for ${account.role}.`);
  // No token is stored, logged, emailed or copied into frontend code.
  await login.auth.signOut({ scope: "local" });
  account.verified = true;
  await save();
  console.log(JSON.stringify({ role: account.role, email: account.email, loginVerified: true }));
}
const lines = ["# Tài khoản test MediaHub", "", "Mật khẩu test được thiết lập qua MEDIAHUB_QA_PASSWORD và lưu riêng trong manifest local.", "", "Email đã xác nhận; đăng nhập bằng mật khẩu ngay, không cần nhận email.", "", "| Role | Email | Mật khẩu |", "| --- | --- | --- |", ...manifest.accounts.map(account => `| ${account.role} | ${account.email} | ${account.password} |`), "", "Guest: truy cập không đăng nhập.", "", "Bộ tài khoản này thuộc Supabase đang cấu hình trong .env, dùng với ứng dụng chạy local. Chỉ các tài khoản trong batch test này được tạo/cập nhật; tài khoản có sẵn khác không bị sửa.", "", "Hai tài khoản test BUSINESS/STUDENT_CREATOR cũ được lưu trong retiredAccounts để giữ ID/lịch sử; chưa bị xóa hoặc đổi quyền. Không phải role dùng để cấp mới.", "", "File này và manifest nằm trong .qa/, đã được Git bỏ qua.", ""];
await fs.writeFile(documentPath, lines.join("\n"), "utf8");
console.log(JSON.stringify({ complete: true, verifiedAccounts: manifest.accounts.length, credentialsFile: fileURLToPath(documentPath) }));
