'use client';

import { useState } from 'react';
import { X, Grid3x3, Square } from 'lucide-react';
import { clsx } from 'clsx';
import { getValidToken } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import {
  seatmapsApi,
  Section,
  SectionMode,
  RowLabelStyle,
  CreateSectionBody,
  SECTION_COLORS,
} from '@/lib/api/seatmaps';
import { Button } from '@/components/ui/button';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
      {children}
    </label>
  );
}

function readableError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return 'Nemáte oprávnenie upravovať tento plánik.';
    if (e.status >= 500) return 'Chyba servera. Skúste neskôr.';
    return e.message || 'Niečo sa pokazilo.';
  }
  return 'Nemôžeme sa pripojiť k serveru.';
}

export function SectionFormModal({
  seatMapId,
  initial,
  onClose,
  onSaved,
}: {
  seatMapId: string;
  initial?: Section; // ak je zadané → edit (mód immutable)
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = !!initial;
  const [mode, setMode] = useState<SectionMode>(initial?.mode ?? 'SECTIONED');
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<string>(initial?.color ?? SECTION_COLORS[0]);
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : '',
  );
  // generátor (len SEATED, len pri create)
  const [rowCount, setRowCount] = useState('5');
  const [seatsPerRow, setSeatsPerRow] = useState('10');
  const [rowLabelStyle, setRowLabelStyle] = useState<RowLabelStyle>('ALPHA');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');
    if (name.trim().length < 1) {
      setError('Zadajte názov sekcie.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');

      if (isEdit) {
        // mód immutable; meníme názov, farbu a (SECTIONED) kapacitu
        const body: { name: string; color: string; capacity?: number } = {
          name: name.trim(),
          color,
        };
        if (initial!.mode === 'SECTIONED') {
          const n = Number(capacity);
          if (!Number.isInteger(n) || n < 0) {
            setError('Kapacita musí byť nezáporné celé číslo.');
            setSubmitting(false);
            return;
          }
          body.capacity = n;
        }
        await seatmapsApi.patchSection(initial!.id, body, token);
        onSaved(`Sekcia „${body.name}" upravená.`);
      } else {
        const body: CreateSectionBody = { name: name.trim(), mode, color };
        if (mode === 'SECTIONED') {
          const n = Number(capacity);
          if (!Number.isInteger(n) || n < 0) {
            setError('Kapacita musí byť nezáporné celé číslo.');
            setSubmitting(false);
            return;
          }
          body.capacity = n;
        } else {
          const rc = Number(rowCount);
          const spr = Number(seatsPerRow);
          if (!Number.isInteger(rc) || rc < 1 || rc > 200) {
            setError('Počet radov: 1–200.');
            setSubmitting(false);
            return;
          }
          if (!Number.isInteger(spr) || spr < 1 || spr > 500) {
            setError('Sedadiel v rade: 1–500.');
            setSubmitting(false);
            return;
          }
          body.generate = { rowCount: rc, seatsPerRow: spr, rowLabelStyle };
        }
        const res = await seatmapsApi.createSection(seatMapId, body, token);
        onSaved(
          mode === 'SEATED'
            ? `Sekcia „${res.name}" vytvorená (${res.rowCount} radov × ${res.seatCount / Math.max(res.rowCount, 1)} = ${res.seatCount} sedadiel).`
            : `Sekcia „${res.name}" vytvorená.`,
        );
      }
    } catch (e) {
      setError(readableError(e));
      setSubmitting(false);
    }
  }

  const ModeBtn = ({ m, icon, label, hint }: { m: SectionMode; icon: React.ReactNode; label: string; hint: string }) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={clsx(
        'flex flex-1 flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors',
        mode === m
          ? 'border-brand bg-brand/5'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{icon}{label}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{isEdit ? 'Upraviť sekciu' : 'Pridať sekciu'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600" aria-label="Zavrieť">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!isEdit && (
            <div className="flex gap-2">
              <ModeBtn m="SECTIONED" icon={<Square size={14} />} label="Kapacitná" hint="Len číslo (státie, voľné)" />
              <ModeBtn m="SEATED" icon={<Grid3x3 size={14} />} label="Sedadlová" hint="Menované sedadlá v radoch" />
            </div>
          )}
          {isEdit && (
            <p className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              Mód: <strong>{initial!.mode === 'SECTIONED' ? 'Kapacitná' : 'Sedadlová'}</strong> — mód sa nedá zmeniť (zmena = zmazať a vytvoriť sekciu).
            </p>
          )}

          <Field label="Názov sekcie *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Parter, Balkón, VIP, Státie" className={inputCls} />
          </Field>

          <Field label="Farba">
            <div className="flex flex-wrap items-center gap-2">
              {SECTION_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={clsx('h-7 w-7 rounded-full border-2 transition-transform', color === c ? 'scale-110 border-gray-900 dark:border-white' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-gray-300 dark:border-gray-700 bg-transparent" aria-label="Vlastná farba" />
            </div>
          </Field>

          {(isEdit ? initial!.mode === 'SECTIONED' : mode === 'SECTIONED') && (
            <Field label="Kapacita *">
              <input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="napr. 200" className={inputCls} />
            </Field>
          )}

          {!isEdit && mode === 'SEATED' && (
            <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Generátor sedadiel</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Počet radov">
                  <input type="number" min={1} max={200} value={rowCount} onChange={(e) => setRowCount(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Sedadiel v rade">
                  <input type="number" min={1} max={500} value={seatsPerRow} onChange={(e) => setSeatsPerRow(e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Označenie radov">
                <select value={rowLabelStyle} onChange={(e) => setRowLabelStyle(e.target.value as RowLabelStyle)} className={inputCls}>
                  <option value="ALPHA">Písmená (A, B, C…)</option>
                  <option value="NUMERIC">Čísla (1, 2, 3…)</option>
                </select>
              </Field>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Vytvorí {Number(rowCount) || 0} × {Number(seatsPerRow) || 0} = <strong>{(Number(rowCount) || 0) * (Number(seatsPerRow) || 0)}</strong> sedadiel (napr. {rowLabelStyle === 'ALPHA' ? 'A1' : '1-1'}).
              </p>
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Zrušiť</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>{isEdit ? 'Uložiť' : 'Vytvoriť'}</Button>
        </div>
      </div>
    </div>
  );
}
