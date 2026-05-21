import { JwtPayload } from "jwt-decode";

export type ApiResponse<T> = {
  message: string;
  status: string;
  data: T;
  pagination?: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
};

export type DataArray<T> = T[];

export type DataObject<T> = T;

export interface PayloadToken extends JwtPayload {
  id: string;
  userId: string;
  username?: string;
  user_name?: string;
  preferred_username?: string;
  uid?: string;
  // `sub` is provided by JwtPayload but include here for clarity
  sub?: string;
  name?: string;
  execute_date: string;
  full_name: string;
  // token may include a single role or an array of roles
  role?: string;
  roles?: string[];
  email: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  token: string;
}
