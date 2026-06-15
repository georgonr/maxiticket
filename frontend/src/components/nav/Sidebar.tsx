'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { QrCode, LogOut } from 'lucide-react';
import { logout } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { StaffLangSwitch } from './StaffLangSwitch';
import { buildNavGroups, showsScanCta, SCANNER_URL, ROLE_KEYS } from './navConfig';

/**
 * Vnútorný obsah navigácie – zdieľaný desktop sidebar aj mobilný drawer.
 * `onNavigate` zavolá drawer na zatvorenie po kliku na linku.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useTranslations('organizer.nav');
  const tRoles = useTranslations('organizer.roles');
  const role = user?.role ?? 'UNKNOWN';
  const roleLabel = ROLE_KEYS.includes(role) ? tRoles(role) : role;
  const groups = buildNavGroups(role);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const linkCls = (href: string) =>
    clsx(
      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
      pathname === href
        ? 'bg-brand/10 text-brand font-medium dark:bg-brand/20'
        : 'text-gray-600 hover:bg-gray-100 hover:text-brand dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-brand',
    );

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center border-b border-gray-200 px-5 dark:border-gray-800">
        <Link href="/organizer/dashboard" onClick={onNavigate}>
          <img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto dark:brightness-0 dark:invert" />
        </Link>
      </div>

      {/* Nav skupiny */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g, gi) => (
          <div key={g.titleKey ?? `g${gi}`} className="space-y-1">
            {g.titleKey && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t(g.titleKey)}
              </p>
            )}
            {g.items.map((item) => (
              <Link key={item.labelKey} href={item.href} onClick={onNavigate} className={linkCls(item.href)}>
                {item.icon}
                {t(item.labelKey)}
              </Link>
            ))}
          </div>
        ))}

        {showsScanCta(role) && (
          <a
            href={SCANNER_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            <QrCode className="h-4 w-4" /> {t('scan')}
          </a>
        )}
      </nav>

      {/* Footer: user + theme + logout */}
      <div className="flex-shrink-0 space-y-3 border-t border-gray-200 px-4 py-4 dark:border-gray-800">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">{user?.email ?? '—'}</div>
          <span className="mt-1 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand dark:bg-brand/20">
            {roleLabel}
          </span>
        </div>
        <StaffLangSwitch />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <LogOut size={15} /> {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Desktop fixná sidebar (skrytá pod lg, kde ju nahrádza drawer v MobileTopBar). */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white lg:block dark:border-gray-800 dark:bg-gray-900 print:hidden">
      <SidebarContent />
    </aside>
  );
}
