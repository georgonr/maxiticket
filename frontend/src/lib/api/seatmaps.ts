import { apiFetch } from '@/lib/api';

// ── Typy (zhodné s backend nested shape, úloha 22 fáza 1) ──
export type SectionMode = 'SECTIONED' | 'SEATED';
export type RowLabelStyle = 'ALPHA' | 'NUMERIC';

export interface Seat {
  id: string;
  rowId: string;
  label: string;
  x?: number | null;
  y?: number | null;
  isAccessible: boolean;
}

export interface Row {
  id: string;
  sectionId: string;
  label: string;
  displayOrder: number;
  seats: Seat[];
}

export interface Section {
  id: string;
  seatMapId: string;
  name: string;
  mode: SectionMode;
  capacity: number | null;
  displayOrder: number;
  color: string | null;
  rows: Row[];
}

/** GET /v1/seatmaps/:id – plná mapa + súhrn. */
export interface SeatMapFull {
  id: string;
  venueId: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sections: Section[];
  totalCapacity: number;
}

/** GET /v1/venues/:venueId/seatmaps – položka zoznamu (súhrn). */
export interface SeatMapSummary {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  sectionCount: number;
  totalCapacity: number;
}

export interface GenerateSeats {
  rowCount: number;
  seatsPerRow: number;
  rowLabelStyle: RowLabelStyle;
  seatStartNumber?: number;
}

export interface CreateSectionBody {
  name: string;
  mode: SectionMode;
  capacity?: number;
  displayOrder?: number;
  color?: string;
  generate?: GenerateSeats;
}

export interface CreateSectionResult extends Omit<Section, 'rows'> {
  rowCount: number;
  seatCount: number;
  sampleSeatLabels: string[];
}

export interface UpdateSectionBody {
  name?: string;
  capacity?: number;
  displayOrder?: number;
  color?: string;
}

// ── API ────────────────────────────────────────────────────
export const seatmapsApi = {
  // mapy
  list: (venueId: string, token: string) =>
    apiFetch<SeatMapSummary[]>(`/v1/venues/${venueId}/seatmaps`, { token }),

  get: (id: string, token: string) =>
    apiFetch<SeatMapFull>(`/v1/seatmaps/${id}`, { token }),

  create: (venueId: string, body: { name: string; isDefault?: boolean }, token: string) =>
    apiFetch<SeatMapFull>(`/v1/venues/${venueId}/seatmaps`, {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    }),

  patch: (
    id: string,
    body: { name?: string; isDefault?: boolean; isActive?: boolean },
    token: string,
  ) =>
    apiFetch<SeatMapFull>(`/v1/seatmaps/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    }),

  remove: (id: string, token: string) =>
    apiFetch<{ deleted: boolean }>(`/v1/seatmaps/${id}`, { method: 'DELETE', token }),

  // sekcie
  createSection: (seatMapId: string, body: CreateSectionBody, token: string) =>
    apiFetch<CreateSectionResult>(`/v1/seatmaps/${seatMapId}/sections`, {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    }),

  patchSection: (id: string, body: UpdateSectionBody, token: string) =>
    apiFetch<Section>(`/v1/sections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    }),

  deleteSection: (id: string, token: string) =>
    apiFetch<{ deleted: boolean }>(`/v1/sections/${id}`, { method: 'DELETE', token }),
};

// ── Pomocníci ──────────────────────────────────────────────
/** Súčet kapacity sekcie: SECTIONED → capacity; SEATED → počet sedadiel. */
export function sectionCapacity(s: Section): number {
  if (s.mode === 'SECTIONED') return s.capacity ?? 0;
  return s.rows.reduce((sum, r) => sum + r.seats.length, 0);
}

/** Predvolené farby sekcií (light/dark čitateľné). */
export const SECTION_COLORS = [
  '#7C3AED', // purple
  '#E11D48', // rose
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F59E0B', // amber
  '#6366F1', // indigo
  '#EC4899', // pink
  '#64748B', // slate
];
