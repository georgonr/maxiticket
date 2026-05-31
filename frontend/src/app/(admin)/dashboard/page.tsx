'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getValidToken, logout } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface JwtClaims {
  sub: string;
  email: string;
  role: string;
  organizerId?: string;
}

function parseJwt(token: string): JwtClaims | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  STAFF: 'Interný operátor',
  ORGANIZER_OWNER: 'Organizátor (vlastník)',
  ORGANIZER_MEMBER: 'Organizátor (člen)',
  SCANNER: 'Skener',
  CUSTOMER: 'Zákazník',
};

export default function DashboardPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<JwtClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getValidToken().then((token) => {
      if (!token) { router.replace('/login'); return; }
      setClaims(parseJwt(token));
      setLoading(false);
    });
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  const role = claims?.role ?? 'UNKNOWN';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <img src="/logo-horizontal.svg" alt="TicketAll" className="h-8 w-auto" />
          <a
            href="https://ticketall.eu"
            className="hidden sm:inline text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Som zákazník?
          </a>
        </div>
        {/* Main nav */}
        <nav className="hidden sm:flex items-center gap-1 text-sm flex-1">
          {(role === 'SUPERADMIN' || role === 'STAFF') && (
            <Link href="/shows" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-brand hover:bg-brand/5 transition-colors">
              Podujatia
            </Link>
          )}
          {role === 'SUPERADMIN' && (
            <Link href="/hero" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-brand hover:bg-brand/5 transition-colors">
              Hero slider
            </Link>
          )}
          {(role === 'ORGANIZER_OWNER' || role === 'ORGANIZER_MEMBER' || role === 'SCANNER') && (
            <Link href="/shows" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-brand hover:bg-brand/5 transition-colors">
              Podujatia
            </Link>
          )}
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
          <span className="text-sm text-gray-600 hidden md:block">{claims?.email}</span>
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">
            {ROLE_LABELS[role] ?? role}
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>Odhlásiť</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-8">
        <h2 className="text-2xl font-bold mb-2">Vitajte späť</h2>
        <p className="text-gray-500 mb-8">
          Toto je placeholder dashboard – sekcie sa doplnia podľa roly.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {role === 'SUPERADMIN' || role === 'STAFF' ? (
            <>
              <DashCard title="Organizátori" desc="Správa tenantov a schvaľovanie" />
              <DashCard title="Používatelia" desc="Všetci používatelia platformy" />
              <DashCard title="Štatistiky" desc="Predaje a analytika" />
              {role === 'SUPERADMIN' && (
                <Link href="/hero">
                  <DashCard title="Hero slider" desc="Titulný slider – bannery a promoted podujatia" />
                </Link>
              )}
            </>
          ) : role === 'ORGANIZER_OWNER' || role === 'ORGANIZER_MEMBER' ? (
            <>
              <Link href="/shows">
                <DashCard title="Podujatia" desc="Vytvorte a spravujte show" />
              </Link>
              <DashCard title="Objednávky" desc="Prehľad predajov a lístkov" />
              <DashCard title="Tím" desc="Pozývajte členov a skenerov" />
              <a href="https://skener.ticketall.eu" target="_blank" rel="noopener noreferrer">
                <ScanCard />
              </a>
            </>
          ) : (
            <a href="https://skener.ticketall.eu" target="_blank" rel="noopener noreferrer">
              <ScanCard />
            </a>
          )}
        </div>
      </main>
    </div>
  );
}

function DashCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{desc}</p>
    </div>
  );
}

function ScanCard() {
  return (
    <div className="rounded-lg border-2 border-brand/30 bg-brand/5 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-center gap-2 mb-1">
        <svg className="h-5 w-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
        </svg>
        <h3 className="font-semibold text-brand">Skenovať vstupenky</h3>
      </div>
      <p className="text-sm text-gray-600">Otvorí mobilný skener pre kontrolu QR kódov na vstupe.</p>
      <p className="mt-2 text-xs text-brand font-medium">Otvoriť skener →</p>
    </div>
  );
}
