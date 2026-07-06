'use client';

// Access token lives in module-level memory only (never localStorage/sessionStorage).
// Refresh token is persisted via httpOnly cookie managed by /api/auth/* route handlers.

import { authApi, TokenPair } from './api';

let _accessToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

/** Bezpečne dekóduj `exp` (unix sekundy) z JWT payloadu; null ak sa nedá. */
function decodeExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp : null;
  } catch {
    return null;
  }
}

/** True len ak tokenu ostáva > 60 s do expirácie. Nedekódovateľný → expirovaný. */
function isTokenFresh(token: string): boolean {
  const exp = decodeExp(token);
  if (exp === null) return false;
  return exp - Date.now() / 1000 > 60;
}

/** Returns a valid access token, refreshing if needed. */
export async function getValidToken(): Promise<string | null> {
  // Proaktívny expiry check: použij token len ak ostáva > 60 s do expirácie.
  if (_accessToken && isTokenFresh(_accessToken)) return _accessToken;

  // Token chýba alebo je blízko expirácie → vynuluj a refreshni z httpOnly cookie.
  _accessToken = null;

  // Avoid concurrent refresh races
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST' });
      if (!res.ok) return null;
      const data: TokenPair = await res.json();
      _accessToken = data.accessToken;
      return _accessToken;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export async function logout() {
  const token = _accessToken;
  clearAccessToken();
  await fetch('/api/auth/logout', { method: 'POST' });
  return token;
}
