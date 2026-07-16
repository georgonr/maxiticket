import { apiFetch } from '@/lib/api';

export type UserRole =
  | 'SUPERADMIN'
  | 'STAFF'
  | 'PLATFORM_ADMIN'
  | 'ACCOUNTANT'
  | 'ORGANIZER_OWNER'
  | 'ORGANIZER_MEMBER'
  | 'SCANNER'
  | 'CUSTOMER';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: UserRole;
  organizerId: string | null;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  organizerId?: string;
  locale?: 'sk' | 'en' | 'cs';
}

/**
 * Zrkadlo backendovej matice `backend/src/users/role-hierarchy.ts`.
 * ZDROJ PRAVDY JE BACKEND – toto je len UI kozmetika (filtrovanie ponuky).
 * Server autorizáciu vynúti nezávisle (krok B), aj keby UI ponúklo nemožné.
 */
export const CREATABLE_BY: Record<UserRole, UserRole[]> = {
  SUPERADMIN: ['PLATFORM_ADMIN', 'ACCOUNTANT', 'ORGANIZER_OWNER', 'CUSTOMER'],
  PLATFORM_ADMIN: ['ORGANIZER_OWNER', 'CUSTOMER'],
  STAFF: [],
  ACCOUNTANT: [],
  ORGANIZER_OWNER: [],
  ORGANIZER_MEMBER: [],
  SCANNER: [],
  CUSTOMER: [],
};

/** Role vyžadujúce organizerId (tenant-scoped). */
export const TENANT_ROLES: UserRole[] = ['ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'SCANNER'];

/** Smie `actor` vytvoriť rolu `target`? (mirror backendu) */
export function canCreate(actor: UserRole, target: UserRole): boolean {
  return CREATABLE_BY[actor]?.includes(target) ?? false;
}

/** Smie `actor` zasiahnuť do používateľa s aktuálnou rolou `targetCurrentRole`? (mirror backendu) */
export function canManageTarget(actor: UserRole, targetCurrentRole: UserRole): boolean {
  if (actor === 'SUPERADMIN') return true;
  return canCreate(actor, targetCurrentRole);
}

export const usersApi = {
  list: (token: string) => apiFetch<AdminUser[]>('/v1/users', { token }),

  create: (input: CreateUserInput, token: string) =>
    apiFetch<AdminUser>('/v1/users', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),

  setActive: (id: string, isActive: boolean, token: string) =>
    apiFetch<void>(`/v1/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
      token,
    }),

  remove: (id: string, token: string) =>
    apiFetch<void>(`/v1/users/${id}`, { method: 'DELETE', token }),
};
