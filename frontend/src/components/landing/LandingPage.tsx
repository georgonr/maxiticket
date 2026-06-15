'use client';

import Link from 'next/link';
import { Bot, ScanLine, Wallet, Users, Tag, LayoutGrid, ArrowRight, Calendar, MapPin } from 'lucide-react';
import { useLandingLang } from '@/lib/landing-i18n';
import { ChatWidget } from '@/components/assistant/ChatWidget';

const REGISTER_URL = '/register';
const ORGANIZER_LOGIN_URL = 'https://admin.ticketall.eu';

const FEATURE_ICONS = [Bot, ScanLine, Wallet, Users, Tag, LayoutGrid];

export function LandingPage() {
  const { lang, setLang, t } = useLandingLang();

  return (
    <div className="min-h-screen bg-cream font-sans text-plum" style={{ colorScheme: 'light' }}>
      {/* ── Nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-plum/5 bg-cream/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" aria-label="TicketAll" className="flex-shrink-0">
            <img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" />
          </Link>

          <div className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
            <Link href="/events" className="transition-colors hover:text-plum">{t.nav.events}</Link>
            <a href="#features" className="transition-colors hover:text-plum">{t.nav.features}</a>
            <a href="#how" className="transition-colors hover:text-plum">{t.nav.how}</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-full border border-plum/10 bg-white p-0.5 text-xs font-semibold">
              {(['sk', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`rounded-full px-2.5 py-1 transition-colors ${lang === l ? 'bg-plum text-cream' : 'text-muted hover:text-plum'}`}
                  aria-pressed={lang === l}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a href={ORGANIZER_LOGIN_URL} className="hidden text-sm font-medium text-plum hover:text-coral sm:inline">
              {t.nav.login}
            </a>
            <Link
              href={REGISTER_URL}
              className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-coral-dark"
            >
              {t.nav.cta}
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-coral shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-coral" /> {t.hero.badge}
            </span>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-plum sm:text-6xl">
              {t.hero.title1}<br />
              <span className="text-coral">{t.hero.title2}</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">{t.hero.subtitle}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={REGISTER_URL}
                className="inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-coral-dark hover:shadow-lg"
              >
                {t.hero.ctaPrimary} <ArrowRight size={18} />
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 rounded-full border border-plum/15 bg-white px-6 py-3 text-base font-semibold text-plum transition-colors hover:border-plum/30"
              >
                {t.hero.ctaSecondary}
              </Link>
            </div>
          </div>

          {/* Ilustračná event-karta (self-contained, žiadne stock fotky) */}
          <div className="relative">
            <div className="absolute -right-6 -top-6 h-56 w-56 rounded-full bg-amber/20 blur-2xl" />
            <div className="absolute -bottom-8 -left-4 h-48 w-48 rounded-full bg-coral/15 blur-2xl" />
            <div className="relative mx-auto max-w-sm rounded-3xl bg-white p-5 shadow-xl ring-1 ring-plum/5">
              <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-coral via-coral-dark to-plum">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(244,165,33,0.6), transparent 45%)' }} />
                <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-coral">{t.hero.cardPrice}</span>
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-plum">{t.hero.cardEvent}</h3>
              <div className="mt-2 space-y-1 text-sm text-muted">
                <p className="flex items-center gap-2"><Calendar size={14} className="text-coral" /> {t.hero.cardDate}</p>
                <p className="flex items-center gap-2"><MapPin size={14} className="text-coral" /> Bratislava</p>
              </div>
              <button className="mt-4 w-full rounded-xl bg-coral py-2.5 text-sm font-semibold text-white">{t.hero.cardBuy}</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-plum sm:text-4xl">{t.features.heading}</h2>
          <p className="mt-3 text-muted">{t.features.sub}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((f, i) => {
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
            <h2 className="font-display text-3xl font-semibold text-cream sm:text-4xl">{t.steps.heading}</h2>
            <p className="mt-3 text-cream/60">{t.steps.sub}</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {t.steps.items.map((s, i) => (
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
            {t.finalCta.title}
          </h2>
          <p className="relative mt-3 text-white/85">{t.finalCta.sub}</p>
          <Link
            href={REGISTER_URL}
            className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-semibold text-coral shadow-md transition-transform hover:scale-[1.02]"
          >
            {t.finalCta.button} <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-plum/5 bg-cream">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" />
            <p className="mt-3 max-w-xs text-sm text-muted">{t.footer.tagline}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-plum/50">{t.footer.product}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/events" className="hover:text-coral">{t.footer.links.events}</Link></li>
              <li><a href="#features" className="hover:text-coral">{t.footer.links.features}</a></li>
              <li><a href="#how" className="hover:text-coral">{t.footer.links.how}</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-plum/50">{t.footer.company}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/pre-organizatorov" className="hover:text-coral">{t.footer.links.organizers}</Link></li>
              <li><Link href="/faq" className="hover:text-coral">{t.footer.links.faq}</Link></li>
              <li><Link href="/kontakt" className="hover:text-coral">{t.footer.links.contact}</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-plum/5">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:px-6">
            <span>© {new Date().getFullYear()} TicketAll · MaceT s.r.o. {t.footer.rights}</span>
            <div className="flex items-center gap-1.5">
              {(['sk', 'en'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={lang === l ? 'font-semibold text-plum' : 'hover:text-plum'}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Krok 28 chat asistent – ostáva mountnutý (self-hide pre non-customer), coral ladí s paletou. */}
      <ChatWidget />
    </div>
  );
}
