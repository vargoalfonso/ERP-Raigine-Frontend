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
  execute_date: string;
  full_name: string;
  role: string;
  email: string;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  token: string;
}
