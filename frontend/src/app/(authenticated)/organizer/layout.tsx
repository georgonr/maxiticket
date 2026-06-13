import { RequireRole } from '@/components/auth/RequireRole';
import { StaffShell } from '@/components/nav/StaffShell';

// Organizer area: SUPERADMIN has full access too (testing + real ops behave identically).
export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'SUPERADMIN']}>
      <StaffShell>{children}</StaffShell>
    </RequireRole>
  );
}
