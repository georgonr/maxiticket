import { PublicAuthProvider } from '@/lib/public-auth';
import { LandingPage } from '@/components/landing/LandingPage';

// Krok 31a: lokalizovaná homepage (landing) – /sk, /en, /cs.
export default function LocaleHome() {
  return (
    <PublicAuthProvider>
      <LandingPage />
    </PublicAuthProvider>
  );
}
