'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getValidToken } from '@/lib/auth';
import { organizerBusinessApi, UpdateOrganizerBusinessBody } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FormState = {
  companyName: string;
  ico: string;
  icDph: string;
  vatPayer: boolean;
  vatRate: string;
  addressStreet: string;
  addressCity: string;
  addressZip: string;
  addressCountry: string;
  bankAccount: string;
};

const EMPTY: FormState = {
  companyName: '', ico: '', icDph: '', vatPayer: false, vatRate: '',
  addressStreet: '', addressCity: '', addressZip: '', addressCountry: 'SK', bankAccount: '',
};

export default function OrganizerSettingsPage() {
  const t = useTranslations('organizer.settings');
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    getValidToken().then(async (token) => {
      if (!token) { router.replace('/login'); return; }
      try {
        const data = await organizerBusinessApi.get(token);
        setForm({
          companyName: data.companyName ?? '',
          ico: data.ico ?? '',
          icDph: data.icDph ?? '',
          vatPayer: data.vatPayer ?? false,
          vatRate: data.vatRate ?? '',
          addressStreet: data.addressStreet ?? '',
          addressCity: data.addressCity ?? '',
          addressZip: data.addressZip ?? '',
          addressCountry: data.addressCountry ?? 'SK',
          bankAccount: data.bankAccount ?? '',
        });
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          router.replace('/login');
          return;
        }
        setError(t('errorLoad'));
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((fe) => ({ ...fe, [key]: '' }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (form.vatPayer && !form.ico.trim()) {
      errs.ico = t('errorIcoRequired');
    }
    if (form.ico && (form.addressCountry === 'SK' || !form.addressCountry) && !/^\d{8}$/.test(form.ico.trim())) {
      errs.ico = t('errorIcoFormat');
    }
    if (form.icDph && !/^[A-Z]{2}\d{8,12}$/.test(form.icDph.trim())) {
      errs.icDph = t('errorIcDphFormat');
    }
    if (form.addressZip && (form.addressCountry === 'SK' || !form.addressCountry) && !/^\d{5}$/.test(form.addressZip.trim())) {
      errs.addressZip = t('errorZipFormat');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) { router.replace('/login'); return; }
      const body: UpdateOrganizerBusinessBody = {
        companyName: form.companyName || undefined,
        ico: form.ico || undefined,
        icDph: form.icDph || undefined,
        vatPayer: form.vatPayer,
        vatRate: form.vatPayer && form.vatRate ? form.vatRate : undefined,
        addressStreet: form.addressStreet || undefined,
        addressCity: form.addressCity || undefined,
        addressZip: form.addressZip || undefined,
        addressCountry: form.addressCountry || undefined,
        bankAccount: form.bankAccount || undefined,
      };
      await organizerBusinessApi.update(body, token);
      setToast({ msg: t('toastSaved'), ok: true });
    } catch (e) {
      const msg = e instanceof ApiError
        ? (e.status === 400 ? t('toastInvalid') : t('toastSaveFailed'))
        : t('toastSaveFailed');
      setToast({ msg, ok: false });
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

  return (
    <div className="min-h-screen bg-cream dark:bg-gray-900">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg transition-all ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <main className="mx-auto max-w-2xl p-6 sm:p-8">
        <Link href="/organizer/dashboard" className="inline-block text-sm text-brand hover:underline">← {t('backToDashboard')}</Link>
        <h1 className="text-2xl font-bold mb-1">{t('title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          {t('subtitle')}
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <Input
            id="companyName" label={t('companyNameLabel')}
            placeholder={t('companyNamePlaceholder')}
            value={form.companyName} onChange={(e) => set('companyName', e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="ico" label={t('icoLabel')}
              placeholder={t('icoPlaceholder')}
              value={form.ico} onChange={(e) => set('ico', e.target.value)}
              error={fieldErrors.ico}
            />
            <Input
              id="icDph" label={t('icDphLabel')}
              placeholder={t('icDphPlaceholder')}
              value={form.icDph} onChange={(e) => set('icDph', e.target.value)}
              error={fieldErrors.icDph}
            />
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 px-4 py-3">
            <input
              id="vatPayer" type="checkbox"
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-brand focus:ring-brand"
              checked={form.vatPayer} onChange={(e) => set('vatPayer', e.target.checked)}
            />
            <label htmlFor="vatPayer" className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('vatPayerLabel')}</label>
          </div>

          {form.vatPayer && (
            <Input
              id="vatRate" label={t('vatRateLabel')} type="number" step="0.01"
              placeholder={t('vatRatePlaceholder')}
              value={form.vatRate} onChange={(e) => set('vatRate', e.target.value)}
            />
          )}

          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{t('addressSection')}</h2>
            <div className="space-y-4">
              <Input
                id="addressStreet" label={t('streetLabel')}
                placeholder={t('streetPlaceholder')}
                value={form.addressStreet} onChange={(e) => set('addressStreet', e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  id="addressZip" label={t('zipLabel')}
                  placeholder={t('zipPlaceholder')}
                  value={form.addressZip} onChange={(e) => set('addressZip', e.target.value)}
                  error={fieldErrors.addressZip}
                />
                <Input
                  id="addressCity" label={t('cityLabel')}
                  placeholder={t('cityPlaceholder')}
                  value={form.addressCity} onChange={(e) => set('addressCity', e.target.value)}
                />
                <Input
                  id="addressCountry" label={t('countryLabel')}
                  placeholder={t('countryPlaceholder')}
                  value={form.addressCountry} onChange={(e) => set('addressCountry', e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          <Input
            id="bankAccount" label={t('bankAccountLabel')}
            placeholder={t('bankAccountPlaceholder')}
            value={form.bankAccount} onChange={(e) => set('bankAccount', e.target.value)}
          />

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              {t('saveButton')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
