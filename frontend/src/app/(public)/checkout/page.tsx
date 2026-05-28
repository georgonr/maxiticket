'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCart, clearCart, cartTotal, Cart } from '@/lib/cart';
import { ordersApi } from '@/lib/api';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { formatDate, formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, ShoppingBag, Loader2, CheckCircle2, Lock } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading } = usePublicAuth();
  const [cart, setCartState] = useState<Cart | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const c = getCart();
    if (!c) { router.push('/events'); return; }
    setCartState(c);
  }, [router]);

  // Redirect to login if not logged in
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.push('/account/login?next=/checkout');
    }
  }, [isLoading, isLoggedIn, router]);

  async function handleCheckout() {
    if (!cart || !acceptTerms) return;
    setError('');
    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) { router.push('/account/login?next=/checkout'); return; }

      const order = await ordersApi.create({
        terminId: cart.terminId,
        items: cart.items.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity })),
        acceptTerms: true,
      }, token);

      // Mock payment
      const paid = await ordersApi.pay(order.id, token);
      clearCart();
      router.push(`/checkout/success/${paid.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Nastala chyba. Skúste znova.');
      setSubmitting(false);
    }
  }

  if (isLoading || !cart) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  const total = cartTotal(cart);
  const currency = cart.items[0]?.currency ?? 'EUR';

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Potvrdenie objednávky</h1>

      {/* Order summary */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900 text-lg">{cart.showName}</h2>
          <p className="flex items-center gap-1 mt-1 text-sm text-gray-500">
            <Calendar size={13} />
            {formatDate(cart.startsAt, cart.timezone)}
          </p>
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <MapPin size={13} />
            {cart.venueName}{cart.city ? `, ${cart.city}` : ''}
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {cart.items.map((item) => (
            <div key={item.ticketTypeId} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-400">{item.quantity} × {formatPrice(item.price, item.currency)}</p>
              </div>
              <span className="font-semibold text-gray-900">{formatPrice(item.price * item.quantity, item.currency)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-3">
          <span className="font-semibold text-gray-900">Celkom</span>
          <span className="text-xl font-bold text-indigo-600">{formatPrice(total, currency)}</span>
        </div>
      </div>

      {/* Payment info */}
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Lock size={14} />
        Platba prebieha v bezpečnom prostredí (testovací mód)
      </div>

      {/* Terms */}
      <label className="mb-4 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-indigo-600"
        />
        <span className="text-sm text-gray-600">
          Súhlasím s{' '}
          <Link href="#" className="text-indigo-600 hover:underline">obchodnými podmienkami</Link>
          {' '}a beriem na vedomie, že vstupenky sú nevratné.
        </span>
      </label>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <Button
        onClick={handleCheckout}
        disabled={!acceptTerms || submitting}
        loading={submitting}
        size="lg"
        className="w-full gap-2"
      >
        <ShoppingBag size={16} />
        {submitting ? 'Spracovávam...' : `Zaplatiť ${formatPrice(total, currency)}`}
      </Button>

      <p className="mt-3 text-center text-xs text-gray-400">
        Zrušiť?{' '}
        <Link href={`/events/${cart.showSlug}`} className="text-indigo-600 hover:underline">
          Vrátiť sa na podujatie
        </Link>
      </p>
    </div>
  );
}
