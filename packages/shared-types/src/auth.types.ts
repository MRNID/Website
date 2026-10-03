export type RoleName = 
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'WAREHOUSE_MANAGER'
  | 'PACKING_USER'
  | 'CUSTOMER_SERVICE'
  | 'VIEWER';

export interface UserProfile {
  id: string;
  businessId: string;
  warehouseId: string | null;
  username: string;
  fullName: string;
  email: string;
  role: RoleName;
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: UserProfile;
  tokens: AuthTokens;
}

export interface JwtTokenPayload {
  sub: string;
  username: string;
  businessId: string;
  warehouseId: string | null;
  role: RoleName;
  iat?: number;
  exp?: number;
}
