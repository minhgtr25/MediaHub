// Base-schema types from 001_mediahub.sql; supplemental mappings live in platform.types.ts.
export type Employee = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  skills: string[] | null;
  status: "ACTIVE" | "INACTIVE" | null;
  joined_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};
export type EmployeeInsert = {
  id?: string;
  name: string;
  email: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  skills?: string[] | null;
  status?: "ACTIVE" | "INACTIVE" | null;
  joined_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type EmployeeUpdate = Partial<EmployeeInsert>;
