import { z } from 'zod';
import { uuid } from './validators.js';
export const publicationPreference = z.object({show_name:z.boolean(),notice_version:z.literal('EXCERPT_V1')}).strict();
export const completedOrderReview = publicationPreference.extend({
 rating:z.number().int().min(1).max(5),content:z.string().trim().min(1).max(3000),
 creators:z.array(z.object({creator_id:uuid,rating:z.number().int().min(1).max(5),content:z.string().trim().min(1).max(2000)}).strict()).min(1).max(100)
 .refine(v=>new Set(v.map(x=>x.creator_id)).size===v.length,'Không đánh giá lặp Creator.'),
}).strict();
export const publishCaseStudy = z.object({title:z.string().trim().min(1).max(150),excerpt:z.string().trim().min(1).max(1000),
 image_path:z.string().max(200),excerpt_checked:z.literal(true),identity_checked:z.literal(true)}).strict();
