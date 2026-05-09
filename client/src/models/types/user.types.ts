export type UserRole = 'player' | 'admin';

export interface User {
  id: string;
  tenantId: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface UserRow {
  id: string;
  tenant_id: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}
