'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import {
  TrendingUp,
  Ticket,
  Calendar,
  CalendarClock,
  Wallet,
  Users,
  RefreshCw,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import {
  organizerMetricsApi,
  adminMetricsApi,
  OrganizerOverview,
  SalesTrendPoint,
  TopShow,
  RecentOrder,
  OrganizerRow,
} from '@/lib/api/metrics';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { TopShowsChart } from '@/components/dashboard/TopShowsChart';
import { RecentOrdersList } from '@/components/dashboard/RecentOrdersList';
import {
  KpiCard,
  SectionCard,
  Skeleton,
  ErrorState,
  greetingKey,
} from '@/components/dashboard/parts';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// Krok 31c1: chybové hlášky cez i18n (t = organizer.dashboard.*); e.message (backend) ostáva raw.
function readableError(t: (k: string) => string, e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return t('errPermission');
    if (e.status === 400) return t('errSelectOrg');
    if (e.status >= 500) return t('errServer');
    return e.message || t('errGeneric');
  }
  return t('errConnect');
}

export default function OrganizerDashboardPage() {
  const { user, isSuperAdmin } = useAuth();
  const t = useTranslations('organizer.dashboard');
  const format = useFormatter();
  const fmtPrice = (amount: number) => format.number(amount, { style: 'currency', currency: 'EUR' });

  // SUPERADMIN cross-cutting: switcher organizátora
  const [orgList, setOrgList] = useState<OrganizerRow[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | undefined>(undefined);

  const [overview, setOverview] = useState<OrganizerOverview | null>(null);
  const [trend, setTrend] = useState<SalesTrendPoint[]>([]);
  const [topShows, setTopShows] = useState<TopShow[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** organizerId pošleme len pre SUPERADMIN; organizer roly scopuje backend z tokenu. */
  const load = useCallback(async (organizerId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const p = organizerId ? { organizerId } : {};
      const [ov, tr, ts, ro] = await Promise.all([
        organizerMetricsApi.getOverview(token, p),
        organizerMetricsApi.getSalesTrend(token, { days: 7, ...p }),
        organizerMetricsApi.getTopShows(token, { limit: 5, ...p }),
        organizerMetricsApi.getRecentOrders(token, { limit: 10, ...p }),
      ]);
      setOverview(ov);
      setTrend(tr);
      setTopShows(ts);
      setRecentOrders(ro);
    } catch (e) {
      setError(readableError(t, e));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Inicializácia: SUPERADMIN najprv načíta zoznam organizátorov a auto-vyberie prvého.
  useEffect(() => {
    if (user === null) return; // čaká na resolúciu tokenu
    let active = true;
    (async () => {
      if (isSuperAdmin) {
        try {
          const token = await getValidToken();
          if (!token) return;
          const orgs = await adminMetricsApi.getOrganizers(token, { limit: 100, sort: 'name' });
          if (!active) return;
          setOrgList(orgs);
          const first = orgs[0]?.organizerId;
          setSelectedOrg(first);
          if (first) {
            await load(first);
          } else {
            setLoading(false);
          }
        } catch (e) {
          if (active) {
            setError(readableError(t, e));
            setLoading(false);
          }
        }
      } else {
        await load();
      }
    })();
    return () => {
      active = false;
    };
  }, [user, isSuperAdmin, load, t]);

  function onSwitchOrg(id: string) {
    setSelectedOrg(id);
    load(id);
  }

  const capacityPct =
    overview && overview.myCapacityTotal > 0
      ? Math.round((overview.myCapacityFilled / overview.myCapacityTotal) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t(greetingKey())}, {user?.email}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && orgList.length > 0 && (
              <Select
                value={selectedOrg ?? ''}
                onChange={(e) => onSwitchOrg(e.target.value)}
                className="py-1.5 text-sm"
                options={orgList.map((o) => ({ value: o.organizerId, label: o.name }))}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(isSuperAdmin ? selectedOrg : undefined)}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
        </div>

        {error && <ErrorState message={error} />}

        {/* KPI karty */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {loading || !overview ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : (
            <>
              <KpiCard
                title={t('kpiMyShows')}
                value={String(overview.myShowsCount)}
                icon={<Calendar className="h-5 w-5" />}
                hint={t('kpiPublishedHint', { count: overview.myPublishedShowsCount })}
              />
              <KpiCard
                title={t('kpiTodayRevenue')}
                value={fmtPrice(overview.myTodayRevenue)}
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <KpiCard
                title={t('kpiSoldToday')}
                value={String(overview.myTicketsSoldToday)}
                icon={<Ticket className="h-5 w-5" />}
              />
              <KpiCard
                title={t('kpiTotalRevenue')}
                value={fmtPrice(overview.myTotalRevenue)}
                icon={<Wallet className="h-5 w-5" />}
                hint={t('kpiTotalTicketsHint', { count: overview.myTotalTicketsSold })}
              />
              <KpiCard
                title={t('kpiUpcoming')}
                value={String(overview.myUpcomingTermins)}
                icon={<CalendarClock className="h-5 w-5" />}
              />
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('capacity')}</span>
                  <span className="text-brand">
                    <Users className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {overview.myCapacityFilled} / {overview.myCapacityTotal}
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {t('capacityHint', { pct: capacityPct })}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Graf + top podujatia */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard title={t('salesTrend7d')} className="lg:col-span-2">
            {loading ? <Skeleton className="h-64" /> : <SalesTrendChart data={trend} />}
          </SectionCard>
          <SectionCard title={t('topShows')}>
            {loading ? <Skeleton className="h-48" /> : <TopShowsChart data={topShows} />}
          </SectionCard>
        </div>

        {/* Posledné objednávky */}
        <SectionCard
          title={t('recentOrders')}
          action={
            <Link
              href="/organizer/orders"
              className="flex items-center gap-0.5 text-xs text-brand hover:underline"
            >
              {t('viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {loading ? <Skeleton className="h-32" /> : <RecentOrdersList orders={recentOrders} />}
        </SectionCard>

        {/* Rýchle akcie */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/organizer/shows"
            className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="rounded-lg bg-brand/10 p-2 text-brand">
              <Plus className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('addEvent')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('addEventDesc')}</p>
            </div>
          </Link>
          <a
            href="https://skener.ticketall.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border-2 border-brand/30 bg-brand/5 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="rounded-lg bg-brand/10 p-2 text-brand">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
              </svg>
            </span>
            <div>
              <h3 className="font-semibold text-brand">{t('scanTickets')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('scanTicketsDesc')}</p>
            </div>
          </a>
        </div>
      </main>
    </div>
  );
}
