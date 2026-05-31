import { RequireRole } from '@/components/auth/RequireRole';

// Organizer area: SUPERADMIN has full access too (testing + real ops behave identically).
export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={['ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'SUPERADMIN']}>
      {children}
    </RequireRole>
  );
}
