'use client';

import { ThemeProvider } from 'next-themes';

/**
 * Globálny theme provider (next-themes, class stratégia).
 * Rieši anti-flash (injektovaný script v <head>) + hydration v App Routeri.
 * Default = systémová preferencia, override uloženým výberom v localStorage.
 *
 * Pozn.: dark trieda ide na <html> globálne, ale public/checkout komponenty
 * nemajú `dark:` varianty → ostanú svetlé aj keď je dark aktívny (izolácia).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
