'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Zrušenie CELÉHO podujatia.
 *  - mode="request"  → organizer žiada o zrušenie (jednoduché potvrdenie, SUPERADMIN dostane notifikáciu).
 *  - mode="execute"  → SUPERADMIN reálne zruší (type-to-confirm názvu + voliteľný dôvod, nezvratná akcia s refundom).
 * onConfirm dostane dôvod (len v execute režime).
 */
export function CancelShowModal({
  mode,
  showName,
  onClose,
  onConfirm,
}: {
  mode: 'request' | 'execute';
  showName: string;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}) {
  const t = useTranslations('organizer.showCancel');
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isExecute = mode === 'execute';
  const match = !isExecute || typed.trim() === showName.trim();

  async function handleConfirm() {
    if (!match || busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm(isExecute ? reason.trim() || undefined : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failed'));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="font-semibold text-red-700">{isExecute ? t('executeTitle') : t('requestTitle')}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              {t.rich(isExecute ? 'executeWarning' : 'requestWarning', {
                name: showName,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </span>
          </div>

          {isExecute && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('reasonLabel')}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('reasonPlaceholder')}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('confirmTypeLabel')} <span className="font-mono text-gray-900 dark:text-gray-100">{showName}</span>
                </label>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={showName}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            </>
          )}

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('back')}</Button>
          <button
            onClick={handleConfirm}
            disabled={!match || busy}
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t('working') : isExecute ? t('executeConfirm') : t('requestConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
