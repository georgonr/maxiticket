'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useTranslations, useFormatter } from 'next-intl';
import { Search, RefreshCw, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import {
  OrderListItem,
  OrderListResponse,
  ListOrdersQuery,
  OrderStatus,
} from '@/lib/api/orders';
import { adminMetricsApi } from '@/lib/api/metrics';
import { SectionCard, Skeleton, EmptyState, ErrorState, OrderStatusBadge } from '@/components/dashboard/parts';

const PAGE_SIZE = 25;

const STATUS_VALUES: (OrderStatus | '')[] = ['', 'PAID', 'PENDING', 'CANCELLED', 'REFUNDED', 'FAILED'];
const PROVIDER_VALUES: string[] = ['', 'stripe', 'pos_cash', 'pos_card', 'comp', 'manual'];

const PROVIDER_META_CLS: Record<string, string> = {
  stripe: 'bg-indigo-50 text-indigo-700',
  pos_cash: 'bg-emerald-50 text-emerald-700',
  pos_card: 'bg-sky-50 text-sky-700',
  comp: 'bg-emerald-50 text-emerald-700',
  manual: 'bg-amber-50 text-amber-700',
  mock: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

function ProviderBadge({ provider, label }: { provider: string | null; label: string }) {
  if (!provider) return <span className="text-gray-300">—</span>;
  const cls = PROVIDER_META_CLS[provider] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
  return (
    <span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  );
}

export function OrdersTable({
  fetchList,
  basePath,
  isAdmin = false,
}: {
  fetchList: (query: ListOrdersQuery, token: string) => Promise<OrderListResponse>;
  basePath: string;
  isAdmin?: boolean;
}) {
  const t = useTranslations('organizer.orders');
  const format = useFormatter();
  const fmtDate = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const fmtPrice = (amount: number | string) =>
    format.number(Number(amount), { style: 'currency', currency: 'EUR' });

  const readableError = (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.status === 401 || e.status === 403) return t('errorForbidden');
      if (e.status >= 500) return t('errorServer');
      return e.message || t('errorGeneric');
    }
    return t('errorConnection');
  };

  const providerLabel = (provider: string): string =>
    PROVIDER_META_CLS[provider] ? t(`provider.${provider}`) : provider;

  const [items, setItems] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtre
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [provider, setProvider] = useState('');
  const [organizerId, setOrganizerId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [organizers, setOrganizers] = useState<{ id: string; name: string }[]>([]);

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Admin organizer dropdown
  useEffect(() => {
    if (!isAdmin) return;
    getValidToken().then(async (token) => {
      if (!token) return;
      try {
        const rows = await adminMetricsApi.getOrganizers(token, { limit: 100, sort: 'name' });
        setOrganizers(rows.map((r) => ({ id: r.organizerId, name: r.name })));
      } catch {
        /* dropdown je voliteľný – tichý fail */
      }
    });
  }, [isAdmin]);

  const query = useMemo<ListOrdersQuery>(
    () => ({
      status: status || undefined,
      paymentProvider: provider || undefined,
      organizerId: organizerId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    [status, provider, organizerId, dateFrom, dateTo, search, offset],
  );

  const reqId = useRef(0);
  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const res = await fetchList(query, token);
      if (my !== reqId.current) return; // zahodené staršie odpovede (race)
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      if (my !== reqId.current) return;
      setError(readableError(e));
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }, [fetchList, query]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset stránky pri zmene filtra (okrem offsetu samotného)
  useEffect(() => {
    setOffset(0);
  }, [status, provider, organizerId, dateFrom, dateTo]);

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <SectionCard title={`${t('title')}${!loading ? ` (${total})` : ''}`}>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')} className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-2 text-sm">
          {STATUS_VALUES.map((v) => <option key={v} value={v}>{v === '' ? t('statusFilter.all') : t(`statusFilter.${v}`)}</option>)}
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-2 text-sm">
          {PROVIDER_VALUES.map((v) => <option key={v} value={v}>{v === '' ? t('providerFilter.all') : t(`providerFilter.${v}`)}</option>)}
        </select>
        {isAdmin && (
          <select value={organizerId} onChange={(e) => setOrganizerId(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-2 text-sm">
            <option value="">{t('allOrganizers')}</option>
            {organizers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-2 text-sm" title={t('dateFrom')} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-700 px-2 py-2 text-sm" title={t('dateTo')} />
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <div className="flex flex-col items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="inline-flex items-center gap-1 font-medium underline">
            <RefreshCw size={13} /> {t('retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                  <th className="py-2 pr-3 font-medium">{t('col.number')}</th>
                  <th className="py-2 px-3 font-medium">{t('col.date')}</th>
                  <th className="py-2 px-3 font-medium">{t('col.buyer')}</th>
                  {isAdmin && <th className="py-2 px-3 font-medium">{t('col.organizer')}</th>}
                  <th className="py-2 px-3 font-medium">{t('col.event')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('col.qty')}</th>
                  <th className="py-2 px-3 font-medium text-right">{t('col.amount')}</th>
                  <th className="py-2 px-3 font-medium">{t('col.payment')}</th>
                  <th className="py-2 pl-3 font-medium">{t('col.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {items.map((o) => (
                  <tr key={o.orderId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-2.5 pr-3">
                      <Link href={`${basePath}/${o.orderId}`} className="font-mono font-medium text-brand hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 whitespace-nowrap text-gray-500 dark:text-gray-400">{fmtDate(o.createdAt)}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800 dark:text-gray-100">{o.buyerName ?? '—'}</span>
                        {o.isGuest && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400" title={t('guestTitle')}>
                            <User size={9} /> {t('guest')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{o.buyerEmail}</div>
                    </td>
                    {isAdmin && <td className="px-3 text-gray-600 dark:text-gray-300">{o.organizerName ?? '—'}</td>}
                    <td className="px-3 text-gray-700 dark:text-gray-200">
                      {o.showTitles.length === 0 ? '—' : o.showTitles.join(', ')}
                      {o.extraShows > 0 && <span className="text-gray-400 dark:text-gray-500"> +{o.extraShows}</span>}
                    </td>
                    <td className="px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{o.ticketCount}</td>
                    <td className="px-3 text-right tabular-nums">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{fmtPrice(o.totalAmount)}</span>
                      {o.discountAmount > 0 && (
                        <div className="text-xs text-emerald-600">
                          −{fmtPrice(o.discountAmount)}{o.couponCode ? ` ${o.couponCode}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-3"><ProviderBadge provider={o.paymentProvider} label={o.paymentProvider ? providerLabel(o.paymentProvider) : ''} /></td>
                    <td className="pl-3"><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stránkovanie */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{t('pagination', { from, to, total })}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={15} /> {t('prev')}
              </button>
              <button
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={to >= total}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('next')} <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}
