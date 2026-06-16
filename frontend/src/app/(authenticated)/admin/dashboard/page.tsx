'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import {
  TrendingUp,
  Ticket,
  Calendar,
  Users,
  RotateCcw,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import {
  adminMetricsApi,
  AdminOverview,
  SalesTrendPoint,
  TopShow,
} from '@/lib/api/metrics';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { TopShowsChart } from '@/components/dashboard/TopShowsChart';
import {
  KpiCard,
  SectionCard,
  Skeleton,
  ErrorState,
  greetingKey,
} from '@/components/dashboard/parts';
import { Button } from '@/components/ui/button';

// Krok 31d: chybové hlášky cez i18n (t = admin.dashboard.*); e.message (backend) ostáva raw.
function readableError(t: (k: string) => string, e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return t('dashboard.errPermission');
    if (e.status >= 500) return t('dashboard.errServer');
    return e.message || t('dashboard.errGeneric');
  }
  return t('dashboard.errConnect');
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const t = useTranslations('admin');
  const format = useFormatter();
  const fmtPrice = (amount: number) =>
    format.number(Number(amount), { style: 'currency', currency: 'EUR' });

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trend, setTrend] = useState<SalesTrendPoint[]>([]);
  const [topShows, setTopShows] = useState<TopShow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const [ov, tr, ts] = await Promise.all([
        adminMetricsApi.getOverview(token),
        adminMetricsApi.getSalesTrend(token, { days: 7 }),
        adminMetricsApi.getTopShows(token, { limit: 5 }),
      ]);
      setOverview(ov);
      setTrend(tr);
      setTopShows(ts);
    } catch (e) {
      setError(readableError(t, e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header s pozdravom */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t(`dashboard.${greetingKey()}`)}, {user?.email}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('dashboard.refresh')}
          </Button>
        </div>

        {error && <ErrorState message={error} />}

        {/* KPI karty */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {loading || !overview ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (
            <>
              <KpiCard
                title={t('dashboard.kpiTodayRevenue')}
                value={fmtPrice(overview.todayRevenue)}
                icon={<TrendingUp className="h-5 w-5" />}
                change={overview.todayRevenueChange}
              />
              <KpiCard
                title={t('dashboard.kpiSoldToday')}
                value={String(overview.ticketsSoldToday)}
                icon={<Ticket className="h-5 w-5" />}
                change={overview.ticketsSoldChange}
              />
              <KpiCard
                title={t('dashboard.kpiActiveShows')}
                value={String(overview.activeShowsCount)}
                icon={<Calendar className="h-5 w-5" />}
              />
              <KpiCard
                title={t('dashboard.kpiOrganizers')}
                value={String(overview.organizersCount)}
                icon={<Users className="h-5 w-5" />}
              />
              <KpiCard
                title={t('dashboard.kpiPendingRefunds')}
                value={String(overview.pendingRefundsCount)}
                icon={<RotateCcw className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        {/* Graf tržieb + top podujatia */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard title={t('dashboard.salesTrend7d')} className="lg:col-span-2">
            {loading ? <Skeleton className="h-64" /> : <SalesTrendChart data={trend} />}
          </SectionCard>

          <SectionCard
            title={t('dashboard.topShows')}
            action={
              <Link
                href="/organizer/shows"
                className="flex items-center gap-0.5 text-xs text-brand hover:underline"
              >
                {t('dashboard.viewAll')} <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {loading ? <Skeleton className="h-48" /> : <TopShowsChart data={topShows} />}
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
