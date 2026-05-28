import React from 'react';
import { PublicAuthProvider } from '@/lib/public-auth';
import { PublicNav } from '@/components/public/nav';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicAuthProvider>
      <div className="min-h-screen bg-gray-50">
        <PublicNav />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-gray-200 bg-white py-8 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} Maxiticket. Všetky práva vyhradené.
        </footer>
      </div>
    </PublicAuthProvider>
  );
}
