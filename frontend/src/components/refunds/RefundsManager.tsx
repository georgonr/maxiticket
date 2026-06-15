'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { clsx } from 'clsx';
import { Loader2, RefreshCw, Check, X, BadgeCheck, AlertTriangle } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { refundsApi, RefundListItem, RefundStatus } from '@/lib/api/refunds';

const REFUND_STATUS_CLS: Record<string, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-sky-50 text-sky-700',
  REJECTED: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  REFUNDED: 'bg-orange-50 text-orange-700',
};

const STATUS_FILTER_VALUES = ['', 'REQUESTED', 'APPROVED', 'REJECTED', 'REFUNDED'] as const;

type ModalState =
  | { kind: 'approve'; row: RefundListItem }
  | { kind: 'reject'; row: RefundListItem }
  | { kind: 'mark'; row: RefundListItem }
  | null;

export function RefundsManager({ admin }: { admin: boolean }) {
  const t = useTranslations('organizer.refunds');
  const format = useFormatter();
  const [rows, setRows] = useState<RefundListItem[] | null>(null);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const token = await getValidToken();
      if (!token) return;
      setRows(await refundsApi.list(admin, statusFilter, token));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.load'));
    }
  }, [admin, statusFilter, t]);

  useEffect(() => { load(); }, [load]);

  function openModal(kind: 'approve' | 'reject' | 'mark', row: RefundListItem) {
    setModal({ kind, row } as ModalState);
    setNote('');
    setAmount(String(row.refundAmount ?? row.orderTotal));
    setActionError('');
  }

  async function confirmModal() {
    if (!modal) return;
    setBusy(true);
    setActionError('');
    try {
      const token = await getValidToken();
      if (!token) return;
      if (modal.kind === 'approve') {
        const amt = amount.trim() ? Number(amount) : undefined;
        await refundsApi.review(modal.row.id, { action: 'approve', reviewNote: note.trim() || undefined, refundAmount: amt }, token);
      } else if (modal.kind === 'reject') {
        await refundsApi.review(modal.row.id, { action: 'reject', reviewNote: note.trim() || undefined }, token);
      } else {
        await refundsApi.markRefunded(modal.row.id, token);
      }
      setModal(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('errors.action'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTER_VALUES.map((value) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === value ? 'bg-brand/10 text-brand' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              {t(`filters.${value || 'all'}`)}
            </button>
          ))}
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
          <RefreshCw size={14} /> {t('refresh')}
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" size={28} /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-800 py-10 text-center text-sm text-gray-400 dark:text-gray-500">{t('empty')}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">{t('table.order')}</th>
                {admin && <th className="px-4 py-3">{t('table.organizer')}</th>}
                <th className="px-4 py-3">{t('table.customer')}</th>
                <th className="px-4 py-3">{t('table.amount')}</th>
                <th className="px-4 py-3">{t('table.reason')}</th>
                <th className="px-4 py-3">{t('table.status')}</th>
                <th className="px-4 py-3">{t('table.requested')}</th>
                <th className="px-4 py-3 text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => {
                const statusCls = REFUND_STATUS_CLS[r.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300';
                const statusLabel = REFUND_STATUS_CLS[r.status] ? t(`status.${r.status}`) : r.status;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-200">{r.orderNumber}</td>
                    {admin && <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.organizerName ?? '—'}</td>}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div>{r.buyerName ?? '—'}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{r.buyerEmail}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{format.number(Number(r.refundAmount ?? r.orderTotal), { style: 'currency', currency: r.currency })}</td>
                    <td className="px-4 py-3 max-w-[16rem] text-gray-600 dark:text-gray-300">
                      <div className="line-clamp-2">{r.reason}</div>
                      {r.status === 'REJECTED' && r.reviewNote && (
                        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('notePrefix')} {r.reviewNote}</div>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', statusCls)}>{statusLabel}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">{format.dateTime(new Date(r.requestedAt), { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {r.status === 'REQUESTED' && (
                          <>
                            <button onClick={() => openModal('approve', r)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                              <Check size={13} /> {t('actions.approve')}
                            </button>
                            <button onClick={() => openModal('reject', r)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <X size={13} /> {t('actions.reject')}
                            </button>
                          </>
                        )}
                        {r.status === 'APPROVED' && (
                          <button onClick={() => openModal('mark', r)} className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-700">
                            <BadgeCheck size={13} /> {t('actions.markRefunded')}
                          </button>
                        )}
                        {(r.status === 'REFUNDED' || r.status === 'REJECTED') && <span className="text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {modal.kind === 'approve' && t('modal.approve.title')}
                {modal.kind === 'reject' && t('modal.reject.title')}
                {modal.kind === 'mark' && t('modal.mark.title')}
              </h3>
              <button onClick={() => !busy && setModal(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('modal.orderLabel')} {modal.row.orderNumber} · {modal.row.buyerEmail}</p>

            {modal.kind === 'approve' && (
              <>
                <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('modal.approve.amountLabel', { currency: modal.row.currency })}</label>
                <input
                  type="number" step="0.01" min="0" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <label className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('modal.approve.noteLabel')}</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                {modal.row.paymentProvider === 'stripe' && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{t('modal.approve.stripeWarning')}</span>
                  </div>
                )}
              </>
            )}

            {modal.kind === 'reject' && (
              <>
                <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('modal.reject.noteLabel')}</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{t('modal.reject.hint')}</p>
              </>
            )}

            {modal.kind === 'mark' && (
              <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                {modal.row.paymentProvider === 'stripe' ? (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{t('modal.mark.stripeWarning')}</span>
                  </div>
                ) : (
                  <p>{t('modal.mark.confirmText')}</p>
                )}
                <p>
                  {t.rich(modal.row.paymentProvider === 'stripe' ? 'modal.mark.invalidatedStripe' : 'modal.mark.invalidated', {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
              </div>
            )}

            {actionError && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModal(null)} disabled={busy} className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">{t('modal.cancel')}</button>
              <button
                onClick={confirmModal} disabled={busy}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                  modal.kind === 'reject' ? 'bg-gray-700 hover:bg-gray-800' : modal.kind === 'mark' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700',
                )}
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {modal.kind === 'approve' && t('modal.approve.confirm')}
                {modal.kind === 'reject' && t('modal.reject.confirm')}
                {modal.kind === 'mark' && t('modal.mark.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
