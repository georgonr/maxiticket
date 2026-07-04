'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ordersApi, publicApi, Order, GuestTickets } from '@/lib/api';
import { getValidToken } from '@/lib/auth';
import { CheckCircle2, Ticket, Mail, Loader2, Clock, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QrCanvas } from '@/components/pos/QrCanvas';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_ATTEMPTS = 40; // ~100 s

export default function SuccessPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const t = useTranslations('checkout');
  const format = useFormatter();
  const fmtPrice = (amount: number, currency: string) => format.number(amount, { style: 'currency', currency });
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [guestTickets, setGuestTickets] = useState<GuestTickets | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [dlError, setDlError] = useState('');
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrder() {
      // token voliteľný – guest order je prístupný cez cuid id (OptionalJwtAuthGuard)
      const token = (await getValidToken()) ?? undefined;
      if (cancelled) return;
      try {
        const o = await ordersApi.get(id, token);
        if (cancelled) return;
        setOrder(o);

        if (o.status === 'PAID') {
          setLoading(false);
          setPolling(false);
          // Guest ticket view: po PAID príde v objednávke 1h token → načítaj lístky (QR/PDF).
          // Zlyhanie (expirovaný/neplatný token) → potichu fallback na e-mail.
          if (o.guestTicketToken) {
            try {
              const gt = await publicApi.guestTicketsByToken(o.guestTicketToken);
              if (!cancelled) setGuestTickets(gt);
            } catch { /* fallback na e-mail */ }
          }
          return;
        }

        // Order not yet paid – keep polling
        attemptsRef.current += 1;
        if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
          setLoading(false);
          setPolling(false);
          return;
        }

        setPolling(true);
        setLoading(false);
        timerRef.current = setTimeout(fetchOrder, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOrder();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id]);

  async function downloadTicketPdf(ticketId: string) {
    if (!order?.guestTicketToken) return;
    setDownloadingId(ticketId);
    setDlError('');
    try {
      const blob = await publicApi.guestTicketPdf(order.guestTicketToken, ticketId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vstupenka-${ticketId.slice(-6).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDlError(t('pdfDownloadFailed'));
    } finally {
      setDownloadingId(null);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  if (!order || order.status !== 'PAID') {
    return (
      <div className="mx-auto max-w-md text-center py-16">
        {polling ? (
          <>
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-yellow-100">
                <Clock size={40} className="text-yellow-600 animate-pulse" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('processing')}</h1>
            <p className="text-gray-500 mb-4">
              {t('processingDesc')}
            </p>
            <div className="flex justify-center">
              <Loader2 className="animate-spin text-indigo-500" size={24} />
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('notConfirmed')}</h1>
            <p className="text-gray-500 mb-6">
              {t('notConfirmedDesc')}
            </p>
            <Link href="/account/tickets">
              <Button size="lg" className="w-full gap-2">
                <Ticket size={16} /> {t('myTickets')}
              </Button>
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center py-12">
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={48} className="text-green-600" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('successTitle')}</h1>
      <p className="text-gray-500 mb-6">{t('orderLabel')} <strong>{order.orderNumber}</strong></p>

      {guestTickets && guestTickets.tickets.length > 0 ? (
        <>
          {/* e-mail + 1h platnosť odkazu */}
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 mb-6 text-left">
            <Mail size={16} className="mt-0.5 flex-shrink-0" />
            <span>{t('ticketValidityNotice')}</span>
          </div>

          {/* Lístky s QR + stiahnutie PDF (rovnaký QR aj PDF ako v e-maile) */}
          <div className="space-y-4 mb-6">
            {guestTickets.tickets.map((tk) => (
              <div key={tk.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="bg-indigo-600 px-5 py-3 text-left text-white">
                  <p className="text-xs font-medium uppercase tracking-wider opacity-75">{guestTickets.showName}</p>
                  <p className="text-sm font-semibold">{tk.typeName}</p>
                </div>
                <div className="flex flex-col items-center px-5 py-6">
                  <div className="rounded-xl bg-gray-50 p-3 shadow-inner">
                    <QrCanvas value={tk.qrToken} size={220} />
                  </div>
                  <p className="mt-3 font-mono text-xs text-gray-400">{tk.id.slice(-12).toUpperCase()}</p>
                  <p className="mt-1 text-xs text-gray-400">{t('showQrAtEntry')}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-2"
                    loading={downloadingId === tk.id}
                    onClick={() => downloadTicketPdf(tk.id)}
                  >
                    <Download size={15} /> {t('downloadPdf')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {dlError && <p className="mb-4 text-sm text-red-600">{dlError}</p>}
        </>
      ) : (
        /* Token chýba / expiroval → žiadny leak, len odkaz na e-mail */
        <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-5 py-3 text-sm text-blue-700 mb-6">
          <Mail size={16} />
          {t('emailFallback')}
        </div>
      )}

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm">
        <p className="text-sm font-medium text-gray-500 mb-2">{t('purchasedTickets')}</p>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-700">{item.priceSnapshot.name} × {item.quantity}</span>
            <span className="font-medium">{fmtPrice(Number(item.unitPrice) * item.quantity, item.currency)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
          <span>{t('totalLabel')}</span>
          <span className="text-indigo-600">{fmtPrice(Number(order.totalAmount), order.currency)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/account/tickets">
          <Button size="lg" className="w-full gap-2">
            <Ticket size={16} /> {t('viewMyTickets')}
          </Button>
        </Link>
        <Link href="/events">
          <Button size="lg" variant="outline" className="w-full">{t('moreEvents')}</Button>
        </Link>
      </div>
    </div>
  );
}
