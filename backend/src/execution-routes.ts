import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { requireRole } from "./middleware.js";
import { persistedRoles, isCustomerRole } from "./domain.js";
import { uuid } from "./validators.js";
export const executionRoutes=Router();
executionRoutes.use(requireRole([...persistedRoles]));
const reason=z.string().trim().min(1).max(2000),party=z.enum(['CUSTOMER','CREATOR','STAFF','MEDIAHUB','EXTERNAL','UNDETERMINED']);
const paging=z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
export const executionSchemas={
 replacement_request:z.object({assignment_id:uuid,reason,idempotency_key:uuid}).strict(),
 replacement_invite:z.object({replacement_id:uuid,creator_id:uuid,reason,work_scope:z.string().trim().min(1).max(3000),deadline:z.iso.date(),response_minutes:z.number().int().min(5).max(15).default(15),idempotency_key:uuid}).strict(),
 replacement_reject:z.object({replacement_id:uuid,reason}).strict(),replacement_withdraw:z.object({replacement_id:uuid,reason}).strict(),
 delay_report:z.object({description:z.string().trim().min(1).max(3000),responsibility:party,proposed_deadline:z.iso.date().optional(),milestone_id:uuid.optional(),idempotency_key:uuid}).strict(),
 delay_apply:z.object({delay_id:uuid,reason,responsibility:party,new_deadline:z.iso.date(),responsible_creator_id:uuid.optional()}).strict().refine(p=>p.responsibility==='CREATOR'?!!p.responsible_creator_id:!p.responsible_creator_id,{message:'Chọn Creator chịu trách nhiệm chỉ khi bên liên quan là Creator.'}),
 delay_dismiss:z.object({delay_id:uuid,reason}).strict(),
};
executionRoutes.get('/invitations',requireRole(['CREATOR','STUDENT_CREATOR']),async(req,res)=>{const {page}=paging.parse(req.query);res.json({success:true,data:await result(db.rpc('execution_invitations',{actor_id:req.identity.id,report_page:page}))});});
executionRoutes.post('/invitations/:id/:operation',requireRole(['CREATOR','STUDENT_CREATOR']),async(req,res)=>{
 const iid=uuid.parse(req.params.id),operation=z.enum(['accept','decline']).parse(req.params.operation);
 const payload=(operation==='accept'?z.object({}).strict():z.object({reason}).strict()).parse(req.body);
 if(!await result(db.rpc('execution_invite_scope',{actor_id:req.identity.id,iid})))throw new ApiError(404,'NOT_FOUND','Không tìm thấy lời mời của bạn.');
 res.json({success:true,data:await result(db.rpc('execution_invite_response',{actor_id:req.identity.id,iid,operation,reason:'reason' in payload?String(payload.reason):''}))});
});
executionRoutes.get('/:id/candidates',requireRole(['STAFF','ADMIN']),async(req,res)=>{
 const oid=uuid.parse(req.params.id),{search}=z.object({search:z.string().trim().max(100).default('')}).strict().parse(req.query);
 const data=await result(db.rpc('execution_candidates',{actor_id:req.identity.id,oid,search_text:search}));if(!data)throw new ApiError(404,'NOT_FOUND','Không tìm thấy đơn.');res.json({success:true,data});
});
executionRoutes.get('/:id',async(req,res)=>{const oid=uuid.parse(req.params.id),{page}=paging.parse(req.query);const data=await result(db.rpc('execution_state',{actor_id:req.identity.id,oid,report_page:page}));if(!data)throw new ApiError(404,'NOT_FOUND','Không tìm thấy điều phối của đơn.');res.json({success:true,data});});
executionRoutes.post('/:id/:operation',async(req,res)=>{
 const oid=uuid.parse(req.params.id),operation=z.enum(['replacement_request','replacement_invite','replacement_reject','replacement_withdraw','delay_report','delay_apply','delay_dismiss']).parse(req.params.operation),u=req.identity;
 if(['replacement_request','replacement_withdraw'].includes(operation)&&!isCustomerRole(u.role)||['replacement_invite','replacement_reject','delay_apply','delay_dismiss'].includes(operation)&&!['STAFF','ADMIN'].includes(u.role))throw new ApiError(403,'FORBIDDEN','Thao tác không đúng vai trò.');
 const payload=executionSchemas[operation].parse(req.body);
 if(!await result(db.rpc('execution_state',{actor_id:u.id,oid,report_page:1})))throw new ApiError(404,'NOT_FOUND','Không tìm thấy điều phối của đơn.');
 res.json({success:true,data:await result(db.rpc('execution_action',{actor_id:u.id,oid,operation,payload}))});
});
