import { RequireRole } from '@/components/auth/RequireRole';

/** User-management krok D: správu používateľov vidí SUPERADMIN a PLATFORM_ADMIN. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={['SUPERADMIN', 'PLATFORM_ADMIN']}>{children}</RequireRole>;
}
