'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { CreditCard, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { ApiError, paymentGatewaysApi, PaymentGatewayId, PaymentGatewayStatus } from '@/lib/api';
import { SectionCard, Skeleton, ErrorState } from '@/components/dashboard/parts';

const META: Record<PaymentGatewayId, { label: string; desc: string; live: boolean; comingSoon?: boolean }> = {
  STRIPE_SANDBOX: { label: 'Stripe Sandbox', desc: 'Testovacie prostredie Stripe (bez reálnych platieb).', live: false },
  STRIPE_LIVE: { label: 'Stripe Live', desc: 'Ostrá platobná brána – reálne platby kartou.', live: true },
  COMGATE_TEST: { label: 'ComGate Test', desc: 'Testovacie prostredie ComGate.', live: false, comingSoon: true },
  COMGATE_LIVE: { label: 'ComGate Live', desc: 'Ostrá brána ComGate – reálne platby.', live: true, comingSoon: true },
};

function readableError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return 'Nemáte oprávnenie spravovať platobné brány.';
    return e.message || 'Niečo sa pokazilo.';
  }
  return 'Nemôžeme sa pripojiť k serveru.';
}

export default function PaymentGatewaysPage() {
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
    if (meta.live && !window.confirm('Zmeníte aktívnu platobnú bránu pre CELÝ predaj. Pokračovať?')) return;
    setBusy(g.gateway);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const res = await paymentGatewaysApi.setActive(g.gateway, token);
      setGateways(res.gateways);
      setToast({ msg: `Aktívna brána: ${meta.label}.`, ok: true });
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Platobné brány</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aktívna je vždy práve jedna brána. Predvolená je Stripe Live. Bránu bez nakonfigurovaných kľúčov nie je možné aktivovať.
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
          <SectionCard title="Brány">
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
                              <CheckCircle2 size={11} /> Aktívna
                            </span>
                          )}
                          {!g.configured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500">
                              <Lock size={11} /> {meta.comingSoon ? 'Čoskoro' : 'Nenakonfigurované'}
                            </span>
                          )}
                          {meta.live && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <AlertTriangle size={11} /> Ostrá
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{meta.desc}</p>
                      </div>

                      {/* iPhone-style toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={g.active}
                        disabled={disabled}
                        onClick={() => activate(g)}
                        title={g.configured ? (g.active ? 'Aktívna' : 'Aktivovať') : 'Nenakonfigurované'}
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
          Zmena ostrej brány ovplyvní všetky nové objednávky. ComGate sa pripravuje (stub) – aktivuje sa po doplnení kľúčov.
        </div>
      </main>
    </div>
  );
}
