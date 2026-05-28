'use client';

import { useEffect, useState } from 'react';

export default function ScanPage() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-900 text-white p-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand text-white text-3xl font-bold shadow-lg">
          MT
        </div>
        <h1 className="text-2xl font-bold">Maxiticket Skener</h1>
        <p className="mt-2 text-gray-400">
          {installed ? 'Aplikácia beží v standalone móde' : 'Nainštalujte aplikáciu na plochu pre offline prístup'}
        </p>
      </div>

      <div className="w-full max-w-xs rounded-xl border border-gray-700 bg-gray-800 p-6 text-center">
        <div className="mx-auto mb-3 h-40 w-40 rounded-lg bg-gray-700 flex items-center justify-center text-gray-500 text-sm">
          Kamera (v ďalšej verzii)
        </div>
        <p className="text-sm text-gray-400">
          Skenovanie QR kódov vstupeniek bude dostupné v nasledujúcom kroku.
        </p>
      </div>

      {!installed && (
        <p className="text-xs text-gray-500 text-center max-w-xs">
          Na iOS: Safari → Zdieľať → Pridať na plochu.<br />
          Na Android: Chrome → ⋮ → Inštalovať aplikáciu.
        </p>
      )}
    </div>
  );
}
