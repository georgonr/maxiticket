'use client';

import { useState, useEffect } from 'react';
import { getValidToken } from '@/lib/auth';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  organizerId?: string;
}

export interface UseAuthResult {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isOrganizer: boolean;
  isSuperAdmin: boolean;
  isCustomer: boolean;
  isLoading: boolean;
}

export function parseJwt(token: string): AuthUser | null {
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    return { id: p.sub, email: p.email, role: p.role, organizerId: p.organizerId };
  } catch {
    return null;
  }
}

/**
 * Client-side auth state derived from the JWT access token.
 * Resolves the token via getValidToken() (refreshes from the httpOnly cookie
 * if the in-memory token is empty – important on hard navigations / fresh loads).
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getValidToken().then((token) => {
      if (!active) return;
      setUser(token ? parseJwt(token) : null);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const role = user?.role;
  return {
    user,
    isAuthenticated: !!user,
    isOrganizer: role === 'ORGANIZER_OWNER' || role === 'ORGANIZER_MEMBER',
    isSuperAdmin: role === 'SUPERADMIN',
    isCustomer: role === 'CUSTOMER',
    isLoading,
  };
}
