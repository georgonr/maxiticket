import { apiFetch } from '@/lib/api';

export type EkasaStatus = 'NONE' | 'PENDING' | 'REGISTERED' | 'OFFLINE' | 'FAILED';

/** eKasa zariadenie (super-admin); accessToken sa NEvracia – len hasAccessToken. */
export interface EkasaDevice {
  id: string;
  organizerId: string;
  label: string;
  cashRegisterCode: string;
  exposeUrl: string;
  hasAccessToken: boolean;
  printMode: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EkasaDeviceInput {
  organizerId?: string;
  label?: string;
  cashRegisterCode?: string;
  exposeUrl?: string;
  accessToken?: string; // prázdne pri update = token sa nemení
  printMode?: string;
  active?: boolean;
}

export const ekasaApi = {
  listDevices: (organizerId: string, token: string) =>
    apiFetch<EkasaDevice[]>(`/v1/admin/ekasa/devices?organizerId=${organizerId}`, { token }),

  createDevice: (body: EkasaDeviceInput, token: string) =>
    apiFetch<EkasaDevice>('/v1/admin/ekasa/devices', { method: 'POST', body: JSON.stringify(body), token }),

  updateDevice: (id: string, body: EkasaDeviceInput, token: string) =>
    apiFetch<EkasaDevice>(`/v1/admin/ekasa/devices/${id}`, { method: 'PATCH', body: JSON.stringify(body), token }),

  deleteDevice: (id: string, token: string) =>
    apiFetch<{ deleted: boolean }>(`/v1/admin/ekasa/devices/${id}`, { method: 'DELETE', token }),
};
