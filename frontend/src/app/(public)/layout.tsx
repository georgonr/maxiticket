import React from 'react';
import { PublicAuthProvider } from '@/lib/public-auth';
import { PublicHeader } from '@/components/public/Header';
import { PublicFooter } from '@/components/public/Footer';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicAuthProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <PublicHeader />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
          {children}
        </main>
        <PublicFooter />
      </div>
    </PublicAuthProvider>
  );
}
