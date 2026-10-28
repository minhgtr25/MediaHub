// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Testimonial = {
  id: string;
  review_id: string;
  content: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  published_at: string | null;
};
export type TestimonialInsert = {
  id?: string;
  review_id: string;
  content: string;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  published_at?: string | null;
};
export type TestimonialUpdate = Partial<TestimonialInsert>;
