'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowLeft, Loader2, User, Ticket as TicketIcon } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { OrderDetail } from '@/lib/api/orders';
import { formatPrice, formatDate } from '@/lib/format';
import { OrderStatusBadge } from '@/components/dashboard/parts';

const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  VALID: { label: 'Platný', cls: 'bg-emerald-50 text-emerald-700' },
  USED: { label: 'Použitý', cls: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: 'Zrušený', cls: 'bg-red-50 text-red-700' },
  REFUNDED: { label: 'Refundovaný', cls: 'bg-orange-50 text-orange-700' },
};

const PROVIDER_LABEL: Record<string, string> = {
  stripe: 'Stripe',
  comp: 'Zdarma (comp)',
  manual: 'Manuál',
  mock: 'Test',
};

function readableError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 403) return 'Táto objednávka nepatrí vašej organizácii.';
    if (e.status === 404) return 'Objednávka neexistuje.';
    if (e.status === 401) return 'Vaše prihlásenie vypršalo.';
    return e.message || 'Niečo sa pokazilo.';
  }
  return 'Nemôžeme sa pripojiť k serveru.';
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

export function OrderDetailPanel({
  id,
  fetchOrder,
  backHref,
}: {
  id: string;
  fetchOrder: (id: string, token: string) => Promise<OrderDetail>;
  backHref: string;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getValidToken().then(async (token) => {
      if (!token) {
        if (active) setError('Vaše prihlásenie vypršalo.');
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

  const subtotal = order ? order.totalAmount + order.discountAmount : 0;

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <ArrowLeft size={15} /> Späť na objednávky
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
              <h1 className="font-mono text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
              <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <Card title="Kupujúci">
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{order.buyerName ?? '—'}</span>
                <span
                  className={clsx(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    order.isGuest ? 'bg-gray-100 text-gray-500' : 'bg-sky-50 text-sky-700',
                  )}
                >
                  <User size={9} /> {order.isGuest ? 'hosť' : 'registrovaný'}
                </span>
              </div>
              <div className="text-gray-600">{order.buyerEmail}</div>
              {order.userEmail && order.userEmail !== order.buyerEmail && (
                <div className="text-xs text-gray-400">Účet: {order.userEmail}</div>
              )}
              {order.buyerPhone && <div className="text-gray-600">{order.buyerPhone}</div>}
              {order.organizerName && (
                <div className="text-xs text-gray-400">Organizátor: {order.organizerName}</div>
              )}
            </div>
          </Card>

          <Card title="Položky">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                    <th className="py-2 pr-3 font-medium">Podujatie / termín</th>
                    <th className="py-2 px-3 font-medium">Typ lístka</th>
                    <th className="py-2 px-3 font-medium text-right">Ks</th>
                    <th className="py-2 px-3 font-medium text-right">Cena</th>
                    <th className="py-2 pl-3 font-medium text-right">Spolu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {order.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-gray-800">{it.showTitle ?? '—'}</div>
                        {it.terminStartsAt && (
                          <div className="text-xs text-gray-400">{formatDate(it.terminStartsAt)}</div>
                        )}
                      </td>
                      <td className="px-3 text-gray-600">{it.ticketTypeName ?? '—'}</td>
                      <td className="px-3 text-right tabular-nums text-gray-600">{it.quantity}</td>
                      <td className="px-3 text-right tabular-nums text-gray-600">{formatPrice(it.unitPrice)}</td>
                      <td className="pl-3 text-right tabular-nums font-medium text-gray-800">{formatPrice(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-sm">
              {order.discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>Medzisúčet</span>
                    <span className="tabular-nums">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Zľava{order.couponCode ? ` (${order.couponCode})` : ''}</span>
                    <span className="tabular-nums">−{formatPrice(order.discountAmount)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-1">
                <span className="font-semibold text-gray-900">Spolu</span>
                <span className="text-lg font-bold text-gray-900 tabular-nums">{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </Card>

          <Card title={`Lístky (${order.tickets.length})`}>
            {order.tickets.length === 0 ? (
              <p className="text-sm text-gray-400">Žiadne vygenerované lístky.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {order.tickets.map((t) => {
                  const m = TICKET_STATUS[t.status] ?? { label: t.status, cls: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={t.ticketId} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
                      <TicketIcon size={13} className="text-gray-400" />
                      <span className="font-mono text-gray-700">…{t.codeSuffix}</span>
                      <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-medium', m.cls)}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Platba">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Spôsob</span>
                <span className="font-medium text-gray-800">
                  {order.paymentProvider ? PROVIDER_LABEL[order.paymentProvider] ?? order.paymentProvider : '—'}
                </span>
              </div>
              {order.paymentRef && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Referencia</span>
                  <span className="font-mono text-xs text-gray-600">{order.paymentRef}</span>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Zaplatené</span>
                  <span className="text-gray-700">{formatDate(order.paidAt)}</span>
                </div>
              )}
              {order.refundedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Refundované</span>
                  <span className="text-gray-700">{formatDate(order.refundedAt)}</span>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
