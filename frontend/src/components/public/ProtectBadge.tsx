'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ShieldCheck, X, ArrowRight } from 'lucide-react';

/**
 * TicketAll Protect – dôveryhodnostný odznak „Bezpečný nákup lístkov".
 * Klik → modal s krátkym vysvetlením + odkaz na /protect. Coral branding.
 * variant „pill" = malý odznak pri kúpe (detail); „strip" = širší pás (checkout).
 *
 * Text zámerne nesľubuje viac než platforma robí: (a) bezpečná šifrovaná platba,
 * (b) peniaze späť LEN pri zrušení podujatia organizátorom (refund je manuálny).
 */
export function ProtectBadge({ variant = 'pill' }: { variant?: 'pill' | 'strip' }) {
  const t = useTranslations('protect');
  const [open, setOpen] = useState(false);

  const trigger =
    variant === 'strip' ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-coral/20 bg-coral/5 px-4 py-3 text-sm font-medium text-plum transition-colors hover:bg-coral/10"
      >
        <ShieldCheck size={16} className="flex-shrink-0 text-coral" />
        <span>{t('badge')}</span>
        <ArrowRight size={14} className="ml-auto flex-shrink-0 text-coral" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold text-coral transition-colors hover:bg-coral/15"
      >
        <ShieldCheck size={13} className="flex-shrink-0" />
        {t('badge')}
      </button>
    );

  return (
    <>
      {trigger}
      {open && <ProtectModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ProtectModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('protect');

  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={t('close')}
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-coral/10">
            <ShieldCheck size={20} className="text-coral" />
          </span>
          <h3 className="font-display text-lg font-semibold text-plum">{t('modalTitle')}</h3>
        </div>

        <ul className="mt-4 space-y-3">
          <li className="flex items-start gap-2.5 text-sm text-muted">
            <ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-coral" />
            <span>{t('pointPayment')}</span>
          </li>
          <li className="flex items-start gap-2.5 text-sm text-muted">
            <ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-coral" />
            <span>{t('pointRefund')}</span>
          </li>
        </ul>

        <Link
          href="/protect"
          onClick={onClose}
          className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-coral hover:text-coral-dark"
        >
          {t('learnMore')} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
