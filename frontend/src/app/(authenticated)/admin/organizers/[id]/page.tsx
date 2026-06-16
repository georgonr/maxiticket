'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import { ArrowLeft, Calendar, TrendingUp, Ticket, Wallet, CheckCircle2 } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { organizersAdminApi, OrganizerDetail } from '@/lib/api/organizers-admin';
import { KpiCard, SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';

const STATUS_CLS: Record<string, string> = {
  DRAFT: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
  ARCHIVED: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

export default function AdminOrganizerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('admin');
  const format = useFormatter();
  const fmtPrice = (a: number) => format.number(Number(a), { style: 'currency', currency: 'EUR' });
  const fmtDate = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'numeric', year: 'numeric' });

  const [data, setData] = useState<OrganizerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      setData(await organizersAdminApi.get(id, token));
    } catch {
      setError(t('organizers.detailErr'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  const dash = t('organizers.profile.dash');
  const org = data?.organizer;
  const address = org && (org.addressStreet || org.addressCity)
    ? [org.addressStreet, [org.addressZip, org.addressCity].filter(Boolean).join(' '), org.addressCountry].filter(Boolean).join(', ')
    : dash;

  const rows: [string, string][] = org
    ? [
        [t('organizers.profile.companyName'), org.companyName || dash],
        [t('organizers.profile.ico'), org.ico || dash],
        [t('organizers.profile.dic'), org.dic || dash],
        [t('organizers.profile.icDph'), org.icDph || dash],
        [t('organizers.profile.vat'), org.vatPayer ? t('organizers.profile.vatYes') : t('organizers.profile.vatNo')],
        [t('organizers.profile.address'), address],
        [t('organizers.profile.email'), org.email],
        [t('organizers.profile.phone'), org.phone || dash],
        [t('organizers.profile.website'), org.websiteUrl || dash],
        [t('organizers.profile.bankAccount'), org.bankAccount || org.iban || dash],
        [t('organizers.profile.created'), fmtDate(org.createdAt)],
      ]
    : [];

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <Link href="/admin/organizers" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-coral dark:text-gray-400">
          <ArrowLeft size={15} /> {t('organizers.back')}
        </Link>

        {error ? (
          <ErrorState message={error} />
        ) : loading || !data ? (
          <Skeleton className="h-72" />
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.organizer.name}</h1>
              {data.organizer.companyName && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{data.organizer.companyName}</p>
              )}
            </div>

            {/* Metriky */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <KpiCard title={t('organizers.metrics.shows')} value={`${data.metrics.publishedShowsCount}/${data.metrics.showsCount}`} icon={<Calendar className="h-5 w-5" />} hint={t('organizers.metrics.published')} />
              <KpiCard title={t('organizers.metrics.revenue')} value={fmtPrice(data.metrics.totalRevenue)} icon={<TrendingUp className="h-5 w-5" />} />
              <KpiCard title={t('organizers.metrics.tickets')} value={String(data.metrics.totalTicketsSold)} icon={<Ticket className="h-5 w-5" />} />
              <KpiCard title={t('organizers.metrics.payout')} value={fmtPrice(data.metrics.outstandingPayout)} icon={<Wallet className="h-5 w-5" />} />
              <KpiCard title={t('organizers.profile.vat')} value={data.organizer.vatPayer ? t('organizers.profile.vatYes') : t('organizers.profile.vatNo')} icon={<CheckCircle2 className="h-5 w-5" />} />
            </div>

            {/* Údaje */}
            <SectionCard title={t('organizers.profile.title')}>
              <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-gray-50 dark:border-gray-800 py-1.5">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
                    <dd className="text-sm font-medium text-gray-900 dark:text-gray-100 text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>

            {/* Podujatia organizátora */}
            <SectionCard title={t('organizers.shows.title')}>
              {data.shows.length === 0 ? (
                <EmptyState message={t('organizers.shows.empty')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                        <th className="py-2 pr-3 font-medium">{t('organizers.shows.colName')}</th>
                        <th className="py-2 px-3 font-medium">{t('organizers.shows.colStatus')}</th>
                        <th className="py-2 px-3 text-right font-medium">{t('organizers.shows.colTermins')}</th>
                        <th className="py-2 pl-3 text-right font-medium">{t('organizers.shows.colCreated')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {data.shows.map((s) => (
                        <tr key={s.id} className="hover:bg-cream/60 dark:hover:bg-gray-800">
                          <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                          <td className="px-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {t.has(`shows.status.${s.status}`) ? t(`shows.status.${s.status}`) : s.status}
                            </span>
                          </td>
                          <td className="px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{s.terminCount}</td>
                          <td className="pl-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{fmtDate(s.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </main>
    </div>
  );
}
