import { RequireRole } from '@/components/auth/RequireRole';
import { StaffShell } from '@/components/nav/StaffShell';

/**
 * Vstup do admin zóny. Od kroku D sem smie aj PLATFORM_ADMIN (správa
 * používateľov) a ACCOUNTANT (fakturácia) – nie však na všetky stránky:
 * každá admin sekcia si drží vlastný, užší RequireRole vo svojom layout.tsx.
 * Toto je len najširší filter, nie autorizácia jednotlivých sekcií.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['SUPERADMIN', 'PLATFORM_ADMIN', 'ACCOUNTANT']}>
      <StaffShell>{children}</StaffShell>
    </RequireRole>
  );
}
