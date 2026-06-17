'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import { ArrowLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { billingApi, InvoiceListRow, InvoiceStatus } from '@/lib/api/billing';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { Button } from '@/components/ui/button';

export default function AdminInvoicesPage() {
  const t = useTranslations('billing.invoice');
  const tb = useTranslations('billing');
  const format = useFormatter();
  const router = useRouter();
  const eur = (cents: number) => format.number(cents / 100, { style: 'currency', currency: 'EUR' });
  const d = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'numeric', year: 'numeric' });

  const [rows, setRows] = useState<InvoiceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | InvoiceStatus>('');
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      setRows(await billingApi.listInvoices(token, statusFilter ? { status: statusFilter } : {}));
    } catch {
      setError(tb('errLoad'));
    } finally {
      setLoading(false);
    }
  }, [tb, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function runAuto() {
    setRunning(true); setToast(null);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      const res = await billingApi.runAutoGeneration('all', token);
      setToast(t('autoRunResult', { count: res.created }));
      await load();
    } catch {
      setToast(tb('errLoad'));
    } finally {
      setRunning(false);
    }
  }

  const STATUSES: InvoiceStatus[] = ['DRAFT', 'FINALIZED', 'SENT', 'PAID'];
  const statusBadge: Record<string, string> = {
    DRAFT: 'bg-amber-50 text-amber-700',
    FINALIZED: 'bg-blue-50 text-blue-700',
    SENT: 'bg-violet-50 text-violet-700',
    PAID: 'bg-emerald-50 text-emerald-700',
  };

  const period = (r: InvoiceListRow) =>
    r.terminId ? '—' : r.periodFrom && r.periodTo ? `${d(r.periodFrom)} – ${d(r.periodTo)}` : '—';

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <Link href="/admin/billing" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-coral dark:text-gray-400">
          <ArrowLeft size={15} /> {tb('back')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('listTitle')}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | InvoiceStatus)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
            >
              <option value="">{t('filterAll')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
            </select>
            <Button variant="outline" onClick={runAuto} loading={running} disabled={running}>
              <RefreshCw size={15} className="mr-1.5" /> {t('runAuto')}
            </Button>
          </div>
        </div>

        {toast && <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">{toast}</div>}

        <SectionCard title={t('listTitle')}>
          {error ? (
            <ErrorState message={error} />
          ) : loading ? (
            <Skeleton className="h-60" />
          ) : rows.length === 0 ? (
            <EmptyState message={t('listEmpty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                    <th className="py-2 pr-3 font-medium">{t('col.number')}</th>
                    <th className="py-2 px-3 font-medium">{t('col.organizer')}</th>
                    <th className="py-2 px-3 font-medium">{t('col.period')}</th>
                    <th className="py-2 px-3 font-medium">{t('col.status')}</th>
                    <th className="py-2 px-3 text-right font-medium">{t('col.total')}</th>
                    <th className="py-2 px-3 font-medium">{t('col.due')}</th>
                    <th className="py-2 pl-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => router.push(`/admin/billing/invoices/${r.id}`)} className="cursor-pointer hover:bg-cream/60 dark:hover:bg-gray-800">
                      <td className="py-2.5 pr-3 font-medium tabular-nums text-gray-900 dark:text-gray-100">{r.invoiceNumber ?? t('noNumber')}</td>
                      <td className="px-3 text-gray-600 dark:text-gray-300">{r.organizer.name}</td>
                      <td className="px-3 text-gray-500 dark:text-gray-400">{period(r)}</td>
                      <td className="px-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {t(`status.${r.status}`)}
                        </span>
                        {r.autoGenerated && <span className="ml-1.5 inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">{t('autoBadge')}</span>}
                        {r.paidOutAt && <span className="ml-1.5 inline-block rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">{t('paidOutBadge')}</span>}
                      </td>
                      <td className="px-3 text-right font-medium tabular-nums text-gray-900 dark:text-gray-100">{eur(r.totalCents)}</td>
                      <td className="px-3 text-gray-500 dark:text-gray-400 tabular-nums">{d(r.dueDate)}</td>
                      <td className="pl-3 text-right text-gray-300 dark:text-gray-600"><ChevronRight size={16} className="inline" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </main>
    </div>
  );
}
