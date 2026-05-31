'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { getReadableError } from '@/lib/api-errors';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.ticketall.eu';

const schema = z.object({
  newPassword: z.string()
    .min(8, 'Min. 8 znakov')
    .regex(/[A-Z]/, 'Aspoň jedno veľké písmeno')
    .regex(/[0-9]/, 'Aspoň jedna číslica'),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, {
  message: 'Heslá sa nezhodujú',
  path: ['confirm'],
});
type Fields = z.infer<typeof schema>;

interface Props { isAdmin: boolean }

function ResetForm({ isAdmin }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(schema),
  });

  const loginHref = isAdmin ? '/login?reset=1' : '/account/login?reset=1';
  const forgotHref = isAdmin ? '/forgot-password' : '/forgot-password';

  if (!token) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-700">
        Neplatný odkaz na reset hesla.{' '}
        <Link href={forgotHref} className="underline">Požiadať znova</Link>
      </div>
    );
  }

  async function onSubmit(data: Fields) {
    setLoading(true);
    setServerError('');
    try {
      const res = await fetch(`${API}/v1/auth/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setServerError(getReadableError({ endpoint: 'password-reset', status: res.status, code: json.message }));
        setLoading(false);
        return;
      }
      router.push(loginHref);
    } catch {
      setServerError(getReadableError({ endpoint: 'password-reset' }));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <PasswordInput id="newPassword" label="Nové heslo" autoComplete="new-password"
        error={errors.newPassword?.message} {...register('newPassword')} />
      <p className="text-xs text-gray-400 -mt-2">Min. 8 znakov, aspoň 1 veľké písmeno a 1 číslica</p>
      <PasswordInput id="confirm" label="Potvrdenie hesla" autoComplete="new-password"
        error={errors.confirm?.message} {...register('confirm')} />
      {serverError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
      <Button type="submit" size="lg" loading={loading} className="w-full">
        Nastaviť nové heslo
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ isAdmin }: Props) {
  const backHref = isAdmin ? '/login' : '/account/login';
  const subtitle = isAdmin ? 'TicketAll Admin portál' : 'Zákaznícky účet TicketAll';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Nové heslo</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <Suspense>
          <ResetForm isAdmin={isAdmin} />
        </Suspense>
        <p className="mt-5 text-center text-sm text-gray-500">
          <Link href={backHref} className={isAdmin ? 'text-brand hover:underline' : 'text-indigo-600 hover:underline'}>
            ← Späť na prihlásenie
          </Link>
        </p>
      </div>
    </div>
  );
}
