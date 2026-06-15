import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { HtmlLangSetter } from '@/components/i18n/HtmlLangSetter';

// Krok 31a: locale layout (nested pod root app/layout.tsx). NextIntlClientProvider + hreflang.
export function generateMetadata(): Metadata {
  return {
    alternates: { languages: { sk: '/sk', en: '/en', cs: '/cs' } },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as AppLocale)) notFound();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLangSetter locale={locale} />
      {children}
    </NextIntlClientProvider>
  );
}
