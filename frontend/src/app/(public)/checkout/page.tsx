'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getCart, clearCart, cartTotal, Cart } from '@/lib/cart';
import { ordersApi } from '@/lib/api';
import { couponsApi } from '@/lib/api/coupons';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { formatDate, formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { CouponInput, AppliedCoupon } from '@/components/checkout/CouponInput';
import { Calendar, MapPin, ShoppingBag, Loader2, Lock } from 'lucide-react';

// useSearchParams (?coupon=) musí byť v Suspense boundary (Next 14 CSR bailout).
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading } = usePublicAuth();
  const [cart, setCartState] = useState<Cart | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  // Guest checkout – buyer údaje (pre prihlásených ich neukazujeme, server berie z účtu)
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');

  useEffect(() => {
    const c = getCart();
    if (!c) { router.push('/events'); return; }
    setCartState(c);
  }, [router]);

  // Auto-apply kupónu z URL ?coupon=CODE (tichý fail ak neplatný)
  useEffect(() => {
    const couponParam = searchParams.get('coupon');
    if (!couponParam || !cart || appliedCoupon) return;
    const subtotal = cartTotal(cart);
    if (subtotal <= 0) return;
    couponsApi
      .validate({
        code: couponParam,
        subtotal,
        items: cart.items.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity })),
      })
      .then((res) => {
        if (res.valid) {
          setAppliedCoupon({
            code: couponParam.toUpperCase(),
            couponId: res.couponId,
            type: res.type,
            scope: res.scope,
            discount: res.discount,
            finalAmount: res.finalAmount,
          });
        }
      })
      .catch(() => {
        /* tichý fail – neplatný URL kupón nezablokuje checkout */
      });
  }, [searchParams, cart, appliedCoupon]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim());
  const guestFieldsOk = isLoggedIn || (emailValid && buyerName.trim().length > 0);

  async function handleCheckout() {
    if (!cart || !acceptTerms || !guestFieldsOk) return;
    setError('');
    setSubmitting(true);
    try {
      // Guest = token null; prihlásený = platný token (server scopuje na účet)
      const token = (await getValidToken()) ?? undefined;

      // 1. Create the order (guest posiela buyer údaje; prihlásený ich vynechá)
      const order = await ordersApi.create({
        terminId: cart.terminId,
        items: cart.items.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity })),
        acceptTerms: true,
        ...(isLoggedIn
          ? {}
          : {
              buyerEmail: buyerEmail.trim(),
              buyerName: buyerName.trim(),
              ...(buyerPhone.trim() ? { buyerPhone: buyerPhone.trim() } : {}),
            }),
      }, token);

      // 2. Initiate checkout – returns { url } (Stripe URL or direct success URL for mock)
      //    Kupón sa re-validuje server-side a zapíše Order.discountAmount/couponId.
      const { url } = await ordersApi.checkout(order.id, token, appliedCoupon?.code);

      // 3. Clear cart and redirect
      clearCart();
      window.location.href = url;
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
  const finalTotal = appliedCoupon ? appliedCoupon.finalAmount : total;

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

        {/* Guest – buyer údaje (prihlásení berú z účtu) */}
        {!isLoggedIn && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <p className="text-sm font-medium text-gray-700">Kontaktné údaje</p>
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="E-mail (vstupenky pošleme sem) *"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Meno a priezvisko *"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="tel"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="Telefón (voliteľné)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400">
              Máte účet?{' '}
              <Link href="/account/login?next=/checkout" className="text-indigo-600 hover:underline">
                Prihláste sa
              </Link>
            </p>
          </div>
        )}

        {/* Kupón */}
        <div className="mt-4 border-t pt-4">
          <CouponInput
            subtotal={total}
            items={cart.items.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity }))}
            currency={currency}
            appliedCoupon={appliedCoupon}
            onApply={setAppliedCoupon}
            onRemove={() => setAppliedCoupon(null)}
          />
        </div>

        {/* Súčty */}
        <div className="mt-4 space-y-1.5 border-t pt-3">
          {appliedCoupon && (
            <>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Medzisúčet</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-emerald-600">
                <span>Zľava ({appliedCoupon.code})</span>
                <span>−{formatPrice(appliedCoupon.discount, currency)}</span>
              </div>
            </>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-gray-900">Spolu</span>
            <span className="text-xl font-bold text-indigo-600">{formatPrice(finalTotal, currency)}</span>
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
        <Lock size={14} />
        Platba prebieha cez zabezpečenú platobnú bránu Stripe
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
        disabled={!acceptTerms || submitting || !guestFieldsOk}
        loading={submitting}
        size="lg"
        className="w-full gap-2"
      >
        <ShoppingBag size={16} />
        {submitting ? 'Presmerovávam na platbu...' : `Zaplatiť ${formatPrice(finalTotal, currency)}`}
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
