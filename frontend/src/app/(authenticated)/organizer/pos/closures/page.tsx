'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useTranslations, useFormatter } from 'next-intl';
import { Loader2, Lock, FileDown, ArrowLeft, Banknote, CreditCard, X } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { posApi, PosSummary, PosClosure } from '@/lib/api/pos';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { Button } from '@/components/ui/button';

export default function PosClosuresPage() {
  const t = useTranslations('organizer.pos');
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
      if (e.status === 403) return t('closures.error.forbidden');
      if (e.status === 400) return e.message || t('closures.error.noSales');
      if (e.status >= 500) return t('closures.error.server');
      return e.message || t('error.generic');
    }
    return t('error.network');
  }, [t]);

  const { user } = useAuth();
  const canClose = user?.role === 'ORGANIZER_OWNER' || user?.role === 'SUPERADMIN' || user?.role === 'STAFF';

  const [summary, setSummary] = useState<PosSummary | null>(null);
  const [closures, setClosures] = useState<PosClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const [s, c] = await Promise.all([posApi.summary(token), posApi.closures(token)]);
      setSummary(s);
      setClosures(c.items);
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

  async function doClose() {
    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const res = await posApi.createClosure(note.trim() || undefined, token);
      setToast({ msg: t('closures.toast.closed', { amount: fmtPrice(res.closure.total), count: res.closure.orderCount }), ok: true });
      setConfirmOpen(false);
      setNote('');
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadPdf(c: PosClosure) {
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const blob = await posApi.closurePdf(c.id, token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uzavierka-${c.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    }
  }

  const hasSales = (summary?.orderCount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <Link href="/organizer/pos" className="inline-flex items-center gap-1 text-sm text-brand hover:underline"><ArrowLeft size={15} /> {t('closures.back')}</Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{t('closures.title')}</h1>
        </div>

        {toast && (
          <div className={clsx('rounded-lg px-4 py-2.5 text-sm font-medium', toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {toast.msg}
          </div>
        )}

        {error ? (
          <ErrorState message={error} />
        ) : loading ? (
          <Skeleton className="h-48" />
        ) : (
          <>
            {/* Živý summary */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">{t('closures.sinceLastClosure')}</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {summary?.periodFrom ? t('closures.periodFrom', { date: fmtDate(summary.periodFrom) }) : t('closures.allPosSales')}
                  </p>
                </div>
                {canClose && (
                  <Button onClick={() => setConfirmOpen(true)} disabled={!hasSales} className="gap-2">
                    <Lock size={16} /> {t('closures.closeButton')}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-emerald-50 p-4">
                  <div className="flex items-center gap-1 text-xs font-medium text-emerald-700"><Banknote size={13} /> {t('closures.cash')}</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-800">{fmtPrice(summary?.cashTotal ?? 0)}</div>
                </div>
                <div className="rounded-lg bg-sky-50 p-4">
                  <div className="flex items-center gap-1 text-xs font-medium text-sky-700"><CreditCard size={13} /> {t('closures.card')}</div>
                  <div className="mt-1 text-2xl font-bold text-sky-800">{fmtPrice(summary?.cardTotal ?? 0)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('closures.total')}</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{fmtPrice(summary?.total ?? 0)}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('closures.salesTicketsSummary', { sales: summary?.orderCount ?? 0, tickets: summary?.ticketCount ?? 0 })}</p>
              {!hasSales && <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">{t('closures.noNewSales')}</p>}
            </div>

            {/* História */}
            <SectionCard title={closures.length ? t('closures.historyTitleCount', { count: closures.length }) : t('closures.historyTitle')}>
              {closures.length === 0 ? (
                <EmptyState message={t('closures.historyEmpty')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                        <th className="py-2 pr-3 font-medium">{t('closures.table.closed')}</th>
                        <th className="py-2 px-3 font-medium">{t('closures.table.period')}</th>
                        <th className="py-2 px-3 font-medium text-right">{t('closures.table.cash')}</th>
                        <th className="py-2 px-3 font-medium text-right">{t('closures.table.card')}</th>
                        <th className="py-2 px-3 font-medium text-right">{t('closures.table.total')}</th>
                        <th className="py-2 px-3 font-medium text-right">{t('closures.table.salesPcs')}</th>
                        <th className="py-2 px-3 font-medium">{t('closures.table.by')}</th>
                        <th className="py-2 pl-3 font-medium text-right">{t('closures.table.pdf')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {closures.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2.5 pr-3 whitespace-nowrap text-gray-700 dark:text-gray-200">{fmtDate(c.createdAt)}</td>
                          <td className="px-3 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">{fmtDate(c.periodFrom)} – {fmtDate(c.periodTo)}</td>
                          <td className="px-3 text-right tabular-nums text-emerald-700">{fmtPrice(c.cashTotal)}</td>
                          <td className="px-3 text-right tabular-nums text-sky-700">{fmtPrice(c.cardTotal)}</td>
                          <td className="px-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{fmtPrice(c.total)}</td>
                          <td className="px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{c.orderCount}/{c.ticketCount}</td>
                          <td className="px-3 text-gray-600 dark:text-gray-300">{c.closedByName ?? '—'}</td>
                          <td className="py-2.5 pl-3 text-right">
                            <button onClick={() => downloadPdf(c)} className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-brand" title={t('closures.downloadPdf')}>
                              <FileDown size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </>
        )}
      </main>

      {/* Confirm modal */}
      {confirmOpen && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('closures.modal.title')}</h3>
              <button onClick={() => setConfirmOpen(false)} className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="space-y-1 rounded-lg bg-gray-50 dark:bg-gray-900 p-4 text-sm">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">{t('closures.cash')}</span><span className="font-semibold">{fmtPrice(summary.cashTotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">{t('closures.card')}</span><span className="font-semibold">{fmtPrice(summary.cardTotal)}</span></div>
                <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-1 text-base"><span className="font-semibold">{t('closures.total')}</span><span className="font-bold text-brand">{fmtPrice(summary.total)}</span></div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{t('closures.salesTicketsSummary', { sales: summary.orderCount, tickets: summary.ticketCount })}</div>
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('closures.modal.notePlaceholder')} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('closures.modal.notice')}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>{t('closures.modal.cancel')}</Button>
              <Button onClick={doClose} loading={submitting} disabled={submitting} className="gap-2"><Lock size={15} /> {t('closures.modal.confirm')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
