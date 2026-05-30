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
        <span className="font-bold text-lg text-brand flex-shrink-0">Maxiticket</span>
        {/* Main nav – Hero visible only to SUPERADMIN */}
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
            </>
          ) : (
            <DashCard title="Skenovanie" desc="Spustite skener vstupeniek" />
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
