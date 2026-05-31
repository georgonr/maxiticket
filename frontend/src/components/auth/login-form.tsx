'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { setAccessToken } from '@/lib/auth';
import { getReadableError } from '@/lib/api-errors';

const schema = z.object({
  email: z.string().email('Neplatný e-mail'),
  password: z.string().min(1, 'Zadajte heslo'),
});

type Fields = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
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
      if (!res.ok) {
        setServerError(getReadableError({ endpoint: 'login', status: res.status, code: json.message }));
        return;
      }
      setAccessToken(json.accessToken);
      router.push('/dashboard');
    } catch {
      setServerError(getReadableError({ endpoint: 'login' }));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        id="email" label="E-mail" type="email" autoComplete="email"
        error={errors.email?.message} {...register('email')}
      />
      <PasswordInput
        id="password" label="Heslo" autoComplete="current-password"
        error={errors.password?.message} {...register('password')}
      />
      <div className="text-right -mt-2">
        <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-brand hover:underline">
          Zabudli ste heslo?
        </Link>
      </div>
      {serverError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        Prihlásiť sa
      </Button>
    </form>
  );
}
