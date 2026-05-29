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
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Prihlásenie</h1>
          <p className="mt-1 text-sm text-gray-500">Váš zákaznícky účet Maxiticket</p>
        </div>
        {resetSuccess && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            Heslo bolo úspešne zmenené. Prihláste sa novým heslom.
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input id="email" label="E-mail" type="email" autoComplete="email"
            error={errors.email?.message} {...register('email')} />
          <PasswordInput id="password" label="Heslo" autoComplete="current-password"
            error={errors.password?.message} {...register('password')} />
          <div className="text-right -mt-1">
            <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-indigo-600 hover:underline">
              Zabudli ste heslo?
            </Link>
          </div>
          {serverError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">Prihlásiť sa</Button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-500">
          Nemáte účet?{' '}
          <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="text-indigo-600 hover:underline">
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
