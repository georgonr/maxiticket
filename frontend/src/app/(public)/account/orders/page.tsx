'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Receipt, Loader2, ChevronRight, RefreshCw } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { accountApi, AccountOrderListItem } from '@/lib/api/account';
import { formatPrice, formatDate } from '@/lib/format';
import { AccountTabs } from '@/components/account/AccountTabs';

const STATUS: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Zaplatené', cls: 'bg-emerald-50 text-emerald-700' },
  PENDING: { label: 'Čaká na platbu', cls: 'bg-amber-50 text-amber-700' },
  REFUNDED: { label: 'Refundované', cls: 'bg-orange-50 text-orange-700' },
  CANCELLED: { label: 'Zrušené', cls: 'bg-slate-100 text-slate-500' },
  FAILED: { label: 'Zlyhalo', cls: 'bg-red-50 text-red-700' },
};

export default function AccountOrdersPage() {
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
      setError(e instanceof Error ? e.message : 'Načítanie objednávok zlyhalo.');
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
        <h1 className="text-2xl font-bold text-slate-900">Moje objednávky</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
      ) : error ? (
        <div className="flex flex-col items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="inline-flex items-center gap-1 font-medium underline"><RefreshCw size={13} /> Skúsiť znova</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-500">Zatiaľ ste nenakúpili žiadne vstupenky.</p>
          <Link href="/events" className="mt-3 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">
            Prehliadať podujatia
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const st = STATUS[o.status] ?? { label: o.status, cls: 'bg-slate-100 text-slate-500' };
            return (
              <Link
                key={o.orderId}
                href={`/account/orders/${o.orderId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">{o.orderNumber}</span>
                    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-600">
                    {o.showTitles.length ? o.showTitles.join(', ') : '—'}{o.extraShows > 0 ? ` +${o.extraShows}` : ''}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(o.createdAt)} · {o.ticketCount} {o.ticketCount === 1 ? 'lístok' : 'lístkov'}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 text-right">
                  <div>
                    <div className="font-semibold text-slate-900">{formatPrice(o.totalAmount)}</div>
                    {o.discountAmount > 0 && (
                      <div className="text-xs text-emerald-600">−{formatPrice(o.discountAmount)}{o.couponCode ? ` ${o.couponCode}` : ''}</div>
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
