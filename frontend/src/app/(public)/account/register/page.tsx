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
import { Button } from '@/components/ui/button';

const schema = z.object({
  firstName: z.string().min(2, 'Min. 2 znaky'),
  lastName: z.string().min(2, 'Min. 2 znaky'),
  email: z.string().email('Neplatný e-mail'),
  password: z.string().min(8, 'Min. 8 znakov'),
  phone: z.string().optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Musíte súhlasiť s podmienkami' }) }),
});
type Fields = z.infer<typeof schema>;

function RegisterContent() {
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
      const res = await fetch('/api/auth/register-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setServerError(json.message ?? 'Chyba registrácie'); return; }
      setAccessToken(json.accessToken);
      await refresh();
      router.push(next);
    } catch {
      setServerError('Nepodarilo sa spojiť so serverom');
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Registrácia</h1>
          <p className="mt-1 text-sm text-gray-500">Vytvorte zákaznícky účet Maxiticket</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input id="firstName" label="Meno" error={errors.firstName?.message} {...register('firstName')} />
            <Input id="lastName" label="Priezvisko" error={errors.lastName?.message} {...register('lastName')} />
          </div>
          <Input id="email" label="E-mail" type="email" autoComplete="email"
            error={errors.email?.message} {...register('email')} />
          <Input id="password" label="Heslo" type="password" autoComplete="new-password"
            error={errors.password?.message} {...register('password')} />
          <Input id="phone" label="Telefón (voliteľné)" type="tel"
            error={errors.phone?.message} {...register('phone')} />

          <label className="flex items-start gap-2 cursor-pointer mt-1">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" {...register('acceptTerms')} />
            <span className="text-sm text-gray-600">
              Súhlasím s{' '}
              <Link href="#" className="text-indigo-600 hover:underline">obchodnými podmienkami</Link>
              {' '}a spracovaním osobných údajov
            </span>
          </label>
          {errors.acceptTerms && <p className="text-xs text-red-600">{errors.acceptTerms.message}</p>}

          {serverError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full mt-1">Zaregistrovať sa</Button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-500">
          Máte účet?{' '}
          <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="text-indigo-600 hover:underline">
            Prihláste sa
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}
