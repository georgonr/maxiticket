import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PublicAuthProvider } from '@/lib/public-auth';
import { PublicHeader } from '@/components/public/Header';
import { PublicFooter } from '@/components/public/Footer';
import EventsPage from './(public)/events/page';

export default function RootPage() {
  const area = headers().get('x-area') ?? 'public';
  if (area === 'admin') redirect('/login');
  if (area === 'scanner') redirect('/scan');

  return (
    <PublicAuthProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <PublicHeader />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
          <EventsPage />
        </main>
        <PublicFooter />
      </div>
    </PublicAuthProvider>
  );
}
