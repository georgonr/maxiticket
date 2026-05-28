'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { setAccessToken, getValidToken, clearAccessToken } from './auth';

interface AuthState {
  isLoggedIn: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  isLoggedIn: false,
  isLoading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function PublicAuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    const token = await getValidToken();
    setIsLoggedIn(!!token);
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearAccessToken();
    setIsLoggedIn(false);
  }

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, []);

  return (
    <Ctx.Provider value={{ isLoggedIn, isLoading, refresh, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePublicAuth() {
  return useContext(Ctx);
}
