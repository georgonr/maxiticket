import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PublicAuthProvider } from '@/lib/public-auth';
import { LandingPage } from '@/components/landing/LandingPage';

// Krok 29: marketingová homepage (landing). Prehľad podujatí ostáva na /events.
export default function RootPage() {
  const area = headers().get('x-area') ?? 'public';
  if (area === 'admin') redirect('/login');
  if (area === 'scanner') redirect('/scan');

  return (
    <PublicAuthProvider>
      <LandingPage />
    </PublicAuthProvider>
  );
}
