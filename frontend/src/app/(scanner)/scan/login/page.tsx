'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken, getValidToken } from '@/lib/auth';
import Link from 'next/link';
import { getReadableError } from '@/lib/api-errors';

export default function ScanLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Skip login if already authenticated
  useEffect(() => {
    getValidToken().then((t) => {
      if (t) router.replace('/scan/terminy');
      else setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(getReadableError({ endpoint: 'login', status: res.status, code: json.message }));
        return;
      }
      setAccessToken(json.accessToken);
      router.replace('/scan/terminy');
    } catch {
      setError(getReadableError({ endpoint: 'login' }));
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-5 py-10">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white text-2xl font-bold shadow-lg">
          MT
        </div>
        <h1 className="text-xl font-bold text-white">TicketAll Skener</h1>
        <p className="mt-1 text-sm text-gray-400">Prihlásenie pre skenovanie vstupeniek</p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-gray-900 p-6 shadow-xl"
      >
        <div className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-gray-300">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-xl border border-gray-700 bg-gray-800 px-4 text-base text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="vas@email.sk"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-gray-300">
                Heslo
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-gray-400 underline-offset-2 active:text-brand"
              >
                Zabudli ste heslo?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 w-full rounded-xl border border-gray-700 bg-gray-800 px-4 pr-12 text-base text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 active:text-white"
                aria-label={showPass ? 'Skryť heslo' : 'Zobraziť heslo'}
              >
                {showPass ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0 1 12 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 0 1 1.563-3.029m5.858.908a3 3 0 1 1 4.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88 6.59 6.59m7.532 7.532 3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0 1 12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 0 1-4.132 4.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-900/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 h-13 w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-50 active:bg-brand-dark"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Prihlasovanie…
              </span>
            ) : 'Prihlásiť sa'}
          </button>
        </div>
      </form>

      <p className="mt-6 text-xs text-gray-600">TicketAll Scanner v1.0</p>
    </div>
  );
}
