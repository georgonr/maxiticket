'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Loader2, RefreshCw, Check, X, BadgeCheck, AlertTriangle } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { refundsApi, RefundListItem, RefundStatus } from '@/lib/api/refunds';
import { formatPrice, formatDate } from '@/lib/format';

const REFUND_STATUS: Record<string, { label: string; cls: string }> = {
  REQUESTED: { label: 'Čaká na vybavenie', cls: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Schválené', cls: 'bg-sky-50 text-sky-700' },
  REJECTED: { label: 'Zamietnuté', cls: 'bg-gray-100 text-gray-500' },
  REFUNDED: { label: 'Peniaze vrátené', cls: 'bg-orange-50 text-orange-700' },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Všetky' },
  { value: 'REQUESTED', label: 'Čakajúce' },
  { value: 'APPROVED', label: 'Schválené' },
  { value: 'REJECTED', label: 'Zamietnuté' },
  { value: 'REFUNDED', label: 'Vrátené' },
];

type ModalState =
  | { kind: 'approve'; row: RefundListItem }
  | { kind: 'reject'; row: RefundListItem }
  | { kind: 'mark'; row: RefundListItem }
  | null;

export function RefundsManager({ admin }: { admin: boolean }) {
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
      setError(e instanceof Error ? e.message : 'Načítanie žiadostí zlyhalo.');
    }
  }, [admin, statusFilter]);

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
      setActionError(e instanceof Error ? e.message : 'Akcia zlyhala.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === f.value ? 'bg-brand/10 text-brand' : 'text-gray-500 hover:bg-gray-100',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <RefreshCw size={14} /> Obnoviť
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand" size={28} /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">Žiadne žiadosti o vrátenie.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Objednávka</th>
                {admin && <th className="px-4 py-3">Organizátor</th>}
                <th className="px-4 py-3">Zákazník</th>
                <th className="px-4 py-3">Suma</th>
                <th className="px-4 py-3">Dôvod</th>
                <th className="px-4 py-3">Stav</th>
                <th className="px-4 py-3">Žiadané</th>
                <th className="px-4 py-3 text-right">Akcie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const rs = REFUND_STATUS[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{r.orderNumber}</td>
                    {admin && <td className="px-4 py-3 text-gray-600">{r.organizerName ?? '—'}</td>}
                    <td className="px-4 py-3 text-gray-600">
                      <div>{r.buyerName ?? '—'}</div>
                      <div className="text-xs text-gray-400">{r.buyerEmail}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{formatPrice(r.refundAmount ?? r.orderTotal, r.currency)}</td>
                    <td className="px-4 py-3 max-w-[16rem] text-gray-600">
                      <div className="line-clamp-2">{r.reason}</div>
                      {r.status === 'REJECTED' && r.reviewNote && (
                        <div className="mt-1 text-xs text-gray-400">Pozn.: {r.reviewNote}</div>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', rs.cls)}>{rs.label}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(r.requestedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {r.status === 'REQUESTED' && (
                          <>
                            <button onClick={() => openModal('approve', r)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                              <Check size={13} /> Schváliť
                            </button>
                            <button onClick={() => openModal('reject', r)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                              <X size={13} /> Zamietnuť
                            </button>
                          </>
                        )}
                        {r.status === 'APPROVED' && (
                          <button onClick={() => openModal('mark', r)} className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-orange-700">
                            <BadgeCheck size={13} /> Označiť ako vrátené
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {modal.kind === 'approve' && 'Schváliť žiadosť o vrátenie'}
                {modal.kind === 'reject' && 'Zamietnuť žiadosť'}
                {modal.kind === 'mark' && 'Označiť ako vrátené'}
              </h3>
              <button onClick={() => !busy && setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <p className="mt-1 text-sm text-gray-500">Objednávka {modal.row.orderNumber} · {modal.row.buyerEmail}</p>

            {modal.kind === 'approve' && (
              <>
                <label className="mt-4 block text-sm font-medium text-gray-700">Suma na vrátenie ({modal.row.currency})</label>
                <input
                  type="number" step="0.01" min="0" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <label className="mt-3 block text-sm font-medium text-gray-700">Poznámka (voliteľná)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                {modal.row.paymentProvider === 'stripe' && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>Toto je Stripe platba. Po schválení vykonajte refund v Stripe dashboarde a až potom potvrďte „Označiť ako vrátené".</span>
                  </div>
                )}
              </>
            )}

            {modal.kind === 'reject' && (
              <>
                <label className="mt-4 block text-sm font-medium text-gray-700">Dôvod zamietnutia (voliteľný – uvidí ho zákazník)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                <p className="mt-2 text-xs text-gray-400">Objednávka sa vráti do stavu „Zaplatené" a lístky ostanú platné.</p>
              </>
            )}

            {modal.kind === 'mark' && (
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                {modal.row.paymentProvider === 'stripe' ? (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-700">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>Najprv vykonajte refund v Stripe dashboarde, potom potvrďte. Systém Stripe API nevolá – iba zaeviduje stav.</span>
                  </div>
                ) : (
                  <p>Potvrdením označíte objednávku ako vrátenú.</p>
                )}
                <p>Vstupenky objednávky budú <strong>zneplatnené</strong> (skener ich odmietne){modal.row.paymentProvider !== 'stripe' ? '.' : ' a prípadný kupón sa vráti do obehu.'}</p>
              </div>
            )}

            {actionError && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModal(null)} disabled={busy} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Zrušiť</button>
              <button
                onClick={confirmModal} disabled={busy}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                  modal.kind === 'reject' ? 'bg-gray-700 hover:bg-gray-800' : modal.kind === 'mark' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700',
                )}
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {modal.kind === 'approve' && 'Schváliť'}
                {modal.kind === 'reject' && 'Zamietnuť'}
                {modal.kind === 'mark' && 'Potvrdiť vrátenie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
