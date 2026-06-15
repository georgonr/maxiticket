'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { CreditCard, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { ApiError, paymentGatewaysApi, PaymentGatewayId, PaymentGatewayStatus } from '@/lib/api';
import { SectionCard, Skeleton, ErrorState } from '@/components/dashboard/parts';

const META: Record<PaymentGatewayId, { label: string; live: boolean; comingSoon?: boolean }> = {
  STRIPE_SANDBOX: { label: 'Stripe Sandbox', live: false },
  STRIPE_LIVE: { label: 'Stripe Live', live: true },
  COMGATE_TEST: { label: 'ComGate Test', live: false, comingSoon: true },
  COMGATE_LIVE: { label: 'ComGate Live', live: true, comingSoon: true },
};

const GATEWAY_DESC_KEY: Record<PaymentGatewayId, string> = {
  STRIPE_SANDBOX: 'descStripeSandbox',
  STRIPE_LIVE: 'descStripeLive',
  COMGATE_TEST: 'descComgateTest',
  COMGATE_LIVE: 'descComgateLive',
};

export default function PaymentGatewaysPage() {
  const t = useTranslations('admin');

  function readableError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 401 || e.status === 403) return t('paymentGateways.errNoPermission');
      return e.message || t('paymentGateways.errGeneric');
    }
    return t('paymentGateways.errConnect');
  }

  const [gateways, setGateways] = useState<PaymentGatewayStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<PaymentGatewayId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const res = await paymentGatewaysApi.list(token);
      setGateways(res.gateways);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function activate(g: PaymentGatewayStatus) {
    if (g.active || !g.configured || busy) return;
    const meta = META[g.gateway];
    if (meta.live && !window.confirm(t('paymentGateways.confirmLive'))) return;
    setBusy(g.gateway);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const res = await paymentGatewaysApi.setActive(g.gateway, token);
      setGateways(res.gateways);
      setToast({ msg: t('paymentGateways.activeGatewayToast', { label: meta.label }), ok: true });
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('paymentGateways.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('paymentGateways.subtitle')}
          </p>
        </div>

        {toast && (
          <div className={clsx('rounded-lg px-4 py-2.5 text-sm font-medium', toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {toast.msg}
          </div>
        )}

        {error ? (
          <ErrorState message={error} />
        ) : (
          <SectionCard title={t('paymentGateways.gatewaysCard')}>
            {loading ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="space-y-3">
                {gateways.map((g) => {
                  const meta = META[g.gateway];
                  const disabled = !g.configured || g.active || busy === g.gateway;
                  return (
                    <div
                      key={g.gateway}
                      className={clsx(
                        'flex items-center justify-between gap-4 rounded-xl border p-4',
                        g.active ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-800',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className="text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">{meta.label}</span>
                          {g.active && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <CheckCircle2 size={11} /> {t('paymentGateways.badgeActive')}
                            </span>
                          )}
                          {!g.configured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500">
                              <Lock size={11} /> {meta.comingSoon ? t('paymentGateways.badgeComingSoon') : t('paymentGateways.badgeNotConfigured')}
                            </span>
                          )}
                          {meta.live && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <AlertTriangle size={11} /> {t('paymentGateways.badgeLive')}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t(`paymentGateways.${GATEWAY_DESC_KEY[g.gateway]}`)}</p>
                      </div>

                      {/* iPhone-style toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={g.active}
                        disabled={disabled}
                        onClick={() => activate(g)}
                        title={g.configured ? (g.active ? t('paymentGateways.titleActive') : t('paymentGateways.titleActivate')) : t('paymentGateways.titleNotConfigured')}
                        className={clsx(
                          'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
                          g.active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700',
                          disabled && !g.active && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <span className={clsx('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', g.active ? 'translate-x-5' : 'translate-x-0.5')} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}

        <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-gray-500">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          {t('paymentGateways.footerNote')}
        </div>
      </main>
    </div>
  );
}
