'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
import { formatPrice } from '@/lib/format';
import {
  adminMetricsApi,
  AdminOverview,
  SalesTrendPoint,
  TopShow,
  RecentOrder,
  OrganizerRow,
  OrganizerSort,
} from '@/lib/api/metrics';
import { SalesTrendChart } from '@/components/dashboard/SalesTrendChart';
import { TopShowsChart } from '@/components/dashboard/TopShowsChart';
import { RecentOrdersList } from '@/components/dashboard/RecentOrdersList';
import {
  KpiCard,
  SectionCard,
  Skeleton,
  EmptyState,
  ErrorState,
  greeting,
} from '@/components/dashboard/parts';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

function readableError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return 'Nemáte oprávnenie zobraziť tieto dáta.';
    if (e.status >= 500) return 'Nastala chyba na strane servera. Skúste neskôr.';
    return e.message || 'Niečo sa pokazilo.';
  }
  return 'Nemôžeme sa pripojiť k serveru. Skontrolujte pripojenie.';
}

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trend, setTrend] = useState<SalesTrendPoint[]>([]);
  const [topShows, setTopShows] = useState<TopShow[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [sort, setSort] = useState<OrganizerSort>('revenue');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const [ov, tr, ts, ro, orgs] = await Promise.all([
        adminMetricsApi.getOverview(token),
        adminMetricsApi.getSalesTrend(token, { days: 7 }),
        adminMetricsApi.getTopShows(token, { limit: 5 }),
        adminMetricsApi.getRecentOrders(token, { limit: 5 }),
        adminMetricsApi.getOrganizers(token, { limit: 20, sort }),
      ]);
      setOverview(ov);
      setTrend(tr);
      setTopShows(ts);
      setRecentOrders(ro);
      setOrganizers(orgs);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // sort dropdown – re-fetch len organizátorov
  async function changeSort(next: OrganizerSort) {
    setSort(next);
    try {
      const token = await getValidToken();
      if (!token) return;
      setOrganizers(await adminMetricsApi.getOrganizers(token, { limit: 20, sort: next }));
    } catch {
      /* ponecháme existujúci zoznam */
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Header s pozdravom */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {greeting()}, {user?.email}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tu je prehľad platformy TicketAll v reálnom čase
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Obnoviť
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
                title="Dnešné tržby"
                value={formatPrice(overview.todayRevenue)}
                icon={<TrendingUp className="h-5 w-5" />}
                change={overview.todayRevenueChange}
              />
              <KpiCard
                title="Predané vstupenky (dnes)"
                value={String(overview.ticketsSoldToday)}
                icon={<Ticket className="h-5 w-5" />}
                change={overview.ticketsSoldChange}
              />
              <KpiCard
                title="Aktívne podujatia"
                value={String(overview.activeShowsCount)}
                icon={<Calendar className="h-5 w-5" />}
              />
              <KpiCard
                title="Organizátori"
                value={String(overview.organizersCount)}
                icon={<Users className="h-5 w-5" />}
              />
              <KpiCard
                title="Čakajúce refundácie"
                value={String(overview.pendingRefundsCount)}
                icon={<RotateCcw className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        {/* Graf tržieb + top podujatia */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard title="Tržby za posledných 7 dní" className="lg:col-span-2">
            {loading ? <Skeleton className="h-64" /> : <SalesTrendChart data={trend} />}
          </SectionCard>

          <SectionCard
            title="Najpredávanejšie podujatia"
            action={
              <Link
                href="/organizer/shows"
                className="flex items-center gap-0.5 text-xs text-brand hover:underline"
              >
                Všetky <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {loading ? <Skeleton className="h-48" /> : <TopShowsChart data={topShows} />}
          </SectionCard>
        </div>

        {/* Posledné objednávky */}
        <SectionCard
          title="Posledné objednávky"
          action={
            <Link
              href="/admin/orders"
              className="flex items-center gap-0.5 text-xs text-brand hover:underline"
            >
              Všetky <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {loading ? <Skeleton className="h-32" /> : <RecentOrdersList orders={recentOrders} />}
        </SectionCard>

        {/* Tabuľka organizátorov */}
        <SectionCard
          title="Organizátori"
          action={
            <Select
              value={sort}
              onChange={(e) => changeSort(e.target.value as OrganizerSort)}
              className="py-1 text-xs"
              options={[
                { value: 'revenue', label: 'Podľa tržieb' },
                { value: 'ticketsSold', label: 'Podľa vstupeniek' },
                { value: 'name', label: 'Podľa názvu' },
              ]}
            />
          }
        >
          {loading ? (
            <Skeleton className="h-40" />
          ) : organizers.length === 0 ? (
            <EmptyState message="Zatiaľ žiadni organizátori." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                    <th className="py-2 pr-3 font-medium">Organizátor</th>
                    <th className="py-2 px-3 font-medium">Podujatia</th>
                    <th className="py-2 px-3 text-right font-medium">Tržby</th>
                    <th className="py-2 px-3 text-right font-medium">Vstupenky</th>
                    <th className="py-2 pl-3 text-right font-medium">Výplata (odhad)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {organizers.map((o) => (
                    <tr key={o.organizerId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
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
                        {formatPrice(o.totalRevenue)}
                      </td>
                      <td className="px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                        {o.totalTicketsSold}
                      </td>
                      <td className="pl-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                        {formatPrice(o.outstandingPayout)}
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
