export type CreatorOption = { id: string; name: string; slug: string };

export type PublicCreator = {
  id: string;
  slug: string;
  display_name: string;
  title: string;
  avatar_url?: string;
  location: string;
  rating?: number | null;
  review_count: number;
  completed_projects: number;
  verified: boolean;
  featured: boolean;
  availability: string;
  creator_skills: { skills: CreatorOption }[];
  creator_portfolio: { id: string; title: string; thumbnail_url?: string }[];
};

export type PublicCreatorDetail = Omit<PublicCreator, "creator_portfolio"> & {
  bio: string;
  cover_url?: string;
  university?: string;
  major?: string;
  experience_level: string;
  tools: string[];
  languages: string[];
  price_from?: number;
  creator_categories: { categories: CreatorOption }[];
  creator_portfolio: {
    id: string;
    title: string;
    description: string;
    thumbnail_url?: string;
    gallery: string[];
    video_url?: string;
    category: string;
    client: string;
    project_year?: number;
    project_url?: string;
    featured: boolean;
  }[];
};

export type CreatorCollection<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};
