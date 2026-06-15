'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { useTranslations, useFormatter } from 'next-intl';
import { ScanLine, Plus, Trash2, Power, KeyRound } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { scannersApi, Scanner } from '@/lib/api/scanners';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { CreateScannerModal } from '@/components/scanners/CreateScannerModal';
import { ChangeScannerPasswordModal } from '@/components/scanners/ChangeScannerPasswordModal';

export default function ScannersPage() {
  const t = useTranslations('organizer.scanners');
  const format = useFormatter();
  const { user, isLoading: authLoading } = useAuth();

  const readableError = useCallback(
    (e: unknown): string => {
      if (e instanceof ApiError) {
        if (e.status === 401 || e.status === 403) return t('error.forbidden');
        if (e.status >= 500) return t('error.server');
        return e.message || t('error.generic');
      }
      return t('error.network');
    },
    [t],
  );

  const formatDate = useCallback(
    (iso: string | null): string => {
      if (!iso) return '—';
      return format.dateTime(new Date(iso), {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });
    },
    [format],
  );

  const canManage = user?.role === 'ORGANIZER_OWNER' || user?.role === 'SUPERADMIN';

  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pwScanner, setPwScanner] = useState<Scanner | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      setScanners(await scannersApi.list(token));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) load();
    else if (!authLoading) setLoading(false);
  }, [canManage, authLoading, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function toggleActive(s: Scanner) {
    setBusyId(s.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const updated = await scannersApi.setActive(s.id, !s.isActive, token);
      setScanners((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
      setToast({ msg: updated.isActive ? t('toast.activated') : t('toast.deactivated'), ok: true });
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function removeScanner(s: Scanner) {
    if (!window.confirm(t('confirmDelete', { email: s.email }))) return;
    setBusyId(s.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await scannersApi.delete(s.id, token);
      setScanners((prev) => prev.filter((x) => x.id !== s.id));
      setToast({ msg: t('toast.deleted', { email: s.email }), ok: true });
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  function onCreated(msg: string) {
    setShowCreate(false);
    setToast({ msg, ok: true });
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              <Plus size={16} /> {t('add')}
            </button>
          )}
        </div>

        {toast && (
          <div
            className={clsx(
              'rounded-lg px-4 py-2.5 text-sm font-medium',
              toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            {toast.msg}
          </div>
        )}

        {!canManage && !authLoading ? (
          <ErrorState message={t('forbiddenManage')} />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <SectionCard title={`${t('cardTitle')}${!loading ? ` (${scanners.length})` : ''}`}>
            {loading ? (
              <Skeleton className="h-40" />
            ) : scanners.length === 0 ? (
              <EmptyState message={t('empty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                      <th className="py-2 pr-3 font-medium">{t('col.email')}</th>
                      <th className="py-2 px-3 font-medium">{t('col.name')}</th>
                      <th className="py-2 px-3 font-medium">{t('col.status')}</th>
                      <th className="py-2 px-3 font-medium">{t('col.created')}</th>
                      <th className="py-2 pl-3 font-medium text-right">{t('col.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {scanners.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-gray-100">{s.email}</td>
                        <td className="px-3 text-gray-600 dark:text-gray-300">{s.firstName ?? '—'}</td>
                        <td className="px-3">
                          <span
                            className={clsx(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                              s.isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                            )}
                          >
                            {s.isActive ? t('status.active') : t('status.inactive')}
                          </span>
                        </td>
                        <td className="px-3 text-gray-500 dark:text-gray-400">{formatDate(s.createdAt)}</td>
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPwScanner(s)}
                              disabled={busyId === s.id}
                              className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-40"
                              title={t('action.changePassword')}
                            >
                              <KeyRound size={15} />
                            </button>
                            <button
                              onClick={() => toggleActive(s)}
                              disabled={busyId === s.id}
                              className="inline-flex items-center gap-1 rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-40"
                              title={s.isActive ? t('action.deactivate') : t('action.activate')}
                            >
                              <Power size={15} className={s.isActive ? 'text-emerald-600' : ''} />
                            </button>
                            <button
                              onClick={() => removeScanner(s)}
                              disabled={busyId === s.id}
                              className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              title={t('action.delete')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {!loading && scanners.length === 0 && canManage && (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
            <ScanLine size={15} /> {t('hint')}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateScannerModal onClose={() => setShowCreate(false)} onCreated={onCreated} />
      )}

      {pwScanner && (
        <ChangeScannerPasswordModal
          scanner={pwScanner}
          onClose={() => setPwScanner(null)}
          onChanged={(msg) => {
            setPwScanner(null);
            setToast({ msg, ok: true });
          }}
        />
      )}
    </div>
  );
}
