import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { db, result, ApiError } from "./db.js";
import { requireRole } from "./middleware.js";
import { uuid } from "./validators.js";
import { fileType } from "./file-validation.js";
export const creatorProfileRoutes=Router();
creatorProfileRoutes.use(requireRole(['CREATOR','STUDENT_CREATOR']));
const text=(max:number)=>z.string().trim().max(max),required=(max:number)=>text(max).min(1);
const url=z.url().max(2000).refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!/[\r\n\u0000]/.test(value);},'Dùng HTTPS không chứa thông tin đăng nhập.');
export const creatorProfileSchemas={
 save:z.object({display_name:required(150),title:required(200),bio:text(5000),location:text(100),university:text(200),major:text(200),experience_level:z.enum(['STUDENT','JUNIOR','MID','SENIOR','LEAD']),availability:z.enum(['AVAILABLE','LIMITED','UNAVAILABLE']),tools:z.array(required(80)).max(20),languages:z.array(required(80)).min(1).max(10),skill_ids:z.array(uuid).max(30),category_ids:z.array(uuid).max(10)}).strict(),
 portfolio_save:z.object({id:uuid.optional(),idempotency_key:uuid,title:required(200),description:text(5000),category:text(100),client:text(200),project_year:z.number().int().min(1900).max(2100).optional(),project_url:url.optional(),image_url:url.optional(),rights_confirmed:z.literal(true)}).strict(),
 portfolio_delete:z.object({id:uuid}).strict(),
};
async function scope(actor:string){const state=await result(db.rpc('creator_profile_state',{actor_id:actor}));if(!state)throw new ApiError(409,'CREATOR_PROFILE_REQUIRED','Admin cần liên kết hồ sơ và xác nhận hợp đồng hợp tác.');return state;}
creatorProfileRoutes.get('/',async(req,res)=>res.json({success:true,data:await scope(req.identity.id)}));
creatorProfileRoutes.post('/:operation',async(req,res,next)=>{
 if(req.params.operation==='images')return next();
 const operation=z.enum(['save','portfolio_save','portfolio_delete']).parse(req.params.operation),payload=creatorProfileSchemas[operation].parse(req.body);
 await scope(req.identity.id);
 if('image_url' in payload&&payload.image_url){const prefix=db.storage.from('creator-profile-assets').getPublicUrl(`${req.identity.id}/`).data.publicUrl;if(!payload.image_url.startsWith(prefix))throw new ApiError(422,'INVALID_ASSET','Ảnh phải được tải lên hồ sơ của bạn.');}
 res.json({success:true,data:await result(db.rpc('creator_profile_action',{actor_id:req.identity.id,operation,payload}))});
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:2}});
creatorProfileRoutes.post('/images',async(req,_res,next)=>{await scope(req.identity.id);next();},upload.single('file'),async(req,res)=>{
 const {kind}=z.object({kind:z.enum(['cover','portfolio']),rights_confirmed:z.literal('true')}).strict().parse(req.body);
 if(!req.file||!['image/jpeg','image/png','image/webp'].includes(req.file.mimetype))throw new ApiError(422,'IMAGE_REQUIRED','Chọn JPG, PNG hoặc WEBP, tối đa 5 MB.');
 const path=`${req.identity.id}/${randomUUID()}.${fileType(req.file)}`;
 await result(db.storage.from('creator-profile-assets').upload(path,req.file.buffer,{contentType:req.file.mimetype,cacheControl:'3600'}));
 const {data:{publicUrl}}=db.storage.from('creator-profile-assets').getPublicUrl(path);
 try{if(kind==='cover')await result(db.rpc('creator_profile_action',{actor_id:req.identity.id,operation:'cover',payload:{image_url:publicUrl}}));}catch(error){await db.storage.from('creator-profile-assets').remove([path]);throw error;}
 res.status(201).json({success:true,data:{image_url:publicUrl}});
});
