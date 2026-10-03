import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
process.env.NODE_ENV='test';
process.env.SUPABASE_URL='http://127.0.0.1:59999';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-not-a-real-key';
const {app,apiLimiter}=await import('../dist/app.mjs');
const {db}=await import('../dist/db.js');
const id='11111111-1111-4111-8111-111111111111';
let server,base;
before(async()=>{server=app.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}/api/public`;});
after(()=>new Promise(resolve=>server.close(resolve)));
const excerpt={public_id:id,kind:'EXCERPT',title:'Approved excerpt',description:'Small part',customer_name:'Khách hàng ẩn danh',category:null,year:null,updated_at:'2026-10-03T00:00:00Z',image_path:'PRIVATE-ORDER/path.png',order_id:'PRIVATE-ORDER',customer_profile_id:'PRIVATE-CUSTOMER',approved_by:'PRIVATE-ADMIN',total:999,contract:'PRIVATE-CONTRACT'};
const legacy={public_id:'public-legacy-id',kind:'PORTFOLIO',slug:'published-company-work',title:'Company work',image_url:'https://example.invalid/public.jpg',customer_name:'Public client',description:'Published summary',category:'Video',year:2025};
async function fixture(run,{missing=false,fail=false,signFail=false}={}){
 apiLimiter.resetKey('127.0.0.1');
 const original={rpc:db.rpc,storage:db.storage.from};const calls=[],signatures=[];
 db.rpc=async(name,args)=>{calls.push({name,args});return {data:missing?null:name==='public_company_excerpt'?excerpt:{items:[excerpt,legacy],total:2},error:fail?{code:'FIXTURE_DATABASE_FAILURE',message:'Database unavailable'}:null};};
 db.storage.from=bucket=>({createSignedUrl:async(path,seconds)=>{signatures.push({bucket,path,seconds});return{data:signFail?null:{signedUrl:'https://example.invalid/excerpt-signed'},error:signFail?{code:'FIXTURE_STORAGE_FAILURE',message:'Cannot sign image'}:null};}});
 try{await run({calls,signatures});}finally{db.rpc=original.rpc;db.storage.from=original.storage;}
}
test('one filtered page signs only excerpts and strips all private database properties',async()=>fixture(async f=>{
 const response=await fetch(base+'/company-portfolio?page=2&limit=6&search=Campaign%20%25&category=Video&kind=ALL');assert.equal(response.status,200);
 const {data}=await response.json();assert.equal(data.total,2);assert.equal(data.page,2);assert.equal(data.items[0].href,`/projects/case/${id}`);assert.equal(data.items[1].href,'/projects/published-company-work');assert.equal(data.items[1].image_url,legacy.image_url);
 assert.deepEqual(f.calls,[{name:'public_company_portfolio',args:{portfolio_page:2,portfolio_limit:6,portfolio_search:'Campaign %',portfolio_category:'Video',portfolio_kind:'ALL'}}]);
 assert.deepEqual(f.signatures,[{bucket:'case-study-excerpts',path:excerpt.image_path,seconds:180}]);
 const serialized=JSON.stringify(data);for(const privateValue of ['PRIVATE-ORDER','PRIVATE-CUSTOMER','PRIVATE-ADMIN','PRIVATE-CONTRACT','image_path','order_id','approved_by','customer_profile_id'])assert.equal(serialized.includes(privateValue),false);
}));
test('invalid or oversized filters fail before any database or storage call',async()=>fixture(async f=>{
 for(const suffix of ['page=0','page=100001','limit=13','kind=ADMIN','page=1&page=2','search='+ 'x'.repeat(101),'unknown=true'])assert.equal((await fetch(base+'/company-portfolio?'+suffix)).status,422,suffix);
 assert.equal(f.calls.length,0);assert.equal(f.signatures.length,0);
}));
test('excerpt detail uses its separate public identity and never caches revoked content',async()=>fixture(async f=>{
 const response=await fetch(base+'/company-portfolio/case/'+id);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(f.calls,[{name:'public_company_excerpt',args:{excerpt_public_id:id}}]);
 const body=await response.json();assert.equal(body.data.customer_name,'Khách hàng ẩn danh');assert.equal(JSON.stringify(body).includes('PRIVATE-'),false);
}));
test('withdrawn, private or unknown excerpt is 404 and cannot obtain an image signature',async()=>fixture(async f=>{
 const response=await fetch(base+'/company-portfolio/case/'+id);assert.equal(response.status,404);assert.equal(f.signatures.length,0);
},{missing:true}));
test('malformed public identity is rejected without a database request',async()=>fixture(async f=>{
 assert.equal((await fetch(base+'/company-portfolio/case/private-order')).status,422);assert.equal(f.calls.length,0);
}));
test('database and image failures remain errors instead of a misleading empty portfolio',async()=>{
 for(const config of [{fail:true},{signFail:true}])await fixture(async()=>{const response=await fetch(base+'/company-portfolio');assert.equal(response.status,500);assert.equal((await response.json()).success,false);},config);
});
