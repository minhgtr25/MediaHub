import { Router } from "express";
import { z } from "zod";
import { db, result, ApiError } from "./db.js";
import { persistedRoles, supportRoles, isCustomerRole } from "./domain.js";
import { requireRole } from "./middleware.js";
import { uuid } from "./validators.js";
import { variationSchemas, variationOperations } from "./order-variation-validators.js";

export const variationRoutes = Router();
variationRoutes.use(requireRole([...persistedRoles]));
const pagination=z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict();
// Read RPCs repeat scope checks in the database and project Creator scope separately.
variationRoutes.get("/:id/scope",async(req,res)=>{
 const oid=uuid.parse(req.params.id),{page}=pagination.parse(req.query);
 const data=await result(db.rpc("order_variation_scopes",{actor_id:req.identity.id,oid,report_page:page}));
 if(!data)throw new ApiError(404,"NOT_FOUND","Không tìm thấy phạm vi bổ sung của đơn.");
 res.json({success:true,data});
});
variationRoutes.get("/:id",requireRole(supportRoles),async(req,res)=>{
 const oid=uuid.parse(req.params.id),{page,focus_id}=pagination.extend({focus_id:uuid.optional()}).strict().parse(req.query);
 const data=await result(db.rpc("order_variation_list",{actor_id:req.identity.id,oid,report_page:page,...(focus_id?{focus_id}:{})}));
 if(!data)throw new ApiError(404,"NOT_FOUND","Không tìm thấy phụ lục của đơn.");
 res.json({success:true,data});
});
variationRoutes.post("/:id/:operation",requireRole(supportRoles),async(req,res)=>{
 const oid=uuid.parse(req.params.id),operation=z.enum(variationOperations).parse(req.params.operation),u=req.identity;
 if(operation==='quote' && !['STAFF','ADMIN'].includes(u.role) || ['request','accept','withdraw'].includes(operation) && !isCustomerRole(u.role))throw new ApiError(403,"FORBIDDEN","Thao tác không đúng vai trò.");
 const payload=variationSchemas[operation].parse(req.body);
 // Avoid exposing the existence of another customer's order, including writes.
 if(!await result(db.rpc('order_variation_list',{actor_id:u.id,oid,report_page:1})))throw new ApiError(404,'NOT_FOUND','Không tìm thấy phụ lục của đơn.');
 res.json({success:true,data:await result(db.rpc('order_variation_action',{actor_id:u.id,oid,operation,payload}))});
});
