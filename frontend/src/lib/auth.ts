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

/** Returns a valid access token, refreshing if needed. */
export async function getValidToken(): Promise<string | null> {
  if (_accessToken) return _accessToken;

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
