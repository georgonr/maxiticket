'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { myApi, MyTicket } from '@/lib/api';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { formatDate } from '@/lib/format';
import { Calendar, MapPin, ArrowLeft, Loader2, Clock } from 'lucide-react';
import QRCode from 'qrcode';

export default function TicketPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { isLoggedIn, isLoading } = usePublicAuth();
  const [ticket, setTicket] = useState<MyTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Render QR code to canvas
  useEffect(() => {
    if (!ticket || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, ticket.qrToken, {
      width: 280,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    }).catch(console.error);
  }, [ticket]);

  if (isLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  if (!ticket) {
    return <div className="py-20 text-center text-gray-500">Vstupenka nenájdená.</div>;
  }

  return (
    <div className="mx-auto max-w-sm">
      <Link href="/account/tickets" className="mb-6 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={14} /> Všetky lístky
      </Link>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
        {/* Header */}
        <div className="bg-indigo-600 px-5 py-4 text-white">
          <p className="text-xs font-medium uppercase tracking-wider opacity-75">Vstupenka / Ticket</p>
          <h1 className="mt-0.5 text-xl font-bold leading-tight">{ticket.termin.show.name}</h1>
          <p className="mt-1 text-sm font-medium opacity-90">{ticket.ticketType.name}</p>
        </div>

        {/* Event info */}
        <div className="space-y-2 bg-indigo-50 px-5 py-3 text-sm text-indigo-800">
          <p className="flex items-center gap-1.5">
            <Calendar size={13} />
            {formatDate(ticket.termin.startsAt, ticket.termin.timezone)}
          </p>
          {ticket.termin.doorsOpenAt && (
            <p className="flex items-center gap-1.5 text-xs opacity-75">
              <Clock size={12} />
              Dvere: {formatDate(ticket.termin.doorsOpenAt, ticket.termin.timezone, { weekday: undefined, year: undefined, month: undefined, day: undefined })}
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
          <div className={`rounded-xl p-3 shadow-inner ${
            ticket.status === 'VALID' ? 'bg-gray-50' : 'bg-red-50 opacity-60'
          }`}>
            <canvas ref={canvasRef} className="block" />
          </div>
          {ticket.status !== 'VALID' && (
            <p className="mt-3 text-sm font-medium text-red-600">Vstupenka bola použitá</p>
          )}
          <p className="mt-3 font-mono text-xs text-gray-400">
            {ticket.id.slice(-12).toUpperCase()}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-dashed border-gray-200 px-5 py-3 text-xs text-gray-400 text-center">
          Obj: {ticket.order.orderNumber} • QR kód je jednorazový
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        Predložte QR kód pri vstupe na podujatie
      </p>
    </div>
  );
}
