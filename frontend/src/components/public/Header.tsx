'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePublicAuth } from '@/lib/public-auth';
import { TicketCheck, Ticket, LogOut, LogIn, Menu, X, UserCircle2, ChevronDown, ShoppingBag } from 'lucide-react';

const NAV_LINKS = [
  { href: '/events', label: 'Podujatia' },
  { href: '/faq', label: 'FAQ' },
  { href: '/pre-organizatorov', label: 'Pre organizátorov' },
];

export function PublicHeader() {
  const { isLoggedIn, isLoading, signOut } = usePublicAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  // Close mobile menu on route change (simple window event)
  useEffect(() => {
    setMobileOpen(false);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 h-16">

        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 group">
            <TicketCheck
              size={22}
              className="text-purple-600 group-hover:text-purple-700 transition-colors flex-shrink-0"
              strokeWidth={2.2}
            />
            <span
              className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-purple-600 to-rose-500 bg-clip-text text-transparent"
              style={{ fontFamily: 'var(--font-geist-sans, sans-serif)' }}
            >
              TicketAll
            </span>
          </Link>
          <a
            href="https://admin.ticketall.eu"
            className="hidden lg:inline text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Som organizátor?
          </a>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center gap-2">
          {isLoading ? (
            <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-100" />
          ) : isLoggedIn ? (
            <>
              <Link
                href="/account/tickets"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <Ticket size={15} />
                Moje lístky
              </Link>
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Účet"
                >
                  <UserCircle2 size={18} className="text-purple-700" />
                  <ChevronDown size={13} className={`text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-100 bg-white shadow-lg py-1 z-50 animate-slide-up">
                    <button
                      onClick={() => { signOut(); setUserMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                    >
                      <LogOut size={14} />
                      Odhlásiť sa
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/account/login"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogIn size={15} />
                Prihlásiť sa
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl shadow-sm hover:shadow transition-all"
              >
                Registrácia
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Zavrieť menu' : 'Otvoriť menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-0.5 animate-fade-in">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
            >
              {link.label === 'Podujatia' && <ShoppingBag size={15} />}
              {link.label}
            </Link>
          ))}
          <div className="pt-3 mt-2 border-t border-slate-100 space-y-1.5">
            {isLoading ? null : isLoggedIn ? (
              <>
                <Link
                  href="/account/tickets"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <Ticket size={15} /> Moje lístky
                </Link>
                <button
                  onClick={() => { signOut(); setMobileOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <LogOut size={15} /> Odhlásiť sa
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/account/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <LogIn size={15} /> Prihlásiť sa
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2.5 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-xl text-center transition-colors"
                >
                  Registrácia
                </Link>
                <a
                  href="https://admin.ticketall.eu"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 text-sm text-slate-500 text-center"
                >
                  Som organizátor? →
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
