'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScannerAuth, loadSelectedTermin, clearSelectedTermin, SelectedTermin } from '@/lib/scanner-auth';

function formatDate(startsAt: string): string {
  return new Date(startsAt).toLocaleDateString('sk-SK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SkenerPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useScannerAuth();
  const [termin, setTermin] = useState<SelectedTermin | null>(null);

  useEffect(() => {
    const t = loadSelectedTermin();
    if (!t) router.replace('/scan/terminy');
    else setTermin(t);
  }, [router]);

  function handleChangeTermin() {
    clearSelectedTermin();
    router.push('/scan/terminy');
  }

  if (authLoading || !termin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
              MT
            </div>
            {user && <p className="text-xs text-gray-400 truncate max-w-[140px]">{user.email}</p>}
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 active:bg-gray-800"
          >
            Odhlásiť
          </button>
        </div>

        {/* Active termin badge */}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-gray-900 px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-white">{termin.showName}</p>
            <p className="text-xs text-gray-400">{formatDate(termin.startsAt)}</p>
            {(termin.venueName || termin.venueCity) && (
              <p className="truncate text-xs text-gray-500">
                {[termin.venueName, termin.venueCity].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <button
            onClick={handleChangeTermin}
            className="ml-3 shrink-0 rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 active:bg-gray-700"
          >
            Zmeniť
          </button>
        </div>
      </header>

      {/* Camera placeholder */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="relative flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-gray-700 bg-gray-900">
          <div className="text-center">
            <div className="text-5xl mb-3">📷</div>
            <p className="text-sm font-medium text-gray-300">Kamera – Krok 3</p>
            <p className="mt-1 text-xs text-gray-500">QR skenovanie bude dostupné v ďalšom kroku</p>
          </div>
          {/* Corner decorations */}
          <span className="absolute top-3 left-3 h-6 w-6 border-l-2 border-t-2 border-brand rounded-tl" />
          <span className="absolute top-3 right-3 h-6 w-6 border-r-2 border-t-2 border-brand rounded-tr" />
          <span className="absolute bottom-3 left-3 h-6 w-6 border-l-2 border-b-2 border-brand rounded-bl" />
          <span className="absolute bottom-3 right-3 h-6 w-6 border-r-2 border-b-2 border-brand rounded-br" />
        </div>

        <button
          onClick={handleChangeTermin}
          className="rounded-xl border border-gray-700 px-6 py-3 text-sm font-medium text-gray-300 active:bg-gray-800"
        >
          ← Zmeniť termín
        </button>
      </main>
    </div>
  );
}
