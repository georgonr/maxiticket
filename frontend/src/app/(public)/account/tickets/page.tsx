'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { myApi, MyTicket } from '@/lib/api';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { formatDate } from '@/lib/format';
import { Calendar, MapPin, Ticket, QrCode, ChevronRight } from 'lucide-react';
import { AccountTabs } from '@/components/account/AccountTabs';

export default function MyTicketsPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = usePublicAuth();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/account/login?next=/account/tickets');
    }
  }, [isLoading, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn) return;
    getValidToken().then((token) => {
      if (!token) return;
      return myApi.tickets(token);
    }).then((t) => t && setTickets(t))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  if (isLoading || loading) {
    return (
      <div className="space-y-3">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-7 w-40 rounded-full bg-slate-100 animate-pulse" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-100 bg-slate-50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <AccountTabs />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Ticket size={20} className="text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Moje lístky</h1>
          {tickets.length > 0 && (
            <p className="text-sm text-slate-400">{tickets.length} {tickets.length === 1 ? 'vstupenka' : tickets.length < 5 ? 'vstupenky' : 'vstupeniek'}</p>
          )}
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Ticket size={28} className="text-slate-300" />
          </div>
          <p className="font-semibold text-slate-500">Zatiaľ nemáte žiadne vstupenky</p>
          <p className="mt-1 text-sm text-slate-400">Kúpte si lístky na niektoré z našich podujatí</p>
          <Link
            href="/events"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-600 transition-colors"
          >
            Prehliadnuť podujatia
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/account/tickets/${ticket.id}`}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-purple-200 transition-all"
            >
              {/* Left: QR icon area */}
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 group-hover:bg-purple-100 transition-colors">
                <QrCode size={24} className="text-purple-600" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors line-clamp-1">
                  {ticket.termin.show.name}
                </p>
                <p className="text-sm font-medium text-purple-600">{ticket.ticketType.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar size={10} className="text-purple-400" />
                    {formatDate(ticket.termin.startsAt, ticket.termin.timezone, { year: undefined })}
                  </span>
                  {ticket.termin.venue.city && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={10} className="text-purple-400" />
                      {ticket.termin.venue.name}{ticket.termin.venue.city ? `, ${ticket.termin.venue.city}` : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Status + arrow */}
              <div className="ml-2 flex flex-shrink-0 flex-col items-end gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  ticket.status === 'VALID'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {ticket.status === 'VALID' ? 'Platná' : ticket.status}
                </span>
                <ChevronRight size={15} className="text-slate-400 group-hover:text-purple-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
