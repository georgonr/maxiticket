'use client';

import Link from 'next/link';
import { usePublicAuth } from '@/lib/public-auth';
import { ShoppingBag, Ticket, LogOut, LogIn } from 'lucide-react';

export function PublicNav() {
  const { isLoggedIn, isLoading, signOut } = usePublicAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/events" className="flex items-center gap-2 font-bold text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm font-bold">MT</span>
          TicketAll
        </Link>

        <nav className="flex items-center gap-2">
          <Link href="/events" className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100">
            <ShoppingBag size={15} /> Podujatia
          </Link>

          {!isLoading && isLoggedIn && (
            <>
              <Link href="/account/tickets" className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100">
                <Ticket size={15} /> Moje lístky
              </Link>
              <button
                onClick={signOut}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Odhlásiť</span>
              </button>
            </>
          )}

          {!isLoading && !isLoggedIn && (
            <Link href="/account/login" className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
              <LogIn size={15} /> Prihlásiť sa
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
