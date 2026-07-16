import { RequireRole } from '@/components/auth/RequireRole';

/**
 * User-management krok D: rodičovský /admin layout púšťa dnu aj PLATFORM_ADMIN
 * a ACCOUNTANT, preto si každá admin sekcia drží vlastný, užší gate.
 * Táto sekcia zostáva SUPERADMIN-only (stav pred krokom D).
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={['SUPERADMIN']}>{children}</RequireRole>;
}
