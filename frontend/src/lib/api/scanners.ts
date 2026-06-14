import { apiFetch } from '@/lib/api';

export interface Scanner {
  id: string;
  email: string;
  firstName: string | null;
  isActive: boolean;
  organizerId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateScannerInput {
  email: string;
  password: string;
  name?: string;
  /** Len SUPERADMIN/STAFF – cieľový organizer. */
  organizerId?: string;
}

export const scannersApi = {
  list: (token: string, organizerId?: string) =>
    apiFetch<Scanner[]>(
      '/v1/organizer/scanners' + (organizerId ? `?organizerId=${encodeURIComponent(organizerId)}` : ''),
      { token },
    ),

  create: (input: CreateScannerInput, token: string) =>
    apiFetch<Scanner>('/v1/organizer/scanners', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),

  setActive: (id: string, isActive: boolean, token: string) =>
    apiFetch<Scanner>('/v1/organizer/scanners/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
      token,
    }),

  delete: (id: string, token: string) =>
    apiFetch<{ deleted: boolean }>('/v1/organizer/scanners/' + id, {
      method: 'DELETE',
      token,
    }),

  // Úloha 23: zmena hesla scanner účtu (mení sa len passwordHash).
  changePassword: (id: string, password: string, token: string) =>
    apiFetch<{ id: string; passwordChanged: boolean }>('/v1/organizer/scanners/' + id + '/password', {
      method: 'PATCH',
      body: JSON.stringify({ password }),
      token,
    }),
};
