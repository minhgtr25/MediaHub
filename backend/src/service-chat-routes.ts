import { Router, type Request } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { db, result, ApiError } from './db.js';
import { requireRole } from './middleware.js';
import { uuid } from './validators.js';
import { fileType } from './file-validation.js';

export const serviceChatRoutes=Router();
serviceChatRoutes.use(requireRole(['CUSTOMER','BUSINESS','STAFF','ADMIN','CREATOR','STUDENT_CREATOR']));
const client=db as any;
export const serviceChatMessage=z.object({content:z.string().trim().min(1).max(5000),audience:z.enum(['TEAM','CUSTOMER_STAFF']).default('TEAM'),reply_to_id:uuid.nullable().default(null),client_message_id:uuid.optional()}).strict();
const fileMetadata=serviceChatMessage.extend({content:z.string().trim().max(5000).default(''),client_message_id:uuid}).strict();
async function scope(req:Request){
 const rid=uuid.parse(req.params.id);
 const data=await result<any>(client.rpc('service_chat_scope',{actor_id:req.identity.id,rid}));
 if(!data)throw new ApiError(404,'NOT_FOUND','Không tìm thấy hội thoại dịch vụ trong phạm vi của bạn.');
 return data;
}
serviceChatRoutes.get('/conversations',async(req,res)=>{
 const f=z.object({page:z.coerce.number().int().min(1).max(100000).default(1),search:z.string().trim().max(150).default('')}).strict().parse(req.query);
 res.json({success:true,data:await result(client.rpc('service_chat_conversations',{actor_id:req.identity.id,chat_page:f.page,chat_search:f.search}))});
});
serviceChatRoutes.get('/:id/resources',async(req,res)=>{
 const s=await scope(req),page=z.coerce.number().int().min(1).max(100000).default(1).parse(req.query.page);
 const data=await result(client.rpc('service_chat_resources',{actor_id:req.identity.id,rid:s.id,resource_page:page}));
 if(!data)throw new ApiError(404,'NOT_FOUND','Không còn quyền xem tài liệu hội thoại này.');
 res.json({success:true,data});
});
serviceChatRoutes.get('/:id/messages',async(req,res)=>{
 const s=await scope(req),params=z.object({before:z.iso.datetime({offset:true}).optional(),before_id:uuid.optional()}).strict().refine(p=>!!p.before===!!p.before_id).parse(req.query);
 let query=client.from('conversation_messages').select('id,sender_id,content,kind,event_data,audience,created_at,reply_to_id').eq('conversation_id',s.conversation_id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
 if(s.creator)query=query.eq('audience','TEAM');
 if(params.before)query=query.or(`created_at.lt.${params.before},and(created_at.eq.${params.before},id.lt.${params.before_id})`);
 const rows=await result<any[]>(query),page=rows.slice(0,50),oldest=page.at(-1);
 const replyIds=[...new Set(page.map(m=>m.reply_to_id).filter(Boolean))];
 let replyQuery=client.from('conversation_messages').select('id,sender_id,content,kind,audience').eq('conversation_id',s.conversation_id).in('id',replyIds);
 if(s.creator)replyQuery=replyQuery.eq('audience','TEAM');
 const [replies,files,members]=await Promise.all([
  replyIds.length?result<any[]>(replyQuery):[],
  page.length?result<any[]>(client.from('service_chat_files').select('message_id,file_name,file_type,file_size').eq('request_id',s.id).in('message_id',page.map(m=>m.id))):[],
  result<any[]>(client.rpc('service_chat_participants',{actor_id:req.identity.id,rid:s.id})),
 ]);
 const ids=[...new Set([...page.map(m=>m.sender_id),...replies.map(m=>m.sender_id),...members.map(m=>m.id)])];
 const senders=ids.length?await result<any[]>(client.from('profiles').select('id,full_name,role,avatar_url').in('id',ids)):[];
 res.json({success:true,data:{messages:page.reverse().map(m=>{const reply=replies.find(r=>r.id===m.reply_to_id)||null;return {...m,reply_to_id:reply?.id||null,reply,file:files.find(f=>f.message_id===m.id)||null};}),members,senders,next_cursor:rows.length>50&&oldest?{before:oldest.created_at,before_id:oldest.id}:null}});
});
serviceChatRoutes.post('/:id/message',async(req,res)=>{
 const s=await scope(req),payload=serviceChatMessage.parse(req.body);
 if(s.creator&&payload.audience!=='TEAM')throw new ApiError(403,'FORBIDDEN','Creator chỉ trao đổi trong đội dự án.');
 res.json({success:true,data:await result(client.rpc('request_action',{actor_id:req.identity.id,rid:s.id,operation:'message',payload}))});
});
serviceChatRoutes.post('/:id/read',async(req,res)=>{
 const s=await scope(req);z.object({}).strict().parse(req.body);
 res.json({success:true,data:await result(client.rpc('request_action',{actor_id:req.identity.id,rid:s.id,operation:'read',payload:{}}))});
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:50*1024*1024,files:1,fields:1,fieldSize:4096}});
serviceChatRoutes.post('/:id/files',async(req,_res,next)=>{try{const s=await scope(req);if(s.closed)throw new ApiError(409,'CHAT_CLOSED','Hội thoại đã đóng.');next();}catch(e){next(e);}},upload.single('file'),async(req,res)=>{
 const s=await scope(req);
 let raw;try{raw=JSON.parse(req.body?.payload||'{}');}catch{throw new ApiError(422,'INVALID_METADATA','Thông tin tệp chưa hợp lệ.');}
 const metadata=fileMetadata.parse(raw);
 if(s.creator&&metadata.audience!=='TEAM')throw new ApiError(403,'FORBIDDEN','Creator chỉ chia sẻ tệp trong đội dự án.');
 if(!req.file||!req.file.size||req.file.originalname.length>255)throw new ApiError(422,'FILE_REQUIRED','Chọn một tệp hợp lệ, tên tối đa 255 ký tự.');
 const extension=fileType(req.file),path=`requests/${s.id}/chat/${randomUUID()}.${extension}`;
 await result(db.storage.from('project-files').upload(path,req.file.buffer,{contentType:req.file.mimetype}));
 try{
  const data=await result<any>(client.rpc('request_action',{actor_id:req.identity.id,rid:s.id,operation:'chat_file',payload:{...metadata,content:metadata.content||req.file.originalname,name:req.file.originalname,path,type:req.file.mimetype,size:req.file.size,sha256:createHash('sha256').update(req.file.buffer).digest('hex')}}));
  if(data.created===false)await db.storage.from('project-files').remove([path]);
  res.status(data.created===false?200:201).json({success:true,data});
 }catch(e){await db.storage.from('project-files').remove([path]);throw e;}
});
serviceChatRoutes.get('/:id/files/:messageId',async(req,res)=>{
 const s=await scope(req),mid=uuid.parse(req.params.messageId);
 let q=client.from('conversation_messages').select('id').eq('id',mid).eq('conversation_id',s.conversation_id);
 if(s.creator)q=q.eq('audience','TEAM');
 const message=await result(q.maybeSingle());
 if(!message)throw new ApiError(404,'NOT_FOUND','Không tìm thấy tệp trong hội thoại này.');
 const file=await result<any>(client.from('service_chat_files').select('storage_path,file_name,file_type').eq('request_id',s.id).eq('message_id',mid).maybeSingle());
 if(!file)throw new ApiError(404,'NOT_FOUND','Không tìm thấy tệp trao đổi.');
 res.json({success:true,data:{...await result(db.storage.from('project-files').createSignedUrl(file.storage_path,180)),file_name:file.file_name,file_type:file.file_type}});
});
