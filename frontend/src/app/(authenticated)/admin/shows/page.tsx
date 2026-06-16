'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useTranslations, useFormatter } from 'next-intl';
import { getValidToken } from '@/lib/auth';
import { ApiError, heroAdminApi, AdminShow } from '@/lib/api';
import {
  SectionCard,
  Skeleton,
  EmptyState,
  ErrorState,
} from '@/components/dashboard/parts';

const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-amber-50 text-amber-700',
};

function readableError(t: (k: string) => string, e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return t('shows.errPermission');
    if (e.status >= 500) return t('shows.errServer');
    return e.message || t('shows.errGeneric');
  }
  return t('shows.errConnect');
}

export default function AdminShowsPage() {
  const t = useTranslations('admin');
  const format = useFormatter();
  const [shows, setShows] = useState<AdminShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nextTermin = (termins: AdminShow['termins']): string => {
    if (!termins?.length) return '—';
    const future = termins
      .map((tm) => new Date(tm.startsAt))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (!future.length) return '—';
    return format.dateTime(future[0], {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      timeZone: 'Europe/Bratislava',
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      setShows(await heroAdminApi.listShows(token));
    } catch (e) {
      setError(readableError(t, e));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('shows.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('shows.subtitle')}
          </p>
        </div>

        {error && <ErrorState message={error} />}

        <SectionCard title={`${t('shows.cardTitle')}${!loading ? ` (${format.number(shows.length)})` : ''}`}>
          {loading ? (
            <Skeleton className="h-48" />
          ) : shows.length === 0 ? (
            <EmptyState message={t('shows.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                    <th className="py-2 pr-3 font-medium">{t('shows.colName')}</th>
                    <th className="py-2 px-3 font-medium">{t('shows.colCategory')}</th>
                    <th className="py-2 px-3 font-medium">{t('shows.colStatus')}</th>
                    <th className="py-2 px-3 font-medium">{t('shows.colTermins')}</th>
                    <th className="py-2 pl-3 font-medium">{t('shows.colNext')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {shows.map((s) => {
                    const statusKey = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'ARCHIVED'].includes(s.status)
                      ? `shows.status.${s.status}`
                      : null;
                    const statusLabel = statusKey ? t(statusKey) : s.status;
                    const statusCls =
                      STATUS_CLS[s.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/organizer/shows/${s.id}`}
                              className="font-medium text-gray-900 dark:text-gray-100 hover:text-brand hover:underline"
                            >
                              {s.name}
                            </Link>
                            {s.isPromoted && (
                              <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-xs font-medium text-brand">
                                {t('shows.promoted')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{s.slug}</div>
                        </td>
                        <td className="px-3 text-gray-600 dark:text-gray-300">{s.category ?? '—'}</td>
                        <td className="px-3">
                          <span
                            className={clsx(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                              statusCls,
                            )}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-3 tabular-nums text-gray-600 dark:text-gray-300">{format.number(s.termins?.length ?? 0)}</td>
                        <td className="pl-3 tabular-nums text-gray-600 dark:text-gray-300">{nextTermin(s.termins)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </main>
    </div>
  );
}
