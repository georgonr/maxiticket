'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

const LOCALES = ['sk', 'en', 'cs'] as const;

/**
 * Krok 31c1: jazykový prepínač pre staff oblasť (flat routes bez URL locale).
 * Nastaví cookie `mt_staff_lang` a refreshne server komponenty (layout prečíta
 * nové locale cez i18n/request.ts → re-render s novými messages).
 */
export function StaffLangSwitch() {
  const locale = useLocale();
  const t = useTranslations('organizer.nav');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setLang(l: string) {
    if (l === locale) return;
    // 1 rok, path=/ aby platilo na celej staff oblasti.
    document.cookie = `mt_staff_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t('langLabel')}
      className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          disabled={pending}
          aria-pressed={locale === l}
          className={clsx(
            'rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
            locale === l
              ? 'bg-brand/10 text-brand dark:bg-brand/20'
              : 'text-gray-500 hover:text-brand dark:text-gray-400',
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
