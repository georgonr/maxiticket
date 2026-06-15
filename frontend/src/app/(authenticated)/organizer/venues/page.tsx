'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import Link from 'next/link';
import { MapPin, Plus, Pencil, Trash2, Globe, LayoutGrid, Share2 } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, venuesApi, Venue } from '@/lib/api';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { VenueFormModal } from '@/components/venues/VenueFormModal';
import { VenueAccessModal } from '@/components/venues/VenueAccessModal';

export default function VenuesPage() {
  const t = useTranslations('organizer.venues');
  const { user } = useAuth();

  const readableError = useCallback((e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.status === 401 || e.status === 403) return t('error.noPermission');
      if (e.status >= 500) return t('error.server');
      return e.message || t('error.generic');
    }
    return t('error.connect');
  }, [t]);
  const isSuper = user?.role === 'SUPERADMIN' || user?.role === 'STAFF';

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [sharing, setSharing] = useState<Venue | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isGlobal = (v: Venue) => v.organizerId == null;
  const isOwn = (v: Venue) => v.organizerId != null && v.organizerId === user?.organizerId;
  // Mutácie smie super/staff (všetko) alebo OWNER (len vlastné, nie globálne/sprístupnené) – nie MEMBER.
  const canManage = (v: Venue) =>
    isSuper || (user?.role === 'ORGANIZER_OWNER' && isOwn(v));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      setVenues(await venuesApi.list(token));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, [readableError]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function remove(v: Venue) {
    if (!window.confirm(t('confirm.delete', { name: v.name }))) return;
    setBusyId(v.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const res = await venuesApi.remove(v.id, token);
      setToast({ msg: res.deactivated ? t('toast.deactivated', { name: v.name }) : t('toast.deleted', { name: v.name }), ok: true });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(v: Venue) {
    setBusyId(v.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await venuesApi.update(v.id, { isActive: true }, token);
      setToast({ msg: t('toast.activated', { name: v.name }), ok: true });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  function onSaved(msg: string) {
    setShowCreate(false);
    setEditing(null);
    setSharing(null);
    setToast({ msg, ok: true });
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('subtitle')}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            <Plus size={16} /> {t('addVenue')}
          </button>
        </div>

        {toast && (
          <div className={clsx('rounded-lg px-4 py-2.5 text-sm font-medium', toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {toast.msg}
          </div>
        )}

        {error ? (
          <ErrorState message={error} />
        ) : (
          <SectionCard title={`${t('listTitle')}${!loading ? ` (${venues.length})` : ''}`}>
            {loading ? (
              <Skeleton className="h-40" />
            ) : venues.length === 0 ? (
              <EmptyState message={t('empty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                      <th className="py-2 pr-3 font-medium">{t('col.name')}</th>
                      <th className="py-2 px-3 font-medium">{t('col.city')}</th>
                      <th className="py-2 px-3 font-medium">{t('col.address')}</th>
                      <th className="py-2 px-3 font-medium text-right">{t('col.capacity')}</th>
                      <th className="py-2 px-3 font-medium">{t('col.type')}</th>
                      <th className="py-2 px-3 font-medium">{t('col.status')}</th>
                      <th className="py-2 pl-3 font-medium text-right">{t('col.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {venues.map((v) => {
                      const manage = canManage(v);
                      return (
                        <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-gray-100">{v.name}</td>
                          <td className="px-3 text-gray-600 dark:text-gray-300">{v.city ?? '—'}</td>
                          <td className="px-3 text-gray-500 dark:text-gray-400">{v.street ?? '—'}</td>
                          <td className="px-3 text-right tabular-nums text-gray-600 dark:text-gray-300">{v.capacity ?? '—'}</td>
                          <td className="px-3">
                            {isSuper ? (
                              isGlobal(v) ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                                  <Globe size={11} /> {t('type.global')}
                                </span>
                              ) : (
                                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{t('type.organizer')}</span>
                              )
                            ) : isOwn(v) ? (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{t('type.own')}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                <Share2 size={11} /> {t('type.shared')}
                              </span>
                            )}
                          </td>
                          <td className="px-3">
                            <span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', v.isActive === false ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' : 'bg-emerald-50 text-emerald-700')}>
                              {v.isActive === false ? t('status.inactive') : t('status.active')}
                            </span>
                          </td>
                          <td className="py-2.5 pl-3">
                            <div className="flex items-center justify-end gap-1">
                              {v.isActive === false && manage && (
                                <button onClick={() => reactivate(v)} disabled={busyId === v.id} className="rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-40">
                                  {t('action.activate')}
                                </button>
                              )}
                              <Link
                                href={`/organizer/venues/${v.id}/seatmaps`}
                                className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700"
                                title={t('action.seatmaps')}
                              >
                                <LayoutGrid size={15} />
                              </Link>
                              {isSuper && (
                                <button
                                  onClick={() => setSharing(v)}
                                  className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-amber-50 hover:text-amber-600"
                                  title={t('action.share')}
                                >
                                  <Share2 size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => setEditing(v)}
                                disabled={!manage}
                                className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                                title={manage ? t('action.edit') : t('action.readOnly')}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => remove(v)}
                                disabled={!manage || busyId === v.id}
                                className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                                title={manage ? t('action.delete') : t('action.readOnly')}
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
          </SectionCard>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
          <MapPin size={15} /> {t('sharedHint')}
        </div>
      </main>

      {showCreate && <VenueFormModal isSuperAdmin={isSuper} onClose={() => setShowCreate(false)} onSaved={onSaved} />}
      {editing && <VenueFormModal initial={editing} isSuperAdmin={isSuper} onClose={() => setEditing(null)} onSaved={onSaved} />}
      {sharing && <VenueAccessModal venue={sharing} onClose={() => setSharing(null)} onSaved={onSaved} />}
    </div>
  );
}
