import {Router} from 'express';
import {z} from 'zod';
import {db,result,ApiError} from './db.js';
import {uuid} from './validators.js';
import type {Identity} from './models/identity.model.js';
import { requireRole } from './middleware.js';
import { isCustomerRole, supportRoles } from './domain.js';
export const supportRoutes=Router();
supportRoutes.use(requireRole(supportRoles));
const status=z.enum(['OPEN','IN_PROGRESS','RESOLVED','CLOSED']);
async function owned(id:string,u:Identity) {
 const t=await result(db.from('support_tickets').select('*').eq('id',id).maybeSingle());
 if(!t || (isCustomerRole(u.role) && t.customer_id!==u.customer_id) || (u.role==='STAFF' && t.assigned_to!==u.id)) throw new ApiError(404,'NOT_FOUND','Không tìm thấy yêu cầu hỗ trợ.');
 return t;
}
supportRoutes.get('/',async(req,res)=>{
 const f=z.object({page:z.coerce.number().int().min(1).default(1),status:status.optional()}).parse(req.query);
 let q=db.from('support_tickets').select('*',{count:'exact'}).order('updated_at',{ascending:false});
 if(isCustomerRole(req.identity.role)) q=q.eq('customer_id',req.identity.customer_id!);
 if(req.identity.role==='STAFF') q=q.or('assigned_to.is.null,assigned_to.eq.'+req.identity.id);
 if(f.status) q=q.eq('status',f.status);
 const {data,error,count}=await q.range((f.page-1)*20,f.page*20-1);
 if(error)throw new ApiError(500,'DATABASE_ERROR','Không thể tải yêu cầu.');
 // Staff only see queue summaries before claiming, never private messages/customer details.
 const items=req.identity.role==='STAFF'?data?.map(t=>({...t,customer_id:undefined})):data;
 res.json({success:true,data:{items,total:count,page:f.page,limit:20}});
});
supportRoutes.get('/agents',async(req,res)=>{
 if(req.identity.role!=='ADMIN')throw new ApiError(403,'FORBIDDEN','Chỉ quản trị viên được phân công.');
 res.json({success:true,data:await result(db.from('profiles').select('id,full_name').in('role',['STAFF','ADMIN']).eq('active',true))});
});
supportRoutes.post('/',async(req,res)=>{
 const payload=z.object({subject:z.string().trim().min(1).max(160),category:z.enum(['GENERAL','PROJECT','PAYMENT','TECHNICAL']),message:z.string().trim().min(1).max(5000)}).strict().parse(req.body);
 if(!isCustomerRole(req.identity.role))throw new ApiError(403,'FORBIDDEN','Chỉ khách hàng tạo yêu cầu.');
 res.status(201).json({success:true,data:await result(db.rpc('support_action',{actor_id:req.identity.id,operation:'create',target_id:null,payload}))});
});
supportRoutes.get('/:id',async(req,res)=>{
 const ticket=await owned(uuid.parse(req.params.id),req.identity);
 const page=z.coerce.number().int().min(1).default(1).parse(req.query.page);
 const {data:messages,error,count}=await db.from('support_messages').select('*',{count:'exact'}).eq('ticket_id',ticket.id).order('created_at',{ascending:false}).order('id').range((page-1)*50,page*50-1);
 if(error)throw new ApiError(500,'DATABASE_ERROR','Không thể tải hội thoại.');
 const ids=[...new Set((messages??[]).map(m=>m.sender_id))];
 if(ticket.assigned_to) ids.push(ticket.assigned_to);
 const senders=ids.length?await result(db.from('profiles').select('id,full_name,role').in('id',ids)):[];
 const assigned_staff=senders?.find(s=>s.id===ticket.assigned_to)??null;
 res.json({success:true,data:{ticket,assigned_staff,messages:(messages??[]).reverse(),senders,total:count,page}});
});
supportRoutes.post('/:id/:operation',async(req,res)=>{
 const id=uuid.parse(req.params.id),operation=z.enum(['message','claim','assign','status']).parse(req.params.operation);
 const payload=operation==='message'?z.object({message:z.string().trim().min(1).max(5000)}).strict().parse(req.body):operation==='assign'?z.object({assigned_to:uuid}).strict().parse(req.body):operation==='status'?z.object({status}).strict().parse(req.body):z.object({}).strict().parse(req.body);
 if(operation==='assign' && req.identity.role!=='ADMIN')throw new ApiError(403,'FORBIDDEN','Chỉ quản trị viên được phân công.');
 if(operation==='status' && !['ADMIN','STAFF'].includes(req.identity.role))throw new ApiError(403,'FORBIDDEN','Chỉ nhân viên phụ trách được đổi trạng thái.');
 if(operation==='claim') {if(!['ADMIN','STAFF'].includes(req.identity.role))throw new ApiError(403,'FORBIDDEN','Không có quyền nhận yêu cầu.');}
 else await owned(id,req.identity);
 res.json({success:true,data:await result(db.rpc('support_action',{actor_id:req.identity.id,operation,target_id:id,payload}))});
});
