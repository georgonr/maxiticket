'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  ArrowLeft, Plus, Pencil, Trash2, Star, ChevronUp, ChevronDown,
  Square, Grid3x3,
} from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import {
  seatmapsApi, SeatMapFull, Section, sectionCapacity, SECTION_COLORS,
} from '@/lib/api/seatmaps';
import { Skeleton, ErrorState } from '@/components/dashboard/parts';
import { SeatMapCanvas } from '@/components/seatmaps/SeatMapCanvas';
import { SectionFormModal } from '@/components/seatmaps/SectionFormModal';

export default function SeatMapEditorPage() {
  const t = useTranslations('organizer.seatmap');
  const { venueId, mapId } = useParams<{ venueId: string; mapId: string }>();
  const { user } = useAuth();

  function readableError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 401 || e.status === 403) return t('editor.error.forbidden');
      if (e.status === 404) return t('editor.error.notFound');
      if (e.status >= 500) return t('error.server');
      return e.message || t('error.generic');
    }
    return t('error.network');
  }
  const isSuper = user?.role === 'SUPERADMIN' || user?.role === 'STAFF';

  const [map, setMap] = useState<SeatMapFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editSection, setEditSection] = useState<Section | null>(null);

  // canManage sa potvrdí podľa toho, či mutácie prejdú (server je autorita).
  // MEMBER / globálne mapy → server vráti 403; UI gating pre OWNER vlastné venue:
  const canManage =
    isSuper || user?.role === 'ORGANIZER_OWNER';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      setMap(await seatmapsApi.get(mapId, token));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, [mapId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function withToken<T>(fn: (t: string) => Promise<T>): Promise<T> {
    const token = await getValidToken();
    if (!token) throw new ApiError(401, 'No token');
    return fn(token);
  }

  async function toggleDefault() {
    if (!map || map.isDefault) return;
    setBusy(true);
    try {
      await withToken((tk) => seatmapsApi.patch(map.id, { isDefault: true }, tk));
      setToast({ msg: t('editor.toast.setDefault'), ok: true });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function renameMap() {
    if (!map) return;
    const name = window.prompt(t('prompt.rename'), map.name);
    if (!name || name.trim().length < 2 || name.trim() === map.name) return;
    setBusy(true);
    try {
      await withToken((tk) => seatmapsApi.patch(map.id, { name: name.trim() }, tk));
      setToast({ msg: t('toast.renamed'), ok: true });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function deleteSection(s: Section) {
    if (!window.confirm(s.mode === 'SEATED' ? t('editor.confirm.deleteSectionSeated', { name: s.name }) : t('editor.confirm.deleteSection', { name: s.name }))) return;
    setBusy(true);
    try {
      await withToken((tk) => seatmapsApi.deleteSection(s.id, tk));
      setToast({ msg: t('editor.toast.sectionDeleted', { name: s.name }), ok: true });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusy(false);
    }
  }

  // reorder = výmena displayOrder so susedom
  async function move(idx: number, dir: -1 | 1) {
    if (!map) return;
    const ordered = [...map.sections].sort((a, b) => a.displayOrder - b.displayOrder);
    const j = idx + dir;
    if (j < 0 || j >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[j];
    setBusy(true);
    try {
      await withToken(async (tk) => {
        await seatmapsApi.patchSection(a.id, { displayOrder: b.displayOrder }, tk);
        await seatmapsApi.patchSection(b.id, { displayOrder: a.displayOrder }, tk);
      });
      load();
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-[70vh]" />
      </div>
    );
  }
  if (error || !map) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <Link href={`/organizer/venues/${venueId}/seatmaps`} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-brand">
          <ArrowLeft size={15} /> {t('editor.backToMaps')}
        </Link>
        <ErrorState message={error ?? t('editor.error.notFound')} />
      </div>
    );
  }

  const ordered = [...map.sections].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* hlavička */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-3">
        <div className="min-w-0">
          <Link href={`/organizer/venues/${venueId}/seatmaps`} className="mb-0.5 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-brand">
            <ArrowLeft size={13} /> {t('editor.backToMaps')}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{map.name}</h1>
            {map.isDefault && (
              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                <Star size={11} className="fill-amber-500 text-amber-500" /> {t('badge.default')}
              </span>
            )}
            <span className="text-sm text-gray-400 dark:text-gray-500">· {t('editor.capacity', { count: map.totalCapacity })}</span>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {!map.isDefault && (
              <button onClick={toggleDefault} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                <Star size={14} /> {t('editor.setDefault')}
              </button>
            )}
            <button onClick={renameMap} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
              <Pencil size={14} /> {t('action.rename')}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className={clsx('px-5 py-2 text-sm font-medium', toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
          {toast.msg}
        </div>
      )}

      {/* telo: ľavý panel + plátno */}
      <div className="flex min-h-0 flex-1">
        {/* ľavý panel */}
        <aside className="flex w-72 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('editor.sectionsTitle', { count: ordered.length })}</h2>
            {canManage && (
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-dark">
                <Plus size={14} /> {t('editor.addSection')}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {ordered.length === 0 ? (
              <p className="px-1 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {t('editor.noSections')} {canManage ? t('editor.noSectionsHint') : ''}
              </p>
            ) : (
              <ul className="space-y-2">
                {ordered.map((s, idx) => {
                  const color = s.color ?? SECTION_COLORS[idx % SECTION_COLORS.length];
                  return (
                    <li key={s.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            {s.mode === 'SECTIONED' ? <Square size={11} /> : <Grid3x3 size={11} />}
                            {s.mode === 'SECTIONED' ? t('editor.modeSectioned') : t('editor.modeSeated')} · {s.mode === 'SEATED' ? t('editor.seatsCount', { count: sectionCapacity(s) }) : sectionCapacity(s)}
                          </p>
                        </div>
                      </div>
                      {canManage && (
                        <div className="mt-2 flex items-center justify-end gap-0.5">
                          <button onClick={() => move(idx, -1)} disabled={busy || idx === 0} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-25" title={t('editor.moveUp')}><ChevronUp size={15} /></button>
                          <button onClick={() => move(idx, 1)} disabled={busy || idx === ordered.length - 1} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-25" title={t('editor.moveDown')}><ChevronDown size={15} /></button>
                          <button onClick={() => setEditSection(s)} disabled={busy} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-40" title={t('action.edit')}><Pencil size={14} /></button>
                          <button onClick={() => deleteSection(s)} disabled={busy} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title={t('action.delete')}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* plátno */}
        <div className="min-w-0 flex-1 p-4">
          {ordered.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center text-sm text-gray-400 dark:text-gray-500">
              <div>
                <Grid3x3 size={32} className="mx-auto mb-2 opacity-40" />
                {t('editor.canvasEmpty')}
              </div>
            </div>
          ) : (
            <SeatMapCanvas sections={ordered} />
          )}
        </div>
      </div>

      {showAdd && (
        <SectionFormModal
          seatMapId={map.id}
          onClose={() => setShowAdd(false)}
          onSaved={(msg) => { setShowAdd(false); setToast({ msg, ok: true }); load(); }}
        />
      )}
      {editSection && (
        <SectionFormModal
          seatMapId={map.id}
          initial={editSection}
          onClose={() => setEditSection(null)}
          onSaved={(msg) => { setEditSection(null); setToast({ msg, ok: true }); load(); }}
        />
      )}
    </div>
  );
}
