import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCreatorImport} from '../src/lib/creator-import.ts';
const header='creator_id,email,full_name,agreement_reference,signed_at';
test('Creator CSV accepts BOM, quoted names and references, and Vietnamese Excel separators',()=>{
 const row='id,email@example.invalid,"Nguyễn, An","Hợp tác ""A""",2026-10-01T00:00:00+07:00';
 const parsed=parseCreatorImport('\uFEFF'+header+'\r\n'+row+'\r\n');
 assert.equal(parsed[0].full_name,'Nguyễn, An');assert.equal(parsed[0].agreement_reference,'Hợp tác "A"');
 assert.equal(parseCreatorImport(header.replaceAll(',',';')+'\n'+'id;email@example.invalid;Nguyễn An;A;2026-10-01T00:00:00+07:00')[0].email,'email@example.invalid');
});
test('Creator CSV rejects ambiguous headers, broken quoting, missing values and excessive batches',()=>{
 for(const csv of [header+'\n"unterminated',header+'\nid,email,name,,date',header.replace('email','creator_id')+'\nid,email,name,ref,date',header+'\n"id"oops,email,name,ref,date',header+'\n'+Array.from({length:51},()=> 'id,email,name,ref,date').join('\n')])assert.throws(()=>parseCreatorImport(csv));
});
