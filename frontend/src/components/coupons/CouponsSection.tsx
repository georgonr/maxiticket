'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ticket, Plus, Layers, Trash2, Eye, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import {
  couponsAdminApi,
  CouponListItem,
  CouponStat,
} from '@/lib/api/coupons';
import { SectionCard, Skeleton } from '@/components/dashboard/parts';
import {
  ScopeBadge,
  StatusBadge,
  useCouponLabels,
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
  const t = useTranslations('organizer.coupon');
  const { typeValueLabel, usageLabel, validityLabel } = useCouponLabels();
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<CouponListItem[]>([]);
  const [stats, setStats] = useState<Record<string, CouponStat>>({});
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
      if (!token) throw new Error(t('errors.loginRequired'));
      const res = await couponsAdminApi.list({ relevantToShowId: showId, limit: 100 }, token);
      setCoupons(res.items);
      // C8: predaj per kupón (affiliate tracking). Zlyhanie statistiky nezhodí zoznam kupónov.
      try {
        const st = await couponsAdminApi.stats(showId, token);
        setStats(Object.fromEntries(st.map((s) => [s.couponId, s])));
      } catch {
        setStats({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [showId, t]);

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
    if (!window.confirm(t('confirmDelete', { code: c.code }))) return;
    setDeletingId(c.id);
    try {
      const token = await getValidToken();
      if (!token) throw new Error(t('errors.loginRequired'));
      await couponsAdminApi.delete(c.id, token);
      setCoupons((prev) => prev.filter((x) => x.id !== c.id));
      setToast({ msg: t('toast.deleted', { code: c.code }), ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : t('errors.deleteFailed'), ok: false });
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <Layers size={15} /> {t('generateMore')}
      </button>
      <button
        onClick={() => setShowCreate(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
      >
        <Plus size={15} /> {t('addCoupon')}
      </button>
    </div>
  );

  return (
    <SectionCard
      title={`${t('title')}${!loading ? ` (${coupons.length})` : ''}`}
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
            <RefreshCw size={13} /> {t('retry')}
          </button>
        </div>
      ) : coupons.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          <Ticket size={28} className="text-gray-300" />
          <p>{t('empty')}</p>
          <button onClick={() => setShowCreate(true)} className="font-medium text-brand hover:underline">
            {t('addFirst')}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                <th className="py-2 pr-3 font-medium">{t('table.code')}</th>
                <th className="py-2 px-3 font-medium">{t('table.discount')}</th>
                <th className="py-2 px-3 font-medium">{t('table.scope')}</th>
                <th className="py-2 px-3 font-medium">{t('table.validity')}</th>
                <th className="py-2 px-3 font-medium">{t('table.usage')}</th>
                <th className="py-2 px-3 font-medium text-right">{t('table.ticketsSold')}</th>
                <th className="py-2 px-3 font-medium text-right">{t('table.revenue')}</th>
                <th className="py-2 px-3 font-medium text-right">{t('table.scanned')}</th>
                <th className="py-2 px-3 font-medium">{t('table.status')}</th>
                <th className="py-2 pl-3 font-medium text-right">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {coupons.map((c) => {
                const inherited = isInherited(c);
                const canDelete = !inherited && c.usedCount === 0;
                const stat = stats[c.id];
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-2.5 pr-3 font-mono font-medium text-gray-900 dark:text-gray-100">{c.code}</td>
                    <td className="px-3 text-gray-700 dark:text-gray-200">{typeValueLabel(c.type, c.value)}</td>
                    <td className="px-3"><ScopeBadge scope={c.scope} inherited={inherited} /></td>
                    <td className="px-3 text-gray-500 dark:text-gray-400">{validityLabel(c.validFrom, c.validUntil)}</td>
                    <td className="px-3 tabular-nums text-gray-600 dark:text-gray-300">{usageLabel(c.usedCount, c.maxUses)}</td>
                    <td className="px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">{stat ? stat.ticketsSold : inherited ? '–' : 0}</td>
                    <td className="px-3 text-right tabular-nums text-gray-700 dark:text-gray-200">{stat ? `${stat.revenue.toFixed(2)} €` : inherited ? '–' : '0.00 €'}</td>
                    <td className="px-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{stat ? stat.scanned : inherited ? '–' : 0}</td>
                    <td className="px-3"><StatusBadge status={c.status} /></td>
                    <td className="py-2.5 pl-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailId(c.id)}
                          className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700"
                          title={t('actions.detail')}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={!canDelete || deletingId === c.id}
                          className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                          title={
                            inherited
                              ? t('actions.inheritedTitle')
                              : c.usedCount > 0
                                ? t('actions.usedTitle')
                                : t('actions.delete')
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
