'use client';

import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

/**
 * Pozadie public layoutu. Dark režim je ZÁMERNE izolovaný len na /account
 * (zákaznícke konto) – verejné stránky (events, checkout, login) ostávajú vždy
 * svetlé, aby sa neriskovalo rozbitie public témy (Úloha 21, B6).
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAccount = pathname?.startsWith('/account') ?? false;
  return (
    <div className={clsx('min-h-screen flex flex-col bg-slate-50', isAccount && 'theme-scope dark:bg-gray-950')}>
      {children}
    </div>
  );
}
