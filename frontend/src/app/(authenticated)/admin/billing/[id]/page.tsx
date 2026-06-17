'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import { ArrowLeft, FileText } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { billingApi, BillingStatement, BillingPastTermin } from '@/lib/api/billing';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { Button } from '@/components/ui/button';

type Mode = 'termin' | 'month';

export default function AdminBillingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('billing');
  const ti = useTranslations('billing.invoice');
  const format = useFormatter();
  const [creating, setCreating] = useState(false);
  const eur = (cents: number) => format.number(cents / 100, { style: 'currency', currency: 'EUR' });
  const fmtTerminDate = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const [termins, setTermins] = useState<BillingPastTermin[]>([]);
  const [mode, setMode] = useState<Mode>('termin');
  const [terminId, setTerminId] = useState('');
  const [month, setMonth] = useState(''); // 'YYYY-MM'
  const [stmt, setStmt] = useState<BillingStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // počiatočné: zoznam minulých termínov
  useEffect(() => {
    (async () => {
      try {
        const token = await getValidToken();
        if (!token) throw new Error('no token');
        setTermins(await billingApi.pastTermins(id, token));
      } catch {
        setError(t('errLoad'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  const loadStatement = useCallback(async (fetcher: (token: string) => Promise<BillingStatement>) => {
    setStmtLoading(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      setStmt(await fetcher(token));
    } catch {
      setStmt(null);
      setError(t('errLoad'));
    } finally {
      setStmtLoading(false);
    }
  }, [t]);

  function onSelectTermin(v: string) {
    setTerminId(v);
    setStmt(null);
    if (v) loadStatement((token) => billingApi.statementByTermin(id, v, token));
  }

  function onSelectMonth(v: string) {
    setMonth(v);
    setStmt(null);
    if (v) {
      const [y, m] = v.split('-').map(Number);
      const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)).toISOString();
      const to = new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString(); // posledný deň mesiaca
      loadStatement((token) => billingApi.statementByRange(id, from, to, token));
    }
  }

  async function createInvoice() {
    let body: { occurrenceId?: string; from?: string; to?: string } | null = null;
    if (mode === 'termin' && terminId) {
      body = { occurrenceId: terminId };
    } else if (mode === 'month' && month) {
      const [y, m] = month.split('-').map(Number);
      body = { from: new Date(Date.UTC(y, m - 1, 1)).toISOString(), to: new Date(Date.UTC(y, m, 0, 23, 59, 59)).toISOString() };
    }
    if (!body) return;
    setCreating(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      const inv = await billingApi.createInvoice(id, body, token);
      router.push(`/admin/billing/invoices/${inv.id}`);
    } catch {
      setError(t('errLoad'));
      setCreating(false);
    }
  }

  const row = (label: string, value: string, opts?: { bold?: boolean; muted?: boolean; sub?: string }) => (
    <div className={`flex items-center justify-between gap-3 py-2 ${opts?.bold ? 'border-t border-gray-200 dark:border-gray-700 mt-1 pt-3' : 'border-b border-gray-50 dark:border-gray-800'}`}>
      <span className={opts?.bold ? 'text-sm font-semibold text-gray-900 dark:text-gray-100' : 'text-sm text-gray-500 dark:text-gray-400'}>
        {label}{opts?.sub ? <span className="ml-1 text-xs text-gray-400">{opts.sub}</span> : null}
      </span>
      <span className={`tabular-nums ${opts?.bold ? 'text-lg font-bold text-coral' : opts?.muted ? 'text-sm text-gray-400 dark:text-gray-500' : 'text-sm font-medium text-gray-900 dark:text-gray-100'}`}>{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Link href="/admin/billing" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-coral dark:text-gray-400">
            <ArrowLeft size={15} /> {t('back')}
          </Link>
          <Link href="/admin/billing/invoices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-coral dark:text-gray-400">
            <FileText size={15} /> {ti('invoicesLink')}
          </Link>
        </div>

        {error && !termins.length ? (
          <ErrorState message={error} />
        ) : loading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            {/* Výber rozsahu */}
            <SectionCard title={t('stmtTitle')}>
              <div className="mb-3 inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 text-sm">
                {(['termin', 'month'] as Mode[]).map((mTab) => (
                  <button
                    key={mTab}
                    onClick={() => { setMode(mTab); setStmt(null); }}
                    className={`rounded-md px-3 py-1 ${mode === mTab ? 'bg-coral/10 text-coral font-medium' : 'text-gray-500 dark:text-gray-400'}`}
                  >
                    {mTab === 'termin' ? t('scopeTermin') : t('scopeMonth')}
                  </button>
                ))}
              </div>

              {mode === 'termin' ? (
                termins.length === 0 ? (
                  <EmptyState message={t('noTermins')} />
                ) : (
                  <select
                    value={terminId}
                    onChange={(e) => onSelectTermin(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
                  >
                    <option value="">{t('selectTermin')}</option>
                    {termins.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {fmtTerminDate(tm.startsAt)}{tm.showName ? ` · ${tm.showName}` : ''}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <input
                  type="month"
                  value={month}
                  onChange={(e) => onSelectMonth(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
                />
              )}
            </SectionCard>

            {/* Rozpis */}
            {stmtLoading ? (
              <Skeleton className="h-72" />
            ) : stmt ? (
              <SectionCard title={t('stmtTitle')}>
                {row(t('ticketsSold'), String(stmt.ticketsSold))}
                {row(t('revenue'), eur(stmt.revenueCents))}
                {row(t('commission'), `−${eur(stmt.commissionCents)}`, { sub: `${stmt.commissionPercent}%` })}
                {row(t('vat'), `−${eur(stmt.vatCents)}`, { sub: `${stmt.vatPercent}%` })}
                {row(t('refundedTickets'), String(stmt.refundedTickets))}
                {row(t('refundFees'), `−${eur(stmt.refundFeesCents)}`, { sub: `${eur(stmt.refundFeePerTicketCents)} ${t('perTicketSuffix')}` })}
                {row(t('netPayout'), eur(stmt.netPayoutCents), { bold: true })}
                <div className="mt-3 rounded-lg bg-cream dark:bg-gray-800 p-3">
                  {row(t('customerFees'), eur(stmt.customerFeesCents), { muted: true })}
                  <p className="text-xs text-gray-400 dark:text-gray-500">{t('customerFeesNote')}</p>
                </div>
                <div className="mt-5">
                  <Button onClick={createInvoice} loading={creating} disabled={creating}>
                    <FileText size={16} className="mr-2" /> {ti('create')}
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <p className="text-center text-sm text-gray-400 dark:text-gray-500">{t('pickPrompt')}</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
