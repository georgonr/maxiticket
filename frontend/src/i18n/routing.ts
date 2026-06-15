import { defineRouting } from 'next-intl/routing';

// Krok 31a: locale routing pre public subdoménu. Default SK, prefix vždy (/sk, /en, /cs).
export const routing = defineRouting({
  locales: ['sk', 'en', 'cs'],
  defaultLocale: 'sk',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];
