export interface User {
  id: string;
  execute_date: string;
  nik: string;
  pid: string;
  name: string;
  band: string;
  title: string;
  email_address: string;
  employee_status: string;
  org: string;
  status: string;
  division: string;
  grp: string;
  direktorat: string;
  tgl_lahir: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginTokenData {
  access_token: string;
  expires_at?: string;
  token_type?: string;
}

export interface LoginStatusType {
  request_id?: string;
  status?: number | string;
  message?: string;
  data: LoginTokenData;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}
