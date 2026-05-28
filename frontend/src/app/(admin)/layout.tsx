import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Maxiticket Admin',
  description: 'Portál pre organizátorov a správcov',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
