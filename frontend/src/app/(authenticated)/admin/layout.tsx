import { RequireRole } from '@/components/auth/RequireRole';
import { StaffShell } from '@/components/nav/StaffShell';

// SUPERADMIN-only area: /admin/hero, /admin/platform-info
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['SUPERADMIN']}>
      <StaffShell>{children}</StaffShell>
    </RequireRole>
  );
}
