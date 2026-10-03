import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canReplyTo,messageTextParts} from '../src/lib/service-chat.ts';
test('commercial reply stays private and cannot be shared with the team or Creator',()=>{
 assert.equal(canReplyTo('CUSTOMER_STAFF','TEAM'),false);assert.equal(canReplyTo('CUSTOMER_STAFF','CUSTOMER_STAFF'),true);
 assert.equal(canReplyTo('CUSTOMER_STAFF','CUSTOMER_STAFF',true),false);assert.equal(canReplyTo('TEAM','TEAM',true),true);
});
test('message links preserve literal text and never turn script URLs or credential URLs into links',()=>{
 const input='Xem https://example.invalid/work\n<script>alert(1)</script> javascript:alert(1) https://secret:password@example.invalid/work';
 const parts=messageTextParts(input);assert.equal(parts.map(p=>p.text).join(''),input);
 assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href),['https://example.invalid/work']);
});
