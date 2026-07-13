'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getValidToken } from '@/lib/auth';
import { telegramApi, TelegramConfig } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TelegramSettingsPage() {
  const t = useTranslations('admin.telegram');
  const [cfg, setCfg] = useState<TelegramConfig | null>(null);
  const [chatId, setChatId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getValidToken();
        if (!token) return;
        const c = await telegramApi.getConfig(token);
        setCfg(c); setChatId(c.chatId ?? ''); setEnabled(c.enabled);
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  async function save() {
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const c = await telegramApi.setConfig({ chatId: chatId.trim(), enabled }, token);
      setCfg(c); setToast({ msg: t('saved'), ok: true });
    } catch {
      setToast({ msg: t('saveFailed'), ok: false });
    } finally { setSaving(false); }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const token = await getValidToken();
      if (!token) return;
      const { sent } = await telegramApi.test(token);
      setToast({ msg: sent ? t('testSent') : t('testNoOp'), ok: sent });
    } catch {
      setToast({ msg: t('testFailed'), ok: false });
    } finally { setTesting(false); }
  }

  if (loading) return <div className="mx-auto max-w-lg px-4 py-10 text-slate-400">{t('loading')}</div>;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>

      {toast && (
        <div className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${toast.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{toast.msg}</div>
      )}

      <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        {/* Token stav */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">{t('tokenStatus')}</span>
          {cfg?.tokenSet ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{t('tokenSet')}</span>
          ) : (
            <span className="rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{t('tokenMissing')}</span>
          )}
        </div>
        {!cfg?.tokenSet && (
          <p className="rounded-lg bg-amber/10 border border-amber/30 px-3 py-2 text-xs text-slate-600">{t('tokenHint')}</p>
        )}

        {/* chatId */}
        <div>
          <label className="block text-sm font-medium text-slate-700">{t('chatId')}</label>
          <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder={t('chatIdPlaceholder')} className="mt-1" />
          <p className="mt-1 text-xs text-slate-400">{t('chatIdHint')}</p>
        </div>

        {/* enabled */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-coral" />
          <span className="text-sm text-slate-700">{t('enabled')}</span>
        </label>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={save} loading={saving}>{t('save')}</Button>
          <Button onClick={sendTest} loading={testing} variant="outline">{t('sendTest')}</Button>
        </div>
      </div>
    </div>
  );
}
