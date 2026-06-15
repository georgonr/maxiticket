import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { RequireRole } from '@/components/auth/RequireRole';

export const metadata: Metadata = {
  title: 'TicketAll Portál',
  description: 'Portál pre organizátorov a správcov',
};

// Krok 31c1: staff i18n bez URL routingu – locale z cookie (mt_staff_lang, default sk)
// cez rozšírený i18n/request.ts. Provider tu pokrýva organizer aj admin (zdieľajú
// StaffShell); messages = celý objekt (rovnako ako public provider).
// Requires any authenticated user; role narrowing happens in admin/ + organizer/ sub-layouts.
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RequireRole>{children}</RequireRole>
    </NextIntlClientProvider>
  );
}
