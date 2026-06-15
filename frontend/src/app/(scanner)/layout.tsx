import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'TicketAll Skener',
  description: 'Skener vstupeniek – inštalovateľná aplikácia',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TicketAll Skener',
  },
};

export const viewport: Viewport = {
  themeColor: '#e63946',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// Krok 31d: scanner i18n cez cookie-locale (mt_staff_lang, default sk) – rovnaká
// infra ako (authenticated)/layout (31c1). Scanner je flat /scan/* (mimo [locale]).
export default async function ScannerLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
