'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { clsx } from 'clsx';
import { ArrowLeft, Loader2, FileDown, Calendar, MapPin, Ticket as TicketIcon, RotateCcw, X } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { localizeApiError } from '@/lib/api-error';
import { usePublicAuth } from '@/lib/public-auth';
import { accountApi, AccountOrderDetail } from '@/lib/api/account';
import { QrCanvas } from '@/components/pos/QrCanvas';

const STATUS_CLS: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  REFUND_REQUESTED: 'bg-amber-50 text-amber-700',
  REFUND_APPROVED: 'bg-sky-50 text-sky-700',
  REFUND_REJECTED: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  REFUNDED: 'bg-orange-50 text-orange-700',
  CANCELLED: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  FAILED: 'bg-red-50 text-red-700',
};

const REFUND_STATUS_CLS: Record<string, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-sky-50 text-sky-700',
  REJECTED: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  REFUNDED: 'bg-orange-50 text-orange-700',
};

const TICKET_STATUS_CLS: Record<string, string> = {
  VALID: 'bg-emerald-50 text-emerald-700',
  USED: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  CANCELLED: 'bg-red-50 text-red-700',
  REFUNDED: 'bg-orange-50 text-orange-700',
};

export default function AccountOrderDetailPage() {
  const t = useTranslations('account');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = usePublicAuth();
  const [order, setOrder] = useState<AccountOrderDetail | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState('');

  async function reloadOrder() {
    const token = await getValidToken();
    if (!token) return;
    setOrder(await accountApi.order(id, token));
  }

  async function submitRefund() {
    if (refundReason.trim().length < 3) {
      setRefundError(t('refundReasonTooShort'));
      return;
    }
    setRefundSubmitting(true);
    setRefundError('');
    try {
      const token = await getValidToken();
      if (!token) return;
      await accountApi.requestRefund(id, refundReason.trim(), token);
      setRefundOpen(false);
      setRefundReason('');
      await reloadOrder();
    } catch (e) {
      setRefundError(e instanceof Error ? e.message : t('refundSubmitFailed'));
    } finally {
      setRefundSubmitting(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { router.replace(`/account/login?next=/account/orders/${id}`); return; }
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/account/login'); return; }
      try {
        setOrder(await accountApi.order(id, token));
      } catch (e) {
        setError(localizeApiError(tErrors, e, t('orderLoadFailed')));
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
      setError(localizeApiError(tErrors, e, t('receiptDownloadFailed')));
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return (
      <div>
        <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-purple-700 hover:underline"><ArrowLeft size={15} /> {t('backToOrders')}</Link>
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }
  if (!order) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600" size={32} /></div>;
  }

  const stLabel = STATUS_CLS[order.status] ? t(`status.${order.status}` as never) : order.status;
  const stCls = STATUS_CLS[order.status] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
  const subtotal = order.totalAmount + order.discountAmount;

  return (
    <div className="space-y-5">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-purple-700 hover:underline"><ArrowLeft size={15} /> {t('backToOrders')}</Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-slate-100">{order.orderNumber}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{format.dateTime(new Date(order.createdAt), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx('rounded-full px-2.5 py-1 text-sm font-medium', stCls)}>{stLabel}</span>
          {order.status === 'PAID' && (
            <button onClick={downloadReceipt} disabled={downloading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} {t('downloadReceipt')}
            </button>
          )}
        </div>
      </div>

      {/* Položky */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t('items')}</h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {order.items.map((it, idx) => (
            <div key={idx} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <div className="font-medium text-slate-800 dark:text-slate-100">{it.showTitle ?? '—'}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-400 dark:text-slate-500">
                  {it.terminStartsAt && <span className="inline-flex items-center gap-1"><Calendar size={11} /> {format.dateTime(new Date(it.terminStartsAt), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                  {it.venueName && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {it.venueName}{it.venueCity ? `, ${it.venueCity}` : ''}</span>}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{it.ticketTypeName} · {it.quantity}× {format.number(it.unitPrice, { style: 'currency', currency: order.currency })}</div>
              </div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{format.number(it.lineTotal, { style: 'currency', currency: order.currency })}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm">
          {(order.discountAmount > 0 || order.feeAmount > 0) && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>{t('subtotal')}</span><span>{format.number(subtotal, { style: 'currency', currency: order.currency })}</span></div>
          )}
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600"><span>{t('discount')}{order.couponCode ? ` (${order.couponCode})` : ''}</span><span>−{format.number(order.discountAmount, { style: 'currency', currency: order.currency })}</span></div>
          )}
          {order.feeAmount > 0 && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>{t('processingFee')}</span><span>{format.number(order.feeAmount, { style: 'currency', currency: order.currency })}</span></div>
          )}
          <div className="flex justify-between pt-1"><span className="font-semibold text-slate-900 dark:text-slate-100">{t('total')}</span><span className="text-lg font-bold text-slate-900 dark:text-slate-100">{format.number(order.totalAmount + order.feeAmount, { style: 'currency', currency: order.currency })}</span></div>
        </div>
      </div>

      {/* Vrátenie peňazí */}
      {(order.canRequestRefund || order.refundRequests.length > 0) && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('refundTitle')}</h2>
            {order.canRequestRefund && (
              <button
                onClick={() => { setRefundError(''); setRefundOpen(true); }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <RotateCcw size={15} /> {t('refundRequest')}
              </button>
            )}
          </div>
          {order.refundRequests.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
              {t('refundHint')}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {order.refundRequests.map((r) => {
                const rsLabel = REFUND_STATUS_CLS[r.status] ? t(`refundStatus.${r.status}` as never) : r.status;
                const rsCls = REFUND_STATUS_CLS[r.status] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
                return (
                  <div key={r.id} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', rsCls)}>{rsLabel}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{format.dateTime(new Date(r.requestedAt), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300"><span className="text-slate-400 dark:text-slate-500">{t('reasonLabel')}</span> {r.reason}</p>
                    {r.status === 'REJECTED' && r.reviewNote && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400"><span className="text-slate-400 dark:text-slate-500">{t('organizerNoteLabel')}</span> {r.reviewNote}</p>
                    )}
                    {r.refundAmount != null && (r.status === 'APPROVED' || r.status === 'REFUNDED') && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400"><span className="text-slate-400 dark:text-slate-500">{t('amountLabel')}</span> {format.number(r.refundAmount, { style: 'currency', currency: order.currency })}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lístky s QR */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t('ticketsHeading', { count: order.tickets.length })}</h2>
        {order.tickets.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('ticketsAfterPayment')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {order.tickets.map((tk) => {
              const tsLabel = TICKET_STATUS_CLS[tk.status] ? t(`ticketStatus.${tk.status}` as never) : tk.status;
              const tsCls = TICKET_STATUS_CLS[tk.status] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
              return (
                <div key={tk.ticketId} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                  <QrCanvas value={tk.qrToken} size={140} />
                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{tk.maskedCode}</span>
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-medium', tsCls)}>{tsLabel}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500"><TicketIcon size={12} /> {t('showQrAtEntry')}</p>
      </div>

      {/* Modal – žiadosť o vrátenie */}
      {refundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !refundSubmitting && setRefundOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t('refundModalTitle')}</h3>
              <button onClick={() => !refundSubmitting && setRefundOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('orderLabel')} {order.orderNumber} · {format.number(order.totalAmount, { style: 'currency', currency: order.currency })}</p>
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">{t('refundReasonLabel')}</label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={t('refundReasonPlaceholder')}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            {refundError && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{refundError}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRefundOpen(false)} disabled={refundSubmitting} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">{t('cancel')}</button>
              <button onClick={submitRefund} disabled={refundSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
                {refundSubmitting && <Loader2 size={15} className="animate-spin" />} {t('submitRefund')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
