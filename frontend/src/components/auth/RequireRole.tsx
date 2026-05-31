'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );
}

/**
 * Client-side route guard.
 * - Not authenticated  → redirect /login?next=<path>
 * - Authenticated but role not in `allow` → redirect /account
 * - `allow` omitted → any authenticated role passes.
 *
 * NOTE: server-side gating is not possible here – the refresh_token cookie is
 * path-scoped to /api/auth and the access token lives in memory only, so the
 * middleware cannot see auth state. This client guard is the real gate.
 */
export function RequireRole({ allow, children }: { allow?: string[]; children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const roleOk = !allow || (user ? allow.includes(user.role) : false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?next=' + encodeURIComponent(pathname));
      return;
    }
    if (!roleOk) {
      router.replace('/account');
    }
  }, [isLoading, isAuthenticated, roleOk, router, pathname]);

  if (isLoading) return <Spinner />;
  if (!isAuthenticated || !roleOk) return null;
  return <>{children}</>;
}
