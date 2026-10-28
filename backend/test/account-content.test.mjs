import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
process.env.NODE_ENV='test';
process.env.SUPABASE_URL='http://127.0.0.1:59999';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
const {app,apiLimiter}=await import('../dist/app.mjs');
const {db}=await import('../dist/db.js');
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}/api`;});
after(()=>new Promise(resolve=>server.close(resolve)));
const headers={Authorization:'Bearer fixture','Content-Type':'application/json'};
async function fixture(role,run,{active=true}={}) {
  apiLimiter.resetKey('127.0.0.1');
  const old={from:db.from,rpc:db.rpc,getUser:db.auth.getUser,storage:db.storage.from};const calls=[];
  db.auth.getUser=async()=>({data:{user:{id}},error:null});
  db.from=table=>{
    let rows=table==='profiles'?[{id,auth_user_id:id,role,active,full_name:'Fixture',email:'fixture@example.invalid'},{id:other,role:'CUSTOMER',active:true}]:table==='customers'?[{id:other,profile_id:id}]:[];
    return {select(){return this;},eq(field,value){rows=rows.filter(r=>r[field]===value);return this;},maybeSingle:async()=>({data:rows[0]??null,error:null})};
  };
  db.rpc=async(name,args)=>{calls.push({name,args});return {data:{id,items:[],total:0,summary:{total:0,active:0,inactive:0,by_role:[]}},error:null};};
  db.storage.from=bucket=>({upload:async(path)=>{calls.push({upload:true,bucket,path});return {data:{path},error:null};},getPublicUrl:path=>({data:{publicUrl:`https://example.invalid/${bucket}/${path}`}})});
  try {await run(calls);} finally {db.from=old.from;db.rpc=old.rpc;db.auth.getUser=old.getUser;db.storage.from=old.storage;}
}
const profile={slug:'real-creator',display_name:'Real Creator',title:'Photographer',content_confirmed:true};
const post=(path,body)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});
test('account directory and Creator creation are Admin-only, including suspended Admin',async()=>{
  for(const role of ['CUSTOMER','BUSINESS','STAFF','CREATOR','STUDENT_CREATOR']) await fixture(role,async calls=>{
    assert.equal((await fetch(base+'/admin/users',{headers})).status,403);
    assert.equal((await post('/admin/creators/profile',profile)).status,403);assert.equal(calls.length,0);
  });
  await fixture('ADMIN',async calls=>{assert.equal((await fetch(base+'/admin/users',{headers})).status,403);assert.equal(calls.length,0);},{active:false});
});
test('directory forwards literal search and validated filters with authenticated actor',async()=>fixture('ADMIN',async calls=>{
  assert.equal((await fetch(base+'/admin/users?page=2&search=mail%40example.invalid&role=STAFF&active=false',{headers})).status,200);
  assert.deepEqual(calls[0],{name:'admin_user_directory',args:{actor_id:id,filters:{page:2,search:'mail@example.invalid',role:'STAFF',active:'false'}}});
  for(const query of ['page=0','page=100001','role=ROOT','active=0','actor_id='+other,'search='+ 'x'.repeat(101)]) assert.equal((await fetch(base+'/admin/users?'+query,{headers})).status,422);
  assert.equal(calls.length,1);
}));
test('Admin creates real profile without fabricated metrics or privilege fields',async()=>fixture('ADMIN',async calls=>{
  for(const extra of [{content_confirmed:false},{rating:5},{completed_projects:99},{profile_id:other},{is_demo:false},{verified:true},{avatar_url:'javascript:alert(1)'}]) assert.equal((await post('/admin/creators/profile',{...profile,...extra})).status,422);
  assert.equal(calls.length,0);
  assert.equal((await post('/admin/creators/profile',profile)).status,201);
  assert.equal(calls[0].args.actor_id,id);assert.equal(calls[0].name,'admin_create_creator_profile');
}));
test('granting Creator through generic user editing cannot bypass company agreement onboarding',async()=>fixture('ADMIN',async calls=>{
  const r=await fetch(base+'/admin/users/'+other,{method:'PATCH',headers,body:JSON.stringify({role:'CREATOR',active:true})});
  assert.equal(r.status,422);assert.equal((await r.json()).error.code,'CREATOR_ONBOARDING_REQUIRED');assert.equal(calls.length,0);
}));
function imageBody(bytes,type='image/png',name='real.png') {const form=new FormData();form.append('file',new Blob([bytes],{type}),name);return form;}
const upload=form=>fetch(base+'/admin/media',{method:'POST',headers:{Authorization:headers.Authorization},body:form});
test('project images check Admin, signatures, size and persist only valid image uploads',async()=>{
  const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
  await fixture('CREATOR',async calls=>{assert.equal((await upload(imageBody(png))).status,403);assert.equal(calls.length,0);});
  await fixture('ADMIN',async calls=>{
    assert.equal((await upload(imageBody(Buffer.from('fake')))).status,422);
    assert.equal((await upload(imageBody(Buffer.from('%PDF-'),'application/pdf','work.pdf'))).status,422);
    const oversized=await upload(imageBody(Buffer.alloc(5*1024*1024+1)));
    assert.equal(oversized.status,422);assert.equal((await oversized.json()).error.code,'INVALID_UPLOAD');
    assert.equal(calls.length,0);
    const response=await upload(imageBody(png));assert.equal(response.status,200);assert.match((await response.json()).data.url,/\/portfolio\/.+\.png$/);assert.equal(calls.length,1);
  });
});
