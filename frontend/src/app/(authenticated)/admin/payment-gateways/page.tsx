'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { CreditCard, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { ApiError, paymentGatewaysApi, PaymentGatewayId, PaymentGatewayStatus } from '@/lib/api';
import { SectionCard, Skeleton, ErrorState } from '@/components/dashboard/parts';
import { ToggleSwitch } from '@/components/ui/toggle-switch';

const META: Record<PaymentGatewayId, { label: string; live: boolean; comingSoon?: boolean }> = {
  STRIPE_SANDBOX: { label: 'Stripe Sandbox', live: false },
  STRIPE_LIVE: { label: 'Stripe Live', live: true },
  COMGATE_TEST: { label: 'ComGate Test', live: false, comingSoon: true },
  COMGATE_LIVE: { label: 'ComGate Live', live: true, comingSoon: true },
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

  const byId = (id: PaymentGatewayId) => gateways.find((x) => x.gateway === id);

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
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
                {/* Stripe – jeden riadok, slider Sandbox ↔ Live */}
                <ProviderRow
                  name="Stripe"
                  left={byId('STRIPE_SANDBOX')}
                  right={byId('STRIPE_LIVE')}
                  leftLabel={t('paymentGateways.sideSandbox')}
                  rightLabel={t('paymentGateways.sideLive')}
                  busy={busy !== null}
                  onSelect={(g) => g && activate(g)}
                  leftHint={byId('STRIPE_SANDBOX')?.configured === false ? t('paymentGateways.sandboxNeedsKey') : null}
                  t={t}
                />
                {/* ComGate – stub (Čoskoro), slider disabled */}
                <ProviderRow
                  name="ComGate"
                  left={byId('COMGATE_TEST')}
                  right={byId('COMGATE_LIVE')}
                  leftLabel={t('paymentGateways.sideTest')}
                  rightLabel={t('paymentGateways.sideLive')}
                  busy={busy !== null}
                  onSelect={() => {}}
                  comingSoon
                  t={t}
                />
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

/** Jeden PROVIDER riadok so sliderom ĽAVO(sandbox/test) ↔ PRAVO(live). */
function ProviderRow({
  name, left, right, leftLabel, rightLabel, busy, onSelect, leftHint, comingSoon, t,
}: {
  name: string;
  left?: PaymentGatewayStatus;
  right?: PaymentGatewayStatus;
  leftLabel: string;
  rightLabel: string;
  busy: boolean;
  onSelect: (g?: PaymentGatewayStatus) => void;
  leftHint?: string | null;
  comingSoon?: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const isLive = !!right?.active;     // checked = pravá strana (Live)
  const leftActive = !!left?.active;
  const anyActive = isLive || leftActive;
  // Prepnúť na druhú stranu len ak je tá strana nakonfigurovaná.
  const toggleDisabled = busy || !!comingSoon || (isLive ? left?.configured !== true : right?.configured !== true);

  return (
    <div className={clsx('rounded-xl border p-4', anyActive && !comingSoon ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-800')}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <CreditCard size={18} className="text-gray-400" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">{name}</span>
          {comingSoon ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500">
              <Lock size={11} /> {t('paymentGateways.badgeComingSoon')}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={11} /> {t('paymentGateways.badgeActive')}: {isLive ? rightLabel : leftLabel}
              </span>
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <AlertTriangle size={11} /> {t('paymentGateways.badgeLive')}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2.5">
          <span className={clsx('text-xs font-medium', leftActive && !comingSoon ? 'text-emerald-600' : 'text-gray-400')}>{leftLabel}</span>
          <ToggleSwitch
            checked={isLive}
            disabled={toggleDisabled}
            onChange={(next) => onSelect(next ? right : left)}
            label={`${name}: ${isLive ? leftLabel : rightLabel}`}
          />
          <span className={clsx('text-xs font-medium', isLive && !comingSoon ? 'text-amber-600' : 'text-gray-400')}>{rightLabel}</span>
        </div>
      </div>
      {leftHint && (
        <p className="mt-2 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <Lock size={11} /> {leftHint}
        </p>
      )}
    </div>
  );
}
