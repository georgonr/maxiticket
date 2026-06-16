'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import NextLink from 'next/link';
import { Link } from '@/i18n/navigation';
import { TicketCheck, Store, X, ArrowRight } from 'lucide-react';

/**
 * FIX registrácia: dialóg „Ako sa chcete registrovať?" – nahrádza mŕtvy footer
 * odkaz (/admin/register = 404). Zákazník → /account/register (locale-aware),
 * Usporiadateľ → /register/organizer (flat). Brand cream/coral.
 *
 * `children` + `className` = vzhľad spúšťacieho prvku (footer link / header CTA).
 */
export function RegisterChoice({ className, children }: { className?: string; children: React.ReactNode }) {
  const t = useTranslations('registerChoice');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-plum/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-cream p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-plum">{t('title')}</h2>
                <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted hover:bg-plum/5 hover:text-plum"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Zákazník – locale-aware */}
              <Link
                href="/account/register"
                onClick={() => setOpen(false)}
                className="group flex flex-col rounded-xl border border-plum/10 bg-white p-5 transition-all hover:border-coral/40 hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-coral/10">
                  <TicketCheck size={22} className="text-coral" />
                </span>
                <h3 className="mt-3 font-semibold text-plum">{t('customerTitle')}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{t('customerDesc')}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-coral">
                  {t('customerCta')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>

              {/* Usporiadateľ – flat route */}
              <NextLink
                href="/register/organizer"
                onClick={() => setOpen(false)}
                className="group flex flex-col rounded-xl border border-plum/10 bg-white p-5 transition-all hover:border-plum/40 hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-plum/10">
                  <Store size={22} className="text-plum" />
                </span>
                <h3 className="mt-3 font-semibold text-plum">{t('organizerTitle')}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{t('organizerDesc')}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-plum">
                  {t('organizerCta')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </NextLink>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
