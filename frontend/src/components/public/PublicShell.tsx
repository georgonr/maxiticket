'use client';

import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { ChatWidget } from '@/components/assistant/ChatWidget';

/**
 * Pozadie public layoutu. Dark režim je ZÁMERNE izolovaný len na /account
 * (zákaznícke konto) – verejné stránky (events, checkout, login) ostávajú vždy
 * svetlé, aby sa neriskovalo rozbitie public témy (Úloha 21, B6).
 *
 * Doľaďovák 1: krémový base (bg-cream #FBF6EE) zjednotený s landingom – už
 * žiadne biele „bliknutie" pri prechode medzi landingom a ostatnými public
 * stránkami. Karty/surface ostávajú biele (kontrast). Dark scoping /account
 * (light=cream, dark=gray-950) nezmenený.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAccount = pathname?.startsWith('/account') ?? false;
  return (
    <div className={clsx('min-h-screen flex flex-col bg-cream', isAccount && 'theme-scope dark:bg-gray-950')}>
      {children}
      {/* Krok 28: chat asistent – sám sa vykreslí len pre prihláseného zákazníka. */}
      <ChatWidget />
    </div>
  );
}
