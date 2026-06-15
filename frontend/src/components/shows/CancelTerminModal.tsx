'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Krok 27: potvrdenie zrušenia termínu – vyžaduje prepísať názov podujatia (nezvratná akcia).
export function CancelTerminModal({
  showName,
  terminLabel,
  onClose,
  onConfirm,
}: {
  showName: string;
  terminLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const match = typed.trim() === showName.trim();

  async function handleConfirm() {
    if (!match || busy) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zrušenie zlyhalo.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="font-semibold text-red-700">Zrušiť termín</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Zavrieť">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>
              <strong>Nezvratná akcia.</strong> Termín <strong>{terminLabel}</strong> bude zrušený,
              všetky lístky zneplatnené a kupujúci dostanú e-mail. Zaplatené objednávky sa označia
              na manuálne vrátenie peňazí (Stripe Dashboard / POS hotovosť).
            </span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Pre potvrdenie napíšte názov podujatia: <span className="font-mono text-gray-900 dark:text-gray-100">{showName}</span>
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={showName}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>Späť</Button>
          <button
            onClick={handleConfirm}
            disabled={!match || busy}
            className="inline-flex items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Rušim…' : 'Zrušiť termín'}
          </button>
        </div>
      </div>
    </div>
  );
}
