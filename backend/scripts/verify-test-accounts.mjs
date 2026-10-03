import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createClient } from "@supabase/supabase-js";
import { app } from "../dist/app.mjs";
import { env } from "../dist/config/database.js";
const manifest = JSON.parse(await fs.readFile(new URL("../../.qa/role-accounts.json", import.meta.url), "utf8"));
assert.equal(manifest.projectHost, new URL(env.SUPABASE_URL).host);
assert.equal(manifest.purpose, "mediahub-local-role-tests");
const login = createClient(env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}/api`;
const report = [];
try {
  for (const account of manifest.accounts) {
    const { data, error } = await login.auth.signInWithPassword({ email: account.email, password: account.password });
    if (error) throw new Error(`Login failed for ${account.role}.`);
    assert.equal(data.user?.id, account.authId);
    assert.equal(data.user?.user_metadata?.qa_purpose, manifest.purpose);
    const headers = { Authorization: `Bearer ${data.session.access_token}` };
    const me = await fetch(base + "/auth/me", { headers });
    assert.equal(me.status, 200);
    const identity = await me.json();
    assert.equal(identity.data.role, account.role);
    const commerce = ["CUSTOMER", "BUSINESS", "STAFF", "ADMIN"].includes(account.role);
    const customerOrAdmin = ["CUSTOMER", "BUSINESS", "ADMIN"].includes(account.role);
    const probes = [["/requests", commerce ? 200 : 403], ["/requests/summary", commerce ? 200 : 403], ["/requests?scope=queue", ["STAFF", "ADMIN"].includes(account.role) ? 200 : 403], ["/admin/service-packages", account.role === "ADMIN" ? 200 : 403], ["/projects", customerOrAdmin ? 200 : 403], ["/messages", 200], ["/orders", commerce ? 200 : 403]];
    // These identifiers are absent; verify new resource paths deny access without
    // creating a binding QA order/contract/payment in the configured database.
    const absentOrder = "00000000-0000-4000-8000-000000000000";
    probes.push([`/orders/${absentOrder}/contracts`, commerce ? 404 : 403], [`/orders/${absentOrder}/payments`, commerce ? 404 : 403]);
    probes.push([`/orders/${absentOrder}/production`, commerce ? 404 : 403]);
    probes.push(["/finance/report", ["STAFF", "ADMIN"].includes(account.role) ? 200 : 403], ["/finance/staff", account.role === "ADMIN" ? 200 : 403], [`/delivery/${absentOrder}`, 404]);
    probes.push([`/order-feedback/${absentOrder}`, commerce ? 404 : 403], ["/admin/case-studies", account.role === "ADMIN" ? 200 : 403]);
    probes.push(["/admin/leads?source=CREATOR_APPLICATION", account.role === "ADMIN" ? 200 : 403], [`/admin/leads/${absentOrder}/attachment`, account.role === "ADMIN" ? 404 : 403]);
    probes.push(['/creator/profile',['CREATOR','STUDENT_CREATOR'].includes(account.role)?[200,409]:403]);
    probes.push([`/execution/${absentOrder}`,404],[`/execution/${absentOrder}/candidates`,['STAFF','ADMIN'].includes(account.role)?404:403],['/execution/invitations',['CREATOR','STUDENT_CREATOR'].includes(account.role)?200:403]);
    probes.push([`/order-variations/${absentOrder}`,commerce?404:403],[`/order-variations/${absentOrder}/scope`,404]);
    probes.push(["/service-chat/conversations",200],[`/service-chat/${absentOrder}/messages`,404],[`/service-chat/${absentOrder}/resources`,404],[`/service-chat/${absentOrder}/files/${absentOrder}`,404]);
    probes.push(['/notifications?status=ALL',200],['/notifications?status=READ',200],['/notifications?status=UNREAD&search='+encodeURIComponent('quote%,"_'),200]);
    for (const [path, expected] of probes) {
      const response = await fetch(base + path, { headers });
      if(Array.isArray(expected))assert.ok(expected.includes(response.status),`${account.role} ${path}`);else assert.equal(response.status, expected, `${account.role} ${path}`);
      if(path==="/orders" && commerce){
       const rows=(await response.json()).data.items;
       if(rows[0]){
        const oid=rows[0].id;
        const variants=await fetch(base+`/order-variations/${oid}`,{headers});assert.equal(variants.status,200);
        const view=(await variants.json()).data;assert.equal(view.page,1);assert.ok(Number(view.total_amount)>=Number(view.base_total));
        for(const item of view.items){assert.equal(Object.hasOwn(item,"idempotency_key"),false);for(const quote of item.quotes)assert.equal(Object.hasOwn(quote,"idempotency_key"),false);}
        const scopes=await fetch(base+`/order-variations/${oid}/scope`,{headers});assert.equal(scopes.status,200);
        for(const item of (await scopes.json()).data.items)for(const field of ["amount","content_hash","quote_id","description","requested_by","idempotency_key"])assert.equal(Object.hasOwn(item,field),false);
       }
      }
      if(path==="/service-chat/conversations"){
       const list=(await response.json()).data;
       for(const item of list.items)for(const field of ["brief","customer_id","conversation_id","request_number","budget_min","budget_max"])assert.equal(Object.hasOwn(item,field),false);
       if(list.items[0]){
        const rid=list.items[0].id;
        const messages=await fetch(base+`/service-chat/${rid}/messages`,{headers});assert.equal(messages.status,200);
        const data=(await messages.json()).data;
        for(const item of data.messages){assert.equal(Object.hasOwn(item,"storage_path"),false);if(["CREATOR","STUDENT_CREATOR"].includes(account.role))assert.equal(item.audience,"TEAM");}
        const resources=await fetch(base+`/service-chat/${rid}/resources`,{headers});assert.equal(resources.status,200);
        for(const item of (await resources.json()).data.files)assert.equal(Object.hasOwn(item,"storage_path"),false);
       }
      }
    }
    report.push({ role: account.role, identityVerified: true, permissionProbes: probes.length });
    await login.auth.signOut({ scope: "local" });
  }
  const cases=await fetch(base+"/public/case-studies");assert.equal(cases.status,200);
  const publicCases=(await cases.json()).data;
  for(const item of publicCases.items)for(const field of ["order_id","customer_profile_id","image_path","approved_by"])assert.equal(Object.hasOwn(item,field),false);
  const company=await fetch(base+"/public/company-portfolio?limit=6");assert.equal(company.status,200);
  const companyData=(await company.json()).data;
  for(const item of companyData.items){
   for(const field of ["order_id","customer_profile_id","image_path","approved_by","request_id"])assert.equal(Object.hasOwn(item,field),false);
   const detail=await fetch(base+(item.kind==="EXCERPT"?"/public/company-portfolio/case/"+item.public_id:"/public/portfolio/"+item.href.split("/").pop()));assert.equal(detail.status,200);
   if(item.kind==="EXCERPT")assert.equal(detail.headers.get("cache-control"),"no-store");
  }
  assert.equal((await fetch(base+"/public/company-portfolio/case/00000000-0000-4000-8000-000000000000")).status,404);
  const home=await fetch(base+"/public/home");assert.equal(home.status,200);
  assert.equal((await home.json()).data.stats.projects,companyData.total);
  const discovery=await fetch(base+"/public/creators?limit=1");assert.equal(discovery.status,200);
  const list=(await discovery.json()).data;
  const first=list.items[0];
  for(const item of list.items)for(const field of ['profile_id','social_links','response_time','response_rate','completion_rate','idempotency_key'])assert.equal(Object.hasOwn(item,field),false);
  assert.equal((await fetch(base+'/public/creators?page=100001')).status,422);
  assert.equal((await fetch(base+'/public/creators/does-not-exist-qa')).status,404);
  const skillSearch=await fetch(base+'/public/creators?search='+encodeURIComponent('Resolve,()%_'));
  assert.equal(skillSearch.status,200);
  if(first){const detail=await fetch(base+'/public/creators/'+first.slug);assert.equal(detail.status,200);const profile=(await detail.json()).data;for(const field of ['profile_id','social_links','response_time','response_rate','completion_rate'])assert.equal(Object.hasOwn(profile,field),false);for(const item of profile.creator_portfolio)for(const field of ['creator_id','idempotency_key'])assert.equal(Object.hasOwn(item,field),false);}

  if(first){
   const reviews=await fetch(base+"/public/creator-reviews/"+first.slug);assert.equal(reviews.status,200);
   const verified=(await reviews.json()).data;assert.equal(Number(first.review_count),Number(verified.total));assert.equal(first.rating,verified.rating);
   for(const item of verified.items)for(const field of ["order_id","customer_profile_id","order_sort_id"])assert.equal(Object.hasOwn(item,field),false);
  }
  await fs.writeFile(new URL("../../.qa/role-verification.json", import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), readOnly: true, accounts: report }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ verifiedAccounts: report.length, permissionProbes: report.reduce((n, r) => n + r.permissionProbes, 0), readOnly: true }));
} finally { await new Promise(resolve => server.close(resolve)); }
