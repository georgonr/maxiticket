'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Ticket } from 'lucide-react';
import { logout } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  STAFF: 'Interný operátor',
  ORGANIZER_OWNER: 'Organizátor (vlastník)',
  ORGANIZER_MEMBER: 'Organizátor (člen)',
  SCANNER: 'Skener',
  CUSTOMER: 'Zákazník',
};

/**
 * Zdieľaný header pre organizer + admin dashboardy.
 * Navigačné linky podľa roly (zachované z Úlohy 11) + SUPERADMIN "Prehľad platformy".
 */
export function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role ?? 'UNKNOWN';

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const linkCls = (href: string) =>
    clsx(
      'px-3 py-1.5 rounded-lg transition-colors',
      pathname === href
        ? 'bg-brand/10 text-brand font-medium'
        : 'text-gray-600 hover:text-brand hover:bg-brand/5',
    );

  return (
    <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link href="/organizer/dashboard">
          <img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" />
        </Link>
        <a
          href="https://ticketall.eu"
          className="hidden sm:inline text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Som zákazník?
        </a>
      </div>

      <nav className="hidden sm:flex items-center gap-1 text-sm flex-1">
        {role === 'SUPERADMIN' && (
          <Link href="/admin/dashboard" className={linkCls('/admin/dashboard')}>
            Prehľad platformy
          </Link>
        )}
        {(role === 'SUPERADMIN' || role === 'STAFF') && (
          <Link href="/organizer/shows" className={linkCls('/organizer/shows')}>
            Podujatia
          </Link>
        )}
        {role === 'SUPERADMIN' && (
          <Link href="/admin/hero" className={linkCls('/admin/hero')}>
            Hero slider
          </Link>
        )}
        {role === 'SUPERADMIN' && (
          <Link href="/admin/platform-info" className={linkCls('/admin/platform-info')}>
            Platforma
          </Link>
        )}
        {(role === 'ORGANIZER_OWNER' || role === 'ORGANIZER_MEMBER' || role === 'SCANNER') && (
          <Link href="/organizer/shows" className={linkCls('/organizer/shows')}>
            Podujatia
          </Link>
        )}
        {(role === 'ORGANIZER_OWNER' || role === 'SUPERADMIN') && (
          <Link href="/organizer/settings" className={linkCls('/organizer/settings')}>
            Údaje firmy
          </Link>
        )}
        <Link href="/account/tickets" className={clsx('flex items-center gap-1.5', linkCls('/account/tickets'))}>
          <Ticket className="h-4 w-4" />
          Moje lístky
        </Link>
        {(role === 'ORGANIZER_OWNER' || role === 'ORGANIZER_MEMBER' || role === 'SCANNER') && (
          <a
            href="https://skener.ticketall.eu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
            </svg>
            Skenovať
          </a>
        )}
      </nav>

      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="text-sm text-gray-600 hidden md:block">{user?.email}</span>
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
          {ROLE_LABELS[role] ?? role}
        </span>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Odhlásiť
        </Button>
      </div>
    </header>
  );
}
