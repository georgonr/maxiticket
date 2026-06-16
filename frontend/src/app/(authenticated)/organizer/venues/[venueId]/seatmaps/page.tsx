'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowLeft, Plus, Pencil, Trash2, Star, LayoutGrid, Armchair } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, venuesApi, Venue } from '@/lib/api';
import { seatmapsApi, SeatMapSummary } from '@/lib/api/seatmaps';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';

export default function VenueSeatMapsPage() {
  const t = useTranslations('organizer.seatmap');
  const { venueId } = useParams<{ venueId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  function readableError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 401 || e.status === 403) return t('list.error.forbidden');
      if (e.status === 404) return t('list.error.notFound');
      if (e.status >= 500) return t('error.server');
      return e.message || t('error.generic');
    }
    return t('error.network');
  }
  const isSuper = user?.role === 'SUPERADMIN' || user?.role === 'STAFF';

  const [venue, setVenue] = useState<Venue | null>(null);
  const [maps, setMaps] = useState<SeatMapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Mutácie: super/staff všetko; OWNER len vlastné (nie globálne); MEMBER nikdy.
  const canManage =
    !!venue &&
    (isSuper ||
      (user?.role === 'ORGANIZER_OWNER' && venue.organizerId != null && venue.organizerId === user?.organizerId));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const [v, m] = await Promise.all([
        venuesApi.get(venueId, token),
        seatmapsApi.list(venueId, token),
      ]);
      setVenue(v);
      setMaps(m);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function createMap() {
    const name = window.prompt(t('list.prompt.create'));
    if (!name || name.trim().length < 2) return;
    setCreating(true);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const created = await seatmapsApi.create(venueId, { name: name.trim() }, token);
      router.push(`/organizer/venues/${venueId}/seatmaps/${created.id}`);
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
      setCreating(false);
    }
  }

  async function rename(m: SeatMapSummary) {
    const name = window.prompt(t('prompt.rename'), m.name);
    if (!name || name.trim().length < 2 || name.trim() === m.name) return;
    setBusyId(m.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await seatmapsApi.patch(m.id, { name: name.trim() }, token);
      setToast({ msg: t('toast.renamed'), ok: true });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function setDefault(m: SeatMapSummary) {
    if (m.isDefault) return;
    setBusyId(m.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await seatmapsApi.patch(m.id, { isDefault: true }, token);
      setToast({ msg: t('list.toast.setDefault', { name: m.name }), ok: true });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(m: SeatMapSummary) {
    if (!window.confirm(t('list.confirm.delete', { name: m.name }))) return;
    setBusyId(m.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await seatmapsApi.remove(m.id, token);
      setToast({ msg: t('list.toast.deleted', { name: m.name }), ok: true });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <Link href="/organizer/venues" className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-brand">
            <ArrowLeft size={15} /> {t('list.backToVenues')}
          </Link>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {venue ? t('list.titleWithVenue', { venue: venue.name }) : t('list.title')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('list.subtitle')}
              </p>
            </div>
            {canManage && (
              <button
                onClick={createMap}
                disabled={creating}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                <Plus size={16} /> {t('list.newMap')}
              </button>
            )}
          </div>
        </div>

        {toast && (
          <div className={clsx('rounded-lg px-4 py-2.5 text-sm font-medium', toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {toast.msg}
          </div>
        )}

        {error ? (
          <ErrorState message={error} />
        ) : (
          <SectionCard title={!loading ? t('list.cardTitleCount', { count: maps.length }) : t('list.cardTitle')}>
            {loading ? (
              <Skeleton className="h-40" />
            ) : maps.length === 0 ? (
              <EmptyState message={canManage ? t('list.empty.canManage') : t('list.empty.readonly')} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {maps.map((m) => (
                  <div key={m.id} className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">{m.name}</h3>
                          {m.isDefault && (
                            <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <Star size={11} className="fill-amber-500 text-amber-500" /> {t('badge.default')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1"><LayoutGrid size={12} /> {t('list.sectionCount', { count: m.sectionCount })}</span>
                          <span className="inline-flex items-center gap-1"><Armchair size={12} /> {t('list.capacity', { count: m.totalCapacity })}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <Link
                        href={`/organizer/venues/${venueId}/seatmaps/${m.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        {canManage ? t('list.openEditor') : t('list.view')}
                      </Link>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          {!m.isDefault && (
                            <button onClick={() => setDefault(m)} disabled={busyId === m.id} className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40" title={t('action.setDefault')}>
                              <Star size={15} />
                            </button>
                          )}
                          <button onClick={() => rename(m)} disabled={busyId === m.id} className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-40" title={t('action.rename')}>
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => remove(m)} disabled={busyId === m.id} className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title={t('action.delete')}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </main>
    </div>
  );
}
