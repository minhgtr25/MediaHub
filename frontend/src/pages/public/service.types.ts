export type Service = {
  features: string[];
  deliverables: string[];
  seo_title: string;
  seo_description: string;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  starting_price: number | null;
  price_max: number | null;
  estimated_days: number | null;
  thumbnail_url: string | null;
};
export type Collection<T> = { items: T[]; total: number };
