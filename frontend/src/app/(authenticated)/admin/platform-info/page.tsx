'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { platformInfoApi, UpdatePlatformInfoBody, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface JwtClaims {
  sub: string;
  email: string;
  role: string;
  organizerId?: string;
}

function parseJwt(token: string): JwtClaims | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

type FormState = {
  legalName: string;
  ico: string;
  icDph: string;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  addressCountry: string;
  defaultVatRateSk: string;
  defaultVatRateCz: string;
};

const EMPTY: FormState = {
  legalName: '', ico: '', icDph: '', addressStreet: '', addressCity: '',
  addressZip: '', addressCountry: 'SK', defaultVatRateSk: '', defaultVatRateCz: '',
};

export default function PlatformInfoPage() {
  const router = useRouter();
  const t = useTranslations('admin');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      const claims = parseJwt(token);
      if (claims?.role !== 'SUPERADMIN') {
        setAllowed(false);
        setLoading(false);
        return;
      }
      setAllowed(true);
      try {
        const data = await platformInfoApi.get(token);
        setForm({
          legalName: data.legalName ?? '',
          ico: data.ico ?? '',
          icDph: data.icDph ?? '',
          addressStreet: data.addressStreet ?? '',
          addressCity: data.addressCity ?? '',
          addressZip: data.addressZip ?? '',
          addressCountry: data.addressCountry ?? 'SK',
          defaultVatRateSk: data.defaultVatRateSk ?? '',
          defaultVatRateCz: data.defaultVatRateCz ?? '',
        });
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setAllowed(false);
        } else {
          setError(t('platformInfo.loadError'));
        }
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const body: UpdatePlatformInfoBody = {
        legalName: form.legalName || undefined,
        ico: form.ico || undefined,
        icDph: form.icDph || undefined,
        addressStreet: form.addressStreet || undefined,
        addressCity: form.addressCity || undefined,
        addressZip: form.addressZip || undefined,
        addressCountry: form.addressCountry || undefined,
        defaultVatRateSk: form.defaultVatRateSk || undefined,
        defaultVatRateCz: form.defaultVatRateCz || undefined,
      };
      await platformInfoApi.update(body, token);
      setToast({ msg: t('platformInfo.saved'), ok: true });
    } catch (e) {
      setToast({ msg: t('platformInfo.saveError'), ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('platformInfo.accessDenied')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{t('platformInfo.accessDeniedDesc')}</p>
        <Link href="/organizer/shows"><Button variant="outline">{t('platformInfo.backToShows')}</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg transition-all ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4 flex items-center justify-between">
        <Link href="/organizer/dashboard"><img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" /></Link>
        <Link href="/organizer/dashboard" className="text-sm text-brand hover:underline">← {t('platformInfo.dashboard')}</Link>
      </header>

      <main className="mx-auto max-w-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-bold mb-1">{t('platformInfo.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          {t('platformInfo.subtitle')}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <Input
            id="legalName" label={t('platformInfo.legalName')}
            placeholder="TicketAll s.r.o."
            value={form.legalName} onChange={(e) => set('legalName', e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input id="ico" label={t('platformInfo.ico')} placeholder={t('platformInfo.icoPlaceholder')}
              value={form.ico} onChange={(e) => set('ico', e.target.value)} />
            <Input id="icDph" label={t('platformInfo.icDph')} placeholder="SK1234567890"
              value={form.icDph} onChange={(e) => set('icDph', e.target.value)} />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{t('platformInfo.address')}</h2>
            <div className="space-y-4">
              <Input id="addressStreet" label={t('platformInfo.street')} placeholder={t('platformInfo.streetPlaceholder')}
                value={form.addressStreet} onChange={(e) => set('addressStreet', e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input id="addressZip" label={t('platformInfo.zip')} placeholder="81101"
                  value={form.addressZip} onChange={(e) => set('addressZip', e.target.value)} />
                <Input id="addressCity" label={t('platformInfo.city')} placeholder="Bratislava"
                  value={form.addressCity} onChange={(e) => set('addressCity', e.target.value)} />
                <Input id="addressCountry" label={t('platformInfo.country')} placeholder="SK"
                  value={form.addressCountry} onChange={(e) => set('addressCountry', e.target.value.toUpperCase())} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{t('platformInfo.vatRates')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input id="defaultVatRateSk" label={t('platformInfo.vatRateSk')} type="number" step="0.01" placeholder="20.00"
                value={form.defaultVatRateSk} onChange={(e) => set('defaultVatRateSk', e.target.value)} />
              <Input id="defaultVatRateCz" label={t('platformInfo.vatRateCz')} type="number" step="0.01" placeholder="21.00"
                value={form.defaultVatRateCz} onChange={(e) => set('defaultVatRateCz', e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              {t('platformInfo.save')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
