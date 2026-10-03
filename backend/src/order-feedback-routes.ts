import { Router, type Request } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, result, ApiError } from './db.js';
import { requireRole } from './middleware.js';
import { isCustomerRole, supportRoles } from './domain.js';
import { uuid } from './validators.js';
import { fileType } from './file-validation.js';
import { publicationPreference, completedOrderReview, publishCaseStudy } from './order-feedback-validators.js';
const client=db as any;
export const orderFeedbackRoutes=Router(), caseStudyAdminRoutes=Router(), publicFeedbackRoutes=Router();
orderFeedbackRoutes.use(requireRole(supportRoles));
caseStudyAdminRoutes.use(requireRole('ADMIN'));
async function ownerScope(req:Request) {
 const order=await result(db.from('orders').select('id,request_id,customer_id,assigned_to,status').eq('id',uuid.parse(req.params.id)).maybeSingle());
 if(!order || !(req.identity.role==='ADMIN' || req.identity.role==='STAFF'&&order.assigned_to===req.identity.id || isCustomerRole(req.identity.role)&&order.customer_id===req.identity.customer_id))throw new ApiError(404,'NOT_FOUND','Không tìm thấy đánh giá của đơn.');
 return order;
}
async function preferences(oid:string){return result<any>(client.from('order_publication_preferences').select('show_name,notice_version,recorded_at').eq('order_id',oid).maybeSingle());}
orderFeedbackRoutes.get('/:id',async(req,res)=>{
 const order=await ownerScope(req);
 const [review,creators,preference,eligible,assignments]=await Promise.all([
  result<any>(client.from('order_result_reviews').select('rating,content,submitted_at,updated_at').eq('order_id',order.id).maybeSingle()),
  result<any[]>(client.from('order_creator_reviews').select('creator_id,rating,content').eq('order_id',order.id)),preferences(order.id),
  result<boolean>(client.rpc('completed_delivery_eligible',{oid:order.id})),
  result<any[]>(client.from('creator_assignments').select('creator_id,creator_profiles(display_name)').eq('request_id',order.request_id).eq('status','COMPLETED')),
 ]);
 const editableUntil=review?new Date(Date.parse(review.submitted_at)+7*86400000).toISOString():null;
 res.json({success:true,data:{review,creators,preference,team:assignments,eligible,editable_until:editableUntil,
  can_review:isCustomerRole(req.identity.role)&&eligible&&(!editableUntil||Date.now()<=Date.parse(editableUntil))}});
});
for(const [operation,schema] of [['preference',publicationPreference],['review',completedOrderReview]] as const){
 orderFeedbackRoutes.post(`/:id/${operation}`,requireRole(['CUSTOMER','BUSINESS']),async(req,res)=>{
  const order=await ownerScope(req),payload=schema.parse(req.body);
  res.json({success:true,data:await result(client.rpc('order_feedback_action',{actor_id:req.identity.id,oid:order.id,operation,payload}))});
 });
}
caseStudyAdminRoutes.get('/',async(req,res)=>{
 const page=z.coerce.number().int().min(1).default(1).parse(req.query.page);
 const {data,error,count}=await db.from('orders').select('id,order_number,request_id,total,requests(title)',{count:'exact'}).eq('status','COMPLETED').order('updated_at',{ascending:false}).range((page-1)*12,page*12-1);
 if(error)throw new ApiError(500,'DATABASE_ERROR','Không thể tải dự án đã hoàn thành.');
 const items=await Promise.all((data??[]).map(async order=>{
  const [preference,caseStudy]=await Promise.all([preferences(order.id),result<any>(client.from('order_case_studies').select('title,excerpt,image_path,published,updated_at').eq('order_id',order.id).maybeSingle())]);
  const preview=caseStudy?await result(db.storage.from('case-study-excerpts').createSignedUrl(caseStudy.image_path,180)):null;
  return {...order,preference,case_study:caseStudy?{...caseStudy,preview_url:preview?.signedUrl}:null};
 }));
 res.json({success:true,data:{items,total:count,page,limit:12}});
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:0}});
caseStudyAdminRoutes.post('/:id/image',async(req,_res,next)=>{try{const order=await ownerScope(req);if(!await result(client.rpc('completed_delivery_eligible',{oid:order.id})))throw new ApiError(409,'NOT_COMPLETED','Chỉ chuẩn bị trích đoạn của dự án đã hoàn thành.');next();}catch(e){next(e);}},upload.single('file'),async(req,res)=>{
 const order=await ownerScope(req);
 if(!req.file||!['image/jpeg','image/png','image/webp'].includes(req.file.mimetype))throw new ApiError(422,'IMAGE_REQUIRED','Ảnh trích đoạn JPG, PNG hoặc WEBP tối đa 5 MB.');
 const path=`${order.id}/${randomUUID()}.${fileType(req.file)}`;
 await result(db.storage.from('case-study-excerpts').upload(path,req.file.buffer,{contentType:req.file.mimetype}));
 try{await result(client.rpc('order_feedback_action',{actor_id:req.identity.id,oid:order.id,operation:'asset',payload:{path}}));}
 catch(e){await db.storage.from('case-study-excerpts').remove([path]);throw e;}
 res.status(201).json({success:true,data:{path,...await result(db.storage.from('case-study-excerpts').createSignedUrl(path,180))}});
});
for(const [operation,schema] of [['publish',publishCaseStudy],['withdraw',z.object({}).strict()]] as const){
 caseStudyAdminRoutes.post(`/:id/${operation}`,async(req,res)=>{
  const order=await ownerScope(req);
  res.json({success:true,data:await result(client.rpc('order_feedback_action',{actor_id:req.identity.id,oid:order.id,operation,payload:schema.parse(req.body)}))});
 });
}
// Raw owner/order IDs never leave the SQL public projections. Image paths are
// server-only inputs to signing; the final JSON exposes only the curated excerpt.
publicFeedbackRoutes.get('/creator-reviews/:slug',async(req,res)=>{
 const slug=z.string().regex(/^[a-z0-9-]+$/).max(100).parse(req.params.slug),page=z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
 const data=await result(client.rpc('public_completed_creator_reviews',{creator_slug:slug,review_page:page}));
 if(!data)throw new ApiError(404,'NOT_FOUND','Không tìm thấy Creator.');
 res.json({success:true,data});
});
publicFeedbackRoutes.get('/case-studies',async(req,res)=>{
 const page=z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
 const data=await result<any>(client.rpc('public_completed_case_studies',{case_page:page}));
 const items=await Promise.all(data.items.map(async(item:any)=>({title:item.title,excerpt:item.excerpt,updated_at:item.updated_at,customer_name:item.customer_name,image_url:(await result(db.storage.from('case-study-excerpts').createSignedUrl(item.image_path,180)))!.signedUrl})));
 res.json({success:true,data:{items,total:data.total,page,limit:6}});
});
