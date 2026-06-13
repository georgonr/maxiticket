'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Ticket, Receipt, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const TABS = [
  { href: '/account/tickets', label: 'Moje lístky', icon: Ticket },
  { href: '/account/orders', label: 'Objednávky', icon: Receipt },
  { href: '/account/settings', label: 'Nastavenia', icon: Settings },
];

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex items-center justify-between gap-1 border-b border-slate-200 dark:border-slate-800">
      <div className="flex gap-1">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                'inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-purple-600 text-purple-700 dark:text-purple-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              <Icon size={15} /> {t.label}
            </Link>
          );
        })}
      </div>
      <div className="pb-1.5">
        <ThemeToggle />
      </div>
    </nav>
  );
}
