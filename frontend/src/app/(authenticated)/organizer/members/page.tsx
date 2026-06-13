'use client';

import { useCallback, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Users, UserPlus, Power, Trash2, Send } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { membersApi, Member } from '@/lib/api/members';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { InviteMemberModal } from '@/components/members/InviteMemberModal';

function readableError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401 || e.status === 403) return 'Nemáte oprávnenie spravovať tím.';
    if (e.status >= 500) return 'Chyba servera. Skúste neskôr.';
    return e.message || 'Niečo sa pokazilo.';
  }
  return 'Nemôžeme sa pripojiť k serveru.';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(iso));
}

export default function MembersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const canManage = user?.role === 'ORGANIZER_OWNER' || user?.role === 'SUPERADMIN' || user?.role === 'STAFF';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      setMembers(await membersApi.list(token));
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

  async function toggleActive(m: Member) {
    setBusyId(m.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      const updated = await membersApi.setActive(m.id, !m.isActive, token);
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      setToast({ msg: updated.isActive ? 'Člen aktivovaný.' : 'Člen deaktivovaný.', ok: true });
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function resend(m: Member) {
    setBusyId(m.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await membersApi.resendInvite(m.id, token);
      setToast({ msg: `Pozvánka znova odoslaná na ${m.email}.`, ok: true });
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(m: Member) {
    if (!window.confirm(`Naozaj odstrániť člena ${m.email} z tímu?`)) return;
    setBusyId(m.id);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await membersApi.delete(m.id, token);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
      setToast({ msg: `Člen ${m.email} odstránený.`, ok: true });
    } catch (e) {
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  function onInvited(msg: string) {
    setShowInvite(false);
    setToast({ msg, ok: true });
    load();
  }

  function statusBadge(m: Member) {
    if (m.pending) return { label: 'Čaká na prijatie', cls: 'bg-amber-50 text-amber-700' };
    if (!m.isActive) return { label: 'Deaktivovaný', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' };
    return { label: 'Aktívny', cls: 'bg-emerald-50 text-emerald-700' };
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tím</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Členovia tímu spravujú podujatia, pokladňu a skenovanie. Nemajú prístup k uzávierkam,
              skenerom ani údajom firmy.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              <UserPlus size={16} /> Pozvať člena
            </button>
          )}
        </div>

        {toast && (
          <div className={clsx('rounded-lg px-4 py-2.5 text-sm font-medium', toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {toast.msg}
          </div>
        )}

        {!canManage && !authLoading ? (
          <ErrorState message="Správa tímu je dostupná len pre vlastníka organizácie." />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <SectionCard title={`Členovia${!loading ? ` (${members.length})` : ''}`}>
            {loading ? (
              <Skeleton className="h-40" />
            ) : members.length === 0 ? (
              <EmptyState message="Žiadni členovia tímu. Pozvite prvého kolegu." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                      <th className="py-2 pr-3 font-medium">E-mail</th>
                      <th className="py-2 px-3 font-medium">Meno</th>
                      <th className="py-2 px-3 font-medium">Stav</th>
                      <th className="py-2 px-3 font-medium">Vytvorený</th>
                      <th className="py-2 pl-3 font-medium text-right">Akcie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {members.map((m) => {
                      const st = statusBadge(m);
                      return (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-gray-100">{m.email}</td>
                          <td className="px-3 text-gray-600 dark:text-gray-300">{m.name ?? '—'}</td>
                          <td className="px-3"><span className={clsx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span></td>
                          <td className="px-3 text-gray-500 dark:text-gray-400">{formatDate(m.createdAt)}</td>
                          <td className="py-2.5 pl-3">
                            <div className="flex items-center justify-end gap-1">
                              {m.pending && (
                                <button onClick={() => resend(m)} disabled={busyId === m.id} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand hover:bg-brand/5 disabled:opacity-40" title="Znova poslať pozvánku">
                                  <Send size={13} /> Pozvánka
                                </button>
                              )}
                              {!m.pending && (
                                <button onClick={() => toggleActive(m)} disabled={busyId === m.id} className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-40" title={m.isActive ? 'Deaktivovať' : 'Aktivovať'}>
                                  <Power size={15} className={m.isActive ? 'text-emerald-600' : ''} />
                                </button>
                              )}
                              <button onClick={() => remove(m)} disabled={busyId === m.id} className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title="Odstrániť">
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
          <Users size={15} /> Pozvaný člen dostane e-mail s odkazom na nastavenie hesla (platnosť 7 dní).
        </div>
      </main>

      {showInvite && <InviteMemberModal onClose={() => setShowInvite(false)} onInvited={onInvited} />}
    </div>
  );
}
