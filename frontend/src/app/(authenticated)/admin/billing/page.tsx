'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { billingApi, BillingOrganizerRow } from '@/lib/api/billing';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';

export default function AdminBillingPage() {
  const t = useTranslations('billing');
  const format = useFormatter();
  const router = useRouter();
  const eur = (cents: number) => format.number(cents / 100, { style: 'currency', currency: 'EUR' });

  const [rows, setRows] = useState<BillingOrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      setRows(await billingApi.organizers(token));
    } catch {
      setError(t('errLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
        </div>

        <SectionCard title={t('title')}>
          {error ? (
            <ErrorState message={error} />
          ) : loading ? (
            <Skeleton className="h-60" />
          ) : rows.length === 0 ? (
            <EmptyState message={t('empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                    <th className="py-2 pr-3 font-medium">{t('col.organizer')}</th>
                    <th className="py-2 px-3 font-medium">{t('col.mode')}</th>
                    <th className="py-2 px-3 text-right font-medium">{t('col.revenue')}</th>
                    <th className="py-2 px-3 text-right font-medium">{t('col.payout')}</th>
                    <th className="py-2 pl-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {rows.map((o) => (
                    <tr
                      key={o.organizerId}
                      onClick={() => router.push(`/admin/billing/${o.organizerId}`)}
                      className="cursor-pointer hover:bg-cream/60 dark:hover:bg-gray-800"
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{o.name}</div>
                        {o.companyName && <div className="text-xs text-gray-400 dark:text-gray-500">{o.companyName}</div>}
                      </td>
                      <td className="px-3 text-gray-600 dark:text-gray-300">{t(`mode.${o.billingMode}`)}</td>
                      <td className="px-3 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{eur(o.revenueCents)}</td>
                      <td className="px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">{eur(o.netPayoutCents)}</td>
                      <td className="pl-3 text-right text-gray-300 dark:text-gray-600"><ChevronRight size={16} className="inline" /></td>
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
