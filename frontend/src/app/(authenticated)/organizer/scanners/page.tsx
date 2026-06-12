'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { ScanLine, Plus, Trash2, Power } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { scannersApi, Scanner } from '@/lib/api/scanners';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { CreateScannerModal } from '@/components/scanners/CreateScannerModal';

function readableError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return 'Nemáte oprávnenie spravovať skenerov.';
    if (e.status >= 500) return 'Chyba servera. Skúste neskôr.';
    return e.message || 'Niečo sa pokazilo.';
  }
  return 'Nemôžeme sa pripojiť k serveru.';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function ScannersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const canManage = user?.role === 'ORGANIZER_OWNER' || user?.role === 'SUPERADMIN';

  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
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
      setToast({ msg: updated.isActive ? 'Scanner aktivovaný.' : 'Scanner deaktivovaný.', ok: true });
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function removeScanner(s: Scanner) {
    if (!window.confirm(`Naozaj zmazať scanner účet ${s.email}? Túto akciu nie je možné vrátiť.`)) return;
    setBusyId(s.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await scannersApi.delete(s.id, token);
      setScanners((prev) => prev.filter((x) => x.id !== s.id));
      setToast({ msg: `Scanner ${s.email} zmazaný.`, ok: true });
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
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Skeneri</h1>
            <p className="text-sm text-gray-500">
              Účty pre personál na vstupe – môžu výhradne skenovať vstupenky vašich podujatí.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              <Plus size={16} /> Pridať skenera
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
          <ErrorState message="Správa skenerov je dostupná len pre vlastníka organizácie." />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <SectionCard title={`Scanner účty${!loading ? ` (${scanners.length})` : ''}`}>
            {loading ? (
              <Skeleton className="h-40" />
            ) : scanners.length === 0 ? (
              <EmptyState message="Žiadne scanner účty. Vytvorte prvý pre personál na vstupe." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                      <th className="py-2 pr-3 font-medium">E-mail</th>
                      <th className="py-2 px-3 font-medium">Meno</th>
                      <th className="py-2 px-3 font-medium">Stav</th>
                      <th className="py-2 px-3 font-medium">Vytvorený</th>
                      <th className="py-2 pl-3 font-medium text-right">Akcie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {scanners.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-3 font-medium text-gray-900">{s.email}</td>
                        <td className="px-3 text-gray-600">{s.firstName ?? '—'}</td>
                        <td className="px-3">
                          <span
                            className={clsx(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                              s.isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-gray-100 text-gray-500',
                            )}
                          >
                            {s.isActive ? 'Aktívny' : 'Deaktivovaný'}
                          </span>
                        </td>
                        <td className="px-3 text-gray-500">{formatDate(s.createdAt)}</td>
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => toggleActive(s)}
                              disabled={busyId === s.id}
                              className="inline-flex items-center gap-1 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                              title={s.isActive ? 'Deaktivovať' : 'Aktivovať'}
                            >
                              <Power size={15} className={s.isActive ? 'text-emerald-600' : ''} />
                            </button>
                            <button
                              onClick={() => removeScanner(s)}
                              disabled={busyId === s.id}
                              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              title="Zmazať"
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
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <ScanLine size={15} /> Skeneri sa prihlasujú cez prihlasovaciu stránku a sú presmerovaní
            na skener.ticketall.eu.
          </div>
        )}
      </main>

      {showCreate && (
        <CreateScannerModal onClose={() => setShowCreate(false)} onCreated={onCreated} />
      )}
    </div>
  );
}
