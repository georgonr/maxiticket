import type { Metadata } from 'next';
import { RequireRole } from '@/components/auth/RequireRole';

export const metadata: Metadata = {
  title: 'TicketAll Portál',
  description: 'Portál pre organizátorov a správcov',
};

// Requires any authenticated user; role narrowing happens in admin/ + organizer/ sub-layouts.
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole>{children}</RequireRole>;
}
