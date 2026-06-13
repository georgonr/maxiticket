'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Settings, Loader2, Mail } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { accountApi, AccountProfile } from '@/lib/api/account';
import { AccountTabs } from '@/components/account/AccountTabs';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = usePublicAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { router.replace('/account/login?next=/account/settings'); return; }
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/account/login'); return; }
      try {
        setProfile(await accountApi.profile(token));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Načítanie profilu zlyhalo.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function toggleMarketing(next: boolean) {
    if (!profile) return;
    setSaving(true);
    setProfile({ ...profile, marketingOptIn: next }); // optimistic
    try {
      const token = await getValidToken();
      if (!token) return;
      const res = await accountApi.updateNotifications(next, token);
      setProfile((p) => (p ? { ...p, marketingOptIn: res.marketingOptIn } : p));
      setToast('Nastavenia uložené.');
    } catch (e) {
      setProfile((p) => (p ? { ...p, marketingOptIn: !next } : p)); // revert
      setError(e instanceof Error ? e.message : 'Uloženie zlyhalo.');
    } finally {
      setSaving(false);
    }
  }

  if (error && !profile) {
    return (<div><AccountTabs /><div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div></div>);
  }
  if (!profile) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-600" size={32} /></div>;
  }

  return (
    <div>
      <AccountTabs />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Settings size={20} className="text-purple-700" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Nastavenia</h1>
      </div>

      {toast && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{toast}</div>}

      <div className="space-y-5">
        {/* Profil */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Účet</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">E-mail</dt><dd className="font-medium text-slate-800">{profile.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Meno</dt><dd className="font-medium text-slate-800">{profile.name ?? '—'}</dd></div>
            {profile.phone && <div className="flex justify-between"><dt className="text-slate-500">Telefón</dt><dd className="font-medium text-slate-800">{profile.phone}</dd></div>}
          </dl>
        </div>

        {/* Notifikácie */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><Mail size={16} /> Notifikácie</h2>
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-slate-800">Marketingové novinky a ponuky</span>
              <span className="block text-xs text-slate-400">Občasné e-maily o nových podujatiach a akciách.</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={profile.marketingOptIn}
              disabled={saving}
              onClick={() => toggleMarketing(!profile.marketingOptIn)}
              className={clsx('relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors', profile.marketingOptIn ? 'bg-purple-600' : 'bg-slate-300')}
            >
              <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', profile.marketingOptIn ? 'translate-x-[22px]' : 'translate-x-0.5')} />
            </button>
          </label>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            Potvrdenia objednávok a vstupenky vám zašleme vždy, bez ohľadu na toto nastavenie.
          </p>
        </div>
      </div>
    </div>
  );
}
