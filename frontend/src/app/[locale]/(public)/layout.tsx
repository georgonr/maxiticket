import React from 'react';
import { PublicAuthProvider } from '@/lib/public-auth';
import { PublicHeader } from '@/components/public/Header';
import { PublicFooter } from '@/components/public/Footer';
import { PublicShell } from '@/components/public/PublicShell';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicAuthProvider>
      <PublicShell>
        <PublicHeader />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
          {children}
        </main>
        <PublicFooter />
      </PublicShell>
    </PublicAuthProvider>
  );
}
