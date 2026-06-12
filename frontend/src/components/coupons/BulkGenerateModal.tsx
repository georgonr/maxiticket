'use client';

import { useState } from 'react';
import { getValidToken } from '@/lib/auth';
import { couponsAdminApi, BulkGenerateInput } from '@/lib/api/coupons';
import { Button } from '@/components/ui/button';
import { ModalShell, Field, inputCls } from './couponUi';
import { useCouponFields, FlatTicketType } from './useCouponFields';

export function BulkGenerateModal({
  showId,
  ticketTypes,
  defaultEmail,
  onClose,
  onGenerated,
}: {
  showId: string;
  ticketTypes: FlatTicketType[];
  defaultEmail: string;
  onClose: () => void;
  onGenerated: (msg: string) => void;
}) {
  const { node, buildBase } = useCouponFields({ showId, ticketTypes });
  const [count, setCount] = useState('10');
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');
    let payload: BulkGenerateInput;
    try {
      const base = buildBase();
      const n = Number(count);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        throw new Error('Počet kódov musí byť celé číslo 1–100.');
      }
      const mail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
        throw new Error('Zadajte platný e-mail pre doručenie PDF.');
      }
      payload = { ...base, count: n, sendToEmail: mail };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neplatné údaje.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('Vyžaduje sa prihlásenie.');
      const res = await couponsAdminApi.bulkGenerate(payload, token);
      onGenerated(`Vygenerovaných ${res.count} kódov, PDF poslané na ${res.sentTo}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generovanie kódov zlyhalo.');
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title="Generovať viac kódov"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Zrušiť
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
            Generovať
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Počet kódov" hint="1–100">
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="PDF poslať na" hint="e-mail">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        {node}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>
    </ModalShell>
  );
}
