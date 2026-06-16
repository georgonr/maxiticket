'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useTranslations, useFormatter } from 'next-intl';
import {
  Loader2, Calendar, MapPin, Minus, Plus, ArrowLeft, Banknote,
  CreditCard, CheckCircle2, Mail, RotateCcw, RefreshCw, Printer, Lock,
} from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { localizeApiError } from '@/lib/api-error';
import { posApi, PosTermin, PosOrderResult, PosSummary } from '@/lib/api/pos';
import { QrCanvas } from '@/components/pos/QrCanvas';

type Step = 'termin' | 'tickets' | 'payment' | 'done';

export default function PosPage() {
  const t = useTranslations('organizer.pos');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const fmtPrice = (amount: number | string, currency = 'EUR') =>
    format.number(Number(amount), { style: 'currency', currency });
  const fmtDate = (iso: string) =>
    format.dateTime(new Date(iso), {
      timeZone: 'Europe/Bratislava',
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const readableError = useCallback((e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.status === 403) return t('error.forbidden');
      if (e.status >= 500) return t('error.server');
      // Krok 31e4: 400/404 POS validačné chyby cez messageCode → errors.* (fallback generic).
      return localizeApiError(tErrors, e, t('error.generic'));
    }
    return t('error.network');
  }, [t, tErrors]);

  const [termins, setTermins] = useState<PosTermin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('termin');
  const [selected, setSelected] = useState<PosTermin | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [coupon, setCoupon] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerName, setBuyerName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PosOrderResult | null>(null);
  const [emailPrompt, setEmailPrompt] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [summary, setSummary] = useState<PosSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const data = await posApi.termins(token);
      setTermins(data);
      if (data.length === 1) { setSelected(data[0]); setStep('tickets'); }
    } catch (e) {
      setLoadError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const token = await getValidToken();
      if (!token) return;
      setSummary(await posApi.summary(token));
    } catch { /* summary lišta je doplnková – tichý fail */ }
  }, []);

  useEffect(() => { load(); loadSummary(); }, [load, loadSummary]);

  const subtotal = useMemo(() => {
    if (!selected) return 0;
    return selected.ticketTypes.reduce((s, tt) => s + tt.price * (qty[tt.ticketTypeId] ?? 0), 0);
  }, [selected, qty]);

  const totalQty = useMemo(
    () => Object.values(qty).reduce((s, n) => s + n, 0),
    [qty],
  );

  function selectTermin(t: PosTermin) {
    setSelected(t);
    setQty({});
    setStep('tickets');
  }

  function setQuantity(ttId: string, delta: number, max: number | null, maxPerOrder: number) {
    setQty((prev) => {
      const cur = prev[ttId] ?? 0;
      let next = cur + delta;
      if (next < 0) next = 0;
      const cap = Math.min(maxPerOrder, max ?? Infinity);
      if (next > cap) next = cap;
      return { ...prev, [ttId]: next };
    });
  }

  async function submit(paymentMethod: 'cash' | 'card') {
    if (!selected || totalQty === 0) return;
    setError('');
    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const items = selected.ticketTypes
        .filter((tt) => (qty[tt.ticketTypeId] ?? 0) > 0)
        .map((tt) => ({ ticketTypeId: tt.ticketTypeId, quantity: qty[tt.ticketTypeId] }));
      const res = await posApi.createOrder(
        {
          terminId: selected.terminId,
          items,
          paymentMethod,
          buyerEmail: buyerEmail.trim() || undefined,
          buyerName: buyerName.trim() || undefined,
          couponCode: coupon.trim() || undefined,
        },
        token,
      );
      setResult(res);
      setEmailMsg(res.emailSent ? t('done.emailSent', { email: buyerEmail.trim() }) : '');
      setStep('done');
      loadSummary();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendEmail() {
    if (!result) return;
    const mail = (buyerEmail.trim() || emailPrompt.trim());
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { setEmailMsg(t('done.invalidEmail')); return; }
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await posApi.emailTickets(result.orderId, mail, token);
      setEmailMsg(t('done.emailSent', { email: mail }));
    } catch (e) {
      setEmailMsg(readableError(e));
    }
  }

  function newSale() {
    setQty({});
    setCoupon('');
    setBuyerEmail('');
    setBuyerName('');
    setResult(null);
    setEmailPrompt('');
    setEmailMsg('');
    setError('');
    setStep(selected ? 'tickets' : 'termin');
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950 print:bg-white">
      <main className="mx-auto max-w-3xl p-4 sm:p-6 print:hidden">
        <h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>

        {/* Summary lišta – od poslednej uzávierky */}
        {summary && (
          <Link
            href="/organizer/pos/closures"
            className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm shadow-sm hover:border-brand"
          >
            <span className="text-gray-500 dark:text-gray-400">{t('summary.sinceLastClosure')}</span>
            <span className="flex items-center gap-3 font-medium">
              <span className="text-emerald-700">{fmtPrice(summary.cashTotal)} {t('summary.cash')}</span>
              <span className="text-sky-700">{fmtPrice(summary.cardTotal)} {t('summary.card')}</span>
              <span className="text-gray-400 dark:text-gray-500">· {t('summary.ticketCount', { count: summary.ticketCount })}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-brand">
              <Lock size={13} /> {t('summary.closureLink')}
            </span>
          </Link>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand" size={36} /></div>
        ) : loadError ? (
          <div className="flex flex-col items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{loadError}</span>
            <button onClick={load} className="inline-flex items-center gap-1 font-medium underline"><RefreshCw size={13} /> {t('retry')}</button>
          </div>
        ) : termins.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-gray-500 dark:text-gray-400">
            {t('termin.empty')}
          </div>
        ) : step === 'termin' ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('termin.selectPrompt')}</p>
            {termins.map((t) => (
              <button
                key={t.terminId}
                onClick={() => selectTermin(t)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-left shadow-sm hover:border-brand active:bg-gray-50"
              >
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{t.showName}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400"><Calendar size={13} /> {fmtDate(t.startsAt)}</div>
                  {t.venueName && <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400"><MapPin size={13} /> {t.venueName}{t.venueCity ? `, ${t.venueCity}` : ''}</div>}
                </div>
                <span className="text-brand">›</span>
              </button>
            ))}
          </div>
        ) : step === 'tickets' && selected ? (
          <div className="space-y-4">
            <button onClick={() => setStep('termin')} className="inline-flex items-center gap-1 text-sm text-brand"><ArrowLeft size={15} /> {t('tickets.otherTermin')}</button>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="font-semibold text-gray-900 dark:text-gray-100">{selected.showName}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{fmtDate(selected.startsAt)}{selected.venueName ? ` • ${selected.venueName}` : ''}</div>
            </div>

            <div className="space-y-2">
              {selected.ticketTypes.map((tt) => {
                const n = qty[tt.ticketTypeId] ?? 0;
                const soldOut = tt.remaining != null && tt.remaining <= 0;
                return (
                  <div key={tt.ticketTypeId} className={clsx('flex items-center justify-between gap-3 rounded-xl border bg-white dark:bg-gray-900 p-4', soldOut ? 'border-gray-100 dark:border-gray-800 opacity-60' : 'border-gray-200 dark:border-gray-800')}>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{tt.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {fmtPrice(tt.price, tt.currency)}
                        {tt.remaining != null && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{t('tickets.remaining', { count: tt.remaining })}</span>}
                      </div>
                    </div>
                    {soldOut ? (
                      <span className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-400 dark:text-gray-500">{t('tickets.soldOut')}</span>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button onClick={() => setQuantity(tt.ticketTypeId, -1, tt.remaining, tt.maxPerOrder)} disabled={n === 0} className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-30 active:bg-gray-100"><Minus size={18} /></button>
                        <span className="w-8 text-center text-lg font-semibold tabular-nums">{n}</span>
                        <button onClick={() => setQuantity(tt.ticketTypeId, 1, tt.remaining, tt.maxPerOrder)} className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-100"><Plus size={18} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder={t('tickets.couponPlaceholder')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm uppercase focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />

            <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-lg">
              <div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{t('tickets.subtotal', { count: totalQty })}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmtPrice(subtotal)}</div>
              </div>
              <button
                onClick={() => setStep('payment')}
                disabled={totalQty === 0}
                className="rounded-xl bg-brand px-6 py-3 text-base font-semibold text-white disabled:opacity-40 active:bg-brand-dark"
              >
                {t('tickets.continue')}
              </button>
            </div>
          </div>
        ) : step === 'payment' && selected ? (
          <div className="space-y-4">
            <button onClick={() => setStep('tickets')} className="inline-flex items-center gap-1 text-sm text-brand"><ArrowLeft size={15} /> {t('payment.backToTickets')}</button>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 text-center">
              <div className="text-sm text-gray-400 dark:text-gray-500">{t('payment.toPay')}</div>
              <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">{fmtPrice(subtotal)}</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('payment.ticketCount', { count: totalQty })}{coupon.trim() ? ` • ${t('payment.couponLabel', { code: coupon.trim().toUpperCase() })}` : ''}</div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('payment.buyerHint')}</p>
              <input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} type="email" placeholder={t('payment.emailPlaceholder')} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
              <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder={t('payment.namePlaceholder')} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>

            {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => submit('cash')} disabled={submitting} className="flex flex-col items-center gap-2 rounded-xl bg-emerald-600 px-4 py-6 text-white shadow-sm active:bg-emerald-700 disabled:opacity-50">
                <Banknote size={32} />
                <span className="text-lg font-semibold">{t('payment.cash')}</span>
              </button>
              <button onClick={() => submit('card')} disabled={submitting} className="flex flex-col items-center gap-2 rounded-xl bg-indigo-600 px-4 py-6 text-white shadow-sm active:bg-indigo-700 disabled:opacity-50">
                <CreditCard size={32} />
                <span className="text-lg font-semibold">{t('payment.card')}</span>
              </button>
            </div>
            {submitting && <div className="flex justify-center"><Loader2 className="animate-spin text-brand" size={28} /></div>}
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">{t('payment.cardHint')}</p>
          </div>
        ) : step === 'done' && result ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <CheckCircle2 size={40} className="text-emerald-600" />
              <div className="text-lg font-bold text-emerald-800">{t('done.title')}</div>
              <div className="font-mono text-sm text-emerald-700">{result.orderNumber}</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmtPrice(result.totalAmount, result.currency)}</div>
              {result.discountAmount > 0 && <div className="text-sm text-emerald-600">{t('done.discount', { amount: fmtPrice(result.discountAmount, result.currency) })}</div>}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-200">{t('done.ticketsHint', { count: result.tickets.length })}</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {result.tickets.map((t, i) => (
                  <div key={t.ticketId} className="flex flex-col items-center gap-1">
                    <QrCanvas value={t.qrToken} size={150} />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{t.ticketTypeName}</span>
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">…{t.ticketId.slice(-4).toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2">
              {!result.emailSent && (
                <div className="flex gap-2">
                  <input value={emailPrompt} onChange={(e) => setEmailPrompt(e.target.value)} type="email" placeholder={t('done.emailInputPlaceholder')} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={sendEmail} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Mail size={15} /> {t('done.sendEmail')}
                </button>
                <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Printer size={15} /> {t('done.print')}
                </button>
              </div>
              {emailMsg && <p className="text-sm text-emerald-700">{emailMsg}</p>}
            </div>

            <button onClick={newSale} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-4 text-lg font-semibold text-white active:bg-brand-dark">
              <RotateCcw size={20} /> {t('done.newSale')}
            </button>
          </div>
        ) : null}
      </main>

      {/* Tlačiteľný pohľad lístkov – viditeľný len pri tlači */}
      {result && selected && (
        <div className="hidden print:block">
          {result.tickets.map((t) => (
            <div key={`print-${t.ticketId}`} className="flex break-inside-avoid items-center gap-6 border-b border-gray-300 dark:border-gray-700 p-6">
              <QrCanvas value={t.qrToken} size={180} />
              <div className="space-y-1">
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{selected.showName}</div>
                <div className="text-gray-700 dark:text-gray-200">{fmtDate(selected.startsAt)}</div>
                {selected.venueName && <div className="text-gray-700 dark:text-gray-200">{selected.venueName}{selected.venueCity ? `, ${selected.venueCity}` : ''}</div>}
                <div className="pt-1 font-medium text-gray-900 dark:text-gray-100">{t.ticketTypeName}</div>
                <div className="font-mono text-sm text-gray-500 dark:text-gray-400">{result.orderNumber} · …{t.ticketId.slice(-4).toUpperCase()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
