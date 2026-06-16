'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { X } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { membersApi } from '@/lib/api/members';
import { Button } from '@/components/ui/button';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

export function InviteMemberModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (msg: string) => void;
}) {
  const locale = useLocale() as 'sk' | 'en' | 'cs';
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError('Zadajte platný e-mail.');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('Vyžaduje sa prihlásenie.');
      await membersApi.create({ email: mail, name: name.trim() || undefined, locale }, token);
      onInvited(`Pozvánka odoslaná na ${mail}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pozvánka zlyhala.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Pozvať člena tímu</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600" aria-label="Zavrieť">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">E-mail *</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kolega@example.sk" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">Meno</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Jana Nováková" className={inputCls} />
          </label>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Na e-mail pošleme pozvánku s odkazom na nastavenie hesla (platnosť 7 dní). Člen môže
            spravovať podujatia, pokladňu a skenovanie.
          </p>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Zrušiť</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>Odoslať pozvánku</Button>
        </div>
      </div>
    </div>
  );
}
