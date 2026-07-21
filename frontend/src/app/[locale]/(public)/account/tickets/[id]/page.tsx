'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useFormatter } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { myApi, MyTicket } from '@/lib/api';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { Calendar, MapPin, ArrowLeft, Loader2, Clock } from 'lucide-react';
import { QrCodeBox } from '@/components/qr/QrCodeBox';

export default function TicketPage({ params }: { params: { id: string } }) {
  const t = useTranslations('account');
  const format = useFormatter();
  const { id } = params;
  const router = useRouter();
  const { isLoggedIn, isLoading } = usePublicAuth();
  const [ticket, setTicket] = useState<MyTicket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/account/login');
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;
    getValidToken().then((token) => {
      if (!token) return;
      return myApi.ticket(id, token);
    }).then((t) => t && setTicket(t))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, isLoggedIn]);

  if (isLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  if (!ticket) {
    return <div className="py-20 text-center text-gray-500 dark:text-gray-400">{t('ticketNotFound')}</div>;
  }

  return (
    <div className="mx-auto max-w-sm">
      <Link href="/account/tickets" className="mb-6 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800">
        <ArrowLeft size={14} /> {t('allTickets')}
      </Link>

      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg">
        {/* Header */}
        <div className="bg-indigo-600 px-5 py-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wider opacity-75">{t('ticketLabel')}</p>
          <h1 className="mt-0.5 text-xl font-bold leading-tight">{ticket.termin.show.name}</h1>
          <p className="mt-1 text-sm font-medium opacity-90">{ticket.ticketType.name}</p>
        </div>

        {/* Event info */}
        <div className="space-y-2 bg-indigo-50 px-5 py-3 text-sm text-indigo-800">
          <p className="flex items-center gap-1.5">
            <Calendar size={13} />
            {format.dateTime(new Date(ticket.termin.startsAt), { timeZone: ticket.termin.timezone, weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          {ticket.termin.doorsOpenAt && (
            <p className="flex items-center gap-1.5 text-xs opacity-75">
              <Clock size={12} />
              {t('doors')} {format.dateTime(new Date(ticket.termin.doorsOpenAt), { timeZone: ticket.termin.timezone, hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <p className="flex items-center gap-1.5">
            <MapPin size={13} />
            {ticket.termin.venue.name}
            {ticket.termin.venue.city ? `, ${ticket.termin.venue.city}` : ''}
            {ticket.termin.venue.street ? ` – ${ticket.termin.venue.street}` : ''}
          </p>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center px-5 py-6">
          {/*
            QR sa reálne skenuje pri vstupe – QrCodeBox drží čiernu na bielej
            s vlastnou bielou quiet zone, takže rámovanie podľa statusu (ani
            dark téma) nezasahuje do skenovateľnosti. opacity-60 pri už
            použitom lístku je zámerné (nemá sa dať naskenovať znova).
          */}
          <div className={`rounded-xl p-3 shadow-inner ${
            ticket.status === 'VALID' ? 'bg-gray-50 dark:bg-gray-900' : 'bg-red-50 opacity-60'
          }`}>
            <QrCodeBox value={ticket.qrToken} size={280} />
          </div>
          {ticket.status !== 'VALID' && (
            <p className="mt-3 text-sm font-medium text-red-600">{t('ticketUsed')}</p>
          )}
          <p className="mt-3 font-mono text-xs text-gray-400 dark:text-gray-500">
            {ticket.id.slice(-12).toUpperCase()}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-dashed border-gray-200 dark:border-gray-800 px-5 py-3 text-xs text-gray-400 dark:text-gray-500 text-center">
          {t('orderShort')} {ticket.order.orderNumber} • {t('qrSingleUse')}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
        {t('showQrAtEntryFull')}
      </p>
    </div>
  );
}
