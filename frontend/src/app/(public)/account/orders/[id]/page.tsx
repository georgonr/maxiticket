'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ArrowLeft, Loader2, FileDown, Calendar, MapPin, Ticket as TicketIcon } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { accountApi, AccountOrderDetail } from '@/lib/api/account';
import { formatPrice, formatDate } from '@/lib/format';
import { QrCanvas } from '@/components/pos/QrCanvas';

const STATUS: Record<string, { label: string; cls: string }> = {
  PAID: { label: 'Zaplatené', cls: 'bg-emerald-50 text-emerald-700' },
  PENDING: { label: 'Čaká na platbu', cls: 'bg-amber-50 text-amber-700' },
  REFUNDED: { label: 'Refundované', cls: 'bg-orange-50 text-orange-700' },
  CANCELLED: { label: 'Zrušené', cls: 'bg-slate-100 text-slate-500' },
  FAILED: { label: 'Zlyhalo', cls: 'bg-red-50 text-red-700' },
};

const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  VALID: { label: 'Platný', cls: 'bg-emerald-50 text-emerald-700' },
  USED: { label: 'Použitý', cls: 'bg-slate-100 text-slate-500' },
  CANCELLED: { label: 'Zrušený', cls: 'bg-red-50 text-red-700' },
  REFUNDED: { label: 'Refundovaný', cls: 'bg-orange-50 text-orange-700' },
};

export default function AccountOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = usePublicAuth();
  const [order, setOrder] = useState<AccountOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { router.replace(`/account/login?next=/account/orders/${id}`); return; }
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/account/login'); return; }
      try {
        setOrder(await accountApi.order(id, token));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Načítanie objednávky zlyhalo.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn, id]);

  async function downloadReceipt() {
    setDownloading(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const blob = await accountApi.receiptPdf(id, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `potvrdenie-${order?.orderNumber ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stiahnutie dokladu zlyhalo.');
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return (
      <div>
        <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-purple-700 hover:underline"><ArrowLeft size={15} /> Späť na objednávky</Link>
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }
  if (!order) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600" size={32} /></div>;
  }

  const st = STATUS[order.status] ?? { label: order.status, cls: 'bg-slate-100 text-slate-500' };
  const subtotal = order.totalAmount + order.discountAmount;

  return (
    <div className="space-y-5">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-purple-700 hover:underline"><ArrowLeft size={15} /> Späť na objednávky</Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-slate-900">{order.orderNumber}</h1>
          <p className="text-sm text-slate-500">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('rounded-full px-2.5 py-1 text-sm font-medium', st.cls)}>{st.label}</span>
          {order.status === 'PAID' && (
            <button onClick={downloadReceipt} disabled={downloading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Stiahnuť doklad
            </button>
          )}
        </div>
      </div>

      {/* Položky */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Položky</h2>
        <div className="divide-y divide-slate-100">
          {order.items.map((it, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <div className="font-medium text-slate-800">{it.showTitle ?? '—'}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-400">
                  {it.terminStartsAt && <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatDate(it.terminStartsAt)}</span>}
                  {it.venueName && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {it.venueName}{it.venueCity ? `, ${it.venueCity}` : ''}</span>}
                </div>
                <div className="text-sm text-slate-500">{it.ticketTypeName} · {it.quantity}× {formatPrice(it.unitPrice, order.currency)}</div>
              </div>
              <span className="font-semibold text-slate-900">{formatPrice(it.lineTotal, order.currency)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
          {order.discountAmount > 0 && (
            <>
              <div className="flex justify-between text-slate-500"><span>Medzisúčet</span><span>{formatPrice(subtotal, order.currency)}</span></div>
              <div className="flex justify-between text-emerald-600"><span>Zľava{order.couponCode ? ` (${order.couponCode})` : ''}</span><span>−{formatPrice(order.discountAmount, order.currency)}</span></div>
            </>
          )}
          <div className="flex justify-between pt-1"><span className="font-semibold text-slate-900">Spolu</span><span className="text-lg font-bold text-slate-900">{formatPrice(order.totalAmount, order.currency)}</span></div>
        </div>
      </div>

      {/* Lístky s QR */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-900">Vstupenky ({order.tickets.length})</h2>
        {order.tickets.length === 0 ? (
          <p className="text-sm text-slate-400">Vstupenky budú dostupné po zaplatení.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {order.tickets.map((t) => {
              const ts = TICKET_STATUS[t.status] ?? { label: t.status, cls: 'bg-slate-100 text-slate-500' };
              return (
                <div key={t.ticketId} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 p-3">
                  <QrCanvas value={t.qrToken} size={140} />
                  <span className="font-mono text-xs text-slate-400">{t.maskedCode}</span>
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-medium', ts.cls)}>{ts.label}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400"><TicketIcon size={12} /> QR kód ukážte pri vstupe na podujatie.</p>
      </div>
    </div>
  );
}
