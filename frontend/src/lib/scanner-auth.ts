'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getValidToken, clearAccessToken } from './auth';

export interface ScannerUser {
  email: string;
  role: string;
}

function decodeJwt(token: string): ScannerUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { email: payload.email ?? '', role: payload.role ?? '' };
  } catch {
    return null;
  }
}

const SCANNER_ROLES = ['ORGANIZER_OWNER', 'ORGANIZER_MEMBER', 'SCANNER'];

export function useScannerAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getValidToken().then((t) => {
      if (!t) {
        router.replace('/scan/login');
        return;
      }
      const decoded = decodeJwt(t);
      if (!decoded || !SCANNER_ROLES.includes(decoded.role)) {
        router.replace('/scan/login');
        return;
      }
      setToken(t);
      setUser(decoded);
      setLoading(false);
    });
  }, [router]);

  const logout = useCallback(async () => {
    clearAccessToken();
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('scanSelectedTermin');
    router.replace('/scan/login');
  }, [router]);

  return { token, user, loading, logout };
}

export interface SelectedTermin {
  id: string;
  showName: string;
  startsAt: string;
  venueName: string | null;
  venueCity: string | null;
}

export function saveSelectedTermin(t: SelectedTermin) {
  localStorage.setItem('scanSelectedTermin', JSON.stringify(t));
}

export function loadSelectedTermin(): SelectedTermin | null {
  try {
    const raw = localStorage.getItem('scanSelectedTermin');
    return raw ? (JSON.parse(raw) as SelectedTermin) : null;
  } catch {
    return null;
  }
}

export function clearSelectedTermin() {
  localStorage.removeItem('scanSelectedTermin');
}
