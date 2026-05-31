'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { setAccessToken } from '@/lib/auth';
import { getReadableError } from '@/lib/api-errors';

const schema = z.object({
  firstName: z.string().min(2, 'Min 2 znaky'),
  lastName: z.string().min(2, 'Min 2 znaky'),
  email: z.string().email('Neplatný e-mail'),
  password: z.string().min(8, 'Min 8 znakov'),
  organizerName: z.string().min(2, 'Min 2 znaky'),
  organizerSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Len malé písmená, číslice a pomlčky'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Musíte prijať podmienky' }) }),
});

type Fields = z.infer<typeof schema>;

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Fields>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: Fields) {
    setServerError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(getReadableError({ endpoint: 'register-organizer', status: res.status, code: json.message }));
        return;
      }
      setAccessToken(json.accessToken);
      router.push('/organizer/dashboard');
    } catch {
      setServerError(getReadableError({ endpoint: 'register-organizer' }));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input id="firstName" label="Meno" error={errors.firstName?.message} {...register('firstName')} />
        <Input id="lastName" label="Priezvisko" error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <Input id="email" label="E-mail" type="email" error={errors.email?.message} {...register('email')} />
      <PasswordInput
        id="password" label="Heslo" autoComplete="new-password"
        error={errors.password?.message} {...register('password')}
      />
      <Input id="organizerName" label="Názov organizátora" error={errors.organizerName?.message} {...register('organizerName')} />
      <Input
        id="organizerSlug" label="URL slug (napr. moj-festival)"
        error={errors.organizerSlug?.message} {...register('organizerSlug')}
      />
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" className="mt-0.5 accent-brand" {...register('acceptTerms')} />
        <span>
          Súhlasím s{' '}
          <a href="#" className="text-brand underline">obchodnými podmienkami</a>
          {' '}a spracovaním osobných údajov.
        </span>
      </label>
      {errors.acceptTerms && <p className="text-xs text-red-600">{errors.acceptTerms.message}</p>}
      {serverError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Vytvoriť účet
      </Button>
    </form>
  );
}
