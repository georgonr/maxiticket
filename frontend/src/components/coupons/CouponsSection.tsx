'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ticket, Plus, Layers, Trash2, Eye, RefreshCw } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import {
  couponsAdminApi,
  CouponListItem,
} from '@/lib/api/coupons';
import { SectionCard, Skeleton } from '@/components/dashboard/parts';
import {
  ScopeBadge,
  StatusBadge,
  typeValueLabel,
  usageLabel,
  validityLabel,
} from './couponUi';
import { CreateCouponModal } from './CreateCouponModal';
import { BulkGenerateModal } from './BulkGenerateModal';
import { CouponDetailModal } from './CouponDetailModal';
import { FlatTicketType } from './useCouponFields';

/** SHOW + TICKET_TYPE kupóny patria tomuto podujatiu (editovateľné); ORGANIZER/GLOBAL sú dedené. */
function isInherited(c: CouponListItem): boolean {
  return c.scope === 'ORGANIZER' || c.scope === 'GLOBAL';
}

export function CouponsSection({
  showId,
  showTitle,
  ticketTypes,
  organizerId,
}: {
  showId: string;
  showTitle: string;
  ticketTypes: FlatTicketType[];
  organizerId: string;
}) {
  void showTitle;
  void organizerId;
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<CouponListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getValidToken();
      if (!token) throw new Error('Vyžaduje sa prihlásenie.');
      const res = await couponsAdminApi.list({ relevantToShowId: showId, limit: 100 }, token);
      setCoupons(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načítanie kupónov zlyhalo.');
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleDelete(c: CouponListItem) {
    if (c.usedCount > 0 || isInherited(c)) return;
    if (!window.confirm(`Naozaj zmazať kupón ${c.code}?`)) return;
    setDeletingId(c.id);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('Vyžaduje sa prihlásenie.');
      await couponsAdminApi.delete(c.id, token);
      setCoupons((prev) => prev.filter((x) => x.id !== c.id));
      setToast({ msg: `Kupón ${c.code} zmazaný.`, ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : 'Zmazanie zlyhalo.', ok: false });
    } finally {
      setDeletingId(null);
    }
  }

  function onMutated(msg: string) {
    setShowCreate(false);
    setShowBulk(false);
    setToast({ msg, ok: true });
    load();
  }

  const headerActions = (
    <div className="flex gap-2">
      <button
        onClick={() => setShowBulk(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <Layers size={15} /> Generovať viac kódov
      </button>
      <button
        onClick={() => setShowCreate(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
      >
        <Plus size={15} /> Pridať kupón
      </button>
    </div>
  );

  return (
    <SectionCard
      title={`Kupóny${!loading ? ` (${coupons.length})` : ''}`}
      action={headerActions}
    >
      {toast && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${
            toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-32" />
      ) : error ? (
        <div className="flex flex-col items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="inline-flex items-center gap-1 font-medium underline">
            <RefreshCw size={13} /> Skúsiť znova
          </button>
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-gray-400">
          <Ticket size={28} className="text-gray-300" />
          <p>Pre toto podujatie zatiaľ nie sú žiadne kupóny.</p>
          <button onClick={() => setShowCreate(true)} className="font-medium text-brand hover:underline">
            + Pridať prvý kupón
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="py-2 pr-3 font-medium">Kód</th>
                <th className="py-2 px-3 font-medium">Zľava</th>
                <th className="py-2 px-3 font-medium">Rozsah</th>
                <th className="py-2 px-3 font-medium">Platnosť</th>
                <th className="py-2 px-3 font-medium">Použitia</th>
                <th className="py-2 px-3 font-medium">Stav</th>
                <th className="py-2 pl-3 font-medium text-right">Akcie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map((c) => {
                const inherited = isInherited(c);
                const canDelete = !inherited && c.usedCount === 0;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-2.5 pr-3 font-mono font-medium text-gray-900">{c.code}</td>
                    <td className="px-3 text-gray-700">{typeValueLabel(c.type, c.value)}</td>
                    <td className="px-3"><ScopeBadge scope={c.scope} inherited={inherited} /></td>
                    <td className="px-3 text-gray-500">{validityLabel(c.validFrom, c.validUntil)}</td>
                    <td className="px-3 tabular-nums text-gray-600">{usageLabel(c.usedCount, c.maxUses)}</td>
                    <td className="px-3"><StatusBadge status={c.status} /></td>
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailId(c.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Detail"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={!canDelete || deletingId === c.id}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          title={
                            inherited
                              ? 'Dedený kupón – upravte v jeho vlastnom rozsahu'
                              : c.usedCount > 0
                                ? 'Použitý kupón nie je možné zmazať'
                                : 'Zmazať'
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateCouponModal
          showId={showId}
          ticketTypes={ticketTypes}
          onClose={() => setShowCreate(false)}
          onCreated={onMutated}
        />
      )}
      {showBulk && (
        <BulkGenerateModal
          showId={showId}
          ticketTypes={ticketTypes}
          defaultEmail={user?.email ?? ''}
          onClose={() => setShowBulk(false)}
          onGenerated={onMutated}
        />
      )}
      {detailId && <CouponDetailModal couponId={detailId} onClose={() => setDetailId(null)} />}
    </SectionCard>
  );
}
