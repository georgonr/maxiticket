'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SidebarContent } from './Sidebar';

/** Mobilný (a tablet) top bar + slide-in drawer. Skrytý na lg, kde je fixná sidebar. */
export function MobileTopBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden dark:border-gray-800 dark:bg-gray-900 print:hidden">
        <button
          aria-label="Otvoriť menu"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Menu size={20} />
        </button>
        <Link href="/organizer/dashboard">
          <img src="/logo-horizontal.svg" alt="TicketAll" className="h-7 w-auto dark:brightness-0 dark:invert" />
        </Link>
        <ThemeToggle />
      </div>

      {/* Drawer */}
      <div className={clsx('fixed inset-0 z-50 lg:hidden', open ? '' : 'pointer-events-none')}>
        {/* Overlay */}
        <div
          onClick={() => setOpen(false)}
          className={clsx('absolute inset-0 bg-black/40 transition-opacity', open ? 'opacity-100' : 'opacity-0')}
        />
        {/* Panel */}
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl transition-transform dark:bg-gray-900',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <button
            aria-label="Zavrieť menu"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X size={18} />
          </button>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </aside>
      </div>
    </>
  );
}
