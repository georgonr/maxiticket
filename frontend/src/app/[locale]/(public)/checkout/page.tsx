'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { getCart, clearCart, cartTotal, Cart } from '@/lib/cart';
import { ordersApi, publicApi } from '@/lib/api';
import { couponsApi } from '@/lib/api/coupons';
import { getValidToken } from '@/lib/auth';
import { localizeApiError } from '@/lib/api-error';
import { usePublicAuth } from '@/lib/public-auth';
import { Button } from '@/components/ui/button';
import { CouponInput, AppliedCoupon } from '@/components/checkout/CouponInput';
import { ProtectBadge } from '@/components/public/ProtectBadge';
import { Calendar, MapPin, ShoppingBag, Loader2, Lock } from 'lucide-react';

// useSearchParams (?coupon=) musí byť v Suspense boundary (Next 14 CSR bailout).
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-coral" size={32} />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const t = useTranslations('checkout');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const locale = useLocale() as 'sk' | 'en' | 'cs';
  const fmtPrice = (amount: number, currency: string) => format.number(amount, { style: 'currency', currency });
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading } = usePublicAuth();
  const [cart, setCartState] = useState<Cart | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [processingFee, setProcessingFee] = useState(0);  // Krok 2/2: zákaznícky poplatok (server quote)
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
        // Kupón sa viaže na typy lístkov; SEATMAP/SECTIONED položky (bez ticketTypeId) sa do scope nepočítajú.
        items: cart.items.filter((i) => i.ticketTypeId).map((i) => ({ ticketTypeId: i.ticketTypeId!, quantity: i.quantity })),
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

  // Krok 2/2: zákaznícky poplatok za spracovanie – server quote (vracia LEN sumu) zo sumy po zľave.
  useEffect(() => {
    if (!cart) { setProcessingFee(0); return; }
    const base = appliedCoupon ? appliedCoupon.finalAmount : cartTotal(cart);
    if (base <= 0) { setProcessingFee(0); return; }
    let active = true;
    publicApi.feeQuote(cart.terminId, base)
      .then((r) => { if (active) setProcessingFee(r.feeAmount ?? 0); })
      .catch(() => { if (active) setProcessingFee(0); });
    return () => { active = false; };
  }, [cart, appliedCoupon]);

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
        items: cart.items.map((i) =>
          i.seatIds?.length
            ? { terminSectionId: i.terminSectionId, seatIds: i.seatIds }
            : i.terminSectionId
              ? { terminSectionId: i.terminSectionId, quantity: i.quantity }
              : { ticketTypeId: i.ticketTypeId, quantity: i.quantity },
        ),
        acceptTerms: true,
        locale,
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
      // Krok 31e3: lokalizuj backend chybu cez messageCode (fallback na message/generic).
      setError(localizeApiError(tErrors, e, t('genericError')));
      setSubmitting(false);
    }
  }

  if (isLoading || !cart) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-coral" size={32} />
      </div>
    );
  }

  const total = cartTotal(cart);
  const currency = cart.items[0]?.currency ?? 'EUR';
  const finalTotal = appliedCoupon ? appliedCoupon.finalAmount : total;
  const grandTotal = finalTotal + processingFee;  // Krok 2/2: cena lístkov (po zľave) + poplatok

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t('title')}</h1>

      {/* Order summary */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="font-semibold text-gray-900 text-lg">{cart.showName}</h2>
          <p className="flex items-center gap-1 mt-1 text-sm text-gray-500">
            <Calendar size={13} />
            {format.dateTime(new Date(cart.startsAt), { timeZone: cart.timezone, weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="flex items-center gap-1 text-sm text-gray-500">
            <MapPin size={13} />
            {cart.venueName}{cart.city ? `, ${cart.city}` : ''}
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {cart.items.map((item) => (
            <div key={item.ticketTypeId ?? item.terminSectionId} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.name}</p>
                <p className="text-xs text-gray-400">{item.quantity} × {fmtPrice(item.price, item.currency)}</p>
                {item.seatLabels?.length ? (
                  <p className="text-xs text-coral mt-0.5">{t('seats')}: {item.seatLabels.join(', ')}</p>
                ) : null}
              </div>
              <span className="font-semibold text-gray-900">{fmtPrice(item.price * item.quantity, item.currency)}</span>
            </div>
          ))}
        </div>

        {/* Guest – buyer údaje (prihlásení berú z účtu) */}
        {!isLoggedIn && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <p className="text-sm font-medium text-gray-700">{t('contactInfo')}</p>
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral"
            />
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral"
            />
            <input
              type="tel"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral"
            />
            <p className="text-xs text-gray-400">
              {t('haveAccount')}{' '}
              <Link href="/account/login?next=/checkout" className="text-coral hover:underline">
                {t('signIn')}
              </Link>
            </p>
          </div>
        )}

        {/* Kupón */}
        <div className="mt-4 border-t pt-4">
          <CouponInput
            subtotal={total}
            items={cart.items.filter((i) => i.ticketTypeId).map((i) => ({ ticketTypeId: i.ticketTypeId!, quantity: i.quantity }))}
            currency={currency}
            appliedCoupon={appliedCoupon}
            onApply={setAppliedCoupon}
            onRemove={() => setAppliedCoupon(null)}
          />
        </div>

        {/* Súčty */}
        <div className="mt-4 space-y-1.5 border-t pt-3">
          {(appliedCoupon || processingFee > 0) && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{t('subtotal')}</span>
              <span>{fmtPrice(total, currency)}</span>
            </div>
          )}
          {appliedCoupon && (
            <div className="flex items-center justify-between text-sm text-emerald-600">
              <span>{t('discount', { code: appliedCoupon.code })}</span>
              <span>−{fmtPrice(appliedCoupon.discount, currency)}</span>
            </div>
          )}
          {processingFee > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{t('processingFee')}</span>
              <span>{fmtPrice(processingFee, currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-gray-900">{t('total')}</span>
            <span className="text-xl font-bold text-coral">{fmtPrice(grandTotal, currency)}</span>
          </div>
        </div>
      </div>

      {/* Payment info */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-coral/20 bg-coral/5 px-4 py-3 text-sm text-plum">
        <Lock size={14} />
        {t('securePayment')}
      </div>

      {/* TicketAll Protect – dôveryhodnostný pás */}
      <div className="mb-4">
        <ProtectBadge variant="strip" />
      </div>

      {/* Terms */}
      <label className="mb-4 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-coral"
        />
        <span className="text-sm text-gray-600">
          {t('agreeStart')}{' '}
          <NextLink href="#" className="text-coral hover:underline">{t('terms')}</NextLink>
          {' '}{t('agreeEnd')}
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
        {submitting ? t('redirecting') : t('pay', { amount: fmtPrice(grandTotal, currency) })}
      </Button>

      <p className="mt-3 text-center text-xs text-gray-400">
        {t('cancelQ')}{' '}
        <Link href={`/events/${cart.showSlug}`} className="text-coral hover:underline">
          {t('backToEvent')}
        </Link>
      </p>
    </div>
  );
}
