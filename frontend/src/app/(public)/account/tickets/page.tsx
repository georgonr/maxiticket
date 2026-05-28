'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { myApi, MyTicket } from '@/lib/api';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { formatDate, formatPrice } from '@/lib/format';
import { Calendar, MapPin, Ticket, Loader2, QrCode } from 'lucide-react';

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
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Ticket size={24} className="text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Moje lístky</h1>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Ticket size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">Zatiaľ nemáte žiadne vstupenky</p>
          <Link href="/events" className="text-indigo-600 hover:underline text-sm">Prehliadnuť podujatia</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/account/tickets/${ticket.id}`} className="block">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-indigo-600 truncate">
                    {ticket.termin.show.name}
                  </p>
                  <p className="text-sm font-medium text-indigo-600">{ticket.ticketType.name}</p>
                  <p className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <Calendar size={11} />
                    {formatDate(ticket.termin.startsAt, ticket.termin.timezone)}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={11} />
                    {ticket.termin.venue.name}{ticket.termin.venue.city ? `, ${ticket.termin.venue.city}` : ''}
                  </p>
                </div>
                <div className="ml-4 flex flex-col items-end gap-2">
                  <QrCode size={32} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ticket.status === 'VALID' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {ticket.status === 'VALID' ? 'Platná' : ticket.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
