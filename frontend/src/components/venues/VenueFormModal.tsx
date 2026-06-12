'use client';

import { useState } from 'react';
import { X, Globe } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { venuesApi, Venue, CreateVenueBody } from '@/lib/api';
import { Button } from '@/components/ui/button';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export function VenueFormModal({
  initial,
  isSuperAdmin = false,
  onClose,
  onSaved,
}: {
  initial?: Venue;
  isSuperAdmin?: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [street, setStreet] = useState(initial?.street ?? '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? '');
  const [capacity, setCapacity] = useState(initial?.capacity != null ? String(initial.capacity) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  // Super: pri vytváraní na tejto stránke defaultne globálne miesto.
  const [global, setGlobal] = useState(isSuperAdmin && !isEdit);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');
    if (name.trim().length < 2) {
      setError('Názov miesta musí mať aspoň 2 znaky.');
      return;
    }
    const body: CreateVenueBody = {
      name: name.trim(),
      city: city.trim() || undefined,
      street: street.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    const cap = capacity.trim();
    if (cap) {
      const n = Number(cap);
      if (!Number.isInteger(n) || n < 0) {
        setError('Kapacita musí byť nezáporné celé číslo.');
        return;
      }
      body.capacity = n;
    }

    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('Vyžaduje sa prihlásenie.');
      if (isEdit) {
        await venuesApi.update(initial!.id, body, token);
        onSaved(`Miesto ${body.name} uložené.`);
      } else {
        await venuesApi.create(body, token, isSuperAdmin ? { global } : {});
        onSaved(`Miesto ${body.name} vytvorené.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Upraviť miesto' : 'Pridať miesto'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Zavrieť">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <Field label="Názov *">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Mestská hala" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mesto">
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </Field>
            <Field label="PSČ">
              <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Adresa">
            <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Ulica a číslo" className={inputCls} />
          </Field>
          <Field label="Kapacita">
            <input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="napr. 500" className={inputCls} />
          </Field>
          <Field label="Poznámka">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </Field>

          {isSuperAdmin && !isEdit && (
            <label className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-800">
              <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} className="accent-purple-600" />
              <Globe size={14} /> Globálne miesto (zdieľané všetkým organizátorom)
            </label>
          )}

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Zrušiť</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
            {isEdit ? 'Uložiť' : 'Vytvoriť'}
          </Button>
        </div>
      </div>
    </div>
  );
}
