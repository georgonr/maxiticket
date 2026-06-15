import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { routing, type AppLocale } from './routing';

// Krok 31c1: cookie pre staff jazyk (flat /organizer /admin /scan – mimo [locale]).
export const STAFF_LOCALE_COOKIE = 'mt_staff_lang';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Public [locale] routes → requestLocale je z URL (truthy) → cookie sa ignoruje,
  // stránky ostávajú staticky generovateľné. Flat staff routes nemajú [locale]
  // segment → requestLocale je undefined → fallback na staff cookie (default sk).
  if (!locale || !routing.locales.includes(locale as AppLocale)) {
    const cookieLocale = cookies().get(STAFF_LOCALE_COOKIE)?.value;
    locale =
      cookieLocale && routing.locales.includes(cookieLocale as AppLocale)
        ? cookieLocale
        : routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
