import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicationPreference,completedOrderReview,publishCaseStudy} from '../dist/order-feedback-validators.js';
const creator='11111111-1111-4111-8111-111111111111';
const valid={show_name:false,notice_version:'EXCERPT_V1',rating:4,content:'Kết quả tốt',creators:[{creator_id:creator,rating:5,content:'Phối hợp tốt'}]};
test('reviews validate real integer scores and require every submitted Creator to be distinct',()=>{
 assert.equal(completedOrderReview.safeParse(valid).success,true);
 for(const change of [{rating:0},{rating:6},{rating:4.5},{rating:'5'},{content:' '},{creators:[]},{creators:[valid.creators[0],valid.creators[0]]}])assert.equal(completedOrderReview.safeParse({...valid,...change}).success,false);
});
test('customer cannot supply authors, initial timestamps, or completion state',()=>{
 for(const change of [{customer_profile_id:creator},{submitted_at:'2026-10-03'},{status:'COMPLETED'},{order_id:creator}])assert.equal(completedOrderReview.safeParse({...valid,...change}).success,false);
 assert.equal(publicationPreference.safeParse({show_name:'false',notice_version:'EXCERPT_V1'}).success,false);
 assert.equal(publicationPreference.safeParse({show_name:false,notice_version:'UNKNOWN'}).success,false);
});
test('publication requires both excerpt and identity checks with bounded public content',()=>{
 const body={title:'Một trích đoạn',excerpt:'Nội dung ngắn',image_path:`${creator}/excerpt.png`,excerpt_checked:true,identity_checked:true};
 assert.equal(publishCaseStudy.safeParse(body).success,true);
 for(const change of [{identity_checked:false},{excerpt_checked:false},{excerpt:'x'.repeat(1001)},{final_file_url:'private'},{published:true}])assert.equal(publishCaseStudy.safeParse({...body,...change}).success,false);
});
