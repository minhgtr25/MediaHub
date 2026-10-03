import {test} from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';
process.env.NODE_ENV='test';process.env.SUPABASE_URL='http://127.0.0.1:59999';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only';
const {app,apiLimiter}=await import('../dist/app.mjs');const {db}=await import('../dist/db.js');
test('notifications: owner scope, read filters, literal search, read-all and overposting',async()=>{
 apiLimiter.resetKey('127.0.0.1');const original={from:db.from,auth:db.auth.getUser};const actor='11111111-1111-4111-8111-111111111111';
 const rows=[{id:'a',user_id:actor,read_at:null},{id:'b',user_id:actor,read_at:'old'},{id:'c',user_id:'other',read_at:null}];let filter='';
 db.auth.getUser=async()=>({data:{user:{id:actor}},error:null});
 db.from=table=>{let selected=table==='customers'?[{id:actor,profile_id:actor}]:table==='profiles'?[{id:actor,auth_user_id:actor,role:'CUSTOMER',active:true}]:rows.slice(),update;return {select(){return this;},eq(k,v){selected=selected.filter(x=>x[k]===v);return this;},is(k,v){selected=selected.filter(x=>x[k]===v);return this;},not(k,op,v){selected=selected.filter(x=>x[k]!==v);return this;},order(){return this;},or(v){filter=v;return this;},update(v){update=v;return this;},maybeSingle:async()=>({data:selected[0],error:null}),range:async(a,b)=>({data:selected.slice(a,b+1),count:selected.length,error:null}),then(resolve,reject){if(update)selected.forEach(x=>Object.assign(x,update));return Promise.resolve({data:selected,error:null}).then(resolve,reject);}};};
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/notifications`,headers={Authorization:'Bearer test-only','Content-Type':'application/json'};
 try{
 for(const [status,total] of [['ALL',2],['UNREAD',1],['READ',1]]){const r=await fetch(base+'?status='+status,{headers});assert.equal(r.status,200);const {data}=await r.json();assert.equal(data.total,total);assert.ok(data.items.every(n=>n.user_id===actor));}
 assert.equal((await fetch(base+'?status=INVALID',{headers})).status,422);assert.equal((await fetch(base+'?page=0',{headers})).status,422);
 assert.equal((await fetch(base+'?search='+encodeURIComponent('a%,x"_'),{headers})).status,200);assert.ok(filter.startsWith('title.ilike."'));assert.ok(filter.includes(',message.ilike."'));assert.ok(filter.includes('\\\\%'));assert.ok(filter.includes('\\"'));
 assert.equal((await fetch(base+'/read-all',{method:'PATCH',headers,body:'{"user_id":"other"}'})).status,422);
 assert.equal((await fetch(base+'/read-all',{method:'PATCH',headers,body:'{}'})).status,200);assert.ok(rows[0].read_at);assert.equal(rows[1].read_at,'old');assert.equal(rows[2].read_at,null);
 assert.equal((await fetch(base+'/read-all',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 }finally{db.from=original.from;db.auth.getUser=original.auth;await new Promise(r=>server.close(r));}
});
