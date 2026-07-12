'use client';

import NextLink from 'next/link';
import { useTranslations } from 'next-intl';
import { Bot, ScanLine, Tag, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ChatWidget } from '@/components/assistant/ChatWidget';
import { PublicHeader } from '@/components/public/Header';
import { PublicFooter } from '@/components/public/Footer';
import { FeaturedEvents } from './FeaturedEvents';
import { HeroSearch } from './HeroSearch';

const REGISTER_URL = '/register'; // ploché (nelokalizované) – staff/customer registrácia

// 3 funkcie (krok 30): AI podpora, Skenovanie, Kupóny a zľavy
const FEATURE_ICONS = [Bot, ScanLine, Tag];

export function LandingPage() {
  const t = useTranslations('landing');
  const features = t.raw('features.items') as { title: string; desc: string }[];
  const steps = t.raw('steps.items') as { title: string; desc: string }[];

  return (
    <div className="min-h-screen bg-cream font-sans text-plum" style={{ colorScheme: 'light' }}>
      {/* ── Zjednotený chrome (rovnaký header ako zvyšok public webu) ── */}
      <PublicHeader />

      {/* ── Hero (kompaktný pás) ──────────────────────────── */}
      <section className="relative overflow-hidden border-b border-plum/5">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-coral/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:py-16">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-coral shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" /> {t('hero.badge')}
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-plum sm:text-5xl">
            {t('hero.title1')} <span className="text-coral">{t('hero.title2')}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">{t('hero.subtitle')}</p>

          {/* C3 blok 1B: prominentný vyhľadávací bar → submit redirectuje na /events */}
          <HeroSearch />

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <NextLink
              href={REGISTER_URL}
              className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-coral-dark hover:shadow-lg"
            >
              {t('hero.ctaPrimary')} <ArrowRight size={18} />
            </NextLink>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-full border border-plum/15 bg-white px-6 py-3 text-base font-semibold text-plum transition-colors hover:border-plum/30"
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Vybrané podujatia (reálne, auto-preklápanie) ──── */}
      <FeaturedEvents />

      {/* ── Features ──────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-plum sm:text-4xl">{t('features.heading')}</h2>
          <p className="mt-3 text-muted">{t('features.sub')}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? Bot;
            return (
              <div key={i} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-plum/5 transition-shadow hover:shadow-md">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cream">
                  <Icon size={22} className="text-coral" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-plum">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Steps (tmavý plum band) ───────────────────────── */}
      <section id="how" className="bg-plum">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold text-cream sm:text-4xl">{t('steps.heading')}</h2>
            <p className="mt-3 text-cream/60">{t('steps.sub')}</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                <span className="font-display text-5xl font-semibold text-amber">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 font-display text-xl font-semibold text-cream">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA band ────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-coral px-6 py-14 text-center shadow-lg sm:px-12">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber/30 blur-2xl" />
          <div className="absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-plum/20 blur-2xl" />
          <h2 className="relative mx-auto max-w-2xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {t('finalCta.title')}
          </h2>
          <p className="relative mt-3 text-white/85">{t('finalCta.sub')}</p>
          <NextLink
            href={REGISTER_URL}
            className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-semibold text-coral shadow-md transition-transform hover:scale-[1.02]"
          >
            {t('finalCta.button')} <ArrowRight size={18} />
          </NextLink>
        </div>
      </section>

      {/* ── Zjednotený footer (rovnaký ako zvyšok public webu) ── */}
      <PublicFooter />

      {/* Krok 28 chat asistent – ostáva mountnutý (self-hide pre non-customer), coral ladí s paletou. */}
      <ChatWidget />
    </div>
  );
}
