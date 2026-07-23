'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useTranslations, useFormatter } from 'next-intl';
import { ArrowLeft, Loader2, User, Ticket as TicketIcon, MailCheck, MailX, MailWarning, Send } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { OrderDetail, TicketsDelivery } from '@/lib/api/orders';
import { OrderStatusBadge } from '@/components/dashboard/parts';

const TICKET_STATUS_CLS: Record<string, string> = {
  VALID: 'bg-emerald-50 text-emerald-700',
  USED: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  CANCELLED: 'bg-red-50 text-red-700',
  REFUNDED: 'bg-orange-50 text-orange-700',
};

// Stav doručenia lístkov → farba + ikona (krok 48).
const DELIVERY_META: Record<TicketsDelivery, { cls: string; Icon: typeof MailCheck }> = {
  delivered: { cls: 'bg-emerald-50 text-emerald-700', Icon: MailCheck },
  failed: { cls: 'bg-red-50 text-red-700', Icon: MailX },
  retrying: { cls: 'bg-amber-50 text-amber-700', Icon: MailWarning },
  unknown: { cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400', Icon: MailWarning },
  na: { cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400', Icon: MailWarning },
};

const REFUND_STATUS_CLS: Record<string, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-sky-50 text-sky-700',
  REJECTED: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  REFUNDED: 'bg-orange-50 text-orange-700',
};

const PROVIDER_KEYS: Record<string, string> = {
  stripe: 'stripe',
  pos_cash: 'pos_cash',
  pos_card: 'pos_card',
  comp: 'comp',
  manual: 'manual',
  mock: 'mock',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </div>
  );
}

export function OrderDetailPanel({
  id,
  fetchOrder,
  backHref,
  resend,
}: {
  id: string;
  fetchOrder: (id: string, token: string) => Promise<OrderDetail>;
  backHref: string;
  // Krok 48: manuálne „Odoslať lístky znova" (len admin). Ak nie je, tlačidlo sa nezobrazí.
  resend?: (id: string, token: string) => Promise<{ orderId: string; message: string }>;
}) {
  const t = useTranslations('organizer.orders');
  const te = useTranslations('ekasa');
  const format = useFormatter();
  const fmtDate = (iso: string) =>
    format.dateTime(new Date(iso), {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const fmtPrice = (amount: number | string, currency = 'EUR') =>
    format.number(Number(amount), { style: 'currency', currency });

  const readableError = (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.status === 403) return t('detailErrorForbidden');
      if (e.status === 404) return t('detailErrorNotFound');
      if (e.status === 401) return t('detailErrorExpired');
      return e.message || t('errorGeneric');
    }
    return t('errorConnection');
  };

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    getValidToken().then(async (token) => {
      if (!token) {
        if (active) setError(t('detailErrorExpired'));
        return;
      }
      try {
        const data = await fetchOrder(id, token);
        if (active) setOrder(data);
      } catch (e) {
        if (active) setError(readableError(e));
      }
    });
    return () => {
      active = false;
    };
  }, [id, fetchOrder]);

  async function handleResend() {
    if (!resend) return;
    setResending(true);
    setResendMsg(null);
    try {
      const token = await getValidToken();
      if (!token) { setResendMsg({ ok: false, text: t('detailErrorExpired') }); return; }
      await resend(id, token);
      const fresh = await fetchOrder(id, token); // znovu načítaj → stav doručenia sa aktualizuje
      setOrder(fresh);
      setResendMsg({ ok: true, text: t('delivery.resendOk') });
    } catch (e) {
      setResendMsg({ ok: false, text: e instanceof ApiError ? (e.message || t('delivery.resendFail')) : t('delivery.resendFail') });
    } finally {
      setResending(false);
    }
  }

  const subtotal = order ? order.totalAmount + order.discountAmount : 0;

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> {t('backToOrders')}
      </Link>

      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : !order ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand" size={32} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-mono text-2xl font-bold text-gray-900 dark:text-gray-100">{order.orderNumber}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{fmtDate(order.createdAt)}</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <Card title={t('buyer')}>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 dark:text-gray-100">{order.buyerName ?? '—'}</span>
                <span
                  className={clsx(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    order.isGuest ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' : 'bg-sky-50 text-sky-700',
                  )}
                >
                  <User size={9} /> {order.isGuest ? t('guest') : t('registered')}
                </span>
              </div>
              <div className="text-gray-600 dark:text-gray-300">{order.buyerEmail}</div>
              {order.userEmail && order.userEmail !== order.buyerEmail && (
                <div className="text-xs text-gray-400 dark:text-gray-500">{t('account')}: {order.userEmail}</div>
              )}
              {order.buyerPhone && <div className="text-gray-600 dark:text-gray-300">{order.buyerPhone}</div>}
              {order.organizerName && (
                <div className="text-xs text-gray-400 dark:text-gray-500">{t('organizer')}: {order.organizerName}</div>
              )}
            </div>
          </Card>

          <Card title={t('items')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                    <th className="py-2 pr-3 font-medium">{t('itemCol.event')}</th>
                    <th className="py-2 px-3 font-medium">{t('itemCol.ticketType')}</th>
                    <th className="py-2 px-3 font-medium text-right">{t('itemCol.qty')}</th>
                    <th className="py-2 px-3 font-medium text-right">{t('itemCol.price')}</th>
                    <th className="py-2 pl-3 font-medium text-right">{t('itemCol.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {order.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{it.showTitle ?? '—'}</div>
                        {it.terminStartsAt && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(it.terminStartsAt)}</div>
                        )}
                      </td>
                      <td className="px-3 text-gray-600 dark:text-gray-300">{it.ticketTypeName ?? '—'}</td>
                      <td className="px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{it.quantity}</td>
                      <td className="px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtPrice(it.unitPrice)}</td>
                      <td className="pl-3 text-right tabular-nums font-medium text-gray-800 dark:text-gray-100">{fmtPrice(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
              {order.discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400">
                    <span>{t('subtotal')}</span>
                    <span className="tabular-nums">{fmtPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>{t('discount')}{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                    <span className="tabular-nums">−{fmtPrice(order.discountAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-1">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{t('grandTotal')}</span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{fmtPrice(order.totalAmount)}</span>
              </div>
            </div>
          </Card>

          <Card title={t('ticketsTitle', { count: order.tickets.length })}>
            {order.tickets.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('noTickets')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {order.tickets.map((tk) => {
                  const cls = TICKET_STATUS_CLS[tk.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
                  const label = TICKET_STATUS_CLS[tk.status] ? t(`ticketStatus.${tk.status}`) : tk.status;
                  return (
                    <div key={tk.ticketId} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm">
                      <TicketIcon size={13} className="text-gray-400 dark:text-gray-500" />
                      <span className="font-mono text-gray-700 dark:text-gray-200">…{tk.codeSuffix}</span>
                      <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-medium', cls)}>{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Krok 48: stav doručenia lístkov e-mailom + manuálny resend (len po PAID). */}
          {order.ticketsDelivery !== 'na' && (() => {
            const meta = DELIVERY_META[order.ticketsDelivery];
            const DIcon = meta.Icon;
            return (
              <Card title={t('delivery.title')}>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', meta.cls)}>
                      <DIcon size={13} /> {t(`delivery.${order.ticketsDelivery}`)}
                    </span>
                    {resend && (
                      <button
                        onClick={handleResend}
                        disabled={resending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {resending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        {t('delivery.resend')}
                      </button>
                    )}
                  </div>
                  {order.ticketsEmailedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">{t('delivery.emailedAt')}</span>
                      <span className="text-gray-700 dark:text-gray-200">{fmtDate(order.ticketsEmailedAt)}</span>
                    </div>
                  )}
                  {order.ticketsEmailAttempts > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">{t('delivery.attempts')}</span>
                      <span className="text-gray-700 dark:text-gray-200 tabular-nums">{order.ticketsEmailAttempts}</span>
                    </div>
                  )}
                  {order.ticketsEmailError && (order.ticketsDelivery === 'failed' || order.ticketsDelivery === 'retrying') && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 break-words">
                      {t('delivery.error')}: {order.ticketsEmailError}
                    </p>
                  )}
                  {order.ticketsDelivery === 'unknown' && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{t('delivery.unknownHint')}</p>
                  )}
                  {resendMsg && (
                    <p className={clsx('text-xs', resendMsg.ok ? 'text-emerald-600' : 'text-red-600')}>{resendMsg.text}</p>
                  )}
                </div>
              </Card>
            );
          })()}

          <Card title={t('payment')}>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">{t('method')}</span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {order.paymentProvider ? (PROVIDER_KEYS[order.paymentProvider] ? t(`provider.${order.paymentProvider}`) : order.paymentProvider) : '—'}
                </span>
              </div>
              {order.paymentRef && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('reference')}</span>
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-300">{order.paymentRef}</span>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('paidAt')}</span>
                  <span className="text-gray-700 dark:text-gray-200">{fmtDate(order.paidAt)}</span>
                </div>
              )}
              {order.refundedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('refundedAt')}</span>
                  <span className="text-gray-700 dark:text-gray-200">{fmtDate(order.refundedAt)}</span>
                </div>
              )}
              {order.ekasaStatus && order.ekasaStatus !== 'NONE' && (
                <div className="flex items-start justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-1.5">
                  <span className="text-gray-500 dark:text-gray-400">{te('label')}</span>
                  <span className="text-right">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      order.ekasaStatus === 'REGISTERED' ? 'bg-emerald-50 text-emerald-700'
                        : order.ekasaStatus === 'OFFLINE' ? 'bg-amber-50 text-amber-700'
                        : order.ekasaStatus === 'FAILED' ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-600'}`}>
                      {te(`status.${order.ekasaStatus}`)}
                    </span>
                    {order.ekasaReceiptNumber && <span className="block text-xs text-gray-500 dark:text-gray-400">{te('receiptNo')}: {order.ekasaReceiptNumber}</span>}
                    {order.ekasaReceiptId && <span className="block font-mono text-[10px] text-gray-400 dark:text-gray-500">{order.ekasaReceiptId}</span>}
                    {order.ekasaStatus === 'FAILED' && order.ekasaError && <span className="block text-xs text-red-600">{order.ekasaError}</span>}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {order.refundRequests.length > 0 && (
            <Card title={t('refundTitle')}>
              <div className="space-y-3">
                {order.refundRequests.map((r) => {
                  const rsCls = REFUND_STATUS_CLS[r.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
                  const rsLabel = REFUND_STATUS_CLS[r.status] ? t(`refundStatus.${r.status}`) : r.status;
                  return (
                    <div key={r.id} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', rsCls)}>{rsLabel}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{fmtDate(r.requestedAt)}</span>
                      </div>
                      <p className="mt-2 text-gray-600 dark:text-gray-300"><span className="text-gray-400 dark:text-gray-500">{t('reason')}:</span> {r.reason}</p>
                      {r.reviewNote && <p className="mt-1 text-gray-500 dark:text-gray-400"><span className="text-gray-400 dark:text-gray-500">{t('note')}:</span> {r.reviewNote}</p>}
                      {r.refundAmount != null && (
                        <p className="mt-1 text-gray-500 dark:text-gray-400"><span className="text-gray-400 dark:text-gray-500">{t('amount')}:</span> {fmtPrice(r.refundAmount, order.currency)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
