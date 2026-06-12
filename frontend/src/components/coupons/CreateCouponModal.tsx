'use client';

import { useState } from 'react';
import { getValidToken } from '@/lib/auth';
import { couponsAdminApi, CreateCouponInput } from '@/lib/api/coupons';
import { Button } from '@/components/ui/button';
import { ModalShell, Field, inputCls } from './couponUi';
import { useCouponFields, FlatTicketType } from './useCouponFields';

export function CreateCouponModal({
  showId,
  ticketTypes,
  onClose,
  onCreated,
}: {
  showId: string;
  ticketTypes: FlatTicketType[];
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const { node, buildBase } = useCouponFields({ showId, ticketTypes });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');
    let payload: CreateCouponInput;
    try {
      payload = { ...buildBase() };
      const trimmed = code.trim().toUpperCase();
      if (trimmed) {
        if (trimmed.length < 4 || trimmed.length > 32) {
          throw new Error('Kód musí mať 4–32 znakov (alebo nechajte prázdne pre auto-generovanie).');
        }
        payload.code = trimmed;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neplatné údaje.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('Vyžaduje sa prihlásenie.');
      const created = await couponsAdminApi.create(payload, token);
      onCreated(`Kupón ${created.code} vytvorený.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vytvorenie kupónu zlyhalo.');
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title="Pridať kupón"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Zrušiť
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
            Vytvoriť
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Kód kupónu" hint="prázdne = auto-generovaný">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Auto-generovaný"
            className={inputCls + ' font-mono uppercase'}
            maxLength={32}
          />
        </Field>
        {node}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>
    </ModalShell>
  );
}
