'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { useScannerAuth, saveSelectedTermin } from '@/lib/scanner-auth';
import { scanApi, ScanTermin } from '@/lib/api';

type DateBadgeKey = 'today' | 'tomorrow' | 'thisWeek' | 'later';
type DateBadge = { key: DateBadgeKey; bg: string; text: string };

function getDateBadge(startsAt: string): DateBadge {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const nextWeek = new Date(today.getTime() + 7 * 86_400_000);
  const eventDay = new Date(new Date(startsAt).setHours(0, 0, 0, 0));

  if (eventDay.getTime() === today.getTime())
    return { key: 'today', bg: 'bg-green-500', text: 'text-white' };
  if (eventDay.getTime() === tomorrow.getTime())
    return { key: 'tomorrow', bg: 'bg-blue-500', text: 'text-white' };
  if (eventDay < nextWeek)
    return { key: 'thisWeek', bg: 'bg-violet-600', text: 'text-white' };
  return { key: 'later', bg: 'bg-gray-600', text: 'text-white' };
}

export default function TerminyPage() {
  const router = useRouter();
  const t = useTranslations('scanner');
  const format = useFormatter();
  const { token, user, loading: authLoading, logout } = useScannerAuth();
  const [terminy, setTerminy] = useState<ScanTermin[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  function formatDate(startsAt: string): string {
    return format.dateTime(new Date(startsAt), {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const fetchTerminy = useCallback(
    async (all: boolean) => {
      if (!token) return;
      setFetching(true);
      setError('');
      try {
        const data = await scanApi.terminy(token, all);
        setTerminy(data);
      } catch {
        setError(t('terminy.loadError'));
      } finally {
        setFetching(false);
      }
    },
    [token, t],
  );

  useEffect(() => {
    if (token) fetchTerminy(showAll);
  }, [token, showAll, fetchTerminy]);

  function handleSelectTermin(termin: ScanTermin) {
    saveSelectedTermin({
      id: termin.id,
      showName: termin.show.name,
      startsAt: termin.startsAt,
      venueName: termin.venue?.name ?? null,
      venueCity: termin.venue?.city ?? null,
    });
    router.push('/scan/skener');
  }

  function toggleShowAll() {
    const next = !showAll;
    setShowAll(next);
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
            MT
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{t('common.scanner')}</p>
            {user && <p className="text-xs text-gray-400 truncate max-w-[160px]">{user.email}</p>}
          </div>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-300 active:bg-gray-800"
        >
          {t('common.logout')}
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4">
        <h1 className="mb-1 text-xl font-bold">{t('terminy.title')}</h1>
        <p className="mb-4 text-sm text-gray-400">
          {t('terminy.subtitle')}
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl bg-red-900/40 px-4 py-3 text-sm text-red-300">
            {error}
            <button
              onClick={() => fetchTerminy(showAll)}
              className="ml-2 underline"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* Loading */}
        {fetching && (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-brand" />
          </div>
        )}

        {/* Empty state */}
        {!fetching && !error && terminy.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-800 text-3xl">
              🎫
            </div>
            <div>
              <p className="font-semibold text-gray-200">{t('terminy.emptyTitle')}</p>
              <p className="mt-1 text-sm text-gray-500">
                {showAll
                  ? t('terminy.emptyAllDesc')
                  : t('terminy.emptyNearDesc')}
              </p>
            </div>
            {!showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="rounded-xl bg-gray-800 px-5 py-2.5 text-sm font-medium text-white active:bg-gray-700"
              >
                {t('terminy.showAll')}
              </button>
            )}
          </div>
        )}

        {/* Termin cards */}
        {!fetching && terminy.length > 0 && (
          <div className="flex flex-col gap-3">
            {terminy.map((termin) => {
              const badge = getDateBadge(termin.startsAt);
              const noShow = termin.ticketCount > 0 ? Math.round(((termin.ticketCount - termin.scannedCount) / termin.ticketCount) * 100) : 0;
              return (
                <button
                  key={termin.id}
                  onClick={() => handleSelectTermin(termin)}
                  className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-4 text-left active:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-semibold text-white">{termin.show.name}</p>
                      <p className="mt-0.5 text-sm text-gray-400">{formatDate(termin.startsAt)}</p>
                      {termin.venue && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {termin.venue.name}{termin.venue.city ? `, ${termin.venue.city}` : ''}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                      {t(`terminy.badge.${badge.key}`)}
                    </span>
                  </div>

                  {/* Stats bar */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 overflow-hidden rounded-full bg-gray-800 h-1.5">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: termin.ticketCount > 0 ? `${(termin.scannedCount / termin.ticketCount) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      <span className="font-semibold text-white">{termin.scannedCount}</span>
                      {' / '}
                      {termin.ticketCount}
                      {termin.ticketCount > 0 && (
                        <span className="ml-1 text-gray-500">{t('terminy.noShow', { percent: noShow })}</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer toggle */}
      <footer className="sticky bottom-0 border-t border-gray-800 bg-gray-950 px-4 py-3">
        <button
          onClick={toggleShowAll}
          className="w-full rounded-xl border border-gray-700 py-2.5 text-sm font-medium text-gray-300 active:bg-gray-800"
        >
          {showAll ? `📅 ${t('terminy.nearOnly')}` : `🗓 ${t('terminy.showAll')}`}
        </button>
      </footer>
    </div>
  );
}
