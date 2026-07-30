export type UserRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'FRONT_DESK'
  | 'HOUSEKEEPING'
  | 'MAINTENANCE'
  | 'ACCOUNTS'
  | 'READ_ONLY';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export type PlatformUser = {
  id: string;
  propertyId: string | null;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserFilters = {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
};

export type UpdateUserPayload = Partial<{
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  password: string;
}>;
