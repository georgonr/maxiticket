import { RequireRole } from '@/components/auth/RequireRole';

/**
 * User-management krok D: fakturáciu vidí SUPERADMIN a ACCOUNTANT.
 * (STAFF má billing v nave, ale rodičovský /admin layout ho nepúšťa – stav
 * pred krokom D zostáva nezmenený.)
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={['SUPERADMIN', 'ACCOUNTANT']}>{children}</RequireRole>;
}
