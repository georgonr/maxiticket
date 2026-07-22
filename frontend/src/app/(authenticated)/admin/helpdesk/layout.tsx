import { RequireRole } from '@/components/auth/RequireRole';

/**
 * Rodičovský /admin layout púšťa dnu aj ACCOUNTANT, preto si sekcia drží vlastný,
 * užší gate. Helpdesk je platformový support – organizátori sem nepatria.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={['SUPERADMIN', 'PLATFORM_ADMIN']}>{children}</RequireRole>;
}
