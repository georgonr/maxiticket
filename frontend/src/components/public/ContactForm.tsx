'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Send, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.ticketall.eu';

type Status = 'idle' | 'sending' | 'ok' | 'error';

/**
 * Kontaktný formulár – jediná interaktívna časť /kontakt (krok 40). Vyčlenený
 * z page, aby stránka mohla byť server component a údaje prevádzkovateľa boli
 * v SSR HTML. Odosielanie sa nezmenilo (POST /v1/public/contact).
 */
export function ContactForm() {
  const t = useTranslations('contact');
  const locale = useLocale();
  const [form, setForm] = useState({ meno: '', email: '', predmet: '', sprava: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrMsg('');
    try {
      const res = await fetch(`${API_BASE}/v1/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, locale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setErrMsg(t('errors.tooMany'));
        } else {
          setErrMsg(data?.message ?? t('errors.generic'));
        }
        setStatus('error');
        return;
      }
      setStatus('ok');
      setForm({ meno: '', email: '', predmet: '', sprava: '' });
    } catch {
      setErrMsg(t('errors.network'));
      setStatus('error');
    }
  }

  if (status === 'ok') {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
        <CheckCircle size={32} className="text-emerald-600" />
        <h2 className="text-lg font-semibold text-emerald-800">{t('success.title')}</h2>
        <p className="text-sm text-emerald-700">{t('success.body')}</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-2 text-sm font-medium text-emerald-700 underline hover:no-underline"
        >
          {t('success.again')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="meno">
            {t('form.name')}
          </label>
          <input
            id="meno" name="meno" type="text" required maxLength={100}
            value={form.meno} onChange={handleChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            placeholder={t('form.namePlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
            {t('form.email')}
          </label>
          <input
            id="email" name="email" type="email" required
            value={form.email} onChange={handleChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
            placeholder={t('form.emailPlaceholder')}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="predmet">
          {t('form.subject')}
        </label>
        <select
          id="predmet" name="predmet" required value={form.predmet} onChange={handleChange}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
        >
          <option value="">{t('form.subjectPlaceholder')}</option>
          <option value="Otázka k objednávke">{t('subjects.order')}</option>
          <option value="Technický problém">{t('subjects.technical')}</option>
          <option value="Vrátenie lístka">{t('subjects.refund')}</option>
          <option value="Spolupráca / organizátor">{t('subjects.partnership')}</option>
          <option value="Iné">{t('subjects.other')}</option>
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="sprava">
          {t('form.message')}
        </label>
        <textarea
          id="sprava" name="sprava" required rows={5} maxLength={2000}
          value={form.sprava} onChange={handleChange}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          placeholder={t('form.messagePlaceholder')}
        />
        <p className="mt-1 text-right text-xs text-slate-400">{form.sprava.length} / 2000</p>
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="flex-shrink-0" />
          {errMsg}
        </div>
      )}

      <button
        type="submit" disabled={status === 'sending'}
        className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-60 transition-colors"
      >
        <Send size={14} />
        {status === 'sending' ? t('form.sending') : t('form.submit')}
      </button>
    </form>
  );
}
