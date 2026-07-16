'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { usersApi, CREATABLE_BY, TENANT_ROLES, UserRole } from '@/lib/api/users';
import { organizersAdminApi } from '@/lib/api/organizers-admin';
import { Button } from '@/components/ui/button';

const inputCls =
  'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

interface OrgOpt {
  id: string;
  name: string;
}

export function CreateUserModal({
  myRole,
  onClose,
  onCreated,
}: {
  myRole: UserRole;
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const locale = useLocale() as 'sk' | 'en' | 'cs';
  const t = useTranslations('admin.users');
  const tRole = useTranslations('organizer.roles');

  const roleOptions = CREATABLE_BY[myRole] ?? [];
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState<UserRole>(roleOptions[0] ?? 'CUSTOMER');
  const [organizerId, setOrganizerId] = useState('');
  const [orgs, setOrgs] = useState<OrgOpt[] | null>(null); // null = ešte sa nenačítalo / nedostupné → text input
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const needsOrg = TENANT_ROLES.includes(role);

  // Skús načítať zoznam organizátorov pre dropdown. Ak nemám prístup (napr. PLATFORM_ADMIN
  // nemá práva na /admin/organizers), padne to a ostane textové pole na organizerId.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await getValidToken();
        if (!token) return;
        const rows = await organizersAdminApi.list(token);
        if (active) setOrgs(rows.map((r) => ({ id: r.organizerId, name: r.name })));
      } catch {
        if (active) setOrgs(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit() {
    setError('');
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError(t('invalidEmail'));
      return;
    }
    if (needsOrg && !organizerId.trim()) {
      setError(t('organizerRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error(t('loginRequired'));
      await usersApi.create(
        {
          email: mail,
          role,
          firstName: firstName.trim() || undefined,
          organizerId: needsOrg ? organizerId.trim() : undefined,
          locale,
        },
        token,
      );
      onCreated(t('toast.invited', { email: mail }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('createFailed'));
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('createTitle')}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600"
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('emailLabel')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('roleLabel')}</span>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {tRole(r)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('nameLabel')}</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('namePlaceholder')}
              className={inputCls}
            />
          </label>

          {needsOrg && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{t('organizerLabel')}</span>
              {orgs && orgs.length > 0 ? (
                <select value={organizerId} onChange={(e) => setOrganizerId(e.target.value)} className={inputCls}>
                  <option value="">{t('organizerSelect')}</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={organizerId}
                  onChange={(e) => setOrganizerId(e.target.value)}
                  placeholder={t('organizerIdPlaceholder')}
                  className={inputCls}
                />
              )}
            </label>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">{t('createHint')}</p>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={submitting}>
            {t('sendInvite')}
          </Button>
        </div>
      </div>
    </div>
  );
}
