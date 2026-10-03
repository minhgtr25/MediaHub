import { Router, type Request } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { requireRole } from "./middleware.js";
import { uuid } from "./validators.js";
import { canReadRequest } from "./request-policy.js";
import { isCustomerRole } from "./domain.js";

export const creatorTeamRoutes = Router({ mergeParams: true });
export const creatorWorkspaceRoutes = Router();
creatorWorkspaceRoutes.use(requireRole(["CREATOR", "STUDENT_CREATOR"]));
const reason = z.string().trim().min(1).max(2000);
export const teamOperations = {
 select: z.object({ proposal_id: uuid }).strict(), deselect: z.object({ proposal_id: uuid }).strict(),
 invite: z.object({ proposal_id: uuid, work_scope: z.string().trim().min(1).max(3000), deadline: z.iso.date(), response_minutes: z.number().int().min(5).max(15).default(15) }).strict(),
 release: z.object({ assignment_id: uuid, reason }).strict(), expire: z.object({ assignment_id: uuid }).strict(),
 accept: z.object({ assignment_id: uuid }).strict(), decline: z.object({ assignment_id: uuid, reason }).strict(),
 progress: z.object({ assignment_id: uuid, progress: z.number().int().min(0).max(100), content: z.string().trim().min(1).max(3000) }).strict(),
};
async function requestScope(req: Request) {
 const request = await result(db.from("requests").select("*").eq("id", uuid.parse(req.params.id)).maybeSingle());
 if (!request || !canReadRequest(req.identity, request)) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy yêu cầu.");
 return request;
}
creatorTeamRoutes.get("/available", requireRole(["STAFF", "ADMIN"]), async (req, res) => {
 await requestScope(req);
 const search = z.string().trim().max(100).default("").parse(req.query.search);
 const data=await result(db.rpc('creator_request_candidates',{actor_id:req.identity.id,rid:uuid.parse(req.params.id),search_text:search}));
 if(!data)throw new ApiError(404,'NOT_FOUND','Không tìm thấy yêu cầu.');
 res.json({success:true,data});
});
creatorTeamRoutes.get("/", async (req, res) => {
 const request = await requestScope(req);
 const [selected, assignments] = await Promise.all([
  result(db.from("request_creator_selections").select("*").eq("request_id", request.id)),
  result(db.from("creator_assignments").select("*").eq("request_id", request.id).order("invited_at")),
 ]);
 const ids = [...new Set([...(selected ?? []).map(row => row.creator_id), ...(assignments ?? []).map(row => row.creator_id)])];
 const creatorIds = (assignments ?? []).map(row => row.id);
 const [creators, updates] = await Promise.all([
  ids.length ? result(db.from("creator_profiles").select("id,display_name,slug,title,avatar_url").in("id", ids)) : [],
  creatorIds.length ? result(db.from("creator_progress_updates").select("*").in("assignment_id", creatorIds).order("created_at", { ascending: false }).limit(100)) : [],
 ]);
 res.json({ success: true, data: { selected, assignments, creators, updates, required: request.team_confirmation_required } });
});
creatorTeamRoutes.post("/:operation", async (req, res) => {
 const request = await requestScope(req), operation = z.enum(["select", "deselect", "invite", "release", "expire"]).parse(req.params.operation);
 if (["select", "deselect"].includes(operation) ? !isCustomerRole(req.identity.role) : !["STAFF", "ADMIN"].includes(req.identity.role)) throw new ApiError(403,"FORBIDDEN","Chỉ Customer chọn đội; Staff phụ trách gửi và thu hồi phân công.");
 const payload = teamOperations[operation].parse(req.body);
 res.json({ success: true, data: await result(db.rpc("creator_team_action", { actor_id: req.identity.id, rid: request.id, operation, payload })) });
});
async function creatorProfile(req: Request) {
 const creator = await result(db.from("creator_profiles").select("id,display_name").eq("profile_id", req.identity.id).maybeSingle());
 if (!creator) throw new ApiError(409, "CREATOR_PROFILE_REQUIRED", "Admin cần liên kết tài khoản với hồ sơ Creator.");
 return creator;
}
async function creatorRequest(req: Request, requestId: string) {
 const creator = await creatorProfile(req);
 const assignment = await result(db.from("creator_assignments").select("*").eq("creator_id", creator.id).eq("request_id", requestId).maybeSingle());
 if (!assignment) throw new ApiError(404, "NOT_FOUND", "Bạn chưa được phân công yêu cầu này.");
 const request = await result(db.from("requests").select("id,title,brief,status,assigned_to,request_number").eq("id", requestId).single());
 if(!['PENDING','ACCEPTED','COMPLETED'].includes(assignment.status))return {assignment,request:request?{...request,brief:'',assigned_to:null}:null,staff:null,order:null,chat_enabled:false,conversation_id:null,updates:await result(db.from('creator_progress_updates').select('*').eq('assignment_id',assignment.id).order('created_at',{ascending:false}).limit(50))};
 const order = await result(db.from("orders").select("id,status").eq("request_id", requestId).maybeSingle());
 const acknowledgment = order ? await result(db.from("contract_acknowledgments").select("order_id").eq("order_id", order.id).maybeSingle()) : null;
 const chatEnabled = ["ACCEPTED", "COMPLETED"].includes(assignment.status) && !!acknowledgment && !!order && !["CANCELLED", "REFUNDED"].includes(order.status);
 const [staff, conversation, updates] = await Promise.all([
  request?.assigned_to ? result(db.from("profiles").select("id,full_name,avatar_url").eq("id", request.assigned_to).maybeSingle()) : null,
  chatEnabled ? result(db.from("conversations").select("id").eq("request_id", requestId).single()) : null,
  result(db.from("creator_progress_updates").select("*").eq("assignment_id", assignment.id).order("created_at", { ascending: false }).limit(50)),
 ]);
 return { assignment, request, staff, order, chat_enabled: chatEnabled, conversation_id: conversation?.id ?? null, updates };
}
creatorWorkspaceRoutes.get("/assignments", async (req, res) => {
 const creator = await creatorProfile(req);
 const assignments = (await result(db.from("creator_assignments").select("*").eq("creator_id", creator.id).order("invited_at", { ascending: false }).limit(100))) ?? [];
 const ids = assignments.map(row => row.request_id);
 const requests = ids.length ? await result(db.from("requests").select("id,title,request_number").in("id", ids)) : [];
 res.json({ success: true, data: { items: assignments.map(row => ({ ...row, request: requests?.find(request => request.id === row.request_id) })) } });
});
creatorWorkspaceRoutes.get("/assignments/:id", async (req, res) => {
 const creator = await creatorProfile(req);
 const assignment = await result(db.from("creator_assignments").select("request_id").eq("id", uuid.parse(req.params.id)).eq("creator_id", creator.id).maybeSingle());
 if (!assignment) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy phân công.");
 res.json({ success: true, data: await creatorRequest(req, assignment.request_id) });
});
creatorWorkspaceRoutes.get("/requests/:id", async (req, res) => res.json({ success: true, data: await creatorRequest(req, uuid.parse(req.params.id)) }));
creatorWorkspaceRoutes.get("/requests/:id/messages", async (req, res) => {
 const id = uuid.parse(req.params.id), scope = await creatorRequest(req, id);
 if (!scope.chat_enabled || !scope.conversation_id) throw new ApiError(403, "CHAT_NOT_READY", "Hội thoại mở sau khi Creator nhận việc và hợp đồng dịch vụ được xác nhận.");
 const params = z.object({ before: z.iso.datetime({ offset: true }).optional(), before_id: uuid.optional() }).refine(value => !!value.before === !!value.before_id).parse(req.query);
 let query = db.from("conversation_messages").select("id,sender_id,content,kind,event_data,audience,created_at").eq("conversation_id", scope.conversation_id).eq("audience", "TEAM").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(51);
 if (params.before) query = query.or(`created_at.lt.${params.before},and(created_at.eq.${params.before},id.lt.${params.before_id})`);
 const messages = (await result(query)) ?? [], page = messages.slice(0, 50), oldest = page.at(-1);
 const members = (await result(db.from("conversation_members").select("profile_id,last_read_at").eq("conversation_id", scope.conversation_id))) ?? [];
 const ids = [...new Set([...page.map(row => row.sender_id), ...members.map(row => row.profile_id)])];
 const senders = ids.length ? await result(db.from("profiles").select("id,full_name,role").in("id", ids)) : [];
 res.json({ success: true, data: { messages: page.reverse(), members: members.map(row => ({ id: row.profile_id, last_read_at: row.last_read_at })), senders, next_cursor: messages.length > 50 && oldest ? { before: oldest.created_at, before_id: oldest.id } : null } });
});
creatorWorkspaceRoutes.post("/requests/:id/:operation", async (req, res) => {
 const id = uuid.parse(req.params.id), scope = await creatorRequest(req, id), operation = z.enum(["accept", "decline", "progress", "message", "read"]).parse(req.params.operation);
 if (operation === "message" || operation === "read") {
  if (!scope.chat_enabled) throw new ApiError(403, "CHAT_NOT_READY", "Hội thoại chưa được mở.");
  const payload = operation === "read" ? z.object({}).strict().parse(req.body) : z.object({ content: z.string().trim().min(1).max(5000) }).strict().parse(req.body);
  res.json({ success: true, data: await result(db.rpc("request_action", { actor_id: req.identity.id, rid: id, operation, payload })) });
 } else {
  const payload = teamOperations[operation].parse(req.body);
  if (payload.assignment_id !== scope.assignment.id) throw new ApiError(404, "NOT_FOUND", "Không tìm thấy phân công.");
  res.json({ success: true, data: await result(db.rpc("creator_team_action", { actor_id: req.identity.id, rid: id, operation, payload })) });
 }
});
