'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getValidToken } from '@/lib/auth';
import { loadSelectedTermin } from '@/lib/scanner-auth';

export default function ScanRootPage() {
  const router = useRouter();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    getValidToken().then((token) => {
      if (!token) {
        router.replace('/scan/login');
        return;
      }
      const termin = loadSelectedTermin();
      router.replace(termin ? '/scan/skener' : '/scan/terminy');
    });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-brand" />
    </div>
  );
}
