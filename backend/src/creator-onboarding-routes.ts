import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { requireRole } from "./middleware.js";
import { env } from "./config/database.js";
import { uuid } from "./validators.js";

export const creatorOnboardingRoutes = Router();
creatorOnboardingRoutes.use(requireRole("ADMIN"));
export const creatorImportSchema = z.object({
 mode: z.enum(["preview", "apply"]).default("preview"), confirm_signed: z.literal(true),
 items: z.array(z.object({ creator_id: uuid, email: z.email().max(254).transform(v => v.toLowerCase()), full_name: z.string().trim().min(1).max(150), agreement_reference: z.string().trim().min(1).max(200), signed_at: z.iso.datetime({ offset: true }).refine(v => new Date(v).getTime() <= Date.now(), "Thời điểm ký không được ở tương lai.") }).strict()).min(1).max(50),
}).strict().refine(v => new Set(v.items.map(i => i.creator_id)).size === v.items.length && new Set(v.items.map(i => i.email)).size === v.items.length, "Danh sách có Creator hoặc email trùng nhau.");

creatorOnboardingRoutes.get("/", async (req, res) => {
 const search = z.string().trim().max(100).default("").parse(req.query.search);
 let query = db.from("creator_profiles").select("id,profile_id,display_name,title,slug").order("display_name").limit(100);
 if(search) query = query.ilike("display_name", `%${search.replace(/[%_]/g, "")}%`);
 const creators = (await result(query)) ?? [], ids = creators.map(c => c.id), pids = creators.map(c => c.profile_id).filter((id): id is string => !!id);
 const [profiles, agreements] = await Promise.all([
  pids.length ? result(db.from("profiles").select("id,email,active,role").in("id", pids)) : [],
  ids.length ? result(db.from("creator_company_agreements").select("creator_id,agreement_reference,signed_at").in("creator_id", ids)) : [],
 ]);
 res.json({success:true,data:{items:creators.map(c => ({...c, account: profiles?.find(p => p.id === c.profile_id) ?? null, agreement: agreements?.find(a => a.creator_id === c.id) ?? null}))}});
});

creatorOnboardingRoutes.post("/import", async (req, res) => {
 const body = creatorImportSchema.parse(req.body);
 // Validate the whole batch before any Auth invitation; each apply result is explicit.
 const rows = [];
 for (const input of body.items) {
  const creator = await result(db.from("creator_profiles").select("id,profile_id,display_name").eq("id", input.creator_id).maybeSingle());
  if(!creator) throw new ApiError(422,"UNKNOWN_CREATOR",`Không tìm thấy hồ sơ Creator: ${input.creator_id}.`);
  const profile = await result(db.from("profiles").select("id,email,role").eq("email",input.email).maybeSingle());
  if(profile && !["CUSTOMER","CREATOR","STUDENT_CREATOR"].includes(profile.role) || creator.profile_id && creator.profile_id !== profile?.id) throw new ApiError(409,"ACCOUNT_CONFLICT",`Email/hồ sơ ${input.email} đã thuộc tài khoản khác.`);
  if(profile) {
   const linked = await result(db.from("creator_profiles").select("id").eq("profile_id",profile.id).maybeSingle());
   if(linked && linked.id !== creator.id) throw new ApiError(409,"ACCOUNT_CONFLICT",`Email ${input.email} đã liên kết với Creator khác.`);
   if(profile.role === "CUSTOMER") {
    const customer = await result(db.from("customers").select("id").eq("profile_id",profile.id).maybeSingle());
    if(customer) {
     const [requests, projects] = await Promise.all([result(db.from("requests").select("id").eq("customer_id",customer.id).limit(1)),result(db.from("projects").select("id").eq("customer_id",customer.id).limit(1))]);
     if(requests?.length || projects?.length) throw new ApiError(409,"ACCOUNT_IN_USE",`Customer ${input.email} đã có nghiệp vụ; cần xử lý riêng trước khi chuyển quyền.`);
    }
   }
  }
  const agreement = await result(db.from("creator_company_agreements").select("agreement_reference,signed_at").eq("creator_id",creator.id).maybeSingle());
  if(agreement && (agreement.agreement_reference !== input.agreement_reference || new Date(agreement.signed_at).getTime() !== new Date(input.signed_at).getTime())) throw new ApiError(409,"AGREEMENT_CONFLICT",`Hồ sơ hợp tác ${creator.display_name} đã được ghi nhận và không được ghi đè.`);
  rows.push({input,creator,profile});
 }
 if(body.mode === "preview") return res.json({success:true,data:{items:rows.map(r => ({...r.input,display_name:r.creator.display_name,action:r.profile ? "LINK_EXISTING" : "INVITE_NEW"})),applied:false}});
 const outcomes = [];
 for(const row of rows) {
  let invited=false;
  try {
   let profile=row.profile;
   if(!profile) {
    const {error}=await db.auth.admin.inviteUserByEmail(row.input.email,{data:{full_name:row.input.full_name},redirectTo:env.AUTH_REDIRECT_URL});
    if(error) throw new ApiError(409,"INVITATION_FAILED","Không gửi được lời mời; kiểm tra cấu hình email hoặc tài khoản đã tồn tại.");
    invited=true;
    profile=await result(db.from("profiles").select("id,email,role").eq("email",row.input.email).single());
   }
   if(!profile) throw new ApiError(503,"PROFILE_PENDING","Lời mời đã gửi nhưng hồ sơ chưa sẵn sàng. Kiểm tra lại tài khoản trước khi thử lại.");
   await result(db.rpc("onboard_creator",{actor_id:req.identity.id,cid:row.creator.id,target_profile_id:profile.id,payload:{agreement_reference:row.input.agreement_reference,signed_at:row.input.signed_at}}));
   outcomes.push({creator_id:row.creator.id,email:row.input.email,provisioned:true,invitation_sent:invited});
  } catch(error) {
   outcomes.push({creator_id:row.creator.id,email:row.input.email,provisioned:false,invitation_sent:invited,error:error instanceof Error ? error.message : "Chưa cấp quyền được. Kiểm tra và thử lại."});
  }
 }
 res.json({success:true,data:{items:outcomes,applied:true}});
});
