import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
process.env.NODE_ENV='test';process.env.SUPABASE_URL='http://127.0.0.1:59999';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
const {app,apiLimiter}=await import('../dist/app.mjs');const {db}=await import('../dist/db.js');
const pid='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222',conv='33333333-3333-4333-8333-333333333333',mid='44444444-4444-4444-8444-444444444444',privateId='55555555-5555-4555-8555-555555555555',other='66666666-6666-4666-8666-666666666666',key='77777777-7777-4777-8777-777777777777';
let server,base;before(async()=>{server=app.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}/api/service-chat`;});after(()=>new Promise(resolve=>server.close(resolve)));
const headers={Authorization:'Bearer test-only'};
async function fixture(run,{role='CUSTOMER',closed=false,ready=true,reject=false,duplicate=false}={}){
 apiLimiter.resetKey('127.0.0.1');const original={from:db.from,rpc:db.rpc,auth:db.auth.getUser,storage:db.storage.from},calls=[],uploads=[],removals=[],signatures=[];
 const records={profiles:[{id:pid,auth_user_id:pid,role,full_name:'Actor',active:true}],customers:[{id:pid,profile_id:pid}],conversation_messages:[
  {id:mid,conversation_id:conv,sender_id:pid,content:'Visible team text',kind:'TEXT',audience:'TEAM',reply_to_id:null,event_data:{},created_at:'2026-10-03T00:00:00Z'},
  {id:privateId,conversation_id:conv,sender_id:pid,content:'Private commercial text',kind:'TEXT',audience:'CUSTOMER_STAFF',reply_to_id:mid,event_data:{},created_at:'2026-10-03T00:01:00Z'}],
  service_chat_files:[{request_id:rid,message_id:privateId,file_name:'commercial.pdf',file_type:'application/pdf',file_size:100,storage_path:'PRIVATE-FILE-PATH'},{request_id:rid,message_id:mid,file_name:'team.png',file_type:'image/png',file_size:100,storage_path:'TEAM-FILE-PATH'}]};
 db.auth.getUser=async()=>({data:{user:{id:pid}},error:null});
 db.from=table=>{let rows=[...(records[table]||[])],fields='*',limit=Infinity;const projected=()=>rows.slice(0,limit).map(row=>fields==='*'?row:Object.fromEntries(fields.split(',').filter(f=>f in row).map(f=>[f,row[f]])));const q={
  select(f='*'){fields=f;return this;},eq(f,v){rows=rows.filter(r=>r[f]===v);return this;},in(f,vs){rows=rows.filter(r=>vs.includes(r[f]));return this;},order(){return this;},limit(n){limit=n;return this;},or(){return this;},
  maybeSingle:async()=>({data:projected()[0]||null,error:null}),then(resolve,reject){return Promise.resolve({data:projected(),error:null}).then(resolve,reject);}};return q;};
 db.rpc=async(name,args)=>{calls.push({name,args});const creator=['CREATOR','STUDENT_CREATOR'].includes(role);
  if(name==='service_chat_scope')return{data:args.rid===rid&&ready?{id:rid,conversation_id:conv,creator,closed}:null,error:null};
  if(name==='service_chat_participants')return{data:[{id:pid,last_read_at:null}],error:null};
  if(name==='service_chat_resources')return{data:{members:[],files:[],total:0,page:args.resource_page,limit:10},error:null};
  if(name==='service_chat_conversations')return{data:{items:[],total:0,page:args.chat_page,limit:20},error:null};
  return{data:{message_id:mid,created:!duplicate},error:reject?{code:'P0001',message:'Workflow denies attachment/reply'}:null};};
 db.storage.from=bucket=>({upload:async(path)=>{uploads.push({bucket,path});return{data:{},error:null};},remove:async paths=>{removals.push(paths);return{data:{},error:null};},createSignedUrl:async(path,seconds)=>{signatures.push({bucket,path,seconds});return{data:{signedUrl:'https://example.invalid/signed'},error:null};}});
 try{await run({calls,uploads,removals,signatures});}finally{db.from=original.from;db.rpc=original.rpc;db.auth.getUser=original.auth;db.storage.from=original.storage;}
}
const send=(path,body)=>fetch(base+path,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
function fileForm(payload={audience:'TEAM',client_message_id:key},content='%PDF-1.7\nfixture',name='file.pdf',type='application/pdf'){const form=new FormData();form.set('payload',typeof payload==='string'?payload:JSON.stringify(payload));form.set('file',new Blob([content],{type}),name);return form;}
test('all service-chat endpoints require authentication',async()=>{assert.equal((await fetch(base+'/conversations')).status,401);assert.equal((await fetch(base+`/${rid}/messages`)).status,401);});
test('list binds the verified actor and rejects caller scope/actor and invalid pagination',async()=>fixture(async f=>{
 const response=await fetch(base+'/conversations?search=Staff&page=2',{headers});assert.equal(response.status,200);assert.deepEqual(f.calls[0],{name:'service_chat_conversations',args:{actor_id:pid,chat_page:2,chat_search:'Staff'}});
 for(const query of ['actor_id='+other,'scope=all','page=0','search='+'x'.repeat(151)])assert.equal((await fetch(base+'/conversations?'+query,{headers})).status,422);
}));
test('unrelated requests and not-yet-enabled Creator cannot read messages or sign files',async()=>{
 for(const options of [{},{role:'CREATOR',ready:false}])await fixture(async f=>{const id=options.ready===false?rid:other;assert.equal((await fetch(base+`/${id}/messages`,{headers})).status,404);assert.equal((await fetch(base+`/${id}/files/${mid}`,{headers})).status,404);assert.equal(f.signatures.length,0);},options);
});
test('Creator message history and replies exclude customer-staff commercial content and private paths',async()=>fixture(async()=>{
 const response=await fetch(base+`/${rid}/messages`,{headers});assert.equal(response.status,200);const {data}=await response.json();assert.deepEqual(data.messages.map(m=>m.id),[mid]);assert.equal(data.messages[0].file.file_name,'team.png');assert.equal(JSON.stringify(data).includes('Private commercial'),false);assert.equal(JSON.stringify(data).includes('storage_path'),false);
},{role:'CREATOR'}));
test('Customer receives a safe reply preview and scoped file metadata without storage paths',async()=>fixture(async()=>{
 const response=await fetch(base+`/${rid}/messages`,{headers});const {data}=await response.json();const reply=data.messages.find(m=>m.id===privateId);assert.equal(reply.reply.id,mid);assert.equal(reply.reply.content,'Visible team text');assert.equal(JSON.stringify(data).includes('PRIVATE-FILE-PATH'),false);
}));
test('file download verifies conversation, request and audience before issuing a short URL',async()=>fixture(async f=>{
 assert.equal((await fetch(base+`/${rid}/files/${privateId}`,{headers})).status,404);assert.equal(f.signatures.length,0);
 assert.equal((await fetch(base+`/${rid}/files/${mid}`,{headers})).status,200);assert.deepEqual(f.signatures,[{bucket:'project-files',path:'TEAM-FILE-PATH',seconds:180}]);
},{role:'CREATOR'}));
test('reply and idempotent text go through workflow; ownership and sender overposting is rejected',async()=>fixture(async f=>{
 assert.equal((await send(`/${rid}/message`,{content:'Reply',reply_to_id:mid,client_message_id:key})).status,200);
 assert.equal(f.calls.at(-1).args.actor_id,pid);assert.equal(f.calls.at(-1).args.payload.reply_to_id,mid);
 for(const extra of [{sender_id:other},{conversation_id:other},{attachments:['http://bad.invalid']},{reply_to_id:'bad'}])assert.equal((await send(`/${rid}/message`,{content:'Text',...extra})).status,422);
}));
test('Creator cannot choose a commercial audience',async()=>fixture(async f=>{
 assert.equal((await send(`/${rid}/message`,{content:'Private',audience:'CUSTOMER_STAFF'})).status,403);assert.equal(f.calls.some(c=>c.name==='request_action'),false);
},{role:'CREATOR'}));
test('spoofed PDF and malformed file metadata never upload',async()=>fixture(async f=>{
 assert.equal((await fetch(base+`/${rid}/files`,{method:'POST',headers,body:fileForm({},'<html>fake</html>')})).status,422);
 assert.equal((await fetch(base+`/${rid}/files`,{method:'POST',headers,body:fileForm('{invalid')})).status,422);assert.equal(f.uploads.length,0);
}));
test('closed conversation rejects file before storage and workflow rejection cleans upload',async()=>{
 await fixture(async f=>{assert.equal((await fetch(base+`/${rid}/files`,{method:'POST',headers,body:fileForm()})).status,409);assert.equal(f.uploads.length,0);},{closed:true});
 await fixture(async f=>{assert.equal((await fetch(base+`/${rid}/files`,{method:'POST',headers,body:fileForm()})).status,409);assert.deepEqual(f.removals,[[f.uploads[0].path]]);},{reject:true});
});
test('file retry carries hash and fixed client key and cleans redundant uploads',async()=>fixture(async f=>{
 const response=await fetch(base+`/${rid}/files`,{method:'POST',headers,body:fileForm({content:'Caption',audience:'TEAM',client_message_id:key,reply_to_id:mid})});assert.equal(response.status,200);const call=f.calls.find(c=>c.args.operation==='chat_file');assert.equal(call.args.payload.client_message_id,key);assert.match(call.args.payload.sha256,/^[a-f0-9]{64}$/);assert.equal(call.args.payload.content,'Caption');assert.equal(call.args.payload.reply_to_id,mid);assert.deepEqual(f.removals,[[f.uploads[0].path]]);
},{duplicate:true}));

test('right panel resources bind current actor and bounded page to the scoped request',async()=>fixture(async f=>{
 const response=await fetch(base+`/${rid}/resources?page=2`,{headers});assert.equal(response.status,200);assert.deepEqual(f.calls.at(-1),{name:'service_chat_resources',args:{actor_id:pid,rid,resource_page:2}});
 assert.equal((await fetch(base+`/${other}/resources`,{headers})).status,404);assert.equal((await fetch(base+`/${rid}/resources?page=0`,{headers})).status,422);
}));
