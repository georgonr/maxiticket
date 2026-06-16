'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.ticketall.eu';
const schema = z.object({ email: z.string().email('Neplatný e-mail') });
type Fields = z.infer<typeof schema>;

interface Props { isAdmin: boolean }

export function ForgotPasswordForm({ isAdmin }: Props) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: Fields) {
    setLoading(true);
    try {
      // Krok 31e2: flat route (mimo next-intl providera) → locale z cookie staff prepínača, inak sk.
      const m = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )mt_staff_lang=(sk|en|cs)/) : null;
      const locale = m ? m[1] : 'sk';
      await fetch(`${API}/v1/auth/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, locale }),
      });
    } catch { /* always show success */ }
    setDone(true);
    setLoading(false);
  }

  const backHref = isAdmin ? '/login' : '/account/login';
  const subtitle = isAdmin ? 'TicketAll Admin portál' : 'Zákaznícky účet TicketAll';
  const description = isAdmin
    ? 'Zadajte e-mail k vášmu Admin účtu.'
    : 'Zadajte e-mail k vášmu zákazníckemu účtu.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Zabudnuté heslo</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>

        {done ? (
          <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
            <p className="font-medium">E-mail bol odoslaný</p>
            <p className="mt-1 text-green-600">Ak účet existuje, dostanete odkaz na reset hesla (platný 1 hodinu).</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">{description} Pošleme vám odkaz na nastavenie nového hesla.</p>
            <Input id="email" label="E-mail" type="email" autoComplete="email"
              error={errors.email?.message} {...register('email')} />
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Odoslať odkaz
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-gray-500">
          <Link href={backHref} className={isAdmin ? 'text-brand hover:underline' : 'text-indigo-600 hover:underline'}>
            ← Späť na prihlásenie
          </Link>
        </p>
      </div>
    </div>
  );
}
