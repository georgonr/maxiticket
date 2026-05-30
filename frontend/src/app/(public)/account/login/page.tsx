'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { setAccessToken } from '@/lib/auth';
import { usePublicAuth } from '@/lib/public-auth';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Neplatný e-mail'),
  password: z.string().min(1, 'Zadajte heslo'),
});
type Fields = z.infer<typeof schema>;

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/account/tickets';
  const { refresh } = usePublicAuth();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Fields>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: Fields) {
    setServerError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setServerError(json.message ?? 'Chyba prihlásenia'); return; }
      setAccessToken(json.accessToken);
      await refresh();
      router.push(next);
    } catch {
      setServerError('Nepodarilo sa spojiť so serverom');
    }
  }

  const resetSuccess = params.get('reset');

  return (
    <div className="flex min-h-[72vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-700 shadow-lg">
            <span className="text-lg font-extrabold text-white">MT</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Prihlásenie</h1>
          <p className="mt-1 text-sm text-slate-500">Váš zákaznícky účet TicketAll</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {resetSuccess && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
              Heslo bolo úspešne zmenené. Prihláste sa novým heslom.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <div>
              <PasswordInput
                id="password"
                label="Heslo"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />
              <div className="mt-1.5 text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs text-slate-400 hover:text-purple-700 transition-colors"
                >
                  Zabudli ste heslo?
                </Link>
              </div>
            </div>

            {serverError && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <Button type="submit" size="lg" loading={isSubmitting} className="w-full mt-1">
              Prihlásiť sa
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Nemáte účet?{' '}
          <Link
            href={`/account/register?next=${encodeURIComponent(next)}`}
            className="font-medium text-purple-700 hover:text-purple-600 hover:underline transition-colors"
          >
            Zaregistrujte sa
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
