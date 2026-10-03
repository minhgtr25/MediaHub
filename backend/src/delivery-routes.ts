import { Router, type Request } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { requireRole } from "./middleware.js";
import { isCustomerRole, supportRoles } from "./domain.js";
import { uuid } from "./validators.js";
import { fileType } from "./file-validation.js";

export const deliveryRoutes = Router();
deliveryRoutes.use(requireRole([...supportRoles, "CREATOR", "STUDENT_CREATOR"]));
const creatorRole = (role:string) => ["CREATOR", "STUDENT_CREATOR"].includes(role);
async function scope(req:Request) {
 const order = await result(db.from("orders").select("id,request_id,customer_id,assigned_to,status").eq("id",uuid.parse(req.params.id)).maybeSingle());
 if (!order) throw new ApiError(404,"NOT_FOUND","Không tìm thấy hồ sơ bàn giao.");
 let assignment = null;
 if (creatorRole(req.identity.role)) {
  const creator = await result(db.from("creator_profiles").select("id").eq("profile_id",req.identity.id).maybeSingle());
  assignment = creator ? await result(db.from("creator_assignments").select("id,status").eq("request_id",order.request_id).eq("creator_id",creator.id).in("status",["ACCEPTED","COMPLETED"]).maybeSingle()) : null;
  const ack = assignment ? await result(db.from("contract_acknowledgments").select("order_id").eq("order_id",order.id).maybeSingle()) : null;
  if (!assignment || !ack || ["CANCELLED","REFUNDED"].includes(order.status)) throw new ApiError(404,"NOT_FOUND","Bạn chưa được cấp quyền tham gia dự án này.");
 } else if (req.identity.role !== "ADMIN" && !(req.identity.role === "STAFF" && order.assigned_to === req.identity.id) && !(isCustomerRole(req.identity.role) && order.customer_id === req.identity.customer_id))
  throw new ApiError(404,"NOT_FOUND","Không tìm thấy hồ sơ bàn giao.");
 return {order,assignment};
}
deliveryRoutes.get("/:id",async(req,res)=>{
 const {order,assignment}=await scope(req);
 const [files,rounds,project,funds]=await Promise.all([
  result(db.from("production_submissions").select("id,assignment_id,author_id,kind,title,note,file_name,file_type,file_size,final_of,created_at").eq("order_id",order.id).order("created_at",{ascending:false}).order("id",{ascending:false})),
  result(db.from("order_review_rounds").select("*").eq("order_id",order.id).order("version",{ascending:false})),
  result(db.from("projects").select("production_status").eq("order_id",order.id).maybeSingle()),
  result(db.from("order_final_funds_confirmations").select("order_id").eq("order_id",order.id).maybeSingle()),
 ]);
 const authors=[...new Set((files ?? []).map(f=>f.author_id))];
 const people=authors.length?await result(db.from("profiles").select("id,full_name").in("id",authors)):[];
 res.json({success:true,data:{files:files ?? [],rounds:rounds ?? [],people:people ?? [],status:order.status,production_status:project?.production_status ?? null,assignment_id:assignment?.id ?? null,funds_confirmed:!!funds}});
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:50*1024*1024,files:1,fields:5}});
deliveryRoutes.post("/:id/files",async(req,_res,next)=>{
 try {if(!creatorRole(req.identity.role))throw new ApiError(403,"FORBIDDEN","Creator phụ trách gửi bản sản phẩm của mình.");await scope(req);next();}catch(e){next(e);}
},upload.single("file"),async(req,res)=>{
 const {order,assignment}=await scope(req);
 if(!req.file)throw new ApiError(422,"FILE_REQUIRED","Chọn tệp sản phẩm.");
 const body=z.object({kind:z.enum(["REVIEW","FINAL"]),title:z.string().trim().min(1).max(200),note:z.string().trim().max(3000).default(""),final_of:uuid.optional(),confirmed:z.literal("true")}).strict().superRefine((v,c)=>{if(v.kind==='FINAL'&&!v.final_of||v.kind==='REVIEW'&&v.final_of)c.addIssue({code:'custom',message:'Bản hoàn thiện phải khớp một bản đã nghiệm thu.',path:['final_of']})}).parse(req.body);
 const ext=fileType(req.file),path=`${order.id}/${randomUUID()}.${ext}`;
 await result(db.storage.from("order-deliverables").upload(path,req.file.buffer,{contentType:req.file.mimetype}));
 try {
  res.status(201).json({success:true,data:await result(db.rpc("order_delivery_action",{actor_id:req.identity.id,oid:order.id,operation:"upload",payload:{...body,confirmed:true,assignment_id:assignment!.id,file_name:req.file.originalname.slice(0,255),path,type:req.file.mimetype,size:req.file.size}}))});
 }catch(e){await db.storage.from("order-deliverables").remove([path]);throw e;}
});
deliveryRoutes.get("/:id/files/:fileId/download",async(req,res)=>{
 const {order}=await scope(req),file=await result(db.from("production_submissions").select("storage_path,kind,final_of").eq("order_id",order.id).eq("id",uuid.parse(req.params.fileId)).maybeSingle());
 if(!file)throw new ApiError(404,"NOT_FOUND","Không tìm thấy phiên bản sản phẩm.");
 if(file.kind==='FINAL'){
  const [funds,round]=await Promise.all([result(db.from("order_final_funds_confirmations").select("order_id").eq("order_id",order.id).maybeSingle()),result(db.from("order_review_rounds").select("submission_ids").eq("order_id",order.id).eq("status","ACCEPTED").maybeSingle())]);
  if(!funds || !round?.submission_ids.includes(file.final_of!))throw new ApiError(403,"FINAL_LOCKED","Bản hoàn thiện chỉ mở sau nghiệm thu và xác nhận thu đủ.");
 }
 res.json({success:true,data:await result(db.storage.from("order-deliverables").createSignedUrl(file.storage_path,180,{download:true}))});
});
const operations={
 send_review:z.object({submission_ids:z.array(uuid).min(1).max(100).refine(v=>new Set(v).size===v.length),note:z.string().trim().min(1).max(3000)}).strict(),
 accept_review:z.object({round_id:uuid,confirmed:z.literal(true)}).strict(),
 request_revision:z.object({round_id:uuid,note:z.string().trim().min(1).max(3000)}).strict(),
};
deliveryRoutes.post("/:id/:operation",async(req,res)=>{
 const {order}=await scope(req),operation=z.enum(["send_review","accept_review","request_revision"]).parse(req.params.operation);
 if(operation==='send_review'? !["STAFF","ADMIN"].includes(req.identity.role):!isCustomerRole(req.identity.role))throw new ApiError(403,"FORBIDDEN",operation==='send_review'?'Người phụ trách gửi nghiệm thu.':'Chỉ chủ đơn phản hồi nghiệm thu.');
 const payload=operations[operation].parse(req.body);
 res.json({success:true,data:await result(db.rpc("order_delivery_action",{actor_id:req.identity.id,oid:order.id,operation,payload}))});
});
