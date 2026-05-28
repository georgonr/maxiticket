'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ordersApi, Order } from '@/lib/api';
import { getValidToken } from '@/lib/auth';
import { formatPrice } from '@/lib/format';
import { CheckCircle2, Ticket, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SuccessPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getValidToken().then((token) => {
      if (!token) return;
      return ordersApi.get(id, token);
    }).then((o) => o && setOrder(o))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>;
  }

  return (
    <div className="mx-auto max-w-md text-center py-12">
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={48} className="text-green-600" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Platba úspešná!</h1>
      {order && (
        <p className="text-gray-500 mb-1">Objednávka <strong>{order.orderNumber}</strong></p>
      )}
      <p className="text-gray-500 mb-8">
        Vstupenky sme odoslali na váš e-mail. Nájdete ich aj v sekcii Moje lístky.
      </p>

      <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-5 py-3 text-sm text-blue-700 mb-6">
        <Mail size={16} />
        Skontrolujte si e-mail s vstupenkami a QR kódmi
      </div>

      {order && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm">
          <p className="text-sm font-medium text-gray-500 mb-2">Zakúpené vstupenky</p>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-700">{item.priceSnapshot.name} × {item.quantity}</span>
              <span className="font-medium">{formatPrice(Number(item.unitPrice) * item.quantity, item.currency)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
            <span>Celkom</span>
            <span className="text-indigo-600">{formatPrice(Number(order.totalAmount), order.currency)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Link href="/account/tickets">
          <Button size="lg" className="w-full gap-2">
            <Ticket size={16} /> Zobraziť moje lístky
          </Button>
        </Link>
        <Link href="/events">
          <Button size="lg" variant="outline" className="w-full">Ďalšie podujatia</Button>
        </Link>
      </div>
    </div>
  );
}
