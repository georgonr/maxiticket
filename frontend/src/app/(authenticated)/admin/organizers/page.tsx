'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { organizersAdminApi, OrganizerRow, OrganizerSort } from '@/lib/api/organizers-admin';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { Select } from '@/components/ui/select';

export default function AdminOrganizersPage() {
  const t = useTranslations('admin');
  const format = useFormatter();
  const router = useRouter();
  const fmtPrice = (amount: number) => format.number(Number(amount), { style: 'currency', currency: 'EUR' });

  const [rows, setRows] = useState<OrganizerRow[]>([]);
  const [sort, setSort] = useState<OrganizerSort>('revenue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: OrganizerSort) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      setRows(await organizersAdminApi.list(token, { sort: s }));
    } catch {
      setError(t('organizers.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(sort); /* eslint-disable-next-line */ }, []);

  function changeSort(next: OrganizerSort) {
    setSort(next);
    load(next);
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('dashboard.organizers')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('organizers.subtitle')}</p>
        </div>

        <SectionCard
          title={t('dashboard.organizers')}
          action={
            <Select
              value={sort}
              onChange={(e) => changeSort(e.target.value as OrganizerSort)}
              className="py-1 text-xs"
              options={[
                { value: 'revenue', label: t('dashboard.sortRevenue') },
                { value: 'ticketsSold', label: t('dashboard.sortTickets') },
                { value: 'name', label: t('dashboard.sortName') },
              ]}
            />
          }
        >
          {error ? (
            <ErrorState message={error} />
          ) : loading ? (
            <Skeleton className="h-60" />
          ) : rows.length === 0 ? (
            <EmptyState message={t('dashboard.organizersEmpty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                    <th className="py-2 pr-3 font-medium">{t('dashboard.colOrganizer')}</th>
                    <th className="py-2 px-3 font-medium">{t('dashboard.colShows')}</th>
                    <th className="py-2 px-3 text-right font-medium">{t('dashboard.colRevenue')}</th>
                    <th className="py-2 px-3 text-right font-medium">{t('dashboard.colTickets')}</th>
                    <th className="py-2 px-3 text-right font-medium">{t('dashboard.colPayout')}</th>
                    <th className="py-2 pl-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {rows.map((o) => (
                    <tr
                      key={o.organizerId}
                      onClick={() => router.push(`/admin/organizers/${o.organizerId}`)}
                      className="cursor-pointer hover:bg-cream/60 dark:hover:bg-gray-800"
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{o.name}</div>
                        {o.companyName && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{o.companyName}</div>
                        )}
                      </td>
                      <td className="px-3 text-gray-600 dark:text-gray-300 tabular-nums">
                        {o.publishedShowsCount}/{o.showsCount}
                      </td>
                      <td className="px-3 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">
                        {fmtPrice(o.totalRevenue)}
                      </td>
                      <td className="px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                        {o.totalTicketsSold}
                      </td>
                      <td className="px-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                        {fmtPrice(o.outstandingPayout)}
                      </td>
                      <td className="pl-3 text-right text-gray-300 dark:text-gray-600">
                        <ChevronRight size={16} className="inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </main>
    </div>
  );
}
