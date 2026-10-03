import {Router} from 'express';
import {z} from 'zod';
import {db,result,ApiError} from './db.js';
import {uuid} from './validators.js';
import { requireRole } from './middleware.js';
import { commerceRoles, isCustomerRole } from './domain.js';
export const paymentRoutes=Router();
paymentRoutes.use(requireRole(commerceRoles));
paymentRoutes.get('/settings',async(_req,res)=>res.json({success:true,data:await result(db.from('payment_settings').select('*').eq('id','default').single())}));
paymentRoutes.put('/settings',async(req,res)=>{
 if(req.identity.role!=='ADMIN')throw new ApiError(403,'FORBIDDEN','Chỉ quản trị viên được cấu hình.');
 const body=z.object({bank_name:z.string().trim().max(100),account_number:z.string().trim().max(50),account_name:z.string().trim().max(150),qr_image:z.union([z.literal(''),z.url().refine(v=>v.startsWith('https://')),z.string().regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).max(600000)]),deposit_percent:z.number().int().min(1).max(99),enabled:z.boolean(),instructions:z.string().max(1000)}).strict().refine(v=>!v.enabled||(!!v.bank_name&&!!v.account_number&&!!v.account_name&&!!v.qr_image),'Cần đủ thông tin ngân hàng và QR để kích hoạt.').parse(req.body);
 res.json({success:true,data:await result(db.from('payment_settings').update({...body,updated_at:new Date().toISOString()}).eq('id','default').select().single())});
});
paymentRoutes.get('/',async(req,res)=>{
 const page=z.coerce.number().int().min(1).default(1).parse(req.query.page);
 let projects=db.from('projects').select('id,title,status').is('order_id',null);
 if(isCustomerRole(req.identity.role))projects=projects.eq('customer_id',req.identity.customer_id!);
 const p=(await result(projects))??[];
 const ids=p.map(x=>x.id);
 if(!ids.length){res.json({success:true,data:{items:[],total:0,page}});return;}
 const {data:plans,error,count}=await db.from('payment_plans').select('*',{count:'exact'}).in('project_id',ids).order('created_at',{ascending:false}).range((page-1)*20,page*20-1);
 if(error)throw new ApiError(500,'DATABASE_ERROR','Không thể tải thanh toán.');
 const planIds=(plans??[]).map(x=>x.id);
 const installments=(planIds.length?await result(db.from('payment_installments').select('*').in('plan_id',planIds)):[])??[];
 res.json({success:true,data:{items:(plans??[]).map(x=>({...x,project:p.find(y=>y.id===x.project_id),installments:installments.filter(i=>i.plan_id===x.id)})),total:count,page}});
});
paymentRoutes.get('/eligible-projects',async(req,res)=>{
 if(req.identity.role!=='ADMIN')throw new ApiError(403,'FORBIDDEN','Chỉ quản trị viên.');
 const quotes=(await result(db.from('quotations').select('project_id,total').eq('status','ACCEPTED')))??[];
 const ids=quotes.map(q=>q.project_id).filter((id): id is string => !!id);
 const projects=ids.length?await result(db.from('projects').select('id,title').in('id',ids).not('status','in','(COMPLETED,CANCELLED)')):[];
 res.json({success:true,data:projects});
});
paymentRoutes.post('/:id/:operation',async(req,res)=>{
 const id=uuid.parse(req.params.id),operation=z.enum(['create-plan','report','confirm','reject']).parse(req.params.operation);
 if(operation!=='report'&&req.identity.role!=='ADMIN')throw new ApiError(403,'FORBIDDEN','Chỉ quản trị viên xác nhận thanh toán.');
 if(operation==='report'&&!isCustomerRole(req.identity.role))throw new ApiError(403,'FORBIDDEN','Chỉ khách hàng được báo chuyển khoản.');
 const payload=operation==='create-plan'?z.object({deposit_percent:z.number().int().min(1).max(99).optional()}).strict().parse(req.body):operation==='report'?z.object({transfer_note:z.string().trim().min(1).max(1000)}).strict().parse(req.body):z.object({}).strict().parse(req.body);
 res.json({success:true,data:await result(db.rpc('payment_action',{actor_id:req.identity.id,operation,target_id:id,payload}))});
});
