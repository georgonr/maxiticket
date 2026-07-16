'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { clsx } from 'clsx';
import { Users, UserPlus, Power, Trash2 } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { usersApi, AdminUser, UserRole, canManageTarget } from '@/lib/api/users';
import { SectionCard, Skeleton, EmptyState, ErrorState } from '@/components/dashboard/parts';
import { CreateUserModal } from '@/components/admin/CreateUserModal';

const ROLE_BADGE: Record<string, string> = {
  SUPERADMIN: 'bg-purple-50 text-purple-700',
  PLATFORM_ADMIN: 'bg-indigo-50 text-indigo-700',
  ACCOUNTANT: 'bg-sky-50 text-sky-700',
  STAFF: 'bg-slate-100 text-slate-600',
  ORGANIZER_OWNER: 'bg-brand/10 text-brand-dark',
  ORGANIZER_MEMBER: 'bg-brand/5 text-brand-dark',
  SCANNER: 'bg-teal-50 text-teal-700',
  CUSTOMER: 'bg-gray-100 text-gray-600',
};

const ALL_ROLES: UserRole[] = [
  'SUPERADMIN',
  'PLATFORM_ADMIN',
  'ACCOUNTANT',
  'STAFF',
  'ORGANIZER_OWNER',
  'ORGANIZER_MEMBER',
  'SCANNER',
  'CUSTOMER',
];

export default function AdminUsersPage() {
  const t = useTranslations('admin.users');
  const tRole = useTranslations('organizer.roles');
  const format = useFormatter();
  const { user, isLoading: authLoading } = useAuth();
  const myRole = user?.role as UserRole | undefined;
  const canView = myRole === 'SUPERADMIN' || myRole === 'PLATFORM_ADMIN';

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filtre
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
      return format.dateTime(new Date(iso), { day: 'numeric', month: 'numeric', year: 'numeric' });
    },
    [format],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      setUsers(await usersApi.list(token));
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, [readableError]);

  useEffect(() => {
    if (canView) load();
    else if (!authLoading) setLoading(false);
  }, [canView, authLoading, load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (roleFilter && u.role !== roleFilter) return false;
        if (statusFilter === 'active' && !u.isActive) return false;
        if (statusFilter === 'inactive' && u.isActive) return false;
        return true;
      }),
    [users, roleFilter, statusFilter],
  );

  async function toggleActive(u: AdminUser) {
    // optimistický update
    const next = !u.isActive;
    setBusyId(u.id);
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: next } : x)));
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await usersApi.setActive(u.id, next, token);
      setToast({ msg: next ? t('toast.activated') : t('toast.deactivated'), ok: true });
    } catch (e) {
      // rollback
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: u.isActive } : x)));
      setToast({ msg: readableError(e), ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(u: AdminUser) {
    if (!window.confirm(t('confirmRemove', { email: u.email }))) return;
    setBusyId(u.id);
    const prevActive = u.isActive;
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: false } : x)));
    try {
      const token = await getValidToken();
      if (!token) throw new ApiError(401, 'No token');
      await usersApi.remove(u.id, token);
      setToast({ msg: t('toast.removed', { email: u.email }), ok: true });
    } catch (e) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: prevActive } : x)));
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

  const selectCls =
    'rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:border-brand focus:outline-none';

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-950">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle')}</p>
          </div>
          {canView && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              <UserPlus size={16} /> {t('addUser')}
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

        {!canView && !authLoading ? (
          <ErrorState message={t('noPermission')} />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <>
            {/* Filtre */}
            <div className="flex flex-wrap items-center gap-2">
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectCls}>
                <option value="">{t('filter.allRoles')}</option>
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tRole(r)}
                  </option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
                <option value="">{t('filter.allStatuses')}</option>
                <option value="active">{t('status.active')}</option>
                <option value="inactive">{t('status.inactive')}</option>
              </select>
            </div>

            <SectionCard title={`${t('listTitle')}${!loading ? ` (${filtered.length})` : ''}`}>
              {loading ? (
                <Skeleton className="h-40" />
              ) : filtered.length === 0 ? (
                <EmptyState message={t('empty')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400 dark:text-gray-500">
                        <th className="py-2 pr-3 font-medium">{t('col.email')}</th>
                        <th className="py-2 px-3 font-medium">{t('col.name')}</th>
                        <th className="py-2 px-3 font-medium">{t('col.role')}</th>
                        <th className="py-2 px-3 font-medium">{t('col.status')}</th>
                        <th className="py-2 px-3 font-medium">{t('col.created')}</th>
                        <th className="py-2 px-3 font-medium">{t('col.lastLogin')}</th>
                        <th className="py-2 pl-3 font-medium text-right">{t('col.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {filtered.map((u) => {
                        const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
                        const manageable = myRole ? canManageTarget(myRole, u.role) : false;
                        const isSelf = u.id === user?.id;
                        const showActions = manageable && !isSelf;
                        return (
                          <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-gray-100">{u.email}</td>
                            <td className="px-3 text-gray-600 dark:text-gray-300">{name || '—'}</td>
                            <td className="px-3">
                              <span
                                className={clsx(
                                  'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                                  ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600',
                                )}
                              >
                                {tRole(u.role)}
                              </span>
                            </td>
                            <td className="px-3">
                              <span
                                className={clsx(
                                  'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                                  u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                                )}
                              >
                                {u.isActive ? t('status.active') : t('status.inactive')}
                              </span>
                            </td>
                            <td className="px-3 text-gray-500 dark:text-gray-400">{formatDate(u.createdAt)}</td>
                            <td className="px-3 text-gray-500 dark:text-gray-400">{formatDate(u.lastLoginAt)}</td>
                            <td className="py-2.5 pl-3">
                              <div className="flex items-center justify-end gap-1">
                                {showActions ? (
                                  <>
                                    <button
                                      onClick={() => toggleActive(u)}
                                      disabled={busyId === u.id}
                                      className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 disabled:opacity-40"
                                      title={u.isActive ? t('action.deactivate') : t('action.activate')}
                                    >
                                      <Power size={15} className={u.isActive ? 'text-emerald-600' : ''} />
                                    </button>
                                    <button
                                      onClick={() => remove(u)}
                                      disabled={busyId === u.id}
                                      className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                                      title={t('action.remove')}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                )}
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
          </>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
          <Users size={15} /> {t('footerNote')}
        </div>
      </main>

      {showCreate && myRole && (
        <CreateUserModal myRole={myRole} onClose={() => setShowCreate(false)} onCreated={onCreated} />
      )}
    </div>
  );
}
