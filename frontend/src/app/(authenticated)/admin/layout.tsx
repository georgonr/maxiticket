import { RequireRole } from '@/components/auth/RequireRole';

// SUPERADMIN-only area: /admin/hero, /admin/platform-info
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={['SUPERADMIN']}>{children}</RequireRole>;
}
