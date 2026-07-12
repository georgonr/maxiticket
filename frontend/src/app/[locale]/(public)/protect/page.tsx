'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ShieldCheck, CreditCard, RotateCcw, ArrowRight } from 'lucide-react';

export default function ProtectPage() {
  const t = useTranslations('protect.page');
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-coral/10">
          <ShieldCheck size={26} className="text-coral" />
        </span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-plum">{t('title')}</h1>
      </div>
      <p className="mt-3 text-muted">{t('subtitle')}</p>

      <div className="mt-10 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-coral" />
            <h2 className="font-display text-lg font-semibold text-plum">{t('paymentTitle')}</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('paymentBody')}</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <RotateCcw size={18} className="text-coral" />
            <h2 className="font-display text-lg font-semibold text-plum">{t('refundTitle')}</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('refundBody')}</p>
        </section>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-slate-400">{t('note')}</p>

      <Link
        href="/events"
        className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-coral hover:text-coral-dark"
      >
        {t('backToEvents')} <ArrowRight size={14} />
      </Link>
    </div>
  );
}
