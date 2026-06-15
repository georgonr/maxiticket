'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { clsx } from 'clsx';
import { Receipt, Loader2, ChevronRight, RefreshCw } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { accountApi, AccountOrderListItem } from '@/lib/api/account';
import { AccountTabs } from '@/components/account/AccountTabs';

const STATUS_CLS: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REFUNDED: 'bg-orange-50 text-orange-700',
  CANCELLED: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  FAILED: 'bg-red-50 text-red-700',
};

export default function AccountOrdersPage() {
  const t = useTranslations('account');
  const format = useFormatter();
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = usePublicAuth();
  const [orders, setOrders] = useState<AccountOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { router.replace('/account/login?next=/account/orders'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/account/login?next=/account/orders'); return; }
      const res = await accountApi.orders(token);
      setOrders(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ordersLoadFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AccountTabs />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Receipt size={20} className="text-purple-700" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('ordersTitle')}</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
      ) : error ? (
        <div className="flex flex-col items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="inline-flex items-center gap-1 font-medium underline"><RefreshCw size={13} /> {t('tryAgain')}</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 p-10 text-center">
          <p className="text-slate-500 dark:text-slate-400">{t('noOrders')}</p>
          <Link href="/events" className="mt-3 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
            {t('browseEvents')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const stLabel = STATUS_CLS[o.status] ? t(`status.${o.status}` as never) : o.status;
            const stCls = STATUS_CLS[o.status] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
            return (
              <Link
                key={o.orderId}
                href={`/account/orders/${o.orderId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{o.orderNumber}</span>
                    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', stCls)}>{stLabel}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
                    {o.showTitles.length ? o.showTitles.join(', ') : '—'}{o.extraShows > 0 ? ` +${o.extraShows}` : ''}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{format.dateTime(new Date(o.createdAt), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {t('ticketCount', { count: o.ticketCount })}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 text-right">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{format.number(o.totalAmount, { style: 'currency', currency: 'EUR' })}</div>
                    {o.discountAmount > 0 && (
                      <div className="text-xs text-emerald-600">−{format.number(o.discountAmount, { style: 'currency', currency: 'EUR' })}{o.couponCode ? ` ${o.couponCode}` : ''}</div>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
