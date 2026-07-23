import { apiFetch } from '@/lib/api';

export interface Member {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  pending: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateMemberInput {
  email: string;
  name?: string;
  // Krok 31e2: jazyk pozývajúceho pre lokalizovaný invite e-mail
  locale?: 'sk' | 'en' | 'cs';
}

export const membersApi = {
  list: (token: string) =>
    apiFetch<Member[]>('/v1/organizer/members', { token }),

  // emailSent=false → člen vytvorený, ale pozvánkový e-mail zlyhal (V4, krok 51).
  create: (input: CreateMemberInput, token: string) =>
    apiFetch<Member & { emailSent: boolean }>('/v1/organizer/members', {
      method: 'POST',
      body: JSON.stringify(input),
      token,
    }),

  setActive: (id: string, isActive: boolean, token: string) =>
    apiFetch<Member>('/v1/organizer/members/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
      token,
    }),

  resendInvite: (id: string, token: string, locale?: 'sk' | 'en' | 'cs') =>
    apiFetch<{ sent: boolean; email: string }>(
      `/v1/organizer/members/${id}/resend-invite${locale ? `?locale=${locale}` : ''}`,
      { method: 'POST', token },
    ),

  delete: (id: string, token: string) =>
    apiFetch<{ deleted: boolean }>('/v1/organizer/members/' + id, {
      method: 'DELETE',
      token,
    }),
};
