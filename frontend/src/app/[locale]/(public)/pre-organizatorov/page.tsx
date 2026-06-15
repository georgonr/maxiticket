import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { TicketCheck, QrCode, BarChart3, CreditCard, Users, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pre organizátorov – TicketAll',
  description: 'Predávajte vstupenky na vaše podujatia jednoducho a bezpečne cez TicketAll.',
};

const BENEFIT_ICONS = [Zap, CreditCard, QrCode, BarChart3, Users, TicketCheck];

type BenefitItem = { title: string; desc: string };

export default function PreOrganizatorovPage() {
  const t = useTranslations('forOrganizers');
  const benefits = t.raw('benefits') as BenefitItem[];

  return (
    <div className="py-10">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center px-4 pb-14">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-rose-500 shadow-lg">
          <TicketCheck size={32} className="text-white" strokeWidth={2.2} />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl leading-tight">
          {t('heroTitle')}<br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-purple-600 to-rose-500 bg-clip-text text-transparent"> {t('heroTitleBrand')}</span>
        </h1>
        <p className="mt-5 text-lg text-slate-500 max-w-xl mx-auto">
          {t('heroSubtitle')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://admin.ticketall.eu/login"
            className="rounded-xl bg-rose-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-rose-600 shadow-sm hover:shadow transition-all"
          >
            {t('ctaLogin')}
          </a>
          <a
            href="https://admin.ticketall.eu/register"
            className="rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t('ctaRegister')}
          </a>
        </div>
        <p className="mt-4 text-sm text-slate-400">{t('heroNote')}</p>
      </section>

      {/* Benefits grid */}
      <section className="mx-auto max-w-4xl px-4">
        <h2 className="text-center text-2xl font-bold text-slate-900 mb-8">{t('benefitsHeading')}</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ title, desc }, i) => {
            const Icon = BENEFIT_ICONS[i] ?? Zap;
            return (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                  <Icon size={20} className="text-purple-600" strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="mx-auto max-w-2xl px-4 mt-14 text-center">
        <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-rose-500 p-8 text-white shadow-lg">
          <h2 className="text-2xl font-bold mb-2">{t('bottomHeading')}</h2>
          <p className="text-purple-100 mb-6 text-sm">
            {t('bottomSubtitle')}
          </p>
          <a
            href="https://admin.ticketall.eu/register"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl bg-white px-8 py-3 text-base font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
          >
            {t('ctaRegister')}
          </a>
          <p className="mt-4 text-xs text-purple-200">
            {t('bottomQuestions')}{' '}
            <Link href="/kontakt" className="underline hover:text-white">
              {t('bottomContactLink')}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
