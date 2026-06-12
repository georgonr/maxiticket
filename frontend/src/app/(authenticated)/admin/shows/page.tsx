'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { getValidToken } from '@/lib/auth';
import { ApiError, heroAdminApi, AdminShow } from '@/lib/api';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import {
  SectionCard,
  Skeleton,
  EmptyState,
  ErrorState,
} from '@/components/dashboard/parts';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Koncept', cls: 'bg-gray-100 text-gray-600' },
  PUBLISHED: { label: 'Publikované', cls: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Zrušené', cls: 'bg-red-50 text-red-700' },
  ARCHIVED: { label: 'Archivované', cls: 'bg-amber-50 text-amber-700' },
};

function readableError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return 'Nemáte oprávnenie zobraziť tieto dáta.';
    if (e.status >= 500) return 'Nastala chyba na strane servera. Skúste neskôr.';
    return e.message || 'Niečo sa pokazilo.';
  }
  return 'Nemôžeme sa pripojiť k serveru. Skontrolujte pripojenie.';
}

function nextTermin(termins: AdminShow['termins']): string {
  if (!termins?.length) return '—';
  const future = termins
    .map((t) => new Date(t.startsAt))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (!future.length) return '—';
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'Europe/Bratislava',
  }).format(future[0]);
}

export default function AdminShowsPage() {
  const [shows, setShows] = useState<AdminShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      setShows(await heroAdminApi.listShows(token));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Podujatia – všetci organizátori</h1>
          <p className="text-sm text-gray-500">
            Cross-organizer prehľad všetkých podujatí na platforme
          </p>
        </div>

        {error && <ErrorState message={error} />}

        <SectionCard title={`Podujatia${!loading ? ` (${shows.length})` : ''}`}>
          {loading ? (
            <Skeleton className="h-48" />
          ) : shows.length === 0 ? (
            <EmptyState message="Zatiaľ žiadne podujatia." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                    <th className="py-2 pr-3 font-medium">Názov</th>
                    <th className="py-2 px-3 font-medium">Kategória</th>
                    <th className="py-2 px-3 font-medium">Stav</th>
                    <th className="py-2 px-3 font-medium">Termíny</th>
                    <th className="py-2 pl-3 font-medium">Najbližší</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {shows.map((s) => {
                    const st = STATUS_LABEL[s.status] ?? {
                      label: s.status,
                      cls: 'bg-gray-100 text-gray-600',
                    };
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/organizer/shows/${s.id}`}
                              className="font-medium text-gray-900 hover:text-brand hover:underline"
                            >
                              {s.name}
                            </Link>
                            {s.isPromoted && (
                              <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-xs font-medium text-brand">
                                promoted
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">{s.slug}</div>
                        </td>
                        <td className="px-3 text-gray-600">{s.category ?? '—'}</td>
                        <td className="px-3">
                          <span
                            className={clsx(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                              st.cls,
                            )}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 tabular-nums text-gray-600">{s.termins?.length ?? 0}</td>
                        <td className="pl-3 tabular-nums text-gray-600">{nextTermin(s.termins)}</td>
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
