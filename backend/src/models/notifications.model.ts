// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read_at: string | null;
  created_at: string | null;
};
export type NotificationInsert = {
  id?: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read_at?: string | null;
  created_at?: string | null;
};
export type NotificationUpdate = Partial<NotificationInsert>;
