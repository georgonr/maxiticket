'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { AlertCircle } from 'lucide-react';

/**
 * Krok 50 (V5/V6): reálny 404 pre neexistujúce podujatie (page.tsx volá notFound()).
 * Jasná hláška „nenašlo sa" + návrat na katalóg – NIE biela stránka ani „žiadne podujatia".
 */
export default function EventNotFound() {
  const t = useTranslations('eventDetail');
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <AlertCircle size={48} className="mb-4 text-slate-300" />
      <h1 className="text-xl font-semibold text-slate-700">{t('notFoundTitle')}</h1>
      <p className="mt-1 text-sm text-slate-400">{t('notFoundDesc')}</p>
      <Link
        href="/events"
        className="mt-6 rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral-dark transition-colors"
      >
        {t('backToEvents')}
      </Link>
    </div>
  );
}
