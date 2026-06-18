'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Plus, Check, X } from 'lucide-react';
import { getValidToken } from '@/lib/auth';
import { ekasaApi, EkasaDevice, EkasaDeviceInput } from '@/lib/api/ekasa';
import { SectionCard, Skeleton } from '@/components/dashboard/parts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const EMPTY: EkasaDeviceInput = { label: '', cashRegisterCode: '', exposeUrl: '', accessToken: '', printMode: 'pos', active: true };

/** Správa eKasa zariadení (ORP) per organizátor – LEN super-admin. accessToken je secret. */
export function EkasaDevicesSection({ organizerId }: { organizerId: string }) {
  const t = useTranslations('ekasa');
  const [devices, setDevices] = useState<EkasaDevice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState<EkasaDeviceInput>(EMPTY);

  const load = useCallback(async () => {
    try {
      const token = await getValidToken();
      if (!token) return;
      setDevices(await ekasaApi.listDevices(organizerId, token));
    } catch {
      setDevices([]);
    }
  }, [organizerId]);

  useEffect(() => { load(); }, [load]);

  async function run(fn: (token: string) => Promise<unknown>, okMsg: string) {
    setBusy(true); setToast(null);
    try {
      const token = await getValidToken();
      if (!token) throw new Error('no token');
      await fn(token);
      await load();
      setToast({ msg: okMsg, ok: true });
    } catch {
      setToast({ msg: t('saveErr'), ok: false });
    } finally {
      setBusy(false);
    }
  }

  const create = () => {
    if (!form.label?.trim() || !form.cashRegisterCode?.trim() || !form.exposeUrl?.trim() || !form.accessToken?.trim()) {
      setToast({ msg: t('fillAll'), ok: false });
      return;
    }
    run((token) => ekasaApi.createDevice({ ...form, organizerId }, token), t('saved')).then(() => setForm(EMPTY));
  };
  const toggleActive = (d: EkasaDevice) => run((token) => ekasaApi.updateDevice(d.id, { active: !d.active }, token), t('saved'));
  const del = (d: EkasaDevice) => { if (window.confirm(t('deleteConfirm'))) run((token) => ekasaApi.deleteDevice(d.id, token), t('saved')); };

  const set = <K extends keyof EkasaDeviceInput>(k: K, v: EkasaDeviceInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard title={t('title')}>
      <p className="mb-4 text-xs text-coral">{t('note')}</p>

      {devices === null ? (
        <Skeleton className="h-24" />
      ) : devices.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">{t('empty')}</p>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{d.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                    {d.active ? t('active') : t('inactive')}
                  </span>
                  {!d.hasAccessToken && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t('noToken')}</span>}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('orp')}: {d.cashRegisterCode} · {d.exposeUrl} · {t('print')}: {d.printMode}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleActive(d)} disabled={busy} title={d.active ? t('deactivate') : t('activate')}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  {d.active ? <X size={15} /> : <Check size={15} />}
                </button>
                <button onClick={() => del(d)} disabled={busy} className="rounded p-1.5 text-gray-400 hover:text-red-600">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pridať zariadenie */}
      <div className="mt-4 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Plus size={15} className="text-coral" /> {t('addDevice')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs text-gray-500">{t('deviceLabel')}</span><Input value={form.label ?? ''} onChange={(e) => set('label', e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs text-gray-500">{t('orp')}</span><Input value={form.cashRegisterCode ?? ''} onChange={(e) => set('cashRegisterCode', e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs text-gray-500">{t('exposeUrl')}</span><Input value={form.exposeUrl ?? ''} onChange={(e) => set('exposeUrl', e.target.value)} placeholder="http://host:port" /></label>
          <label className="block"><span className="mb-1 block text-xs text-gray-500">{t('accessToken')}</span><Input type="password" value={form.accessToken ?? ''} onChange={(e) => set('accessToken', e.target.value)} /></label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">{t('printMode')}</span>
            <select value={form.printMode} onChange={(e) => set('printMode', e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
              <option value="pos">pos</option>
              <option value="pdf">pdf</option>
              <option value="email">email</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="outline" onClick={create} disabled={busy}><Plus size={15} className="mr-1.5" /> {t('add')}</Button>
          {toast && <span className={toast.ok ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>{toast.msg}</span>}
        </div>
      </div>
    </SectionCard>
  );
}
