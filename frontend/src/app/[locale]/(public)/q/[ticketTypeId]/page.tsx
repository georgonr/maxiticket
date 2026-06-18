'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import { Calendar, MapPin, Loader2, Lock, Minus, Plus, Ticket } from 'lucide-react';
import { publicApi, QrTicketInfo } from '@/lib/api';
import { localizeApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';

export default function QrBuyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>}>
      <QrBuyContent />
    </Suspense>
  );
}

function QrBuyContent() {
  const { ticketTypeId } = useParams<{ ticketTypeId: string }>();
  const searchParams = useSearchParams();
  const qtyParam = Number(searchParams.get('qty'));
  const t = useTranslations('qrCheckout');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const locale = useLocale() as 'sk' | 'en' | 'cs';
  const fmtPrice = (a: number, c: string) => format.number(a, { style: 'currency', currency: c });
  const fmtDate = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const [info, setInfo] = useState<QrTicketInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(false);
    try {
      const data = await publicApi.qrInfo(ticketTypeId);
      setInfo(data);
      // ?qty=N predvyplní počet (orežaný na zostatok/max; zostáva upraviteľný)
      if (Number.isFinite(qtyParam) && qtyParam >= 1 && data.maxQuantity > 0) {
        setQty(Math.min(Math.floor(qtyParam), data.maxQuantity));
      }
    } catch {
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, [ticketTypeId, qtyParam]);

  useEffect(() => { load(); }, [load]);

  async function pay() {
    if (!info) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setPayErr(t('emailInvalid')); return; }
    setSubmitting(true); setPayErr(null);
    try {
      const { url } = await publicApi.qrCheckout({ ticketTypeId, quantity: qty, email: email.trim(), locale });
      window.location.href = url;
    } catch (e) {
      setPayErr(localizeApiError(tErrors, e, t('payErr')));
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>;
  }
  if (loadErr || !info) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Ticket className="mx-auto mb-3 text-gray-300" size={40} />
        <p className="text-gray-600 dark:text-gray-300">{t('notFound')}</p>
      </div>
    );
  }

  const max = Math.max(1, info.maxQuantity);
  const total = info.price * qty;

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        {info.show.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.show.imageUrl} alt={info.show.name} className="h-44 w-full object-cover" />
        )}
        <div className="space-y-4 p-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{info.show.name}</h1>
            <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <p className="flex items-center gap-1.5"><Calendar size={15} className="text-emerald-600" /> {fmtDate(info.termin.startsAt)}</p>
              {info.termin.venueName && (
                <p className="flex items-center gap-1.5"><MapPin size={15} className="text-emerald-600" /> {info.termin.venueName}{info.termin.venueCity ? `, ${info.termin.venueCity}` : ''}</p>
              )}
            </div>
          </div>

          {!info.purchasable ? (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {t(`reason.${info.reason}`)}
            </div>
          ) : (
            <>
              {/* Typ lístka + cena */}
              <div className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{info.name}</div>
                  {info.description && <div className="text-xs text-gray-500 dark:text-gray-400">{info.description}</div>}
                </div>
                <div className="text-lg font-bold text-emerald-700">{fmtPrice(info.price, info.currency)}</div>
              </div>

              {/* Výber počtu */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('quantity')}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 disabled:opacity-40">
                    <Minus size={16} />
                  </button>
                  <span className="w-6 text-center text-lg font-bold tabular-nums">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 disabled:opacity-40">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* E-mail */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('email')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('emailPlaceholder')}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm" />
                <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">{t('emailHint')}</span>
              </label>

              {/* Suma + platba */}
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('total')}</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmtPrice(total, info.currency)}</span>
              </div>
              <p className="text-center text-xs text-gray-400 dark:text-gray-500">{t('feeNote')}</p>

              {payErr && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{payErr}</div>}

              <Button onClick={pay} loading={submitting} disabled={submitting} className="w-full">
                <Lock size={16} className="mr-2" /> {t('payCard')}
              </Button>
              <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">{t('afterPay')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
