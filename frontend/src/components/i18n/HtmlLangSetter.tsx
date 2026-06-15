'use client';

import { useEffect } from 'react';

// Krok 31a: nastaví <html lang> podľa aktuálneho locale (root <html> je v app/layout.tsx).
export function HtmlLangSetter({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
